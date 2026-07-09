/**
 * The CrossPlay driver contract (architecture doc §3.2, ADR-002).
 *
 * This interface is the extension boundary of the whole framework: platform
 * drivers (`@projectcrossplay/driver-web`, `@projectcrossplay/driver-android`, future iOS or
 * community drivers) implement it, and core owns everything platform-neutral
 * on top of it — selector resolution policy, the auto-wait loop, tracing, and
 * error wording.
 *
 * Contract rules (violating these breaks cross-platform parity):
 * 1. Drivers never wait. `findElements` and `getElementState` return the
 *    current state immediately; core's auto-wait engine decides when to retry.
 * 2. Drivers never throw ambiguity errors. `findElements` returns all matches;
 *    core raises the candidate-listing error (FR-032).
 * 3. Widening this interface is semver-relevant. Within 0.x, only additive
 *    optional members are allowed. Platform-specific capability goes through
 *    `native<T>()`, not new required methods.
 */

export interface PlatformDriver {
  /** Stable platform identifier: 'web' | 'android' | future 'ios', 'flutter'… */
  readonly platform: string;
  launch(target: TargetConfig, ctx: LaunchContext): Promise<DriverSession>;
}

export interface DriverSession {
  /** Resolve a unified selector to zero or more element handles. Never waits. */
  findElements(selector: UnifiedSelector): Promise<ElementHandle[]>;

  /**
   * Cheap state snapshot for one element. Called repeatedly (adaptive backoff)
   * by core's auto-wait loop, so implementations must avoid expensive work:
   * no screenshots, no hierarchy dumps, no reflows beyond what the platform
   * requires to answer.
   */
  getElementState(el: ElementHandle): Promise<ElementState>;

  /** Execute a primitive action on an element core has already deemed actionable. */
  performAction(el: ElementHandle, action: DriverAction): Promise<void>;

  /** Platform state capture for traces (FR-050/052). */
  captureState(kind: 'screenshot'): Promise<Uint8Array>;
  captureState(kind: 'hierarchy'): Promise<string>;

  /**
   * Escape hatch (FR-003): the raw platform object — Playwright Page for web,
   * AndroidBridge session for Android. Type parameter is caller-asserted.
   */
  native<T>(): T;

  /** Release everything: processes, connections, port-forwards. Idempotent. */
  dispose(): Promise<void>;
}

/** Unified selector produced by `by.*` (FR-030/031). */
export type UnifiedSelector =
  | { kind: 'testId'; value: string }
  | { kind: 'text'; value: string; exact?: boolean }
  | { kind: 'role'; role: SemanticRole; name?: string };

/** Semantic roles with defined mappings on every platform (spec §3.4). */
export type SemanticRole =
  | 'button'
  | 'textbox'
  | 'checkbox'
  | 'switch'
  | 'link'
  | 'image'
  | 'heading'
  | 'listitem';

/** Opaque, driver-owned element reference. Core never inspects it. */
export interface ElementHandle {
  readonly id: string;
}

/** Snapshot consumed by the auto-wait engine (FR-040). */
export interface ElementState {
  present: boolean;
  visible: boolean;
  enabled: boolean;
  /** Viewport-relative bounding box; null when not present/rendered. */
  bounds: { x: number; y: number; width: number; height: number } | null;
}

export type DriverAction =
  | { kind: 'tap' }
  | { kind: 'fill'; value: string; /** trace masking flag, default true (NFR-017) */ mask?: boolean }
  | { kind: 'clear' }
  | { kind: 'getText' };

/** One named target from crossplay.config.ts (FR-104 shape, minimal in v0.1). */
export interface TargetConfig {
  name: string;
  platform: string;
  use: WebTargetOptions | AndroidTargetOptions;
}

export interface WebTargetOptions {
  baseURL: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
}

export interface AndroidTargetOptions {
  apk: string;
  /** ADB serial; omit = single connected device (FR-021). */
  device?: string;
}

/** Facilities core hands to a driver at launch. */
export interface LaunchContext {
  /** Global action timeout in ms (default 30_000, FR-042). */
  timeout: number;
  /** Register cleanup that must run even if the test crashes (NFR-014). */
  onDispose(fn: () => Promise<void>): void;
  /** Structured driver diagnostics routed into the trace, never stdout. */
  log(message: string): void;
}
