/**
 * Auto-wait engine (FR-040/041/042) — core-owned and platform-neutral, the
 * single source of wait truth (architecture §3.1). Drivers only answer cheap
 * state queries; this loop decides when to retry and how to fail.
 *
 * Conditions, in order: present → unique → visible → stable → enabled.
 * Polling is adaptive backoff 50→200 ms via setTimeout (no busy-wait,
 * NFR-013). Stability = bounding box unchanged between two consecutive polls
 * at least STABLE_WINDOW_MS apart (bounds-change count is kept as evidence
 * for the timeout error, per wireframe C3).
 */
import type { DriverSession, ElementHandle, ElementState, UnifiedSelector } from './driver.js';
import { AmbiguityError, TimeoutError, type WaitLogEntry } from './errors.js';

const INITIAL_POLL_MS = 50;
const MAX_POLL_MS = 200;
const BACKOFF_FACTOR = 1.5;
/** Two same-bounds observations at least this far apart count as stable. */
const STABLE_WINDOW_MS = 100;

export interface WaitOptions {
  timeout: number;
  /** Stop after 'visible' (for waitFor) instead of full actionability. */
  until?: 'visible' | 'actionable';
}

export interface WaitResult {
  el: ElementHandle;
  waitLog: WaitLogEntry[];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function waitFor(
  session: DriverSession,
  selector: UnifiedSelector,
  opts: WaitOptions,
): Promise<WaitResult> {
  const start = Date.now();
  const until = opts.until ?? 'actionable';
  const waitLog: WaitLogEntry[] = [];
  const log = (condition: WaitLogEntry['condition'], ok: boolean, detail?: string) => {
    const entry: WaitLogEntry = { t: Date.now() - start, condition, ok };
    if (detail !== undefined) entry.detail = detail;
    waitLog.push(entry);
  };

  let pollMs = INITIAL_POLL_MS;
  let boundsChanges = 0;
  let lastStable: { bounds: string; at: number } | null = null;
  // What we were still waiting on when time ran out — always (re)assigned
  // before use: every loop branch that reaches the timeout check below
  // assigns it first, so the old placeholder initial value was dead code.
  let failing!: { condition: WaitLogEntry['condition']; detail: string };

  for (;;) {
    const found = await session.findElements(selector);

    if (found.length > 1) {
      // Ambiguity is a spec bug, not a transient state — fail fast (FR-032).
      const candidates = await Promise.all(found.map((el) => describeCandidate(session, el)));
      throw new AmbiguityError({ selector, candidates });
    }

    if (found.length === 0) {
      log('present', false);
      failing = { condition: 'present', detail: 'not found' };
      lastStable = null;
    } else {
      const el = found[0]!;
      const state = await session.getElementState(el);
      log('present', state.present);

      if (!state.present) {
        failing = { condition: 'present', detail: 'not found' };
        lastStable = null;
      } else if (!state.visible) {
        log('visible', false);
        failing = { condition: 'visible', detail: 'found but not visible' };
        lastStable = null;
      } else {
        log('visible', true);
        if (until === 'visible') return { el, waitLog };

        const stable = checkStable(state, lastStable, Date.now());
        if (stable.changed) boundsChanges++;
        lastStable = stable.next;
        log('stable', stable.ok, stable.ok ? undefined : `bounding box changed ${boundsChanges}×`);

        if (!stable.ok) {
          failing = {
            condition: 'stable',
            detail: `found but not stable: still animating`,
          };
        } else if (!state.enabled) {
          log('enabled', false);
          failing = { condition: 'enabled', detail: 'found but disabled' };
        } else {
          log('enabled', true);
          return { el, waitLog };
        }
      }
    }

    const elapsed = Date.now() - start;
    if (elapsed + pollMs > opts.timeout) {
      throw new TimeoutError({
        selector,
        timeoutMs: opts.timeout,
        condition: failing.condition,
        conditionDetail:
          failing.condition === 'stable'
            ? `${failing.detail} (bounding box changed ${boundsChanges}×)`
            : failing.detail,
        waitLog,
      });
    }
    await sleep(pollMs);
    pollMs = Math.min(Math.round(pollMs * BACKOFF_FACTOR), MAX_POLL_MS);
  }
}

function checkStable(
  state: ElementState,
  last: { bounds: string; at: number } | null,
  now: number,
): { ok: boolean; changed: boolean; next: { bounds: string; at: number } } {
  const bounds = state.bounds
    ? `${state.bounds.x},${state.bounds.y},${state.bounds.width},${state.bounds.height}`
    : 'none';
  if (last === null || last.bounds !== bounds) {
    return { ok: false, changed: last !== null, next: { bounds, at: now } };
  }
  // Same bounds as before — stable once the observation window is long enough.
  return { ok: now - last.at >= STABLE_WINDOW_MS, changed: false, next: last };
}

/** Best-effort candidate description for ambiguity errors. */
async function describeCandidate(session: DriverSession, el: ElementHandle): Promise<string> {
  try {
    const state = await session.getElementState(el);
    const box = state.bounds
      ? `at (${Math.round(state.bounds.x)},${Math.round(state.bounds.y)}) ${Math.round(state.bounds.width)}×${Math.round(state.bounds.height)}`
      : 'not rendered';
    return `${el.id} — ${state.visible ? 'visible' : 'hidden'}, ${box}`;
  } catch {
    return el.id;
  }
}
