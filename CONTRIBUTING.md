# Contributing to CrossPlay

Thanks for your interest! v0.1 is under active initial development; the contribution surface will stabilize at v0.1.0.

- **Architecture**: start with `docs/architecture.md` in the project docs. The `PlatformDriver` contract in `packages/core/src/driver.ts` is the extension boundary — new platform drivers implement it without touching core.
- **Setup**: Node ≥ 20, `pnpm install`, `pnpm build`, `pnpm test`.
- **Monorepo**: `packages/core` (API + engines), `packages/driver-web`, `packages/driver-android`, `packages/cli`, `packages/trace-viewer`.
- **Rules**: no `any` in public API surfaces; every action goes through the core auto-wait engine (drivers never wait); all resources released via dispose paths.
- **License**: Apache 2.0. By contributing you agree your contributions are licensed under it.

Driver-plugin authoring guide lands with v0.1.0 (`docs/driver-plugin.md`).
