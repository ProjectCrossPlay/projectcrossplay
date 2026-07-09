/**
 * Reporter seam (FR-071). No telemetry ships in v0.1, but every run event
 * flows through this dispatcher, so adding an opt-in telemetry reporter later
 * touches no core logic — it's one more entry in `config.reporters`.
 *
 * Reporters are fire-and-forget observers: a throwing reporter is disabled
 * for the rest of the run and never fails a test.
 */

export type ReporterEvent =
  | { kind: 'testStart'; spec: string; target: string; platform: string }
  | {
      kind: 'step';
      spec: string;
      action: string;
      selector?: string;
      status: 'passed' | 'failed';
      durationMs: number;
    }
  | { kind: 'testEnd'; spec: string; result: 'passed' | 'failed'; durationMs: number; trace?: string };

export interface CrossPlayReporter {
  onEvent(event: ReporterEvent): void | Promise<void>;
}

export class ReporterDispatcher {
  private active: CrossPlayReporter[];

  constructor(reporters: CrossPlayReporter[] = []) {
    this.active = [...reporters];
  }

  emit(event: ReporterEvent): void {
    for (const r of [...this.active]) {
      try {
        void Promise.resolve(r.onEvent(event)).catch(() => this.disable(r));
      } catch {
        this.disable(r);
      }
    }
  }

  private disable(r: CrossPlayReporter): void {
    this.active = this.active.filter((x) => x !== r);
  }
}
