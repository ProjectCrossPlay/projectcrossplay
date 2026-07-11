/**
 * crossplay_read_trace tool (B-105-06) — thin wrapper around core's
 * readTrace(), which already treats trace files as untrusted input
 * (ADR-003, NFR-018). Screenshot bytes are never embedded in the tool's
 * response, only asset names — hierarchy dumps (text/XML) are decoded
 * and included in full, since they're the useful failure-debugging signal
 * an agent needs and aren't binary.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readTrace } from '@projectcrossplay/core';
import { resolveWithinWorkspace } from '../workspace-guard.js';

export function registerReadTraceTool(server: McpServer): void {
  server.registerTool(
    'crossplay_read_trace',
    {
      title: 'Read a CrossPlay trace file',
      description:
        'Parse a .trace file and return the action log, per-step status/errors, and any captured DOM hierarchy ' +
        'dumps. Read-only. Screenshot bytes are never embedded in the response — only asset names are listed.',
      inputSchema: {
        tracePath: z.string().describe('Path to a .trace file, relative to the workspace root.'),
      },
    },
    async ({ tracePath }) => {
      let resolvedPath: string;
      try {
        resolvedPath = resolveWithinWorkspace(tracePath);
      } catch (e) {
        return { isError: true, content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }] };
      }

      let trace: Awaited<ReturnType<typeof readTrace>>;
      try {
        trace = await readTrace(resolvedPath);
      } catch (e) {
        return { isError: true, content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }] };
      }

      const steps = trace.steps.map((s) => ({
        i: s.i,
        action: s.action,
        ...(s.selector !== undefined ? { selector: s.selector } : {}),
        status: s.status,
        durationMs: s.t1 - s.t0,
        ...(s.error !== undefined ? { error: s.error } : {}),
        ...(s.waitLog !== undefined ? { waitLog: s.waitLog } : {}),
        ...(s.screenshot !== undefined ? { screenshotAsset: s.screenshot } : {}),
        ...(s.hierarchy !== undefined && trace.assets.has(s.hierarchy)
          ? { hierarchyXml: new TextDecoder().decode(trace.assets.get(s.hierarchy)!) }
          : {}),
      }));

      const result = { manifest: trace.manifest, steps, assets: Array.from(trace.assets.keys()) };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
