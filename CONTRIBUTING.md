# Contributing to CrossPlay

Thanks for your interest! v0.1 is under active initial development; the contribution surface will stabilize at v0.1.0.

- **Architecture**: start with [`docs/architecture.md`](docs/architecture.md). The `PlatformDriver` contract in `packages/core/src/driver.ts` is the extension boundary — new platform drivers implement it without touching core; see [`docs/driver-plugin.md`](docs/driver-plugin.md) for a full guide.
- **Setup**: Node ≥ 20, `pnpm install`, `pnpm build`, `pnpm test`. (`pnpm build` also relinks `examples/demo-web`'s `crossplay` bin — pnpm only creates workspace bin shims for targets that already exist on disk, and `@projectcrossplay/cli`'s `dist/index.js` doesn't exist until the first build. If you ever see `Command "crossplay" not found` after a fresh clone, that's this — rerun `pnpm build`.)
- **Monorepo**: `packages/core` (API + engines), `packages/driver-web`, `packages/driver-android`, `packages/cli`, `packages/trace-viewer`.
- **Docs**: [`docs/quickstart.md`](docs/quickstart.md), [`docs/selectors.md`](docs/selectors.md), [`docs/api-reference.md`](docs/api-reference.md) (generated — run `pnpm docs:api` after changing a public type and commit the result; CI checks it's not stale).
- **Rules**: no `any` in public API surfaces; every action goes through the core auto-wait engine (drivers never wait); all resources released via dispose paths.
- **License**: Apache 2.0. By contributing you agree your contributions are licensed under it.
