import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { connected } from '../helpers.js';

let dir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  dir = await mkdtemp(join(tmpdir(), 'mcp-scaffold-test-'));
  process.chdir(dir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('crossplay_scaffold tool (B-105-07)', () => {
  test('creates the config and example spec in a fresh directory', async () => {
    const { client, close } = await connected();
    const result = await client.callTool({ name: 'crossplay_scaffold', arguments: {} });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const results = JSON.parse(content[0]!.text) as Array<{ path: string; action: string; reason?: string }>;

    const config = results.find((r) => r.path === 'crossplay.config.mts');
    expect(config?.action).toBe('created');
    await expect(readFile(join(dir, 'crossplay.config.mts'), 'utf8')).resolves.toContain('defineConfig');

    const ci = results.find((r) => r.path.includes('crossplay.yml'));
    expect(ci?.action).toBe('skipped');
    expect(ci?.reason).toBe('ci-not-requested');
    await close();
  });

  test('scaffolds the CI workflow too when ci: true', async () => {
    const { client, close } = await connected();
    const result = await client.callTool({ name: 'crossplay_scaffold', arguments: { ci: true } });
    const content = result.content as Array<{ type: string; text: string }>;
    const results = JSON.parse(content[0]!.text) as Array<{ path: string; action: string }>;
    const ci = results.find((r) => r.path.includes('crossplay.yml'));
    expect(ci?.action).toBe('created');
    await close();
  });

  test('never overwrites an existing file', async () => {
    const { client: c1, close: close1 } = await connected();
    await c1.callTool({ name: 'crossplay_scaffold', arguments: {} });
    await close1();

    const { client: c2, close: close2 } = await connected();
    const result = await c2.callTool({ name: 'crossplay_scaffold', arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    const results = JSON.parse(content[0]!.text) as Array<{ path: string; action: string; reason?: string }>;
    const config = results.find((r) => r.path === 'crossplay.config.mts');
    expect(config?.action).toBe('skipped');
    expect(config?.reason).toBe('exists');
    await close2();
  });
});
