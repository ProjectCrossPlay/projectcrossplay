# @projectcrossplay/driver-web

Playwright-backed [`PlatformDriver`](https://github.com/ProjectCrossPlay/projectcrossplay/blob/main/docs/driver-plugin.md) for [CrossPlay](https://github.com/ProjectCrossPlay/projectcrossplay): Chromium, Firefox, and WebKit behind one unified test API.

## Install

```bash
npm install -D @projectcrossplay/core @projectcrossplay/driver-web
npx playwright install   # downloads the browser binaries
```

## Usage

Register the driver for a target in `crossplay.config.ts`:

```ts
import { defineConfig } from '@projectcrossplay/core';

export default defineConfig({
  targets: {
    web: { platform: 'web', use: { baseURL: 'http://localhost:3000', browser: 'chromium' } },
  },
});
```

`browser` accepts `chromium` (default), `firefox`, or `webkit`. All auto-waiting, selector resolution, and tracing come from `@projectcrossplay/core` — this package only implements the platform-specific primitives (launch, find, act, capture).

## License

Apache-2.0
