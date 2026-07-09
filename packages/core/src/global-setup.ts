/**
 * Vitest globalSetup (the runner adapter's config half, ADR-001).
 *
 * Runs inside Vitest's node process, where TS config files import cleanly.
 * Loads crossplay.config.ts, resolves the target named by CROSSPLAY_TARGET
 * (set by the CLI, or defaulting to the only configured target), and provides
 * the serializable runtime to test workers via Vitest's provide/inject.
 *
 * Non-serializable config (reporters, FR-071) is re-loaded inside the worker
 * from the provided configPath.
 */
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { TestProject } from 'vitest/node';
import { type CrossPlayConfig, DEFAULT_TIMEOUT_MS, DEFAULT_TRACE_DIR, resolveTarget } from './config.js';
import type { TargetConfig } from './driver.js';
import { CrossPlayError } from './errors.js';

export interface ProvidedRuntime {
  configPath: string;
  targetName: string;
  target: TargetConfig & { driver?: string };
  timeout: number;
  trace: 'on' | 'retain-on-failure';
  traceDir: string;
}

declare module 'vitest' {
  interface ProvidedContext {
    crossplay: ProvidedRuntime;
  }
}

const CONFIG_CANDIDATES = ['crossplay.config.ts', 'crossplay.config.mts', 'crossplay.config.js', 'crossplay.config.mjs'];

export async function loadConfigFile(explicitPath?: string): Promise<{ path: string; config: CrossPlayConfig }> {
  let path: string | undefined;
  if (explicitPath) {
    path = isAbsolute(explicitPath) ? explicitPath : resolve(process.cwd(), explicitPath);
    if (!existsSync(path)) {
      throw new CrossPlayError({
        what: `config file not found: ${explicitPath}`,
        next: ['check the path, or run crossplay init to scaffold one'],
      });
    }
  } else {
    path = CONFIG_CANDIDATES.map((c) => resolve(process.cwd(), c)).find((p) => existsSync(p));
    if (!path) {
      throw new CrossPlayError({
        what: 'no crossplay.config.ts found',
        why: [`looked for ${CONFIG_CANDIDATES.join(', ')} in ${process.cwd()}`],
        next: ['run: crossplay init'],
      });
    }
  }
  const mod = (await import(pathToFileURL(path).href)) as { default?: CrossPlayConfig };
  if (!mod.default || typeof mod.default !== 'object') {
    throw new CrossPlayError({
      what: `${path} has no default export`,
      next: ["export default defineConfig({ targets: { … } }) from '@projectcrossplay/core'"],
    });
  }
  return { path, config: mod.default };
}

export default async function globalSetup(project: TestProject): Promise<void> {
  const { path, config } = await loadConfigFile(process.env['CROSSPLAY_CONFIG']);

  const names = Object.keys(config.targets ?? {});
  let targetName = process.env['CROSSPLAY_TARGET'];
  if (!targetName) {
    if (names.length !== 1) {
      throw new CrossPlayError({
        what: 'no target selected',
        why: [names.length === 0 ? 'config has no targets' : `config has ${names.length} targets: ${names.join(', ')}`],
        next: ['run: crossplay test --target <name>'],
      });
    }
    targetName = names[0]!;
  }

  project.provide('crossplay', {
    configPath: path,
    targetName,
    target: resolveTarget(config, targetName),
    timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
    trace: config.trace ?? 'on',
    traceDir: resolve(process.cwd(), config.traceDir ?? DEFAULT_TRACE_DIR),
  });
}
