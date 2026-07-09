import { describe, expect, test } from 'vitest';
import { AmbiguityError, TimeoutError } from '../src/errors.js';
import { by } from '../src/selector.js';
import { waitFor } from '../src/wait.js';
import { el, FakeSession } from './fake-driver.js';

describe('auto-wait engine (FR-040/042)', () => {
  test('resolves quickly for an actionable element, all conditions confirmed', async () => {
    const s = new FakeSession();
    s.elements = [el({ id: 'btn', testId: 'login-button' })];
    const start = Date.now();
    const { el: found, waitLog } = await waitFor(s, by.testId('login-button'), { timeout: 1000 });
    expect(found.id).toBe('btn');
    // Stability needs two same-bounds observations ≥100ms apart, so ~2 polls:
    expect(Date.now() - start).toBeLessThan(500);
    const confirmed = new Set(waitLog.filter((e) => e.ok).map((e) => e.condition));
    expect([...confirmed].sort()).toEqual(['enabled', 'present', 'stable', 'visible']);
  });

  test('waits for late-appearing elements without busy-waiting', async () => {
    const s = new FakeSession();
    setTimeout(() => {
      s.elements = [el({ id: 'row', testId: 'item-row-1' })];
    }, 250);
    const start = Date.now();
    await waitFor(s, by.testId('item-row-1'), { timeout: 5000 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(240);
    // Adaptive backoff (50→200ms): a busy-wait would poll thousands of times.
    expect(s.findCalls).toBeLessThan(12);
  });

  test('timeout names the failed condition: not found', async () => {
    const s = new FakeSession();
    const err = await waitFor(s, by.testId('ghost'), { timeout: 300 }).catch((e) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.condition).toBe('present');
    expect(err.message).toContain('not found');
    expect(err.message).toContain("by.testId('ghost')");
  });

  test('timeout names the failed condition: not stable while animating', async () => {
    const s = new FakeSession();
    s.elements = [el({ id: 'row', testId: 'row', animating: true })];
    const err = await waitFor(s, by.testId('row'), { timeout: 400 }).catch((e) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.condition).toBe('stable');
    expect(err.message).toContain('still animating');
    expect(err.message).toContain('bounding box changed');
    expect(err.message).toContain('present ✔');
    expect(err.message).toContain('stable ✖');
  });

  test('timeout names the failed condition: disabled', async () => {
    const s = new FakeSession();
    s.elements = [el({ id: 'btn', testId: 'submit', enabled: false })];
    const err = await waitFor(s, by.testId('submit'), { timeout: 400 }).catch((e) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.condition).toBe('enabled');
    expect(err.message).toContain('disabled');
  });

  test("until: 'visible' does not require stable/enabled (waitFor semantics)", async () => {
    const s = new FakeSession();
    s.elements = [el({ id: 'spin', testId: 'spinner', animating: true, enabled: false })];
    const { el: found } = await waitFor(s, by.testId('spinner'), { timeout: 500, until: 'visible' });
    expect(found.id).toBe('spin');
  });

  test('ambiguity fails fast with candidates listed (FR-032)', async () => {
    const s = new FakeSession();
    s.elements = [
      el({ id: 'a', text: 'Delete' }),
      el({ id: 'b', text: 'Delete', bounds: { x: 10, y: 200, width: 80, height: 30 } }),
    ];
    const start = Date.now();
    const err = await waitFor(s, by.text('Delete'), { timeout: 5000 }).catch((e) => e);
    expect(err).toBeInstanceOf(AmbiguityError);
    expect(Date.now() - start).toBeLessThan(1000); // no waiting on spec bugs
    expect(err.message).toContain('matched 2 elements');
    expect(err.message).toContain("by.text('Delete')");
    expect(err.message).toContain('[1]');
    expect(err.message).toContain('[2]');
    expect(err.message).toContain('narrow the selector');
  });
});
