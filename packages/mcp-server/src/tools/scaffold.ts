/**
 * crossplay_scaffold tool (B-105-07) — thin wrapper around the CLI's
 * scaffoldFiles(), extracted from init() the same way runDoctorChecks()
 * was extracted from doctor(): the console-printing entrypoint stays
 * CLI-only since stdout is the MCP transport channel.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { scaffoldFiles } from '@projectcrossplay/cli/init';

export function registerScaffoldTool(server: McpServer): void {
  server.registerTool(
    'crossplay_scaffold',
    {
      title: 'Scaffold a CrossPlay project',
      description:
        'Create crossplay.config.mts and an example spec in the current directory. Never overwrites existing files.',
      inputSchema: {
        ci: z.boolean().optional().describe('Also scaffold a GitHub Actions workflow.'),
      },
    },
    async ({ ci }) => {
      const results = await scaffoldFiles(ci !== undefined ? { ci } : {});
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    },
  );
}
