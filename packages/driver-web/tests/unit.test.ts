import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { LaunchContext, TargetConfig, WebTargetOptions } from '@projectcrossplay/core';

const mocks = vi.hoisted(() => ({
  chromiumLaunch: vi.fn(),
  firefoxLaunch: vi.fn(),
  webkitLaunch: vi.fn(),
}));

// Playwright's real launch() spawns a browser process — mocked so these are
// true unit tests of driver-web's own logic, not an e2e re-test (the browser
// matrix CI job already covers real engines end to end).
vi.mock('playwright', () => ({
  chromium: { launch: mocks.chromiumLaunch },
  firefox: { launch: mocks.firefoxLaunch },
  webkit: { launch: mocks.webkitLaunch },
}));

const { driver } = await import('../src/index.js');

function makeCtx(): LaunchContext {
  return { timeout: 30_000, onDispose: vi.fn(), log: vi.fn() };
}

function webTarget(use: Partial<WebTargetOptions> = {}): TargetConfig {
  return { name: 't', platform: 'web', use: { baseURL: 'https://example.test', ...use } };
}

function makeElementHandle(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    evaluate: vi.fn().mockResolvedValue(true),
    isVisible: vi.fn().mockResolvedValue(true),
    isEnabled: vi.fn().mockResolvedValue(true),
    boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 10, height: 10 }),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    innerText: vi.fn().mockResolvedValue('hi'),
    dispose: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeLocator(handles: ReturnType<typeof makeElementHandle>[]) {
  return { elementHandles: vi.fn().mockResolvedValue(handles) };
}

function makePage() {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue(makeLocator([])),
    getByText: vi.fn().mockReturnValue(makeLocator([])),
    getByRole: vi.fn().mockReturnValue(makeLocator([])),
    screenshot: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    content: vi.fn().mockResolvedValue('<html/>'),
  };
}

function makeBrowserGraph() {
  const page = makePage();
  const context = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) };
  const browser = { newContext: vi.fn().mockResolvedValue(context), close: vi.fn().mockResolvedValue(undefined) };
  return { browser, context, page };
}

beforeEach(() => {
  mocks.chromiumLaunch.mockReset();
  mocks.firefoxLaunch.mockReset();
  mocks.webkitLaunch.mockReset();
});

describe('launch() validation and errors', () => {
  test('throws CrossPlayError when target has no baseURL', async () => {
    const err = await driver.launch(webTarget({ baseURL: undefined as unknown as string }), makeCtx()).catch((e) => e);
    expect(err.name).toBe('CrossPlayError');
    expect(err.parts.what).toContain('no baseURL');
  });

  test('throws CrossPlayError for an unknown browser name', async () => {
    const err = await driver
      .launch(webTarget({ browser: 'ie6' as unknown as WebTargetOptions['browser'] }), makeCtx())
      .catch((e) => e);
    expect(err.name).toBe('CrossPlayError');
    expect(err.parts.what).toContain('unknown browser');
    expect(err.parts.next?.[0]).toContain('chromium');
  });

  test('wraps an engine launch failure with an actionable next step', async () => {
    mocks.chromiumLaunch.mockRejectedValue(new Error('executable not found'));
    const err = await driver.launch(webTarget(), makeCtx()).catch((e) => e);
    expect(err.name).toBe('CrossPlayError');
    expect(err.parts.what).toContain('could not launch chromium');
    expect(err.parts.next?.[0]).toContain('playwright install chromium');
  });

  test('defaults to chromium and navigates to baseURL on success', async () => {
    const { browser, context, page } = makeBrowserGraph();
    mocks.chromiumLaunch.mockResolvedValue(browser);
    const ctx = makeCtx();
    await driver.launch(webTarget(), ctx);
    expect(browser.newContext).toHaveBeenCalled();
    expect(context.newPage).toHaveBeenCalled();
    expect(page.goto).toHaveBeenCalledWith('https://example.test');
    expect(ctx.onDispose).toHaveBeenCalled();
  });

  test('honors an explicit browser choice', async () => {
    const { browser } = makeBrowserGraph();
    mocks.firefoxLaunch.mockResolvedValue(browser);
    await driver.launch(webTarget({ browser: 'firefox' }), makeCtx());
    expect(mocks.firefoxLaunch).toHaveBeenCalled();
    expect(mocks.chromiumLaunch).not.toHaveBeenCalled();
  });
});

