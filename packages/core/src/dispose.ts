/**
 * DisposeScope (NFR-014): every resource acquired during a test registers a
 * cleanup here; the scope unwinds LIFO on pass, fail, or crash. Cleanup errors
 * are collected, never masked, and never prevent later cleanups from running.
 */
export class DisposeScope {
  private cleanups: Array<() => Promise<void> | void> = [];
  private disposed = false;

  add(fn: () => Promise<void> | void): void {
    if (this.disposed) throw new Error('DisposeScope already disposed');
    this.cleanups.push(fn);
  }

  /** Idempotent. Runs all cleanups LIFO; throws an AggregateError only after all ran. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (const fn of this.cleanups.reverse()) {
      try {
        await fn();
      } catch (e) {
        errors.push(e);
      }
    }
    this.cleanups = [];
    if (errors.length > 0) {
      throw new AggregateError(errors, `${errors.length} cleanup(s) failed during dispose`);
    }
  }
}
