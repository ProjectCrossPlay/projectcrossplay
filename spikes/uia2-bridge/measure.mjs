/**
 * Spike B-004: validate ADR-002 latency budget against a live emulator.
 * Measures: server ready (from instrumentation start) → session create →
 * find element → click round-trip → hierarchy dump → screenshot.
 * Budget (FR-022): session startup ≤ 10s after APKs installed.
 */
import { spawn } from 'node:child_process';

const BASE_CANDIDATES = ['http://127.0.0.1:6790/wd/hub', 'http://127.0.0.1:6790'];
const now = () => performance.now();
const results = {};

// 1. Start instrumentation (the "session startup" clock starts here)
const t0 = now();
const instr = spawn('adb', [
  'shell', 'am', 'instrument', '-w',
  'io.appium.uiautomator2.server.test/androidx.test.runner.AndroidJUnitRunner',
], { stdio: 'ignore', detached: true });
instr.unref();

// 2. Poll /status until the server answers (adaptive backoff, like the real bridge will)
let base = null;
let delay = 50;
while (now() - t0 < 30_000) {
  for (const b of BASE_CANDIDATES) {
    try {
      const r = await fetch(`${b}/status`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) { base = b; break; }
    } catch { /* not up yet */ }
  }
  if (base) break;
  await new Promise((res) => setTimeout(res, delay));
  delay = Math.min(delay * 1.5, 300);
}
if (!base) { console.error('FAIL: server never became ready'); process.exit(1); }
results.serverReadyMs = Math.round(now() - t0);

async function call(method, path, body) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  return r.json();
}

// 3. Create session
let t = now();
const sess = await call('POST', '/session', {
  capabilities: { firstMatch: [{}], alwaysMatch: {} },
});
const sid = sess.value?.sessionId ?? sess.sessionId;
if (!sid) { console.error('FAIL: no session:', JSON.stringify(sess).slice(0, 300)); process.exit(1); }
results.sessionCreateMs = Math.round(now() - t);
results.totalStartupMs = results.serverReadyMs + results.sessionCreateMs;

// 4. Find an element (Settings screen has TextViews)
t = now();
const found = await call('POST', `/session/${sid}/element`, {
  using: 'class name', value: 'android.widget.TextView',
});
const elId = found.value?.ELEMENT ?? found.value?.['element-6066-11e4-a52e-4f735466cecf'];
results.findElementMs = Math.round(now() - t);

// 5. Click round-trip
if (elId) {
  t = now();
  await call('POST', `/session/${sid}/element/${elId}/click`, {});
  results.clickMs = Math.round(now() - t);
}

// 6. Hierarchy dump (trace failure snapshot path)
t = now();
const src = await call('GET', `/session/${sid}/source`);
results.hierarchyMs = Math.round(now() - t);
results.hierarchyBytes = (src.value ?? '').length;

// 7. Screenshot (trace per-step path)
t = now();
const shot = await call('GET', `/session/${sid}/screenshot`);
results.screenshotMs = Math.round(now() - t);
results.screenshotKb = Math.round(((shot.value ?? '').length * 3) / 4 / 1024);

await call('DELETE', `/session/${sid}`);
results.base = base;
results.budgetPass = results.totalStartupMs <= 10_000;
console.log('B-004 RESULTS ' + JSON.stringify(results, null, 2));
