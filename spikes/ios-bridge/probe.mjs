#!/usr/bin/env node
/** Quick hierarchy probe: what does 'General' actually look like in iOS 18 Settings? */
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';

const udid = process.argv[2];
const derived = '/tmp/wda-derived/Build/Products';
const xctestrun = `${derived}/${readdirSync(derived).find((f) => f.endsWith('.xctestrun'))}`;
const BASE = 'http://127.0.0.1:8100';

async function wda(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

const t0 = Date.now();
const proc = spawn('xcodebuild', ['test-without-building', '-xctestrun', xctestrun, '-destination', `id=${udid}`], { stdio: 'ignore' });
process.on('exit', () => proc.kill('SIGTERM'));

let ready = false;
for (let i = 0; i < 240 && !ready; i++) {
  try {
    if ((await fetch(`${BASE}/status`, { signal: AbortSignal.timeout(1000) })).ok) ready = true;
  } catch { await new Promise((r) => setTimeout(r, 500)); }
}
console.log(`server ready (warm run): ${Date.now() - t0}ms`);

const t1 = Date.now();
const session = await wda('POST', '/session', { capabilities: { alwaysMatch: { bundleId: 'com.apple.Preferences' } } });
const sid = session.value?.sessionId ?? session.sessionId;
console.log(`session created (warm run): ${Date.now() - t1}ms`);

const source = await wda('GET', `/session/${sid}/source`);
const xml = source.value;
// print every line mentioning General with its element type
for (const line of xml.split('\n')) {
  if (line.includes('General')) console.log(line.trim().slice(0, 250));
}
await wda('DELETE', `/session/${sid}`).catch(() => {});
proc.kill('SIGTERM');
process.exit(0);
