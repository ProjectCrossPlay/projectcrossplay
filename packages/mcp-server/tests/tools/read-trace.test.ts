import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { packZip, TRACE_FORMAT_VERSION } from '@projectcrossplay/core';
import { connected } from '../helpers.js';

/** Builds a real, valid .trace file — no TraceWriter needed (core doesn't
 * expose it publicly; the write side is core's own internal concern, only
 * the read side, readTrace, is a stable tooling contract). packZip is the
 * same store-only pack primitive TraceWriter uses internally. */
async function writeFixtureTrace(path: string): Promise<void> {
  const encoder = new TextEncoder();
  const manifest = {
    formatVersion: TRACE_FORMAT_VERSION,
    spec: 'demo.spec.ts › x',
    target: 'web',
    platform: 'web',
    result: 'failed' as const,
    startedAt: new Date(0).toISOString(),
    durationMs: 10,
  };
  const step = {
    i: 0,
    action: 'tap',
    status: 'failed' as const,
    t0: 0,
    t1: 10,
    error: 'element not found',
    screenshot: 'screenshots/0.png',
    hierarchy: 'hierarchy/0.html',
  };
  const zip = packZip([
    { name: 'manifest.json', data: encoder.encode(JSON.stringify(manifest)) },
    { name: 'steps.jsonl', data: encoder.encode(`${JSON.stringify(step)}\n`) },
    { name: 'screenshots/0.png', data: new Uint8Array([1, 2, 3]) },
    { name: 'hierarchy/0.html', data: encoder.encode('<html><body>hi</body></html>') },
  ]);
  await writeFile(path, zip);
}

let dir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  dir = await mkdtemp(join(tmpdir(), 'mcp-read-trace-test-'));
  // The workspace guard resolves against process.cwd() — chdir into the
  // fixture dir so a relative tracePath in the tool call round-trips
  // through the same guard a real deployment would use, rather than
  // special-casing the test around it.
  process.chdir(dir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('crossplay_read_trace tool (B-105-06)', () => {
  test('reads a real trace: action log, hierarchy text, and asset references — never embeds screenshot bytes', async () => {
    await writeFixtureTrace(join(dir, 'x.trace'));

    const { client, close } = await connected();
    const result = await client.callTool({
      name: 'crossplay_read_trace',
      arguments: { tracePath: 'x.trace' },
    });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text) as {
      manifest: { result: string };
      steps: Array<{ error?: string; hierarchyXml?: string; screenshotAsset?: string }>;
      assets: string[];
    };

    expect(parsed.manifest.result).toBe('failed');
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.steps[0]!.error).toBe('element not found');
    expect(parsed.steps[0]!.hierarchyXml).toContain('hi');
    expect(parsed.steps[0]!.screenshotAsset).toBeTruthy();
    expect(parsed.assets).toContain(parsed.steps[0]!.screenshotAsset);
    // The raw response text must never contain the screenshot's own bytes.
    expect(content[0]!.text.includes(String.fromCharCode(1, 2, 3))).toBe(false);

    await close();
  });

  test('rejects a tracePath that escapes the workspace root', async () => {
    const { client, close } = await connected();
    const result = await client.callTool({
      name: 'crossplay_read_trace',
      arguments: { tracePath: '../../../etc/passwd' },
    });
    expect(result.isError).toBe(true);
    await close();
  });

  test('rejects a path to a file that is not a valid trace', async () => {
    const { client, close } = await connected();
    const result = await client.callTool({ name: 'crossplay_read_trace', arguments: { tracePath: 'nope.trace' } });
    expect(result.isError).toBe(true);
    await close();
  });
});
