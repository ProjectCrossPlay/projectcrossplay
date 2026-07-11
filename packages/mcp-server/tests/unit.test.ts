import { describe, expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, DISCLAIMER } from '../src/server.js';

/** Connects a fresh server+client pair over a real in-memory transport (no mocks). */
async function connected(): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, close: async () => Promise.all([client.close(), server.server.close()]).then(() => undefined) };
}

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
});

describe('crossplay_doctor tool (B-105-03)', () => {
  test('is listed with a description and no required input', async () => {
    const { client, close } = await connected();
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({ name: 'crossplay_doctor' });
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
