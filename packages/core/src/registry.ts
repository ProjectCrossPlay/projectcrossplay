/**
 * Driver registry (B-021, FR-004): drivers are separate packages loaded by
 * config. Resolution happens from the user's project (cwd), not from core —
 * the user installs the driver package; core never depends on any driver.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PlatformDriver, TargetConfig } from './driver.js';
import { CrossPlayError } from './errors.js';

const BUILTIN_DRIVERS: Record<string, string> = {
  web: '@projectcrossplay/driver-web',
  android: '@projectcrossplay/driver-android',
};

export async function loadDriver(target: TargetConfig & { driver?: string }): Promise<PlatformDriver> {
  const pkg = target.driver ?? BUILTIN_DRIVERS[target.platform];
  if (!pkg) {
    throw new CrossPlayError({
      what: `no driver known for platform '${target.platform}'`,
      why: [`built-in platforms: ${Object.keys(BUILTIN_DRIVERS).join(', ')}`],
      next: [`set targets.${target.name}.driver to the driver package name`],
    });
  }

  let resolved: string;
  try {
    // Resolve from the user's project so community drivers are found where
    // the user installed them (pnpm-strict safe).
    resolved = createRequire(join(process.cwd(), 'package.json')).resolve(pkg);
  } catch {
    throw new CrossPlayError({
      what: `driver package '${pkg}' is not installed`,
      why: [`needed by target '${target.name}' (platform '${target.platform}')`],
      next: [`pnpm add -D ${pkg}`],
    });
  }

  const mod = (await import(pathToFileURL(resolved).href)) as {
    default?: PlatformDriver;
    driver?: PlatformDriver;
  };
  const driver = mod.driver ?? mod.default;
  if (!driver || typeof driver.launch !== 'function' || typeof driver.platform !== 'string') {
    throw new CrossPlayError({
      what: `'${pkg}' does not export a PlatformDriver`,
      why: [`expected an export named 'driver' (or default) with { platform, launch() }`],
      next: ['check the driver package version matches @projectcrossplay/core'],
    });
  }
  if (driver.platform !== target.platform) {
    throw new CrossPlayError({
      what: `driver/platform mismatch for target '${target.name}'`,
      why: [`config says platform '${target.platform}', but '${pkg}' implements '${driver.platform}'`],
      next: [`fix targets.${target.name}.platform or point 'driver' at the right package`],
    });
  }
  return driver;
}
