/**
 * @projectcrossplay/driver-android (B-030, FR-020–022, ADR-002) — UIAutomator2
 * without an Appium server: ADBManager readies the device, AndroidBridge talks
 * HTTP to the reused appium-uiautomator2-server APK over an adb forward.
 *
 * Session lifecycle (spike finding #3): one UIA2 session per instrumentation
 * run — launch starts instrumentation + session, dispose deletes the session
 * (which kills instrumentation) and removes the forward. Server APKs install
 * once per device (FR-022); measured startup after that is ~1.6s (budget 10s).
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  CrossPlayError,
  type AndroidTargetOptions,
  type DriverAction,
  type DriverSession,
  type ElementHandle,
  type ElementState,
  type LaunchContext,
  type PlatformDriver,
  type TargetConfig,
  type UnifiedSelector,
} from '@projectcrossplay/core';
import { ADBManager, freePort, SERVER_DEVICE_PORT } from './adb.js';
import { AndroidBridge, BridgeError } from './bridge.js';
import { toQueries } from './selectors.js';

export { ADBManager } from './adb.js';
export { AndroidBridge } from './bridge.js';
export { toQueries } from './selectors.js';

/** Server readiness ceiling — generous vs the ~1.6s measured, hard NFR-003 is 10s. */
const SERVER_READY_TIMEOUT_MS = 30_000;

export const driver: PlatformDriver = {
  platform: 'android',

  async launch(target: TargetConfig, ctx: LaunchContext): Promise<DriverSession> {
    const use = target.use as AndroidTargetOptions;
    if (!use?.apk && !use?.appId) {
      throw new CrossPlayError({
        what: `target '${target.name}' has neither apk nor appId`,
        next: [`set targets.${target.name}.use.apk (path to the APK) or use.appId (installed package)`],
      });
    }

    const adb = await ADBManager.locate();
    const serial = await adb.pickDevice(use.device);
    ctx.log(`device: ${serial}`);

    // The server APKs ship with our pinned appium-uiautomator2-server dependency.
    const require = createRequire(import.meta.url);
    const apksDir = join(dirname(require.resolve('appium-uiautomator2-server/package.json')), 'apks');
    await adb.ensureServerInstalled(serial, apksDir, ctx.log);

    const appId = use.appId ?? (await adb.resolveAppId(use.apk!));
    if (use.apk && !(await adb.isInstalled(serial, appId))) {
      ctx.log(`installing ${appId}`);
      await adb.install(serial, use.apk);
    }

    // Clean slate: a stale instrumentation from a crashed run would hold 6790.
    await adb.killStaleServer(serial);
    const localPort = await freePort();
    await adb.forward(serial, localPort, SERVER_DEVICE_PORT);

    const bridge = new AndroidBridge(`http://127.0.0.1:${localPort}/wd/hub`);
    const instrumentation = adb.startInstrumentation(serial);

    const session = new AndroidSession(adb, bridge, serial, appId, localPort, instrumentation);
    // Register cleanup before the risky part so a mid-launch crash still unwinds (NFR-014).
    ctx.onDispose(() => session.dispose());

    const t0 = Date.now();
    await bridge.waitUntilReady(SERVER_READY_TIMEOUT_MS);
    await bridge.createSession();
    ctx.log(`UIA2 session up in ${Date.now() - t0}ms`);

    await adb.startApp(serial, appId, use.activity);
    return session;
  },
};

export default driver;

class AndroidSession implements DriverSession {
  private disposed = false;

  constructor(
    private readonly adb: ADBManager,
    private readonly bridge: AndroidBridge,
    private readonly serial: string,
    private readonly appId: string,
    private readonly localPort: number,
    private readonly instrumentation: { stop: () => Promise<void> },
  ) {}

  async findElements(selector: UnifiedSelector): Promise<ElementHandle[]> {
    const seen = new Set<string>();
    for (const q of toQueries(selector)) {
      try {
        for (const id of await this.bridge.findElements(q.strategy, q.selector)) seen.add(id);
      } catch (e) {
        // "no such element" style responses mean zero matches, not failure.
        if (!(e instanceof BridgeError)) throw e;
      }
    }
    return [...seen].map((id) => ({ id }));
  }

  async getElementState(el: ElementHandle): Promise<ElementState> {
    try {
      const [displayed, enabled, rect] = await Promise.all([
        this.bridge.elementAttribute(el.id, 'displayed'),
        this.bridge.elementAttribute(el.id, 'enabled'),
        this.bridge.elementRect(el.id),
      ]);
      return {
        present: true,
        visible: displayed === 'true',
        enabled: enabled === 'true',
        bounds: rect,
      };
    } catch (e) {
      if (e instanceof BridgeError && e.isStaleElement) {
        return { present: false, visible: false, enabled: false, bounds: null };
      }
      throw e;
    }
  }

  async performAction(el: ElementHandle, action: DriverAction): Promise<void> {
    switch (action.kind) {
      case 'tap':
        return this.bridge.click(el.id);
      case 'fill':
        // fill = replace (same semantics as the web driver)
        await this.bridge.clear(el.id);
        return this.bridge.sendKeys(el.id, action.value);
      case 'clear':
        return this.bridge.clear(el.id);
    }
  }

  async getText(el: ElementHandle): Promise<string> {
    return this.bridge.text(el.id);
  }

  captureState(kind: 'screenshot'): Promise<Uint8Array>;
  captureState(kind: 'hierarchy'): Promise<string>;
  async captureState(kind: 'screenshot' | 'hierarchy'): Promise<Uint8Array | string> {
    return kind === 'screenshot' ? this.bridge.screenshot() : this.bridge.source();
  }

  /** Escape hatch (FR-003): the bridge itself — raw UIA2 protocol access. */
  native<T>(): T {
    return this.bridge as unknown as T;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.bridge.deleteSession(); // kills instrumentation (spike finding #3)
    await this.instrumentation.stop(); // fallback if the session never existed
    await this.adb.removeForward(this.serial, this.localPort);
    await this.adb.forceStop(this.serial, this.appId);
  }
}
