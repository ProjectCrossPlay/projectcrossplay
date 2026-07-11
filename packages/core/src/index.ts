/**
 * @projectcrossplay/core public surface (fully typed, FR-002).
 *
 * This root entry is importable everywhere — config files, the CLI, driver
 * packages. `test`/`expect` live in '@projectcrossplay/core/test' because
 * they transitively import vitest, which only loads inside a test run.
 *
 * User-facing here: by, defineConfig, App, errors.
 * Driver authors: the PlatformDriver contract types.
 * Tooling (CLI/viewer): trace reading.
 */

// The app object (B-020); `test` itself is in '@projectcrossplay/core/test'
export { App, MASKED_VALUE } from './app.js';

// Selectors (B-022)
export { by, formatSelector } from './selector.js';

// Config (B-021)
export { defineConfig, resolveTarget, type CrossPlayConfig, type TargetDef } from './config.js';

// Errors (3-part contract)
export { CrossPlayError, TimeoutError, AmbiguityError, type ErrorParts, type WaitLogEntry } from './errors.js';

// Reporter seam (FR-071)
export type { CrossPlayReporter, ReporterEvent } from './reporter.js';

// Trace (B-025, ADR-003)
export {
  readTrace,
  TRACE_FORMAT_VERSION,
  type ParsedTrace,
  type TraceManifest,
  type TraceStep,
} from './trace.js';

// Internal building blocks exposed for drivers/tooling
export { DisposeScope } from './dispose.js';
export { loadDriver } from './registry.js';
export { waitFor as waitForElement, type WaitOptions, type WaitResult } from './wait.js';
// Store-only zip pack/unpack (ADR-003) — exposed so tooling (the MCP server's
// tests, B-105-06) can build real trace fixtures without a private import
// into another package's compiled output. Symmetric with readTrace: unpack
// already treats any input as untrusted regardless of who packed it.
export { packZip, unpackZip, type ZipEntry } from './zip.js';

// The G5 driver contract
export type {
  PlatformDriver,
  DriverSession,
  UnifiedSelector,
  SemanticRole,
  ElementHandle,
  ElementState,
  DriverAction,
  TargetConfig,
  WebTargetOptions,
  AndroidTargetOptions,
  LaunchContext,
} from './driver.js';
