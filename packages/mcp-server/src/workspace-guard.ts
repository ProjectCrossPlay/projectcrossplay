/**
 * Workspace-root path guard (B-105-04). MCP tools accept paths from a
 * calling agent, not a human typing at their own shell — the CLI itself
 * doesn't need this because a human's own shell is already the trust
 * boundary; an agent isn't (docs/mcp-server-scoping.md §4).
 *
 * Uses path.relative()+startsWith('..') rather than a string-prefix check
 * on the resolved path (e.g. `resolved.startsWith(root)`) — that exact
 * class of bug (a missing trailing separator letting a sibling directory
 * that merely shares a prefix slip through) was found and fixed twice
 * already in this repo (viewer-server.ts, examples/quickstart-demo's
 * server.mjs). relative() doesn't have that failure mode.
 */
import { isAbsolute, relative, resolve } from 'node:path';
import { CrossPlayError } from '@projectcrossplay/core';

/**
 * Resolves `candidate` against `root` and throws if the result escapes
 * `root` — whether via `../` traversal or by `candidate` itself being an
 * absolute path elsewhere on the filesystem.
 */
export function resolveWithinWorkspace(candidate: string, root: string = process.cwd()): string {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(resolvedRoot, candidate);
  const rel = relative(resolvedRoot, resolvedCandidate);

  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new CrossPlayError({
      what: `path '${candidate}' escapes the workspace root`,
      why: [`resolved to: ${resolvedCandidate}`, `workspace root: ${resolvedRoot}`],
      next: ['use a path inside the project directory'],
    });
  }
  return resolvedCandidate;
}
