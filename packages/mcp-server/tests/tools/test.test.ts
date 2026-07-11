import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { connected } from '../helpers.js';

let dir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  dir = await mkdtemp(join(tmpdir(), 'mcp-test-tool-test-'));
  process.chdir(dir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
});

describe('crossplay_test tool (B-105-05)', () => {
  test('is listed with a description that carries the ACE caution notice', async () => {
    const { client, close } = await connected();
    const { tools } = await client.listTools();
    const testTool = tools.find((t) => t.name === 'crossplay_test');
    expect(testTool?.description).toMatch(/CAUTION/);
    expect(testTool?.description).toMatch(/sandbox/i);
    await close();
  });

  test('rejects a specPath that escapes the workspace root before touching Vitest', async () => {
    const { client, close } = await connected();
    const result = await client.callTool({
      name: 'crossplay_test',
      arguments: { specPath: '../../../etc/passwd' },
    });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toMatch(/escapes the workspace root/);
    await close();
  });

  test('with no crossplay.config in the workspace, fails clearly instead of crashing', async () => {
    // A full successful-run proof (real target, real driver) belongs to
    // B-105-08's CI smoke test — that needs a real config + spec + running
    // browser/emulator, which is integration territory, not a unit test.
    // This test covers the error path any config-less workspace hits.
    const { client, close } = await connected();
    const result = await client.callTool({ name: 'crossplay_test', arguments: {} });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toMatch(/cannot read target names|no targets configured/);
    await close();
  });
});
