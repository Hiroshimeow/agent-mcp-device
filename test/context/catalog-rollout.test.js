import test from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { contextToolCatalog } from '../../dist/context/gateway.js';
import { gatewayCapabilities } from '../../dist/device/gateway-tool-adapter.js';
import { approvalFixture } from './fixtures/capture-approval.js';

test('SDK client refresh/re-registration sees six gated schemas without duplicates', async t => {
  const f = approvalFixture(t, ['FEATURE_PUBLIC_GATEWAY']);
  const server = new Server({ name: 'context-rollout', version: '1' }, { capabilities: { tools: { listChanged: true } } });
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: contextToolCatalog() }));
  const client = new Client({ name: 'representative-sdk-client', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  const initial = await client.listTools();
  assert.equal(initial.tools.length, 6);
  await server.sendToolListChanged();
  const refreshed = await client.listTools();
  assert.deepEqual(refreshed, initial);
  assert.equal(new Set(refreshed.tools.map(tool => tool.name)).size, 6);
  const replacement = new Client({ name: 're-registered-client', version: '1' });
  const secondServer = new Server({ name: 'context-rollout', version: '1' }, { capabilities: { tools: {} } });
  secondServer.setRequestHandler(ListToolsRequestSchema, () => ({ tools: contextToolCatalog() }));
  const [c, d] = InMemoryTransport.createLinkedPair();
  await secondServer.connect(c); await replacement.connect(d);
  try { assert.deepEqual(await replacement.listTools(), initial); }
  finally { await replacement.close(); await secondServer.close(); }
  unlinkSync(f.path);
  assert.ok(!gatewayCapabilities().some(capability => capability.startsWith('local_')));
  await assert.rejects(client.listTools(), /FEATURE_GATE_LOCKED/);
});
