import { describe, expect, test } from 'vitest';
import { DISCLAIMER } from '../src/server.js';
import { connected } from './helpers.js';

describe('protocol bootstrap (B-105-02)', () => {
  test('a real MCP client completes the initialize handshake', async () => {
    const { client, close } = await connected();
    expect(client.getServerVersion()?.name).toBe('crossplay-mcp');
    await close();
  });

  test('carries the founder-mandated caution + sandbox-recommendation disclaimer (2026-07-11)', () => {
    expect(DISCLAIMER).toMatch(/sandbox/i);
    expect(DISCLAIMER).toMatch(/crossplay_test/);
    expect(DISCLAIMER).toMatch(/execute real code/i);
  });

  test('lists exactly the 4 tools shipped so far, none silently dropped or duplicated', async () => {
    const { client, close } = await connected();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['crossplay_doctor', 'crossplay_read_trace', 'crossplay_scaffold', 'crossplay_test'].sort(),
    );
    await close();
  });
});

describe('crossplay_doctor tool (B-105-03)', () => {
  test('is listed with a description and no required input', async () => {
    const { client, close } = await connected();
    const { tools } = await client.listTools();
    const doctor = tools.find((t) => t.name === 'crossplay_doctor');
    expect(doctor).toMatchObject({ name: 'crossplay_doctor' });
    expect(doctor?.description).toBeTruthy();
    await close();
  });

  test('calling it returns the same structured result runDoctorChecks() produces', async () => {
    const { client, close } = await connected();
    const result = await client.callTool({ name: 'crossplay_doctor', arguments: {} });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text) as { checks: unknown[]; blocking: number; optional: number };
    expect(Array.isArray(parsed.checks)).toBe(true);
    expect(typeof parsed.blocking).toBe('number');
    expect(typeof parsed.optional).toBe('number');
    // Node.js check is always first and always present regardless of environment.
    expect(parsed.checks[0]).toMatchObject({ name: 'Node.js' });
    await close();
  });
});
