/**
 * ADBManager (architecture §3.4): device discovery, APK install, app
 * lifecycle, port-forward lifecycle. Everything shells out to adb — no root,
 * least privilege (NFR-016); forwards bind 127.0.0.1 by adb's design.
 */
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { CrossPlayError } from '@projectcrossplay/core';

const exec = promisify(execFile);

export const SERVER_PKG = 'io.appium.uiautomator2.server';
export const SERVER_TEST_PKG = 'io.appium.uiautomator2.server.test';
export const SERVER_DEVICE_PORT = 6790;
const INSTRUMENTATION = `${SERVER_TEST_PKG}/androidx.test.runner.AndroidJUnitRunner`;

function sdkRoots(): string[] {
  return [
    process.env['ANDROID_HOME'],
    process.env['ANDROID_SDK_ROOT'],
    join(process.env['HOME'] ?? '', 'Library', 'Android', 'sdk'), // macOS default
    join(process.env['HOME'] ?? '', 'Android', 'Sdk'), // Linux default
  ].filter((p): p is string => !!p && existsSync(p));
}

export class ADBManager {
  private constructor(readonly adbPath: string) {}

  static async locate(): Promise<ADBManager> {
    const candidates = ['adb', ...sdkRoots().map((r) => join(r, 'platform-tools', 'adb'))];
    for (const candidate of candidates) {
      try {
        await exec(candidate, ['--version']);
        return new ADBManager(candidate);
      } catch {
        // try next
      }
    }
    throw new CrossPlayError({
      what: 'adb not found',
      why: ['looked on PATH, $ANDROID_HOME, $ANDROID_SDK_ROOT, and the default SDK locations'],
      next: ['install Android platform-tools, or set ANDROID_HOME', 'then verify: crossplay doctor'],
    });
  }

