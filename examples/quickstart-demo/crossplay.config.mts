import { defineConfig } from '@projectcrossplay/core';

export default defineConfig({
  targets: {
    // Web target using Playwright Chromium driver
    web: {
      platform: 'web',
      use: {
        baseURL: 'http://localhost:3000',
        browser: 'chromium',
      },
    },

    // To run on Android, uncomment the following block:
    /*
    android: {
      platform: 'android',
      use: {
        // Path to your compiled debug APK
        apk: './app/build/outputs/apk/debug/app-debug.apk',
      },
    },
    */
  },
  
  // Maximum execution time for individual test actions (in milliseconds)
  timeout: 30_000,
  
  // Capture step-by-step screenshots and traces for test reporting
  trace: 'on',
});
