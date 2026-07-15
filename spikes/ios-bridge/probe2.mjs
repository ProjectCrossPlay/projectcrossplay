#!/usr/bin/env node
/** Probe 2: what do rows on the General screen actually look like? */
const udid = process.argv[2];
const BASE = 'http://127.0.0.1:8100';
import { spawn } from 'node:child_process';

async function wda(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

spawn('xcrun', ['simctl', 'launch', udid, 'com.facebook.WebDriverAgentRunner.xctrunner'], { stdio: 'ignore' });
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  try { if ((await fetch(`${BASE}/status`, { signal: AbortSignal.timeout(1000) })).ok) ready = true; }
  catch { await new Promise((r) => setTimeout(r, 500)); }
}

const session = await wda('POST', '/session', {
  capabilities: { alwaysMatch: { bundleId: 'com.apple.Preferences', shouldWaitForQuiescence: false } },
});
const sid = session.value?.sessionId ?? session.sessionId;

const gen = await wda('POST', `/session/${sid}/elements`, {
  using: 'predicate string',
  value: "label == 'General' AND type == 'XCUIElementTypeButton'",
});
await wda('POST', `/session/${sid}/element/${Object.values(gen.value[0])[0]}/click`, {});
await new Promise((r) => setTimeout(r, 2000));

const source = await wda('GET', `/session/${sid}/source`);
for (const line of source.value.split('\n')) {
  const t = line.trim();
  if (t.startsWith('<XCUIElementTypeButton') || t.includes('About')) console.log(t.slice(0, 220));
}
await wda('DELETE', `/session/${sid}`).catch(() => {});
spawn('xcrun', ['simctl', 'terminate', udid, 'com.facebook.WebDriverAgentRunner.xctrunner'], { stdio: 'ignore' });
process.exit(0);
