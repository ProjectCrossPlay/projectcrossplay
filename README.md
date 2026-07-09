# CrossPlay

**One TypeScript API. One test spec. Web and native Android.**

CrossPlay is an open source cross-platform test automation framework: write a user flow once and run it against your web app (Chromium, Firefox, WebKit — Playwright-backed) and your native Android app (UIAutomator2-backed, **no Appium server**), with Playwright-quality auto-waiting, unified selectors, and a portable trace for every run.

> ⚠️ **Status: pre-release, under active development.** The v0.1.0 public release is in progress — API and docs will stabilize then. Watch the repo to follow along.

## Why

Teams with a web + mobile product maintain two test stacks today: Playwright/Cypress for web, Appium/Maestro for mobile. Same login flow, written twice, maintained twice. Appium covers platforms with poor DX; Playwright has great DX but no native mobile. CrossPlay exists to close that gap.

## What v0.1 will look like

```ts
import { test, by, expect } from '@projectcrossplay/core/test';

test('login flow', async ({ app }) => {
  await app.fill(by.testId('username'), 'demo');
  await app.fill(by.testId('password'), 's3cret');
  await app.tap(by.testId('login-button'));
  expect(await app.getText(by.testId('welcome'))).toContain('Welcome');
});
```

```bash
crossplay test --target=all   # same spec: Chromium + Firefox + WebKit + Android emulator/device
```

- **Auto-waiting on mobile at web quality** — every action waits for present, visible, stable, enabled; no sleeps, ever
- **Unified selectors** — `by.testId(...)` maps to `data-testid` on web and `resource-id`/`content-desc` on Android
- **Trace everything** — per-step screenshots, action log, failure hierarchy; `crossplay show-trace` opens a local viewer
- **15-minute onboarding** — `crossplay init` scaffolds, `crossplay doctor` diagnoses your environment
- **Extensible by design** — drivers implement one documented `PlatformDriver` interface; core never changes. iOS is the first planned driver after v0.1

## Repository layout

| Package | Purpose |
|---|---|
| [`@projectcrossplay/core`](packages/core) | Test API, selector engine, auto-wait engine, trace writer, `PlatformDriver` contract |
| [`@projectcrossplay/driver-web`](packages/driver-web) | Playwright-backed driver (Chromium/Firefox/WebKit) |
| [`@projectcrossplay/driver-android`](packages/driver-android) | UIAutomator2-backed driver over ADB |
| [`@projectcrossplay/cli`](packages/cli) | `init` · `doctor` · `test` · `show-trace` |
| [`@projectcrossplay/trace-viewer`](packages/trace-viewer) | Local trace viewer (self-contained, localhost-only) |

The `spikes/` directory holds the validation spikes behind the architecture decisions — including live-measured UIAutomator2 session startup of **1.57s** ([results](spikes/uia2-bridge/RESULTS.md)).

## Development

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm test
```

Node ≥ 20. See [CONTRIBUTING.md](CONTRIBUTING.md). Security policy: [SECURITY.md](SECURITY.md).

## License

[Apache 2.0](LICENSE)
