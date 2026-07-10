[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / MASKED\_VALUE

# Variable: MASKED\_VALUE

> `const` **MASKED\_VALUE**: `"•••••••"` = `'•••••••'`

@projectcrossplay/core public surface (fully typed, FR-002).

This root entry is importable everywhere — config files, the CLI, driver
packages. `test`/`expect` live in '@projectcrossplay/core/test' because
they transitively import vitest, which only loads inside a test run.

User-facing here: by, defineConfig, App, errors.
Driver authors: the PlatformDriver contract types.
Tooling (CLI/viewer): trace reading.
