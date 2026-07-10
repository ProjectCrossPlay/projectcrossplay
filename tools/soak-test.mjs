#!/usr/bin/env node
/**
 * Soak/leak validation (B-043, NFR-013/014): repeatedly launch → interact →
 * dispose a real driver session in one process and sample heap usage each
 * cycle. This targets the driver/session/dispose lifecycle directly (browser
 * contexts, ADB connections, UIA2 sessions, file handles) rather than
 * spawning N subprocesses (flake-farm's job) — a subprocess-per-run design
 * can never observe an in-process leak, since each run gets a fresh heap.
 *
 * Verdict: compare the median heap of the first third of runs (after a
 * short warm-up) against the last third. Bounded memory tolerates GC-driven
 * fluctuation; a real leak shows as sustained growth between those windows.
 *
 * Usage: node --expose-gc tools/soak-test.mjs --target chromium [--runs 30] [--cwd examples/demo-web]
 * Report written to soak-report-<target>.json. Exit code 0 (bounded) or 1 (growth detected).
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = args[i + 1];
  return value !== undefined && !value.startsWith('--') ? value : fallback;
}

const target = opt('target');
const runs = Number(opt('runs', '30'));
const cwd = resolve(opt('cwd', 'examples/demo-web'));
const WARMUP = Math.max(2, Math.floor(runs * 0.1));
const GROWTH_THRESHOLD = 1.5; // last-third median > 1.5x first-third median => probable leak

if (!target || !Number.isInteger(runs) || runs < WARMUP * 3) {
  console.error(`usage: node --expose-gc tools/soak-test.mjs --target <name> [--runs 30] [--cwd examples/demo-web]`);
  console.error(`  --runs must be large enough for warmup + two comparison windows (>= ${WARMUP * 3} here)`);
  process.exit(2);
}
if (typeof global.gc !== 'function') {
  console.error('warning: run with --expose-gc for a reliable signal (heap samples are noisier without forced GC)');
}

// Report goes next to wherever this was invoked from (matches flake-farm.mjs),
// captured before the chdir below moves us into the target's project.
const invokedFrom = process.cwd();

// loadDriver() resolves driver packages relative to process.cwd() (it looks
// up the caller's project, same as the CLI does) — must match cwd for real.
process.chdir(cwd);

const core = await import(pathToFileURL(resolve(cwd, 'node_modules/@projectcrossplay/core/dist/index.js')).href);
const { resolveTarget, loadDriver, DisposeScope, by } = core;

const configMod = await import(pathToFileURL(resolve(cwd, 'crossplay.config.ts')).href);
const targetConfig = resolveTarget(configMod.default, target);

const samples = [];
for (let i = 0; i < runs; i++) {
  const scope = new DisposeScope();
  try {
    const driver = await loadDriver(targetConfig);
    const session = await driver.launch(targetConfig, {
      timeout: 30_000,
      onDispose: (fn) => scope.add(fn),
      log: () => {},
    });
    // Minimal realistic interaction so real resources (page/context,
    // ADB forward, UIA2 session) are actually exercised, not just opened.
    const [el] = await session.findElements(by.role('heading'));
    if (el) await session.getElementState(el);
    await session.captureState('screenshot');
  } finally {
    await scope.dispose();
  }
  if (global.gc) global.gc();
  await new Promise((r) => setTimeout(r, 50));
  const heapUsed = process.memoryUsage().heapUsed;
  samples.push(heapUsed);
  console.log(`run ${String(i + 1).padStart(3)}/${runs}  heapUsed=${(heapUsed / 1024 / 1024).toFixed(1)}MB`);
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const afterWarmup = samples.slice(WARMUP);
const windowSize = Math.floor(afterWarmup.length / 3);
const firstWindow = afterWarmup.slice(0, windowSize);
const lastWindow = afterWarmup.slice(-windowSize);
const firstMedian = median(firstWindow);
const lastMedian = median(lastWindow);
const growth = lastMedian / firstMedian;
const leaked = growth > GROWTH_THRESHOLD;

const report = {
  target,
  runs,
  warmup: WARMUP,
  firstWindowMedianMB: +(firstMedian / 1024 / 1024).toFixed(2),
  lastWindowMedianMB: +(lastMedian / 1024 / 1024).toFixed(2),
  growthRatio: +growth.toFixed(3),
  threshold: GROWTH_THRESHOLD,
  leaked,
  samples,
  finishedAt: new Date().toISOString(),
};
const out = resolve(invokedFrom, `soak-report-${target}.json`);
await writeFile(out, JSON.stringify(report, null, 2));
console.log(
  `\n${leaked ? '✖' : '✔'} heap growth ${growth.toFixed(2)}× (first-third median ${report.firstWindowMedianMB}MB → last-third ${report.lastWindowMedianMB}MB, threshold ${GROWTH_THRESHOLD}×)`,
);
console.log(`report: ${out}`);
process.exit(leaked ? 1 : 0);
