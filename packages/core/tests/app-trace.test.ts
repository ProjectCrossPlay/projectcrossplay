import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { App, MASKED_VALUE } from '../src/app.js';
import { CrossPlayError, TimeoutError } from '../src/errors.js';
import { ReporterDispatcher, type ReporterEvent } from '../src/reporter.js';
import { by } from '../src/selector.js';
import { readTrace, TraceWriter } from '../src/trace.js';
import { el, FakeSession } from './fake-driver.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'crossplay-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function makeApp(session: FakeSession, events?: ReporterEvent[]) {
  const trace = new TraceWriter(dir, { spec: 'demo.spec.ts › login flow', target: 'web', platform: 'web' });
  const reporters = new ReporterDispatcher(
    events ? [{ onEvent: (e) => void events.push(e) }] : [],
  );
  const app = new App(session, { timeout: 800, spec: 'demo.spec.ts › login flow', trace, reporters, platform: 'web' });
  return { app, trace };
}

describe('app + trace capture (B-020/B-025)', () => {
  test('happy path: steps recorded with screenshots, fill masked by default (NFR-017)', async () => {
    const s = new FakeSession();
    s.elements = [
      el({ id: 'user', testId: 'username' }),
      el({ id: 'pass', testId: 'password' }),
      el({ id: 'btn', role: 'button', name: 'Sign in' }),
    ];
    const { app, trace } = makeApp(s);

    await app.fill(by.testId('username'), 'demo-user', { mask: false });
    await app.fill(by.testId('password'), 's3cret!');
    await app.tap(by.role('button', { name: 'Sign in' }));

    const path = await trace.close({ result: 'passed', keep: true });
    expect(path).toBeTruthy();
    const parsed = await readTrace(path!);

    expect(parsed.manifest.result).toBe('passed');
    expect(parsed.manifest.spec).toBe('demo.spec.ts › login flow');
    expect(parsed.steps).toHaveLength(3);

    const [userStep, passStep, tapStep] = parsed.steps;
    expect(userStep!.value).toBe('demo-user'); // opted out of masking
    expect(userStep!.masked).toBe(false);
    expect(passStep!.value).toBe(MASKED_VALUE); // masked by default
    expect(passStep!.masked).toBe(true);
    expect(JSON.stringify(parsed.steps)).not.toContain('s3cret'); // never in the trace
    expect(tapStep!.selector).toBe("by.role('button', { name: 'Sign in' })");
    for (const step of parsed.steps) {
      expect(step.status).toBe('passed');
      expect(step.screenshot).toBeTruthy();
      expect(parsed.assets.has(step.screenshot!)).toBe(true);
    }
    // The real fill still received the real value:
    expect(s.actions.find((a) => a.el === 'pass')?.action).toMatchObject({ kind: 'fill', value: 's3cret!' });
  });

  test('failing step: hierarchy captured (FR-052), waitLog preserved, error rethrown', async () => {
    const s = new FakeSession();
    const { app, trace } = makeApp(s);

    await expect(app.tap(by.testId('ghost'))).rejects.toThrow(TimeoutError);
    expect(app.hadFailure).toBe(true);

    const path = await trace.close({ result: 'failed', keep: true });
    const parsed = await readTrace(path!);
    const failed = parsed.steps[0]!;
    expect(failed.status).toBe('failed');
    expect(failed.error).toContain('not found');
    expect(failed.waitLog!.length).toBeGreaterThan(0);
    expect(failed.hierarchy).toBeTruthy();
    expect(new TextDecoder().decode(parsed.assets.get(failed.hierarchy!))).toBe('<fake-hierarchy/>');
  });

  test('retain-on-failure: passing trace is discarded, nothing left on disk', async () => {
    const s = new FakeSession();
    s.elements = [el({ id: 'btn', testId: 'ok' })];
    const { app, trace } = makeApp(s);
    await app.tap(by.testId('ok'));
    const path = await trace.close({ result: 'passed', keep: false });
    expect(path).toBeNull();
    const { readdir } = await import('node:fs/promises');
    expect(await readdir(dir)).toEqual([]);
  });

  test('getText returns the driver value through the unified API', async () => {
    const s = new FakeSession();
    s.elements = [el({ id: 'h', testId: 'greeting', text: 'Welcome back' })];
    const { app } = makeApp(s);
    expect(await app.getText(by.testId('greeting'))).toBe('Welcome back');
  });

  test('goto on a platform without navigate: clear 3-part error', async () => {
    const s = new FakeSession(); // FakeSession has no navigate
    const { app } = makeApp(s);
    const err = await app.goto('http://localhost:1234').catch((e) => e);
    expect(err).toBeInstanceOf(CrossPlayError);
    expect(err.message).toContain('not supported');
    expect(err.message).toContain('→');
  });

  test('reporter seam receives step events; a throwing reporter never fails the test (FR-071)', async () => {
    const s = new FakeSession();
    s.elements = [el({ id: 'btn', testId: 'ok' })];
    const events: ReporterEvent[] = [];
    const trace = new TraceWriter(dir, { spec: 'x', target: 'web', platform: 'web' });
    const reporters = new ReporterDispatcher([
      { onEvent: (e) => void events.push(e) },
      {
        onEvent: () => {
          throw new Error('bad reporter');
        },
      },
    ]);
    const app = new App(s, { timeout: 800, spec: 'x', trace, reporters, platform: 'web' });
    await app.tap(by.testId('ok'));
    await app.tap(by.testId('ok'));
    await trace.close({ result: 'passed', keep: false });
    expect(events.filter((e) => e.kind === 'step')).toHaveLength(2);
  });
});
