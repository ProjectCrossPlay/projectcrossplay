/** @crossplay/driver-android — UIAutomator2-backed PlatformDriver (Sprint 3, B-030; bridge per ADR-002). */
import type { PlatformDriver } from '@crossplay/core';

export const androidDriverPlaceholder: Pick<PlatformDriver, 'platform'> = { platform: 'android' };
