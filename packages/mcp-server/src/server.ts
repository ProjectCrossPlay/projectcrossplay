/**
 * @projectcrossplay/mcp-server (B-105) bootstrap. Tools are registered here
 * one at a time across B-105-03/05/06/07; this file only builds the server
 * instance and carries the mandatory caution notice (founder-conditioned
 * approval, 2026-07-11 — docs/mcp-server-scoping.md §4, docs/project-proposal-mcp-v0.2.md R01/A3).
 *
 * Split from index.ts (the bin entrypoint) so the server can be built and
 * driven by a real in-memory MCP client in tests without connecting real
 * stdio — see tests/unit.test.ts.
 */
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDoctorTool } from './tools/doctor.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

export const DISCLAIMER = [
  'crossplay-mcp: this server can execute real code on behalf of the calling agent',
  '(the crossplay_test tool runs your test suite via Node). Treat granting an agent',
  'access to this server as equivalent to giving it local shell access to this',
  'project. Run it inside a sandbox you control (container, VM, or a restricted/',
  'ephemeral OS user) — it is not a safe default for an untrusted or multi-tenant caller.',
].join('\n');

export function createServer(): McpServer {
  const server = new McpServer({ name: 'crossplay-mcp', version });
  registerDoctorTool(server);
  return server;
}
