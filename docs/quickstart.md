# Quickstart

Goal: a passing test against your web app in under 15 minutes. Android is a few extra minutes if you have an emulator or device already set up.

## 1. Install

```bash
npm install -D @projectcrossplay/cli @projectcrossplay/core @projectcrossplay/driver-web
```

Add `@projectcrossplay/driver-android` too if you're testing a native Android app. Node 20.19+, 22.12+, or 24+ is required.

## 2. Scaffold

```bash
npx crossplay init
```

This creates two files (it never overwrites anything that already exists):

- `crossplay.config.ts` — one `web` target pointed at `http://localhost:3000`, an `android` target commented out
- `tests/example.spec.ts` — a one-test starting point

Pass `--ci` to also scaffold a GitHub Actions workflow (`.github/workflows/crossplay.yml`).

## 3. Check your environment

```bash
npx crossplay doctor
```

`doctor` checks Node version, config presence, Playwright browser installs, and (only if you're planning to test Android) ADB + a connected device/emulator. Only `✖` failures block you — `⚠` warnings are for capabilities you aren't using yet. Each failing line prints the fix to run.

If the web driver warns that no browser is installed:

```bash
npx playwright install chromium
```

## 4. Point the config at your app

Edit `crossplay.config.ts`:

```ts
import { defineConfig } from '@projectcrossplay/core';

export default defineConfig({
  targets: {
    web: {
      platform: 'web',
      use: { baseURL: 'http://localhost:3000', browser: 'chromium' },
    },
  },
  timeout: 30_000,
  trace: 'on',
});
```

`baseURL` is the only thing you'll usually change — point it at your app's dev server (start that server yourself before running tests; CrossPlay doesn't manage app processes).

## 5. Write a spec

```ts
import { by, expect, test } from '@projectcrossplay/core/test';

test('login flow', async ({ app }) => {
  await app.fill(by.testId('username'), 'demo');
  await app.fill(by.testId('password'), 's3cret');
  await app.tap(by.testId('login-button'));
  expect(await app.getText(by.testId('welcome'))).toContain('Welcome');
});
```

`app` is the only fixture you need — every action (`tap`, `fill`, `getText`, `waitFor`) auto-waits for the element to be present, visible, stable, and enabled before acting; there's no manual `sleep()` or explicit wait call anywhere in a normal spec. See [`selectors.md`](selectors.md) for what `by.testId`/`by.text`/`by.role` map to on each platform.

## 6. Run it

```bash
npx crossplay test --target web
```

Exit code is the number of failed tests (0 = all green — safe to use directly in CI). Add `--json` for machine-readable output.

## 7. Look at what happened

Every run writes a `.trace` file per test to `.crossplay/traces/` (screenshots + action log + failure hierarchy dumps). Open one:

```bash
crossplay show-trace .crossplay/traces/<the-file>.trace
```

This starts a local, localhost-only viewer and opens your browser to it. Traces are treated as untrusted input by the viewer (it will happily open one someone hands you, e.g. from a bug report) — nothing in a trace ever executes.

## Adding Android

1. Build a debug APK, or use one you already have.
2. Uncomment the `android` target in `crossplay.config.ts` and point `apk` at it:
   ```ts
   android: {
     platform: 'android',
     use: { apk: './app/build/outputs/apk/debug/app-debug.apk' },
   },
   ```
3. Start an emulator (`emulator -avd <name>`) or plug in a device with USB debugging enabled.
4. `npx crossplay doctor` again — it'll confirm ADB + device detection.
5. `npx crossplay test --target android`

The **same spec file** runs unchanged against both targets — `app.tap(...)` is a native tap on Android and a click on web; that's the point. `by.testId(...)` maps to `resource-id`/`content-desc` instead of `data-testid`. No `--target` branching in test code, ever.

Run everything at once with `--target all` (comma-separated names also work: `--target web,android`).

## What's next

- [`selectors.md`](selectors.md) — the full `by.*` → platform mapping
- [`architecture.md`](architecture.md) — how the pieces fit together
- [`driver-plugin.md`](driver-plugin.md) — write a driver for another platform
- [`api-reference.md`](api-reference.md) — the full typed API surface
