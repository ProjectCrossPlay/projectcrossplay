#!/usr/bin/env node
/**
 * crossplay-mcp bin entrypoint (B-105-02). Stdio transport only — no
 * network transport is wired here by design (local-only trust boundary,
 * docs/mcp-server-scoping.md §4).
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, DISCLAIMER } from './server.js';

console.error(DISCLAIMER);
await createServer().server.connect(new StdioServerTransport());
