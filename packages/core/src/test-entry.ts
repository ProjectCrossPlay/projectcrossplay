/**
 * Spec-file entry point: `import { test, expect, by } from '@projectcrossplay/core/test'`.
 *
 * Separate from the package root because this module (transitively) imports
 * vitest, which only loads inside a test run — while the root entry must stay
 * importable everywhere (crossplay.config.ts, the CLI, driver packages).
 * Same split as @playwright/test vs playwright.
 */
export { test, type CrossPlayFixtures } from './test.js';
export { expect } from 'vitest';
export { by } from './selector.js';
export { App } from './app.js';
export { CrossPlayError, TimeoutError, AmbiguityError } from './errors.js';
export type { UnifiedSelector, SemanticRole } from './driver.js';