  private async run(serial: string | null, args: string[], timeoutMs = 30_000): Promise<string> {
    const full = serial ? ['-s', serial, ...args] : args;
    const { stdout } = await exec(this.adbPath, full, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  }

  async listDevices(): Promise<string[]> {
    const out = await this.run(null, ['devices']);
    return out
      .split('\n')
      .slice(1)
      .filter((l) => l.trim().endsWith('device'))
      .map((l) => l.split('\t')[0]!.trim());
  }

  /** FR-021: explicit serial, or exactly one connected device. */
  async pickDevice(serial?: string): Promise<string> {
    const devices = await this.listDevices();
    if (serial) {
      if (!devices.includes(serial)) {
        throw new CrossPlayError({
          what: `device '${serial}' is not connected`,
          why: [devices.length > 0 ? `connected: ${devices.join(', ')}` : 'no devices connected'],
          next: ['check the serial with: adb devices'],
        });
      }
      return serial;
    }
    if (devices.length === 1) return devices[0]!;
    throw new CrossPlayError({
      what: devices.length === 0 ? 'no device or emulator detected' : `${devices.length} devices connected, none selected`,
      why: devices.length > 0 ? [`connected: ${devices.join(', ')}`] : [],
      next:
        devices.length === 0
          ? ['start an emulator:  emulator -avd <name>', 'or plug in a device with USB debugging enabled']
          : ['set targets.<name>.use.device to one of the serials above'],
    });
  }

  async isInstalled(serial: string, pkg: string): Promise<boolean> {
    try {
      const out = await this.run(serial, ['shell', 'pm', 'path', pkg]);
      return out.includes('package:');
    } catch {
      return false;
    }
  }

  async install(serial: string, apkPath: string): Promise<void> {
    if (!existsSync(apkPath)) {
      throw new CrossPlayError({
        what: `APK not found: ${apkPath}`,
        next: ['check targets.<name>.use.apk in crossplay.config.ts'],
      });
    }
    // -r reinstall, -t allow test APKs, -g grant runtime permissions
    await this.run(serial, ['install', '-r', '-t', '-g', apkPath], 120_000);
  }

  /** Install the two UIA2 server APKs if missing (one-time per device, FR-022). */
  async ensureServerInstalled(serial: string, apksDir: string, log: (m: string) => void): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(apksDir);
    } catch {
      throw new CrossPlayError({
        what: 'bundled UIAutomator2 server APKs not found',
        why: [`${apksDir} is missing or unreadable`],
        next: ['reinstall @projectcrossplay/driver-android (its appium-uiautomator2-server dependency ships them)'],
      });
    }
    const serverApk = entries.find((f) => f.endsWith('.apk') && !f.includes('androidTest'));
    const testApk = entries.find((f) => f.endsWith('.apk') && f.includes('androidTest'));
    if (!serverApk || !testApk) {
      throw new CrossPlayError({
        what: 'bundled UIAutomator2 server APKs not found',
        why: [`looked in ${apksDir}`],
        next: ['reinstall @projectcrossplay/driver-android (its appium-uiautomator2-server dependency ships them)'],
      });
    }
    if (!(await this.isInstalled(serial, SERVER_PKG))) {
      log('installing UIAutomator2 server APK (one-time)');
      await this.install(serial, join(apksDir, serverApk));
    }
    if (!(await this.isInstalled(serial, SERVER_TEST_PKG))) {
      log('installing UIAutomator2 instrumentation APK (one-time)');
      await this.install(serial, join(apksDir, testApk));
    }
  }

  /**
   * Start the UIA2 instrumentation. Long-lived: resolves when spawned, not
   * when ready — readiness is the bridge's /status poll. Returns a stop
   * handle; the process also dies when the session is deleted (spike finding
   * #3), so stop() is a fallback, not the primary shutdown path.
   */
  startInstrumentation(serial: string): { stop: () => Promise<void> } {
    const child = spawn(this.adbPath, ['-s', serial, 'shell', 'am', 'instrument', '-w', INSTRUMENTATION], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    return {
      stop: async () => {
        try {
          await this.run(serial, ['shell', 'am', 'force-stop', SERVER_TEST_PKG]);
          await this.run(serial, ['shell', 'am', 'force-stop', SERVER_PKG]);
        } catch {
          // device may already be gone
        }
      },
    };
  }

  /** Kill any stale server instrumentation from a previous crashed run. */
  async killStaleServer(serial: string): Promise<void> {
    try {
      await this.run(serial, ['shell', 'am', 'force-stop', SERVER_TEST_PKG]);
      await this.run(serial, ['shell', 'am', 'force-stop', SERVER_PKG]);
    } catch {
      // best effort
    }
  }

  async forward(serial: string, localPort: number, devicePort: number): Promise<void> {
    await this.run(serial, ['forward', `tcp:${localPort}`, `tcp:${devicePort}`]);
  }

  async removeForward(serial: string, localPort: number): Promise<void> {
    try {
      await this.run(serial, ['forward', '--remove', `tcp:${localPort}`]);
    } catch {
      // forward may already be gone (adb restart, device unplugged)
    }
  }

  /** Fresh app state per session: force-stop, then launch. */
  async startApp(serial: string, appId: string, activity?: string): Promise<void> {
    await this.run(serial, ['shell', 'am', 'force-stop', appId]);
    let component: string;
    if (activity) {
      component = activity.includes('/') ? activity : `${appId}/${activity}`;
    } else {
      // API 24+: resolve the launcher activity on-device (no aapt needed).
      const out = await this.run(serial, [
        'shell', 'cmd', 'package', 'resolve-activity', '--brief',
        '-c', 'android.intent.category.LAUNCHER', appId,
      ]);
      const resolved = out.trim().split('\n').map((l) => l.trim()).find((l) => l.includes('/'));
      if (!resolved || resolved.includes('No activity found')) {
        throw new CrossPlayError({
          what: `no launcher activity found for '${appId}'`,
          next: [`set targets.<name>.use.activity to the activity to start`],
        });
      }
      component = resolved;
    }
    await this.run(serial, ['shell', 'am', 'start', '-W', '-n', component]);
  }

  async forceStop(serial: string, appId: string): Promise<void> {
    try {
      await this.run(serial, ['shell', 'am', 'force-stop', appId]);
    } catch {
      // best effort during teardown
    }
  }

  /** Read the package id from an APK via aapt/aapt2 from the SDK build-tools. */
  async resolveAppId(apkPath: string): Promise<string> {
    for (const root of sdkRoots()) {
      const buildTools = join(root, 'build-tools');
      if (!existsSync(buildTools)) continue;
      // Numeric-aware descending sort: lexicographic sort would rank "9.0.0"
      // above "34.0.0" and pick the wrong "latest" build-tools directory.
      const versions = (await readdir(buildTools)).sort((a, b) =>
        b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }),
      );
      for (const v of versions) {
        for (const tool of ['aapt2', 'aapt']) {
          const bin = join(buildTools, v, tool);
          if (!existsSync(bin)) continue;
          try {
            const { stdout } = await exec(bin, ['dump', 'badging', apkPath], { maxBuffer: 8 * 1024 * 1024 });
            const m = stdout.match(/package: name='([^']+)'/);
            if (m) return m[1]!;
          } catch {
            // try the next tool/version
          }
        }
      }
    }
    throw new CrossPlayError({
      what: `could not determine the application id of ${apkPath}`,
      why: ['aapt/aapt2 not found in any SDK build-tools directory'],
      next: [`set targets.<name>.use.appId explicitly in crossplay.config.ts`],
    });
  }
}

/** OS-assigned free port for the adb forward (parallel runs never collide). */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}
