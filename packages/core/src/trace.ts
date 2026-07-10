/**
 * Trace capture v1 (B-025, ADR-003, FR-050/052, NFR-013/017).
 *
 * Streaming by construction: during the run everything is appended straight
 * to a working directory on disk (steps.jsonl via an append-only handle,
 * screenshots/hierarchy dumps as individual files) — nothing accumulates in
 * memory. `close()` packs the directory into a single portable `.trace` zip
 * (store-only, see zip.ts) and removes the working dir.
 *
 * One trace file per test: manifest.spec identifies `file › test`, matching
 * viewer wireframe W1. Fill values are masked at the format level by default
 * (NFR-017) — the real value never reaches this module.
 */
import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { UnifiedSelector } from './driver.js';
import type { WaitLogEntry } from './errors.js';
import { formatSelector } from './selector.js';
import {
  parseTraceEntries,
  TRACE_FORMAT_VERSION,
  type ParsedTrace,
  type TraceManifest,
  type TraceStep,
} from './trace-format.js';
import { packZip, type ZipEntry } from './zip.js';
export type { ZipEntry } from './zip.js';
export { parseTraceEntries, TRACE_FORMAT_VERSION, type ParsedTrace, type TraceManifest, type TraceStep };

export interface StepInput {
  action: string;
  selector?: UnifiedSelector;
  value?: string;
  masked?: boolean;
}

export class TraceWriter {
  private readonly workDir: string;
  private readonly tracePath: string;
  private readonly startedAt = new Date();
  private readonly t0 = Date.now();
  private steps: WriteStream | null = null;
  private stepCount = 0;
  private assetCount = 0;
  private ready: Promise<void>;

  constructor(
    traceDir: string,
    private readonly meta: { spec: string; target: string; platform: string },
  ) {
    const stamp = this.startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const slug = meta.spec.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const tracePath = join(traceDir, `${stamp}-${meta.target}-${slug}.trace`);
    const workDir = `${tracePath}.work`;
    this.tracePath = tracePath;
    this.workDir = workDir;
    this.ready = (async () => {
      await mkdir(join(workDir, 'screenshots'), { recursive: true });
      await mkdir(join(workDir, 'hierarchy'), { recursive: true });
      this.steps = createWriteStream(join(workDir, 'steps.jsonl'), { flags: 'a' });
    })();
  }

  /** ms since trace start — step timings are relative to this. */
  now(): number {
    return Date.now() - this.t0;
  }

  nextStepIndex(): number {
    return this.stepCount;
  }

  async addStep(
    step: StepInput & {
      status: 'passed' | 'failed';
      t0: number;
      t1: number;
      waitLog?: WaitLogEntry[];
      error?: string;
      screenshot?: Uint8Array;
      hierarchy?: { data: string; ext: 'html' | 'xml' };
    },
  ): Promise<void> {
    await this.ready;
    const i = this.stepCount++;
    const record: TraceStep = {
      i,
      action: step.action,
      status: step.status,
      t0: step.t0,
      t1: step.t1,
    };
    if (step.selector) record.selector = formatSelector(step.selector);
    if (step.value !== undefined) record.value = step.value;
    if (step.masked !== undefined) record.masked = step.masked;
    if (step.waitLog && step.waitLog.length > 0) record.waitLog = step.waitLog;
    if (step.error !== undefined) record.error = step.error;
    if (step.screenshot) {
      const name = `screenshots/${this.assetCount++}.png`;
      await writeFile(join(this.workDir, name), step.screenshot);
      record.screenshot = name;
    }
    if (step.hierarchy) {
      const name = `hierarchy/${i}.${step.hierarchy.ext}`;
      await writeFile(join(this.workDir, name), step.hierarchy.data, 'utf8');
      record.hierarchy = name;
    }
    await new Promise<void>((resolve, reject) =>
      this.steps!.write(JSON.stringify(record) + '\n', (e) => (e ? reject(e) : resolve())),
    );
  }

  /**
   * Finalize: pack the working dir into the .trace zip (or discard it under
   * trace: 'retain-on-failure' for passing tests). Returns the trace path, or
   * null when discarded.
   */
  async close(opts: { result: 'passed' | 'failed'; keep: boolean }): Promise<string | null> {
    await this.ready;
    await new Promise<void>((resolve) => this.steps!.end(() => resolve()));
    this.steps = null;

    if (!opts.keep) {
      await rm(this.workDir, { recursive: true, force: true });
      return null;
    }

    const manifest: TraceManifest = {
      formatVersion: TRACE_FORMAT_VERSION,
      spec: this.meta.spec,
      target: this.meta.target,
      platform: this.meta.platform,
      result: opts.result,
      startedAt: this.startedAt.toISOString(),
      durationMs: Date.now() - this.t0,
    };
    const entries: ZipEntry[] = [
      { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
      { name: 'steps.jsonl', data: await readFile(join(this.workDir, 'steps.jsonl')) },
    ];
    for (const sub of ['screenshots', 'hierarchy'] as const) {
      for (const f of await readdir(join(this.workDir, sub))) {
        entries.push({ name: `${sub}/${f}`, data: await readFile(join(this.workDir, sub, f)) });
      }
    }
    await writeFile(this.tracePath, packZip(entries));
    await rm(this.workDir, { recursive: true, force: true });
    return this.tracePath;
  }
}

/** Strict reader — throws on anything malformed (NFR-018: traces are untrusted). */
export async function readTrace(path: string): Promise<ParsedTrace> {
  const { unpackZip } = await import('./zip.js');
  return parseTraceEntries(unpackZip(await readFile(path)));
}
