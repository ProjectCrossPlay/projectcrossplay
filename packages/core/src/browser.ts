/**
 * Browser-safe surface — zero Node builtins. Used by
 * @projectcrossplay/trace-viewer to parse a trace file entirely client-side
 * (fetched from the local server or picked/dropped by the user), so a trace
 * loaded from disk and one opened via drag-and-drop in the viewer go through
 * the exact same validation (NFR-018: traces are untrusted data — parsed the
 * same way regardless of source, never trusted based on where they came from).
 */
export { unpackZip, packZip, crc32, type ZipEntry } from './zip.js';
export {
  parseTraceEntries,
  TRACE_FORMAT_VERSION,
  type ParsedTrace,
  type TraceManifest,
  type TraceStep,
} from './trace-format.js';
export { formatSelector } from './selector.js';
export type { UnifiedSelector } from './driver.js';
export type { WaitLogEntry } from './errors.js';
