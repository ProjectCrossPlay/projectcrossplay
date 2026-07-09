/**
 * Spike B-003, part 1: prove the CrossPlay public API shape is expressible on
 * Vitest — `test` with an injected `app` fixture whose lifecycle (launch →
 * dispose) is owned by the fixture, exactly as @projectcrossplay/core will do with a
 * real PlatformDriver behind it.
 */
import { test as base } from 'vitest';

/** Stand-in for the real app object; records steps like the trace writer will. */
export interface FakeApp {
  tap(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  getText(selector: string): Promise<string>;
  readonly steps: ReadonlyArray<{ action: string; selector: string; masked?: boolean }>;
  readonly disposed: boolean;
}

class FakeAppImpl implements FakeApp {
  steps: Array<{ action: string; selector: string; masked?: boolean }> = [];
  disposed = false;
  async tap(selector: string) {
    this.steps.push({ action: 'tap', selector });
  }
  async fill(selector: string, _value: string) {
    // masked-by-default, mirroring NFR-017
    this.steps.push({ action: 'fill', selector, masked: true });
  }
  async getText(selector: string) {
    this.steps.push({ action: 'getText', selector });
    return 'Welcome back';
  }
  async dispose() {
    this.disposed = true;
  }
}

interface CrossplayFixtures {
  app: FakeApp;
}

/**
 * The decisive question for ADR-001: can we hand users a `test` that injects
 * `app` with guaranteed teardown, without exposing Vitest types in our public
 * surface? `test.extend` answers yes — teardown runs after the test body even
 * on failure (validated by the reporter check in reporter.mjs).
 */
export const test = base.extend<CrossplayFixtures>({
  app: async ({}, use) => {
    const app = new FakeAppImpl();
    await use(app); // test body runs here
    await app.dispose(); // teardown on pass AND fail — the DisposeScope pattern
    if (!app.disposed) throw new Error('dispose contract violated');
  },
});
