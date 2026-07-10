/**
 * Trace format (ADR-003) — types + pure parsing, zero Node builtins. Split
 * out from trace.ts so the trace-viewer (browser.ts) can import this module
 * without dragging in TraceWriter's node:fs/node:path dependencies: static
 * ESM imports resolve eagerly regardless of tree-shaking, so esbuild's
 * browser-platform bundle fails to resolve 'node:fs' the moment anything
 * re-exports from a module that imports it, even if that code path is never
 * called client-side.
 */
import type { WaitLogEntry } from './errors.js';
import type { ZipEntry } from './zip.js';

export const TRACE_FORMAT_VERSION = 1;

export interface TraceManifest {
  formatVersion: number;
  /** `demo.spec.ts › list/detail` */
  spec: string;
  target: string;
  platform: string;
  result: 'passed' | 'failed';
  startedAt: string;
  durationMs: number;
}

export interface TraceStep {
  i: number;
  action: string;
  selector?: string;
  /** For fill steps: the loggable value — '•••••••' unless masking was opted out. */
  value?: string;
  masked?: boolean;
  status: 'passed' | 'failed';
  /** ms since run start */
  t0: number;
  t1: number;
  screenshot?: string;
  hierarchy?: string;
  waitLog?: WaitLogEntry[];
  error?: string;
}

/** Parsed trace, as consumed by the CLI summary and the viewer. */
export interface ParsedTrace {
  manifest: TraceManifest;
  steps: TraceStep[];
  /** Binary/text assets by entry name (screenshots/N.png, hierarchy/N.xml). */
  assets: Map<string, Uint8Array>;
}

/**
 * Strict parse of already-unpacked zip entries — throws on anything
 * malformed (NFR-018: traces are untrusted). Shared between the Node
 * `readTrace` (trace.ts) and the trace-viewer's client-side parser, so a
 * trace opened from disk by the CLI and one dropped into the viewer by a
 * user go through identical validation.
 */
export function parseTraceEntries(entries: ZipEntry[]): ParsedTrace {
  const byName = new Map(entries.map((e) => [e.name, e.data]));
  const manifestRaw = byName.get('manifest.json');
  const stepsRaw = byName.get('steps.jsonl');
  if (!manifestRaw || !stepsRaw) throw new Error('not a CrossPlay trace: missing manifest.json or steps.jsonl');
  const manifest = JSON.parse(new TextDecoder().decode(manifestRaw)) as TraceManifest;
  if (manifest.formatVersion !== TRACE_FORMAT_VERSION) {
    throw new Error(`unsupported trace formatVersion ${manifest.formatVersion} (v${TRACE_FORMAT_VERSION} only)`);
  }
  const steps = new TextDecoder()
    .decode(stepsRaw)
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as TraceStep);
  byName.delete('manifest.json');
  byName.delete('steps.jsonl');
  return { manifest, steps, assets: byName };
}
