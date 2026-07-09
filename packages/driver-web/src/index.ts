/** @projectcrossplay/driver-web — Playwright-backed PlatformDriver (Sprint 2, B-023). */
import type { PlatformDriver } from '@projectcrossplay/core';

export const webDriverPlaceholder: Pick<PlatformDriver, 'platform'> = { platform: 'web' };
