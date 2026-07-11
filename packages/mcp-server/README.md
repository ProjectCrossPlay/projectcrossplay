# @projectcrossplay/mcp-server

Exposes [CrossPlay](https://github.com/ProjectCrossPlay/projectcrossplay) to AI coding agents over the [Model Context Protocol](https://modelcontextprotocol.io): run tests, check environment health, read trace failures, and scaffold a new project — all through tools an agent can call directly.

> ⚠️ **Run this with caution.** The `crossplay_test` tool executes real code — running your test suite via Node. Granting an agent access to this server is equivalent to giving it local shell access to this project. **Run it inside a sandbox you control** (a container, a VM, or a restricted/ephemeral OS user) — it is not a safe default for an untrusted or multi-tenant caller. See [`docs/mcp-server.md`](https://github.com/ProjectCrossPlay/projectcrossplay/blob/main/docs/mcp-server.md) for the full trust model.

## Status

Under active development (B-105). Tools ship incrementally — see [`docs/sprint-plan-mcp-v0.2.md`](https://github.com/ProjectCrossPlay/projectcrossplay/blob/main/docs/sprint-plan-mcp-v0.2.md) for what's done.

## Install

```bash
npm install -D @projectcrossplay/mcp-server
```

Configure your MCP client to launch `crossplay-mcp` over stdio. Transport is local-stdio-only by design — no network transport is exposed.

## License

Apache-2.0
