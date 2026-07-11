/**
 * crossplay doctor (FR-061, wireframe C1): one line per check, indented fix
 * lines (3-part contract), exit code = number of blocking (✖) failures.
 * ⚠ never blocks — Android tooling is optional until you test Android.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { FAIL, OK, WARN } from './ui.js';

const exec = promisify(execFile);

export type Status = 'ok' | 'warn' | 'fail';

export interface Check {
  name: string;
  status: Status;
  detail: string;
  fixes: string[];
}

export interface DoctorResult {
  checks: Check[];
  blocking: number;
  optional: number;
}

/**
 * Pure check computation, no console output — split out from `doctor()` so
 * callers that need the structured data (the MCP `crossplay_doctor` tool,
 * B-105-03) can get it directly instead of scraping the CLI's own stdout.
 */
export async function runDoctorChecks(): Promise<DoctorResult> {
  const checks: Check[] = [];

  // Node.js
  const [major] = process.versions.node.split('.').map(Number);
  checks.push(
    major !== undefined && major >= 20
      ? { name: 'Node.js', status: 'ok', detail: `v${process.versions.node}  (>= 20 required)`, fixes: [] }
      : {
          name: 'Node.js',
          status: 'fail',
          detail: `v${process.versions.node} — 20 or newer required`,
          fixes: ['install Node 20+: https://nodejs.org or `nvm install 20`'],
        },
  );

  // Config
  const configFile = ['crossplay.config.ts', 'crossplay.config.mts', 'crossplay.config.js', 'crossplay.config.mjs'].find(
    (c) => existsSync(c),
  );
  checks.push(
    configFile
      ? { name: 'Config', status: 'ok', detail: `${configFile} found`, fixes: [] }
      : { name: 'Config', status: 'fail', detail: 'no crossplay.config.{ts,mts,js,mjs} in this directory', fixes: ['run: crossplay init'] },
  );

  // Web driver + browsers
  const req = createRequire(join(process.cwd(), 'package.json'));
  let playwright: typeof import('playwright') | null = null;
  try {
    // playwright is a dependency of the driver, not of the user's project
    // (pnpm-strict): resolve the driver from the project, then playwright
    // from the driver.
    let pwPath: string;
    try {
      pwPath = req.resolve('playwright');
    } catch {
      const driverPath = req.resolve('@projectcrossplay/driver-web');
      pwPath = createRequire(driverPath).resolve('playwright');
    }
    const mod = (await import(new URL(`file://${pwPath}`).href)) as
      | typeof import('playwright')
      | { default: typeof import('playwright') };
    playwright = 'default' in mod && mod.default ? mod.default : (mod as typeof import('playwright'));
  } catch {
    checks.push({
      name: 'Web driver',
      status: 'warn',
      detail: 'playwright not installed (only needed for web targets)',
      fixes: ['pnpm add -D @projectcrossplay/driver-web'],
    });
  }
  if (playwright) {
    for (const engine of ['chromium', 'firefox', 'webkit'] as const) {
      const path = playwright[engine].executablePath();
      checks.push(
        path && existsSync(path)
          ? { name: `Browser: ${engine}`, status: 'ok', detail: 'installed', fixes: [] }
          : {
              name: `Browser: ${engine}`,
              status: 'warn',
              detail: 'not installed (needed for this engine only)',
              fixes: [`npx playwright install ${engine}`],
            },
      );
    }
  }

  // ADB + device (optional until an Android target is exercised)
  const adbCandidates = [
    'adb',
    ...(process.env['ANDROID_HOME'] ? [join(process.env['ANDROID_HOME'], 'platform-tools', 'adb')] : []),
    join(process.env['HOME'] ?? '', 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
  ];
  let adb: string | null = null;
  for (const candidate of adbCandidates) {
    try {
      const { stdout } = await exec(candidate, ['--version']);
      adb = candidate;
      const version = stdout.match(/version ([\d.]+)/)?.[1] ?? '?';
      checks.push({ name: 'ADB', status: 'ok', detail: `${version}    (${candidate})`, fixes: [] });
      break;
    } catch {
      // try next candidate
    }
  }
  if (!adb) {
    checks.push({
      name: 'ADB',
      status: 'warn',
      detail: 'not found (only needed for Android targets)',
      fixes: ['install Android platform-tools, or set ANDROID_HOME'],
    });
  } else {
    try {
      const { stdout } = await exec(adb, ['devices']);
      const devices = stdout.split('\n').slice(1).filter((l) => l.trim().endsWith('device'));
      checks.push(
        devices.length > 0
          ? { name: 'Device', status: 'ok', detail: `${devices.length} device(s) connected`, fixes: [] }
          : {
              name: 'Device',
              status: 'warn',
              detail: 'no device or emulator detected (needed for Android runs)',
              fixes: ['start an emulator:  emulator -avd <name>', 'or plug in a device with USB debugging enabled, then run:  adb devices'],
            },
      );
    } catch {
      // adb devices failing is covered by the ADB check above
    }
  }

  const blocking = checks.filter((c) => c.status === 'fail').length;
  const optional = checks.filter((c) => c.status === 'warn').length;

  return { checks, blocking, optional };
}

export async function doctor(opts: { json?: boolean }): Promise<number> {
  const { checks, blocking, optional } = await runDoctorChecks();

  if (opts.json) {
    console.log(JSON.stringify({ checks, blocking, optional }, null, 2));
    return blocking;
  }

  console.log('\nCrossPlay doctor — checking your environment\n');
  const symbols: Record<Status, string> = { ok: OK, warn: WARN, fail: FAIL };
  for (const c of checks) {
    console.log(`  ${symbols[c.status]} ${c.name.padEnd(18)} ${c.detail}`);
    for (const fix of c.fixes) console.log(`      → ${fix}`);
  }
  console.log('');
  if (blocking > 0) {
    console.log(
      `${blocking} problem${blocking > 1 ? 's' : ''} block${blocking === 1 ? 's' : ''} testing` +
        (optional > 0 ? `, ${optional} optional` : '') +
        `. Fix ✖ items and re-run: crossplay doctor`,
    );
  } else {
    console.log(optional > 0 ? `Ready (with ${optional} optional note${optional > 1 ? 's' : ''}). Next: crossplay test --target=web` : 'Ready. Next: crossplay test --target=web');
  }
  return blocking;
}
