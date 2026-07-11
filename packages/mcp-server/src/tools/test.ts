/**
 * crossplay_test tool (B-105-05) — the one genuinely arbitrary-code-execution
 * surface in this server (docs/project-proposal-mcp-v0.2.md R01/A3). Wraps
 * the CLI's runTarget()/resolveTargets(), which already return structured
 * data via Vitest's programmatic API — never shells out to the `crossplay`
 * binary and scrapes its stdout (R03 guardrail).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { resolveTargets, runTarget } from '@projectcrossplay/cli/test-cmd';
import { DISCLAIMER } from '../server.js';
import { resolveWithinWorkspace } from '../workspace-guard.js';

export function registerTestTool(server: McpServer): void {
  server.registerTool(
    'crossplay_test',
    {
      title: 'Run CrossPlay tests',
      description:
        'Run the CrossPlay test suite for one or more targets. CAUTION: this executes real code — ' +
        'it runs your test suite via Node/Vitest, equivalent to giving the calling agent local shell ' +
        'access to run tests in this project. Only expose this tool inside a sandbox you control.',
      inputSchema: {
        target: z
          .string()
          .optional()
          .describe("Target name, comma-separated names, or 'all'. Omit to run the first configured target."),
        specPath: z
          .string()
          .optional()
          .describe('Path to a specific spec file, relative to the workspace root. Omit to run the full suite.'),
      },
    },
    async ({ target, specPath }) => {
      // Belt-and-suspenders: printed at server startup too, but an agent
      // could be handed a long-lived connection — repeat it at the one
      // moment code is actually about to execute.
      console.error(DISCLAIMER);

      let validatedSpecPath: string | undefined;
      try {
        validatedSpecPath = specPath ? resolveWithinWorkspace(specPath) : undefined;
      } catch (e) {
        return { isError: true, content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }] };
      }

      const resolved = await resolveTargets(target ?? '');
      if (!resolved.ok) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                resolved.reason === 'unreadable-config'
                  ? 'cannot read target names from crossplay.config — pass `target` explicitly'
                  : 'no targets configured — run crossplay_scaffold or crossplay init first',
            },
          ],
        };
      }

      const results = [];
      for (const t of resolved.targets) {
        results.push(await runTarget(t, { quiet: true, ...(validatedSpecPath !== undefined ? { specPath: validatedSpecPath } : {}) }));
      }
      const passed = results.reduce((n, r) => n + r.passed, 0);
      const failed = results.reduce((n, r) => n + r.failed, 0);

      return {
        isError: failed > 0,
        content: [{ type: 'text', text: JSON.stringify({ targets: results, passed, failed }, null, 2) }],
      };
    },
  );
}
