import { defineConfig } from '@projectcrossplay/core';

const baseURL = `http://127.0.0.1:${process.env['PORT'] ?? 4173}`;

// One target per engine (FR-010–012) + the native Android demo apps — the
// same tests/demo.spec.ts runs on every target with zero branching (G1/FR-070).
export default defineConfig({
  targets: {
    chromium: { platform: 'web', use: { baseURL, browser: 'chromium' } },
    firefox: { platform: 'web', use: { baseURL, browser: 'firefox' } },
    webkit: { platform: 'web', use: { baseURL, browser: 'webkit' } },
    'android-kotlin': {
      platform: 'android',
      use: {
        apk: '../demo-android-kotlin/app/build/outputs/apk/debug/app-debug.apk',
        appId: 'com.projectcrossplay.demo',
      },
    },
    'android-rn': {
      platform: 'android',
      use: {
        // release build: JS bundled into the APK, no Metro needed
        apk: '../demo-android-rn/android/app/build/outputs/apk/release/app-release.apk',
        appId: 'com.crossplaydemo',
      },
    },
  },
  timeout: 30_000,
  trace: 'on',
});
