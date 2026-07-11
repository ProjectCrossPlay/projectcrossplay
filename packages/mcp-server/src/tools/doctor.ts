/**
 * crossplay_doctor tool (B-105-03) — thin wrapper around the CLI's
 * `runDoctorChecks()`, which already returns structured data. No input.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runDoctorChecks } from '@projectcrossplay/cli/doctor';

export function registerDoctorTool(server: McpServer): void {
  server.registerTool(
    'crossplay_doctor',
    {
      title: 'CrossPlay environment check',
      description:
        'Check the local environment for CrossPlay testing: Node.js version, config file, Playwright browser installs, and Android ADB/device availability. Read-only — never modifies anything.',
    },
    async () => {
      const result = await runDoctorChecks();
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
