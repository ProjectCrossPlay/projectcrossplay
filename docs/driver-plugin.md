# Writing a driver

A driver is a separate npm package that implements `PlatformDriver` from `@projectcrossplay/core`. Core never imports a driver — the user's project depends on the driver package it needs, and `crossplay.config.ts` points at it. This is how `driver-web` and `driver-android` are built; an iOS or Flutter driver (or a private, closed-source one for an internal app framework) is meant to be built the same way, outside this repo if you like.

## The contract

```ts
import type { PlatformDriver, DriverSession, TargetConfig, LaunchContext } from '@projectcrossplay/core';

export const driver: PlatformDriver = {
  platform: 'my-platform', // stable identifier, matched against config

  async launch(target: TargetConfig, ctx: LaunchContext): Promise<DriverSession> {
    // stand up whatever this platform needs (browser, device connection, ...)
  },
};

export default driver; // registry accepts either a named `driver` export or default
```

`DriverSession` is the per-run object core drives:

```ts
export interface DriverSession {
  findElements(selector: UnifiedSelector): Promise<ElementHandle[]>;
  getElementState(el: ElementHandle): Promise<ElementState>;
  performAction(el: ElementHandle, action: DriverAction): Promise<void>;
  getText(el: ElementHandle): Promise<string>;
  navigate?(url: string): Promise<void>; // optional — web-shaped platforms only
  captureState(kind: 'screenshot'): Promise<Uint8Array>;
  captureState(kind: 'hierarchy'): Promise<string>;
  native<T>(): T; // escape hatch to the raw platform object
  dispose(): Promise<void>; // idempotent
}
```

## Three rules that aren't optional

1. **Drivers never wait.** `findElements` and `getElementState` report current reality immediately. Core's auto-wait engine (adaptive backoff, present → visible → stable → enabled) is the only place polling happens — that's what keeps timing behavior identical across platforms. If your primitive has its own short internal timeout (Playwright's actionability check, for instance), that's fine as a secondary safety net on an element core has already deemed actionable, never as the thing tests actually wait on.
2. **Drivers never resolve ambiguity.** `findElements` returns *every* match; core raises `AmbiguityError` (with the candidate list) when there's more than one. Don't pick "the first match" inside a driver — that policy belongs in core so its wording and behavior are identical everywhere.
3. **`dispose()` is idempotent and best-effort per resource.** It's called on every exit path — pass, fail, or crash — via `ctx.onDispose()` (see below), so it has to release everything (processes, connections, forwarded ports) even if the session is already half-broken. Guard each teardown step so one failing step doesn't skip the rest.

## Selectors

You'll receive a `UnifiedSelector` — a discriminated union with `kind: 'testId' | 'text' | 'role'` — and translate it into your platform's native query language. You choose the query strategy; core just needs `ElementHandle[]` back. Look at `driver-web`'s `toLocator` (DOM: `data-testid`, Playwright's `getByText`/`getByRole`) and `driver-android`'s `toQueries` (UiSelector strings, resource-id/content-desc/class matching) for two different but valid approaches — including `driver-android`'s pattern of running a selector kind as *multiple* underlying queries and merging results, for platforms where one unified concept (like `testId`) can land in more than one native place.

## A minimal `launch()`

```ts
export const driver: PlatformDriver = {
  platform: 'my-platform',

  async launch(target: TargetConfig, ctx: LaunchContext): Promise<DriverSession> {
    const use = target.use as MyTargetOptions;
    if (!use?.someRequiredOption) {
      throw new CrossPlayError({
        what: `target '${target.name}' has no someRequiredOption`,
        next: [`set targets.${target.name}.use.someRequiredOption in crossplay.config.ts`],
      });
    }

    ctx.log('launching');
    const handle = await connectToWhateverThisPlatformIs();
    const session = new MySession(handle);

    // Register cleanup before anything else risky, so a mid-launch crash still unwinds.
    ctx.onDispose(() => session.dispose());

    return session;
  },
};
```

`ctx` also carries `timeout` (the configured global action timeout, in case a launch-time operation needs to respect it) — most drivers only need `onDispose` and `log`.

## Errors

Throw `CrossPlayError` (from `@projectcrossplay/core`) for anything user-actionable — a missing config option, a tool not found, an app not installed. Every CrossPlay error follows the same three-part shape: **what** failed (one line), **why** (evidence lines), **next** (actionable fix). Reuse this shape rather than inventing your own error format; it's what makes failures read the same regardless of which driver produced them.

```ts
throw new CrossPlayError({
  what: `app 'com.example.app' is not installed on ${serial}`,
  next: [
    `set targets.${target.name}.use.apk so CrossPlay can install it`,
    `or install it yourself: adb -s ${serial} install <apk>`,
  ],
});
```

## Wiring it up

Users install your package and either rely on the built-in `platform` → package mapping (only `web` and `android` are built in) or set `driver` explicitly:

```ts
export default defineConfig({
  targets: {
    myTarget: {
      platform: 'my-platform',
      driver: '@my-scope/crossplay-driver-my-platform',
      use: { someRequiredOption: '...' },
    },
  },
});
```

The registry resolves your package from the *user's* project (not from core), imports it, and checks that the exported driver's `platform` matches the config — so a driver/platform mismatch fails with a clear error instead of silently doing the wrong thing.

## Versioning

Within the `0.x` line, `PlatformDriver`/`DriverSession` only grow via **additive optional members** — see `navigate?` as the existing example (web implements it; other platforms simply omit it and `app.goto()` raises a clear "not supported on this platform" error). Anything platform-specific that doesn't fit the unified contract goes through `native<T>()`, not a new required method — that's what keeps the core interface stable while platform-specific capability still has an escape hatch.
