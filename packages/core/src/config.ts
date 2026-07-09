/**
 * crossplay.config.ts shape (architecture §4). Config is user-authored code —
 * same trust level as the spec itself (threat model §6); it is validated for
 * shape, not sanitized.
 */
import type { TargetConfig } from './driver.js';
import { CrossPlayError } from './errors.js';
import type { CrossPlayReporter } from './reporter.js';

export interface TargetDef {
  /** 'web' | 'android' | any platform a driver package provides. */
  platform: string;
  /**
   * Driver package to load (B-021). Defaults by platform:
   * web → @projectcrossplay/driver-web, android → @projectcrossplay/driver-android.
   * Community drivers set this explicitly.
   */
  driver?: string;
  /** Platform options, passed to the driver verbatim (baseURL/browser, apk/device…). */
  use: Record<string, unknown>;
}

export interface CrossPlayConfig {
  targets: Record<string, TargetDef>;
  /** Global action timeout in ms (FR-042). Default 30_000. */
  timeout?: number;
  /** 'on' (default): trace every run (FR-050). 'retain-on-failure': keep failures only. */
  trace?: 'on' | 'retain-on-failure';
  /** Where .trace files land. Default '.crossplay/traces'. */
  traceDir?: string;
  /** Reporter seam (FR-071). Empty in v0.1. */
  reporters?: CrossPlayReporter[];
}

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_TRACE_DIR = '.crossplay/traces';

/** Identity helper for typed configs (mirrors Vitest/Playwright convention). */
export function defineConfig(config: CrossPlayConfig): CrossPlayConfig {
  return config;
}

/** Validate shape + resolve one named target into the driver-facing TargetConfig. */
export function resolveTarget(config: CrossPlayConfig, name: string): TargetConfig & { driver?: string } {
  const targets = config.targets ?? {};
  const def = targets[name];
  if (!def) {
    const known = Object.keys(targets);
    throw new CrossPlayError({
      what: `unknown target '${name}'`,
      why: [known.length > 0 ? `configured targets: ${known.join(', ')}` : 'no targets configured'],
      next: [`add '${name}' to targets in crossplay.config.ts, or pick one of the configured names`],
    });
  }
  if (typeof def.platform !== 'string' || def.platform === '') {
    throw new CrossPlayError({
      what: `target '${name}' has no platform`,
      next: [`set targets.${name}.platform to 'web' or 'android'`],
    });
  }
  const resolved: TargetConfig & { driver?: string } = {
    name,
    platform: def.platform,
    use: (def.use ?? {}) as unknown as TargetConfig['use'],
  };
  if (def.driver !== undefined) resolved.driver = def.driver;
  return resolved;
}
