/**
 * crossplay test (FR-062, wireframe C3): runs the spec suite via Vitest
 * (ADR-001) once per target, sequentially. Target selection reaches core's
 * globalSetup through CROSSPLAY_TARGET; the config file itself is only ever
 * imported inside Vitest, where TypeScript configs load natively.
 *
 * `--target all` needs the target names up front, which means importing the
 * config from the CLI process: native import handles .js/.mjs configs on all
 * supported Node versions and .ts configs on Node >= 23 (type stripping).
 * Where that fails we ask for explicit names — a clear error over magic.
 */
import { readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Vitest } from 'vitest/node';
import { dim, FAIL, OK, seconds } from './ui.js';

interface TargetResult {
  target: string;
  passed: number;
  failed: number;
  durationMs: number;
}

export async function testCmd(opts: { target?: string; config?: string; json?: boolean }): Promise<number> {
  const requested = opts.target ?? '';
  let targets: string[];
  if (requested === '' || requested === 'all') {
    const names = await readTargetNames(opts.config);
    if (names === null) {
      console.error(
        [
          `${FAIL} cannot read target names from crossplay.config.ts on Node ${process.versions.node}`,
          '  importing TypeScript config files outside the test runner needs Node >= 23',
          '  → pass targets explicitly: crossplay test --target <name>[,<name>…]',
        ].join('\n'),
      );
      return 1;
    }
    if (names.length === 0) {
      console.error(`${FAIL} no targets configured — add one to crossplay.config.ts`);
      return 1;
    }
    targets = requested === 'all' ? names : [names[0]!];
  } else {
    targets = requested.split(',').map((t) => t.trim()).filter(Boolean);
  }

  const startedAt = Date.now();
  const results: TargetResult[] = [];
  for (const target of targets) {
    results.push(await runTarget(target, opts));
  }

  const totalPassed = results.reduce((n, r) => n + r.passed, 0);
  const totalFailed = results.reduce((n, r) => n + r.failed, 0);

  if (opts.json) {
    console.log(JSON.stringify({ targets: results, passed: totalPassed, failed: totalFailed }, null, 2));
  } else {
    console.log(
      `\n${totalFailed > 0 ? FAIL : OK} ${totalPassed} passed, ${totalFailed} failed (${seconds(Date.now() - startedAt)})`,
    );
    await printTraceHint(startedAt);
  }
  return totalFailed;
}

async function runTarget(target: string, opts: { config?: string }): Promise<TargetResult> {
  console.log(`\n─── target: ${target} ${'─'.repeat(Math.max(0, 50 - target.length))}\n`);
  process.env['CROSSPLAY_TARGET'] = target;
  if (opts.config) process.env['CROSSPLAY_CONFIG'] = opts.config;

  const require = createRequire(import.meta.url);
  const globalSetup = require.resolve('@projectcrossplay/core/global-setup');

  const { startVitest } = await import('vitest/node');
  const t0 = Date.now();
  const vitest: Vitest = await startVitest('test', [], {
    watch: false,
    globalSetup: [globalSetup],
    // A test spans several auto-waited actions (30s budget each, FR-042) plus
    // session launch; Vitest's 5s default would cut real runs short.
    testTimeout: 120_000,
    hookTimeout: 60_000,
  });
  await vitest.close();

  let passed = 0;
  let failed = 0;
  for (const mod of vitest.state.getTestModules()) {
    for (const t of mod.children.allTests()) {
      const state = t.result().state;
      if (state === 'passed') passed++;
      else if (state === 'failed') failed++;
    }
  }
  return { target, passed, failed, durationMs: Date.now() - t0 };
}

/** Try to read target names by importing the config from this process. */
async function readTargetNames(configPath?: string): Promise<string[] | null> {
  const candidates = configPath
    ? [resolve(configPath)]
    : ['crossplay.config.js', 'crossplay.config.mjs', 'crossplay.config.ts', 'crossplay.config.mts'].map((c) => resolve(c));
  for (const path of candidates) {
    try {
      await stat(path);
    } catch {
      continue;
    }
    try {
      const mod = (await import(pathToFileURL(path).href)) as { default?: { targets?: Record<string, unknown> } };
      return Object.keys(mod.default?.targets ?? {});
    } catch {
      return null; // found but not importable from this process (TS on old Node)
    }
  }
  return null;
}

/** C3: end the run with a copy-pasteable trace pointer. */
async function printTraceHint(sinceMs: number): Promise<void> {
  const dir = join(process.cwd(), '.crossplay', 'traces');
  try {
    const fresh: string[] = [];
    for (const f of await readdir(dir)) {
      if (!f.endsWith('.trace')) continue;
      const s = await stat(join(dir, f));
      if (s.mtimeMs >= sinceMs) fresh.push(join('.crossplay', 'traces', f));
    }
    if (fresh.length > 0) {
      console.log(`Trace${fresh.length > 1 ? 's' : ''} saved: ${fresh.length > 1 ? `${fresh.length} files in .crossplay/traces/` : fresh[0]}`);
      console.log(dim(`  → crossplay show-trace ${fresh[fresh.length - 1]}`));
    }
  } catch {
    // no traces dir — nothing to hint at
  }
}
