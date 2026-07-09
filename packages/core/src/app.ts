/**
 * The `app` object (B-020, FR-001) — the unified action surface handed to
 * every test. Semantics are identical on every platform by construction:
 * each action runs core's auto-wait (wait.ts), delegates one primitive to the
 * driver, and records one trace step (screenshot on every step, hierarchy
 * dump added on failure — FR-050/052).
 */
import type { DriverSession, UnifiedSelector } from './driver.js';
import { CrossPlayError, type WaitLogEntry } from './errors.js';
import type { ReporterDispatcher } from './reporter.js';
import type { TraceWriter } from './trace.js';
import { waitFor } from './wait.js';

export const MASKED_VALUE = '•••••••';

export interface AppOptions {
  timeout: number;
  spec: string;
  trace: TraceWriter | null;
  reporters: ReporterDispatcher;
  platform: string;
}

export class App {
  /** True once any step failed — drives retain-on-failure (config.trace). */
  hadFailure = false;

  constructor(
    private readonly session: DriverSession,
    private readonly opts: AppOptions,
  ) {}

  /** Semantically unified: tap on Android, click on web (FR-001). */
  async tap(selector: UnifiedSelector): Promise<void> {
    await this.step('tap', selector, async (el) => {
      await this.session.performAction(el, { kind: 'tap' });
    });
  }

  /** Alias of tap for web-minded readers. */
  async click(selector: UnifiedSelector): Promise<void> {
    return this.tap(selector);
  }

  /**
   * Fill a text field. The value is masked in the trace by default (NFR-017);
   * pass { mask: false } to opt out for non-sensitive fields.
   */
  async fill(selector: UnifiedSelector, value: string, opts?: { mask?: boolean }): Promise<void> {
    const mask = opts?.mask !== false;
    await this.step(
      'fill',
      selector,
      async (el) => {
        await this.session.performAction(el, { kind: 'fill', value, mask });
      },
      { value: mask ? MASKED_VALUE : value, masked: mask },
    );
  }

  async getText(selector: UnifiedSelector): Promise<string> {
    return this.step('getText', selector, (el) => this.session.getText(el));
  }

  /** Wait until the element is visible (FR-001); no action performed. */
  async waitFor(selector: UnifiedSelector): Promise<void> {
    await this.step('waitFor', selector, async () => {}, { until: 'visible' });
  }

  /** Capture a screenshot as its own trace step; returns the PNG bytes. */
  async screenshot(): Promise<Uint8Array> {
    const t0 = this.opts.trace?.now() ?? 0;
    const png = await this.session.captureState('screenshot');
    await this.opts.trace?.addStep({
      action: 'screenshot',
      status: 'passed',
      t0,
      t1: this.opts.trace.now(),
      screenshot: png,
    });
    return png;
  }

  /** Navigate (web only in v0.1). Android tests express flows via interactions. */
  async goto(url: string): Promise<void> {
    if (!this.session.navigate) {
      throw new CrossPlayError({
        what: `goto() is not supported on platform '${this.opts.platform}'`,
        why: ['navigation applies to web targets; native apps start at their launch screen'],
        next: ['drive the app through taps, or use app.native<T>() for platform-specific control'],
      });
    }
    const navigate = this.session.navigate.bind(this.session);
    const t0 = this.opts.trace?.now() ?? 0;
    try {
      await navigate(url);
      await this.recordStep({ action: `goto ${url}`, status: 'passed', t0 });
    } catch (e) {
      this.hadFailure = true;
      await this.recordStep({ action: `goto ${url}`, status: 'failed', t0, error: String(e) });
      throw e;
    }
  }

  /** Escape hatch (FR-003): raw platform object, caller-asserted type. */
  native<T>(): T {
    return this.session.native<T>();
  }

  /**
   * One traced step: auto-wait → driver primitive → screenshot. On failure,
   * capture failure context (screenshot + hierarchy, FR-052) and rethrow.
   */
  private async step<T>(
    action: string,
    selector: UnifiedSelector,
    run: (el: import('./driver.js').ElementHandle) => Promise<T>,
    extra?: { value?: string; masked?: boolean; until?: 'visible' },
  ): Promise<T> {
    const t0 = this.opts.trace?.now() ?? 0;
    const started = Date.now();
    let waitLog: WaitLogEntry[] | undefined;
    try {
      const waited = await waitFor(this.session, selector, {
        timeout: this.opts.timeout,
        ...(extra?.until ? { until: extra.until } : {}),
      });
      waitLog = waited.waitLog;
      const result = await run(waited.el);
      await this.recordStep({
        action,
        selector,
        status: 'passed',
        t0,
        ...(extra?.value !== undefined ? { value: extra.value } : {}),
        ...(extra?.masked !== undefined ? { masked: extra.masked } : {}),
        ...(waitLog ? { waitLog } : {}),
      });
      this.opts.reporters.emit({
        kind: 'step',
        spec: this.opts.spec,
        action,
        status: 'passed',
        durationMs: Date.now() - started,
      });
      return result;
    } catch (e) {
      this.hadFailure = true;
      if (e instanceof CrossPlayError && 'waitLog' in e) waitLog = e.waitLog as WaitLogEntry[];
      await this.recordStep({
        action,
        selector,
        status: 'failed',
        t0,
        error: e instanceof Error ? e.message : String(e),
        ...(waitLog ? { waitLog } : {}),
        withHierarchy: true,
      });
      this.opts.reporters.emit({
        kind: 'step',
        spec: this.opts.spec,
        action,
        status: 'failed',
        durationMs: Date.now() - started,
      });
      throw e;
    }
  }

  private async recordStep(opts: {
    action: string;
    selector?: UnifiedSelector;
    status: 'passed' | 'failed';
    t0: number;
    value?: string;
    masked?: boolean;
    waitLog?: WaitLogEntry[];
    error?: string;
    withHierarchy?: boolean;
  }): Promise<void> {
    if (!this.opts.trace) return;
    // Trace capture must never mask the original failure — best-effort only.
    let screenshot: Uint8Array | undefined;
    let hierarchy: { data: string; ext: 'html' | 'xml' } | undefined;
    try {
      screenshot = await this.session.captureState('screenshot');
      if (opts.withHierarchy) {
        hierarchy = {
          data: await this.session.captureState('hierarchy'),
          ext: this.opts.platform === 'web' ? 'html' : 'xml',
        };
      }
    } catch {
      // session may already be unusable at failure time — keep what we have
    }
    const { withHierarchy: _ignored, ...step } = opts;
    await this.opts.trace.addStep({
      ...step,
      t1: this.opts.trace.now(),
      ...(screenshot ? { screenshot } : {}),
      ...(hierarchy ? { hierarchy } : {}),
    });
  }
}
