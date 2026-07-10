# API reference

The full typed API surface, generated from source via TypeDoc — nothing here is hand-maintained, so it can't drift from the actual type signatures.

- [`@projectcrossplay/core`](api/index/README.md) — `test`/`app`, `by.*`, `defineConfig`, the `PlatformDriver` contract, error types, trace reading
- [`@projectcrossplay/core/test`](api/test/README.md) — the `test` fixture entry point (separate from the root export because it transitively pulls in Vitest)

Regenerate after changing any public type: `pnpm docs:api` (CI checks this stays committed — see `.github/workflows/ci.yml`).

For narrative rather than signature-level docs, start with [`quickstart.md`](quickstart.md), [`selectors.md`](selectors.md), or [`architecture.md`](architecture.md) instead.
