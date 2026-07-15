#!/usr/bin/env node
/**
 * Spike A final run: WDA with per-action settle-waits disabled
 * (waitForIdleTimeout/animationCoolOffTimeout → 0 via /appium/settings).
 * Rationale: CrossPlay core owns ALL waiting (driver contract rule #1) —
 * WDA's server-side idle-waits duplicate what core's auto-wait loop does,
 * so the fair comparison for ADR-005 is WDA with them off.
 * Also completes the fill leg: type into Settings' search field, read back.
 */
import { spawn } from 'node:child_process';

const udid = process.argv[2];
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

const t0 = t();
const proc = spawn('xcrun', ['simctl', 'launch', udid, 'com.facebook.WebDriverAgentRunner.xctrunner'], { stdio: 'ignore' });
process.on('exit', () => {
  proc.kill('SIGTERM');
  spawn('xcrun', ['simctl', 'terminate', udid, 'com.facebook.WebDriverAgentRunner.xctrunner'], { stdio: 'ignore' });
});
let ready = false;
for (let i = 0; i < 240 && !ready; i++) {
  try { if ((await fetch(`${BASE}/status`, { signal: AbortSignal.timeout(1000) })).ok) ready = true; }
  catch { await new Promise((r) => setTimeout(r, 500)); }
}
timings.serverReadyMs = t() - t0;

const t1 = t();
const session = await wda('POST', '/session', {
  capabilities: { alwaysMatch: { bundleId: 'com.apple.Preferences', shouldWaitForQuiescence: false } },
});
const sid = session.value?.sessionId ?? session.sessionId;
timings.sessionCreateMs = t() - t1;

// Disable WDA's own settle-waits — core owns waiting.
await wda('POST', `/session/${sid}/appium/settings`, {
  settings: { waitForIdleTimeout: 0, animationCoolOffTimeout: 0 },
});

// find + tap (General row)
const t2 = t();
const gen = await wda('POST', `/session/${sid}/elements`, {
  using: 'predicate string',
  value: "label == 'General' AND type == 'XCUIElementTypeButton'",
});
timings.findMs = t() - t2;
const t3 = t();
await wda('POST', `/session/${sid}/element/${Object.values(gen.value[0])[0]}/click`, {});
timings.tapMs = t() - t3;

// poll-find + read (About row on General screen — Cell type there, probed)
const t4 = t();
let about = { value: [] };
for (let i = 0; i < 20 && about.value.length === 0; i++) {
  about = await wda('POST', `/session/${sid}/elements`, {
    using: 'predicate string',
    value: "label == 'About' AND (type == 'XCUIElementTypeCell' OR type == 'XCUIElementTypeButton')",
  });
  if (about.value.length === 0) await new Promise((r) => setTimeout(r, 250));
}
const text = await wda('GET', `/session/${sid}/element/${Object.values(about.value[0])[0]}/text`);
timings.findAndReadMs = t() - t4;
if (text.value !== 'About') throw new Error(`read mismatch: ${text.value}`);

// fill leg: go back, tap the search field, type, read back
await wda('POST', `/session/${sid}/element/${
  Object.values((await wda('POST', `/session/${sid}/elements`, { using: 'predicate string', value: "label == 'Settings' AND type == 'XCUIElementTypeButton'" })).value[0])[0]
}/click`, {});
const t5 = t();
let search = { value: [] };
for (let i = 0; i < 20 && search.value.length === 0; i++) {
  search = await wda('POST', `/session/${sid}/elements`, {
    using: 'class name',
    value: 'XCUIElementTypeSearchField',
  });
  if (search.value.length === 0) await new Promise((r) => setTimeout(r, 250));
}
const searchId = Object.values(search.value[0])[0];
await wda('POST', `/session/${sid}/element/${searchId}/click`, {});
await wda('POST', `/session/${sid}/element/${searchId}/value`, { value: ['W', 'i'] });
const typed = await wda('GET', `/session/${sid}/element/${searchId}/text`);
timings.fillAndReadMs = t() - t5;
if (typed.value !== 'Wi') throw new Error(`fill mismatch: "${typed.value}"`);

// screenshot (trace-relevant)
const t6 = t();
const shot = await wda('GET', `/session/${sid}/screenshot`);
timings.screenshotMs = t() - t6;
timings.screenshotBytes = Math.round((shot.value.length * 3) / 4);

await wda('DELETE', `/session/${sid}`).catch(() => {});
console.log('TUNED RESULTS', JSON.stringify(timings, null, 2));
console.log(`headline: server ${timings.serverReadyMs}ms + session ${timings.sessionCreateMs}ms = ${timings.serverReadyMs + timings.sessionCreateMs}ms; fill verified ("Wi" read back)`);
process.exit(0);
