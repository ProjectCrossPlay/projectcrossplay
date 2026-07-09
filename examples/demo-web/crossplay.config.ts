import { defineConfig } from '@projectcrossplay/core';

const baseURL = `http://127.0.0.1:${process.env['PORT'] ?? 4173}`;

// One target per engine (FR-010–012); the Android target joins in Sprint 3.
export default defineConfig({
  targets: {
    chromium: { platform: 'web', use: { baseURL, browser: 'chromium' } },
    firefox: { platform: 'web', use: { baseURL, browser: 'firefox' } },
    webkit: { platform: 'web', use: { baseURL, browser: 'webkit' } },
  },
  timeout: 30_000,
  trace: 'on',
});
