# @projectcrossplay/core

Unified test API, selector engine, auto-wait engine, trace writer, and the `PlatformDriver` contract for [CrossPlay](https://github.com/ProjectCrossPlay/projectcrossplay) — one TypeScript API for web and native Android tests.

## Install

```bash
npm install -D @projectcrossplay/core @projectcrossplay/driver-web
```

## Usage

```ts
import { test, by, expect } from '@projectcrossplay/core/test';

test('login flow', async ({ app }) => {
  await app.fill(by.testId('username'), 'demo');
  await app.tap(by.testId('login-button'));
  expect(await app.getText(by.testId('welcome'))).toContain('Welcome');
});
```

`@projectcrossplay/core` is the root entry (`by`, `defineConfig`, `App`, error types, driver contract). `@projectcrossplay/core/test` additionally exports the `test`/`expect` fixtures, kept separate because they transitively load Vitest.

See the [quickstart](https://github.com/ProjectCrossPlay/projectcrossplay/blob/main/docs/quickstart.md), [selector guide](https://github.com/ProjectCrossPlay/projectcrossplay/blob/main/docs/selectors.md), and [driver-authoring guide](https://github.com/ProjectCrossPlay/projectcrossplay/blob/main/docs/driver-plugin.md) in the main repo.

## License

Apache-2.0
