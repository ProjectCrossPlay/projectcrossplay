import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

/** Connects a fresh server+client pair over a real in-memory transport (no mocks). */
export async function connected(): Promise<{ client: Client; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, close: async () => Promise.all([client.close(), server.server.close()]).then(() => undefined) };
}
