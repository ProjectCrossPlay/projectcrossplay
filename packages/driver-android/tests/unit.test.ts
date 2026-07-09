import { describe, expect, test } from 'vitest';
import { AndroidBridge } from '../src/bridge.js';
import { toQueries } from '../src/selectors.js';
import { by } from '@projectcrossplay/core';

describe('selector mapping (spec §3.4)', () => {
  test('testId expands to resource-id AND content-desc queries (FR-030)', () => {
    const queries = toQueries(by.testId('login-button'));
    expect(queries).toHaveLength(2);
    expect(queries[0]!.strategy).toBe('-android uiautomator');
    expect(queries[0]!.selector).toContain(':id/login-button');
    expect(queries[1]).toEqual({ strategy: 'accessibility id', selector: 'login-button' });
  });

  test('text maps to UiSelector text/textContains (FR-031)', () => {
    expect(toQueries(by.text('Sign in'))[0]!.selector).toBe('new UiSelector().text("Sign in")');
    expect(toQueries(by.text('Sign', { exact: false }))[0]!.selector).toBe(
      'new UiSelector().textContains("Sign")',
    );
  });

  test('text with quotes is escaped, not injected', () => {
    const q = toQueries(by.text('He said "hi"'))[0]!;
    expect(q.selector).toBe('new UiSelector().text("He said \\"hi\\"")');
  });

  test('role maps to widget classes; name combines class + text (FR-031)', () => {
    expect(toQueries(by.role('button'))[0]).toEqual({
      strategy: 'class name',
      selector: 'android.widget.Button',
    });
    expect(toQueries(by.role('button', { name: 'Sign in' }))[0]!.selector).toBe(
      'new UiSelector().className("android.widget.Button").text("Sign in")',
    );
    expect(toQueries(by.role('textbox'))[0]!.selector).toBe('android.widget.EditText');
  });
});

describe('bridge protocol (spike RESULTS.md findings)', () => {
  function mockFetch(handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const impl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), ...(init ? { init } : {}) });
      const { status = 200, body } = handler(String(url), init);
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    return { impl, calls };
  }

  test('find body carries non-W3C {strategy, selector, context} (finding #1)', async () => {
    const { impl, calls } = mockFetch((url) => {
      if (url.endsWith('/session')) return { body: { value: { sessionId: 'S1' } } };
      return { body: { value: [{ 'element-6066-11e4-a52e-4f735466cecf': 'E1' }] } };
    });
    const bridge = new AndroidBridge('http://127.0.0.1:1/wd/hub', impl);
    await bridge.createSession();
    const ids = await bridge.findElements('accessibility id', 'login-button');
    expect(ids).toEqual(['E1']);
    const findCall = calls.find((c) => c.url.endsWith('/elements'))!;
    const body = JSON.parse(String(findCall.init!.body));
    expect(body).toMatchObject({ strategy: 'accessibility id', selector: 'login-button', context: '' });
    expect(findCall.url).toContain('/wd/hub/session/S1/elements'); // finding #2: /wd/hub base
  });

  test('W3C ELEMENT key fallback is read too', async () => {
    const { impl } = mockFetch((url) => {
      if (url.endsWith('/session')) return { body: { value: { sessionId: 'S1' } } };
      return { body: { value: [{ ELEMENT: 'legacy-1' }] } };
    });
    const bridge = new AndroidBridge('http://x/wd/hub', impl);
    await bridge.createSession();
    expect(await bridge.findElements('id', 'x')).toEqual(['legacy-1']);
  });

  test('deleteSession swallows the socket drop and is idempotent (finding #3)', async () => {
    let deletes = 0;
    const { impl } = mockFetch((url, init) => {
      if (init?.method === 'DELETE') {
        deletes++;
        throw new Error('socket hang up'); // instrumentation dies mid-response
      }
      return { body: { value: { sessionId: 'S1' } } };
    });
    const bridge = new AndroidBridge('http://x/wd/hub', impl);
    await bridge.createSession();
    await bridge.deleteSession(); // must not throw
    await bridge.deleteSession(); // second call is a no-op
    expect(deletes).toBe(1);
  });

  test('UIA2 error envelopes become BridgeError with stale detection', async () => {
    const { impl } = mockFetch((url) => {
      if (url.endsWith('/session')) return { body: { value: { sessionId: 'S1' } } };
      return {
        status: 404,
        body: { value: { error: 'stale element reference', message: 'element is not attached' } },
      };
    });
    const bridge = new AndroidBridge('http://x/wd/hub', impl);
    await bridge.createSession();
    const err = await bridge.elementRect('E9').catch((e) => e);
    expect(err.name).toBe('BridgeError');
    expect(err.isStaleElement).toBe(true);
  });
});
