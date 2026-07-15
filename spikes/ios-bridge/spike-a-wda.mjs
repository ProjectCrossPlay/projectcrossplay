#!/usr/bin/env node
/**
 * Spike A (B-200): WebDriverAgent baseline for the iOS bridge decision (Q1).
 * Mirrors spikes/uia2-bridge exactly: hand-written zero-dependency client
 * over fetch — no Appium client library, no WebDriver npm package. Measures
 * the numbers ADR-005 needs:
 *
 *   1. server ready:   xcodebuild test-without-building spawn → GET /status OK
 *   2. session create: POST /session (bundleId) → response
 *   3. find element:   POST /session/:id/elements (predicate)
 *   4. tap:            POST /session/:id/element/:el/click
 *   5. type + read:    /element/:el/value then GET /element/:el/text
 *   6. hierarchy:      GET /session/:id/source (viewer-relevant payload size)
 *
 * Target app: Settings (com.apple.Preferences) — preinstalled on every
 * simulator, so the spike needs no app build of its own.
 *
 * Usage: node spike-a-wda.mjs <simulator-udid> [xctestrun-path]
 * Assumes WDA already built via build-for-testing (the one-time cost is
 * reported separately in RESULTS.md, not folded into per-session numbers —
 * same split as Android's "server APKs install once per device").
 */
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';

const udid = process.argv[2];
if (!udid) {
  console.error('usage: node spike-a-wda.mjs <simulator-udid> [xctestrun-path]');
  process.exit(1);
}
const derived = '/tmp/wda-derived/Build/Products';
const xctestrun =
  process.argv[3] ?? `${derived}/${readdirSync(derived).find((f) => f.endsWith('.xctestrun'))}`;

const BASE = 'http://127.0.0.1:8100';
const t = () => Date.now();
const timings = {};

async function wda(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

// ---- 1. spawn WDA (server-ready window) --------------------------------
// Tuned path: launch the already-installed runner app directly via simctl
// (the community-documented "preinstalled WDA" optimization) instead of
// going through xcodebuild test-without-building, whose own overhead
// measured ~9-16s in this spike's earlier runs. `--mode=all` isn't needed;
// the xctrunner app hosts the HTTP server itself when launched this way.
// Fallback: pass USE_XCODEBUILD=1 to measure the untuned path.
console.log(`xctestrun: ${xctestrun}`);
const t0 = t();
const proc = process.env.USE_XCODEBUILD
  ? spawn('xcodebuild', ['test-without-building', '-xctestrun', xctestrun, '-destination', `id=${udid}`], {
      stdio: 'ignore',
      detached: false,
    })
  : spawn('xcrun', ['simctl', 'launch', udid, 'com.facebook.WebDriverAgentRunner.xctrunner'], {
      stdio: 'ignore',
      detached: false,
    });
process.on('exit', () => {
  proc.kill('SIGTERM');
  if (!process.env.USE_XCODEBUILD) {
    spawn('xcrun', ['simctl', 'terminate', udid, 'com.facebook.WebDriverAgentRunner.xctrunner'], { stdio: 'ignore' });
  }
});

let ready = false;
for (let i = 0; i < 240 && !ready; i++) {
  try {
    const s = await fetch(`${BASE}/status`, { signal: AbortSignal.timeout(1000) });
    if (s.ok) ready = true;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!ready) {
  console.error('WDA never became ready within 120s');
  process.exit(1);
}
timings.serverReadyMs = t() - t0;
console.log(`server ready: ${timings.serverReadyMs}ms`);

// ---- 2. create session on Settings -------------------------------------
const t1 = t();
const session = await wda('POST', '/session', {
  // shouldWaitForQuiescence:false — CrossPlay's core owns all waiting (the
  // driver contract's rule #1), so WDA's own settle-wait is redundant here
  // and measured ~5-6s of the 7s session cost in this spike's earlier runs.
  capabilities: { alwaysMatch: { bundleId: 'com.apple.Preferences', shouldWaitForQuiescence: false } },
});
const sid = session.value?.sessionId ?? session.sessionId;
timings.sessionCreateMs = t() - t1;
console.log(`session created: ${timings.sessionCreateMs}ms (sid ${sid})`);

// ---- 3. find element (the General row) ----------------------------------
const t2 = t();
// iOS 18's SwiftUI Settings exposes rows as Buttons, not Cells (probed, not
// assumed — see probe.mjs). Element also carries a stable name
// ("com.apple.settings.general"), the accessibilityIdentifier analog.
const found = await wda('POST', `/session/${sid}/elements`, {
  using: 'predicate string',
  value: "label == 'General' AND type == 'XCUIElementTypeButton'",
});
const elId = Object.values(found.value[0])[0];
timings.findMs = t() - t2;
console.log(`find element: ${timings.findMs}ms (${found.value.length} match(es))`);

// ---- 4. tap --------------------------------------------------------------
const t3 = t();
await wda('POST', `/session/${sid}/element/${elId}/click`, {});
timings.tapMs = t() - t3;
console.log(`tap: ${timings.tapMs}ms`);

// ---- 5. verify navigation by reading the About row on the General screen -
// Poll-until-found, mirroring core's auto-wait (drivers never wait; the
// spike stands in for core here): the nav animation takes ~0.5s and WDA
// correctly returns zero matches until the destination screen settles.
const t4 = t();
// Key spike finding (probe2.mjs): iOS 18 Settings MIXES element types
// across screens — root rows are Buttons (SwiftUI), General-screen rows
// are Cells (UIKit). Exactly the multi-slot variance FR-213's N-query
// merge pattern anticipated; the compound predicate below is what the
// real driver's role-mapping will effectively do.
let about = { value: [] };
for (let i = 0; i < 20 && about.value.length === 0; i++) {
  about = await wda('POST', `/session/${sid}/elements`, {
    using: 'predicate string',
    value: "label == 'About' AND (type == 'XCUIElementTypeCell' OR type == 'XCUIElementTypeButton')",
  });
  if (about.value.length === 0) await new Promise((r) => setTimeout(r, 250));
}
if (about.value.length === 0) throw new Error('About row never appeared after tapping General');
const aboutId = Object.values(about.value[0])[0];
const text = await wda('GET', `/session/${sid}/element/${aboutId}/text`);
timings.findAndReadMs = t() - t4;
console.log(`find+read after nav: ${timings.findAndReadMs}ms -> "${text.value}"`);

// ---- 6. hierarchy dump size (trace/viewer relevance) ----------------------
const t5 = t();
const source = await wda('GET', `/session/${sid}/source`);
timings.hierarchyMs = t() - t5;
timings.hierarchyBytes = JSON.stringify(source.value).length;
console.log(`hierarchy: ${timings.hierarchyMs}ms, ${timings.hierarchyBytes} bytes`);

// ---- teardown -------------------------------------------------------------
await wda('DELETE', `/session/${sid}`).catch(() => {});
proc.kill('SIGTERM');

console.log('\nRESULTS', JSON.stringify(timings, null, 2));
console.log(
  `\nheadline: server-ready ${timings.serverReadyMs}ms + session ${timings.sessionCreateMs}ms = ${
    timings.serverReadyMs + timings.sessionCreateMs
  }ms total cold start (Android baseline: 1,567ms; budget: 10,000ms)`,
);
process.exit(0);