describe('session behavior', () => {
  async function launchSession(page = makePage()) {
    const context = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) };
    const browser = { newContext: vi.fn().mockResolvedValue(context), close: vi.fn().mockResolvedValue(undefined) };
    mocks.chromiumLaunch.mockResolvedValue(browser);
    const session = await driver.launch(webTarget(), makeCtx());
    return { session, browser, context, page };
  }

  test('findElements assigns ids and getElementState reports handle state', async () => {
    const handle = makeElementHandle();
    const page = makePage();
    page.locator = vi.fn().mockReturnValue(makeLocator([handle]));
    const { session } = await launchSession(page);

    const found = await session.findElements({ kind: 'testId', value: 'login' });
    expect(found).toHaveLength(1);
    expect(page.locator).toHaveBeenCalledWith('[data-testid="login"]');

    const state = await session.getElementState(found[0]!);
    expect(state).toEqual({ present: true, visible: true, enabled: true, bounds: { x: 0, y: 0, width: 10, height: 10 } });
  });

  test('getElementState reports not-present when the node is detached', async () => {
    const handle = makeElementHandle({ evaluate: vi.fn().mockResolvedValue(false) });
    const page = makePage();
    page.locator = vi.fn().mockReturnValue(makeLocator([handle]));
    const { session } = await launchSession(page);
    const [el] = await session.findElements({ kind: 'testId', value: 'x' });

    expect(await session.getElementState(el!)).toEqual({ present: false, visible: false, enabled: false, bounds: null });
  });

  test('getElementState treats a stale-frame evaluate() rejection as not-present', async () => {
    const handle = makeElementHandle({ evaluate: vi.fn().mockRejectedValue(new Error('frame detached')) });
    const page = makePage();
    page.locator = vi.fn().mockReturnValue(makeLocator([handle]));
    const { session } = await launchSession(page);
    const [el] = await session.findElements({ kind: 'testId', value: 'x' });

    expect(await session.getElementState(el!)).toEqual({ present: false, visible: false, enabled: false, bounds: null });
  });

  test('getElementState throws a clear error for a handle id this session never produced', async () => {
    const { session } = await launchSession();
    const err = await session.getElementState({ id: 'other-session-el-0' }).catch((e) => e);
    expect(err.name).toBe('CrossPlayError');
    expect(err.parts.what).toContain('stale element handle');
  });

  test('performAction dispatches tap/fill/clear to the underlying handle', async () => {
    const handle = makeElementHandle();
    const page = makePage();
    page.locator = vi.fn().mockReturnValue(makeLocator([handle]));
    const { session } = await launchSession(page);
    const [el] = await session.findElements({ kind: 'testId', value: 'x' });

    await session.performAction(el!, { kind: 'tap' });
    expect(handle.click).toHaveBeenCalled();
    await session.performAction(el!, { kind: 'fill', value: 'hello' });
    expect(handle.fill).toHaveBeenCalledWith('hello', expect.anything());
    await session.performAction(el!, { kind: 'clear' });
    expect(handle.fill).toHaveBeenCalledWith('', expect.anything());
  });

  test('getText reads innerText', async () => {
    const handle = makeElementHandle();
    const page = makePage();
    page.locator = vi.fn().mockReturnValue(makeLocator([handle]));
    const { session } = await launchSession(page);
    const [el] = await session.findElements({ kind: 'testId', value: 'x' });
    expect(await session.getText(el!)).toBe('hi');
  });

  test('captureState returns a screenshot buffer or the page hierarchy', async () => {
    const { session, page } = await launchSession();
    expect(await session.captureState('screenshot')).toBeInstanceOf(Uint8Array);
    expect(page.screenshot).toHaveBeenCalledWith({ type: 'png' });
    expect(await session.captureState('hierarchy')).toBe('<html/>');
  });

  test('navigate() and native() expose the underlying page', async () => {
    const { session, page } = await launchSession();
    await session.navigate('https://example.test/2');
    expect(page.goto).toHaveBeenCalledWith('https://example.test/2');
    expect(session.native()).toBe(page);
  });

  test('findElements evicts the oldest handle past the tracked cap, releasing its remote reference', async () => {
    const page = makePage();
    const { session } = await launchSession(page);
    for (let i = 0; i < 501; i++) {
      const handle = makeElementHandle();
      page.locator = vi.fn().mockReturnValue(makeLocator([handle]));
      await session.findElements({ kind: 'testId', value: `el-${i}` });
    }
    // The very first handle (id chromium-el-0) must have been evicted and disposed.
    const err = await session.getElementState({ id: 'chromium-el-0' }).catch((e) => e);
    expect(err.name).toBe('CrossPlayError');
  });
});

describe('dispose()', () => {
  test('closes context then browser, and is idempotent', async () => {
    const { browser, context } = makeBrowserGraph();
    mocks.chromiumLaunch.mockResolvedValue(browser);
    const session = await driver.launch(webTarget(), makeCtx());

    await session.dispose();
    await session.dispose();

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  test('still closes the browser when context.close() rejects (orphaned-process bug, fixed 2026-07-10)', async () => {
    const { browser, context } = makeBrowserGraph();
    context.close = vi.fn().mockRejectedValue(new Error('already crashed'));
    mocks.chromiumLaunch.mockResolvedValue(browser);
    const session = await driver.launch(webTarget(), makeCtx());

    await expect(session.dispose()).resolves.toBeUndefined();
    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});

describe('selector mapping', () => {
  async function launchWithLocatorSpy() {
    const page = makePage();
    const { session } = await (async () => {
      const context = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
      const browser = { newContext: vi.fn().mockResolvedValue(context), close: vi.fn() };
      mocks.chromiumLaunch.mockResolvedValue(browser);
      return { session: await driver.launch(webTarget(), makeCtx()) };
    })();
    return { session, page };
  }

  test('testId maps to a data-testid attribute selector, quote-safe', async () => {
    const { session, page } = await launchWithLocatorSpy();
    await session.findElements({ kind: 'testId', value: 'weird"quote' });
    expect(page.locator).toHaveBeenCalledWith('[data-testid="weird\\"quote"]');
  });

  test('text respects the exact flag', async () => {
    const { session, page } = await launchWithLocatorSpy();
    await session.findElements({ kind: 'text', value: 'Sign in' });
    expect(page.getByText).toHaveBeenCalledWith('Sign in', { exact: true });
    await session.findElements({ kind: 'text', value: 'Sign', exact: false });
    expect(page.getByText).toHaveBeenCalledWith('Sign', { exact: false });
  });

  test('role maps unified "image" to ARIA "img", and passes name through', async () => {
    const { session, page } = await launchWithLocatorSpy();
    await session.findElements({ kind: 'role', role: 'image' });
    expect(page.getByRole).toHaveBeenCalledWith('img');
    await session.findElements({ kind: 'role', role: 'button', name: 'Sign in' });
    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Sign in', exact: true });
  });
});
