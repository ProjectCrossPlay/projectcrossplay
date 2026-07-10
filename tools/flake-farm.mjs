#!/usr/bin/env node
/**
 * Flake farm (B-035, G2/NFR-001): run the demo suite N consecutive times
 * against one target and report the flake rate. Release gate: 0 failures in
 * 50 consecutive emulator runs.
 *
 * Usage: node tools/flake-farm.mjs --target android-kotlin [--runs 50] [--cwd examples/demo-web]
 * Exit code = number of failed runs, capped at 255 (POSIX range) — the exact
 * count is always in stdout and the report JSON. Report written to
 * flake-report-<target>.json.
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = args[i + 1];
  // Missing value (flag was last arg) or the "value" is actually the next
  // flag (e.g. `--runs --cwd x`) — both mean no value was given.
  return value !== undefined && !value.startsWith('--') ? value : fallback;
}

const target = opt('target');
const runs = Number(opt('runs', '50'));
const cwd = resolve(opt('cwd', 'examples/demo-web'));
if (!target || !Number.isInteger(runs) || runs < 1) {
  console.error('usage: node tools/flake-farm.mjs --target <name> [--runs 50] [--cwd examples/demo-web]');
  if (target && !(Number.isInteger(runs) && runs >= 1)) {
    console.error(`  --runs must be a positive integer, got '${opt('runs', '50')}'`);
  }
  process.exit(2);
}

const results = [];
for (let i = 1; i <= runs; i++) {
  const t0 = Date.now();
  const code = await new Promise((res) => {
    const child = spawn('node', [resolve('packages/cli/dist/index.js'), 'test', '--target', target], {
      cwd,
      stdio: 'ignore',
      // Traces accumulate under <cwd>/.crossplay/traces — clear before long
      // farms, or set trace: 'retain-on-failure' in the target config.
    });
    child.on('close', res);
  });
  const durationMs = Date.now() - t0;
  results.push({ run: i, pass: code === 0, durationMs });
  console.log(`run ${String(i).padStart(3)}/${runs}  ${code === 0 ? '✔' : '✖ FAIL'}  ${(durationMs / 1000).toFixed(1)}s`);
}

const failed = results.filter((r) => !r.pass).length;
const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
const report = {
  target,
  runs,
  failed,
  flakeRate: failed / runs,
  p50Ms: durations[Math.floor((runs - 1) * 0.5)],
  p95Ms: durations[Math.floor((runs - 1) * 0.95)],
  maxMs: durations[runs - 1],
  finishedAt: new Date().toISOString(),
  results,
};
const out = `flake-report-${target}.json`;
await writeFile(out, JSON.stringify(report, null, 2));
console.log(`\n${failed === 0 ? '✔' : '✖'} ${runs - failed}/${runs} runs passed (flake rate ${(report.flakeRate * 100).toFixed(1)}%) — p50 ${(report.p50Ms / 1000).toFixed(1)}s, p95 ${(report.p95Ms / 1000).toFixed(1)}s`);
console.log(`report: ${out}`);
process.exit(Math.min(failed, 255));
