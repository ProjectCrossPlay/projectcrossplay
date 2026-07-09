/**
 * The public `test` (B-020) — Vitest test.extend with an `app` fixture whose
 * lifecycle core owns end to end: load driver (registry) → launch session →
 * hand `app` to the body → unwind DisposeScope and finalize the trace on
 * pass, fail, or crash (NFR-014). The pattern was spike-validated in B-003.
 */
import { mkdir } from 'node:fs/promises';
import { inject, test as base } from 'vitest';
import { App } from './app.js';
import { DisposeScope } from './dispose.js';
import type { LaunchContext } from './driver.js';
import { ReporterDispatcher } from './reporter.js';
import { loadDriver } from './registry.js';
import { TraceWriter } from './trace.js';

export interface CrossPlayFixtures {
  app: App;
}

export const test = base.extend<CrossPlayFixtures>({
  // eslint-disable-next-line no-empty-pattern
  app: async ({ task }, use) => {
    const rt = inject('crossplay');
    const spec = `${task.file.name} › ${task.name}`;
    const scope = new DisposeScope();
    const reporters = new ReporterDispatcher(); // v0.1: no reporters configured (FR-071 seam)
    reporters.emit({ kind: 'testStart', spec, target: rt.targetName, platform: rt.target.platform });
    const startedAt = Date.now();

    await mkdir(rt.traceDir, { recursive: true });
    const trace = new TraceWriter(rt.traceDir, {
      spec,
      target: rt.targetName,
      platform: rt.target.platform,
    });

    let app: App | null = null;
    try {
      const driver = await loadDriver(rt.target);
      const ctx: LaunchContext = {
        timeout: rt.timeout,
        onDispose: (fn) => scope.add(fn),
        log: () => {}, // routed into trace detail in a later sprint; never stdout
      };
      const session = await driver.launch(rt.target, ctx);
      scope.add(() => session.dispose());
      app = new App(session, {
        timeout: rt.timeout,
        spec,
        trace,
        reporters,
        platform: rt.target.platform,
      });

      await use(app);
    } finally {
      // Vitest resolves use() after the body even when the test fails; the
      // task result tells us how it went (assertion failures included).
      const failed = task.result?.state === 'fail' || (app?.hadFailure ?? false);
      const result = failed ? 'failed' : 'passed';
      await scope.dispose(); // always unwind, whatever happened (NFR-014)
      const tracePath = await trace.close({
        result,
        keep: rt.trace === 'on' || failed,
      });
      reporters.emit({
        kind: 'testEnd',
        spec,
        result,
        durationMs: Date.now() - startedAt,
        ...(tracePath ? { trace: tracePath } : {}),
      });
    }
  },
});
