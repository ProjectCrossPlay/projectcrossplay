/**
 * @crossplay/core public surface.
 *
 * v0.1.0-dev: driver contract only (M1 deliverable). The runtime — test(),
 * app, by, selector engine, auto-wait engine, trace writer — lands in Sprint 2
 * (B-020..B-025) behind this contract.
 */
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
