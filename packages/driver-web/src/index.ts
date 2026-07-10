/**
 * @projectcrossplay/driver-web (B-023, FR-010–012) — Playwright as a library
 * behind the PlatformDriver contract. One engine per target (chromium,
 * firefox, webkit; architecture §3.3).
 *
 * Contract discipline: core owns all waiting. This driver answers state
 * queries from current reality and performs primitives with a short residual
 * timeout — Playwright's own actionability check runs as a harmless second
 * opinion on an element core already deemed actionable, never as the primary
 * wait (single source of wait truth).
 */
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type ElementHandle as PWElementHandle,
  type Page,
} from 'playwright';
import {
  CrossPlayError,
  type DriverAction,
  type DriverSession,
  type ElementHandle,
  type ElementState,
  type LaunchContext,
  type PlatformDriver,
  type TargetConfig,
  type UnifiedSelector,
  type WebTargetOptions,
} from '@projectcrossplay/core';

const ENGINES = { chromium, firefox, webkit } as const;
type EngineName = keyof typeof ENGINES;

/** Residual timeout for driver primitives — core has already waited (FR-042). */
const ACTION_RESIDUAL_TIMEOUT_MS = 5_000;

export const driver: PlatformDriver = {
  platform: 'web',

  async launch(target: TargetConfig, ctx: LaunchContext): Promise<DriverSession> {
    const use = target.use as WebTargetOptions;
    if (!use?.baseURL) {
      throw new CrossPlayError({
        what: `target '${target.name}' has no baseURL`,
        next: [`set targets.${target.name}.use.baseURL in crossplay.config.ts`],
      });
    }
    const engineName = (use.browser ?? 'chromium') as EngineName;
    const engine = ENGINES[engineName];
    if (!engine) {
      throw new CrossPlayError({
        what: `unknown browser '${use.browser}'`,
        why: [`target '${target.name}'`],
        next: [`use one of: ${Object.keys(ENGINES).join(', ')}`],
      });
    }

    ctx.log(`launching ${engineName}`);
    let browser: Browser;
    try {
      browser = await engine.launch();
    } catch (e) {
      throw new CrossPlayError({
        what: `could not launch ${engineName}`,
        why: [e instanceof Error ? e.message.split('\n')[0]! : String(e)],
        next: [`install the browser: npx playwright install ${engineName}`, 'then re-check: crossplay doctor'],
      });
    }
    const session = await WebSession.create(browser, await browser.newContext(), engineName);
    ctx.onDispose(() => session.dispose());
    await session.page.goto(use.baseURL);
    return session;
  },
};

export default driver;

/**
 * Cap on tracked element handles (NFR-013/014). Auto-wait re-queries
 * findElements() every poll by design (drivers never cache across polls),
 * so a long-running spec would otherwise grow this map without bound — well
 * past any single action's poll count (a 30s wait at the 50-200ms adaptive
 * backoff is under ~200 polls), so evicting past this cap never touches a
 * handle still in use by an in-flight action.
 */
const MAX_TRACKED_HANDLES = 500;

class WebSession implements DriverSession {
  readonly page: Page;
  private handles = new Map<string, PWElementHandle>();
  private nextId = 0;
  private disposed = false;

  constructor(
    private readonly browser: Browser,
    private readonly context: BrowserContext,
    private readonly engineName: EngineName,
  ) {
    // One page per session in v0.1; multi-page flows use native<Page>().
    this.page = null as unknown as Page;
  }

  /** Async page creation can't happen in the constructor — done by launch(). */
  static async create(browser: Browser, context: BrowserContext, engineName: EngineName): Promise<WebSession> {
    const s = new WebSession(browser, context, engineName);
    (s as { page: Page }).page = await context.newPage();
    return s;
  }

  async findElements(selector: UnifiedSelector): Promise<ElementHandle[]> {
    const locator = this.toLocator(selector);
    const pwHandles = await locator.elementHandles();
    const result = pwHandles.map((h) => {
      const id = `${this.engineName}-el-${this.nextId++}`;
      this.handles.set(id, h);
      return { id };
    });
    await this.evictOldHandles();
    return result;
  }

  /** FIFO eviction past the cap — releases the remote JS handle too, not just our own reference. */
  private async evictOldHandles(): Promise<void> {
    while (this.handles.size > MAX_TRACKED_HANDLES) {
      const oldestId = this.handles.keys().next().value;
      if (oldestId === undefined) break;
      const h = this.handles.get(oldestId);
      this.handles.delete(oldestId);
      if (h) await h.dispose().catch(() => {});
    }
  }

  async getElementState(el: ElementHandle): Promise<ElementState> {
    const h = this.handle(el);
    try {
      const attached = await h.evaluate((node: Node) => (node as unknown as { isConnected: boolean }).isConnected);
      if (!attached) return { present: false, visible: false, enabled: false, bounds: null };
      const [visible, enabled, bounds] = await Promise.all([h.isVisible(), h.isEnabled(), h.boundingBox()]);
      return { present: true, visible, enabled, bounds };
    } catch {
      // Evaluation fails when the element's frame/page navigated away.
      return { present: false, visible: false, enabled: false, bounds: null };
    }
  }

  async performAction(el: ElementHandle, action: DriverAction): Promise<void> {
    const h = this.handle(el);
    switch (action.kind) {
      case 'tap':
        return h.click({ timeout: ACTION_RESIDUAL_TIMEOUT_MS });
      case 'fill':
        return h.fill(action.value, { timeout: ACTION_RESIDUAL_TIMEOUT_MS });
      case 'clear':
        return h.fill('', { timeout: ACTION_RESIDUAL_TIMEOUT_MS });
    }
  }

  async getText(el: ElementHandle): Promise<string> {
    return this.handle(el).innerText();
  }

  captureState(kind: 'screenshot'): Promise<Uint8Array>;
  captureState(kind: 'hierarchy'): Promise<string>;
  async captureState(kind: 'screenshot' | 'hierarchy'): Promise<Uint8Array | string> {
    if (kind === 'screenshot') return this.page.screenshot({ type: 'png' });
    return this.page.content();
  }

  async navigate(url: string): Promise<void> {
    await this.page.goto(url);
  }

  native<T>(): T {
    return this.page as unknown as T;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.handles.clear();
    // Independent try/catch per step: context.close() rejecting (e.g. the
    // browser process already crashed) must not skip browser.close() —
    // that would orphan the whole browser process (NFR-014).
    try {
      await this.context.close();
    } catch {
      // already closed/crashed — browser.close() below still needs to run
    }
    try {
      await this.browser.close();
    } catch {
      // already closed/crashed
    }
  }

  private handle(el: ElementHandle): PWElementHandle {
    const h = this.handles.get(el.id);
    if (!h) {
      throw new CrossPlayError({
        what: `stale element handle '${el.id}'`,
        why: ['the handle was not produced by this session'],
        next: ['re-query the element via app actions instead of caching handles'],
      });
    }
    return h;
  }

  private toLocator(selector: UnifiedSelector) {
    switch (selector.kind) {
      case 'testId':
        return this.page.locator(`[data-testid=${JSON.stringify(selector.value)}]`);
      case 'text':
        return this.page.getByText(selector.value, { exact: selector.exact !== false });
      case 'role': {
        // Unified roles are ARIA-flavored; 'image' is the one divergent name (spec §3.4).
        const aria = (selector.role === 'image' ? 'img' : selector.role) as Exclude<
          Parameters<Page['getByRole']>[0],
          undefined
        >;
        return selector.name === undefined
          ? this.page.getByRole(aria)
          : this.page.getByRole(aria, { name: selector.name, exact: true });
      }
    }
  }
}
