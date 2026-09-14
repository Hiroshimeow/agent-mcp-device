import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { WebSocketServer } from 'ws';

import { GatewayDeviceChannel } from '../dist/remote-device/gateway-channel.js';
import { GatewayDeviceIdentity } from '../dist/remote-device/gateway-identity.js';

async function testStatusCallbacksReceiveAuthAndSnapshots() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-channel-status-'));
  const identity = new GatewayDeviceIdentity(path.join(root, 'identity.json'));
  const wss = new WebSocketServer({ port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  const port = wss.address().port;
  const seen = [];
  wss.on('connection', ws => ws.on('message', raw => {
    const message = JSON.parse(raw.toString());
    if (message.type === 'enroll_hello') {
      ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_challenge', device_id: message.device_id, payload: { nonce: 'status-nonce' } }));
    } else if (message.type === 'auth_response') {
      ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_ok', device_id: message.device_id, connection_epoch: 1, payload: {
        accepted: true,
        account: { connected: true, label: 'HCU Gateway' },
        device: { id: message.device_id, name: 'ThinkBook', online: true, connectionEpoch: 1, connectedAt: 100, lastSeenAt: 100 },
        usage: { connections: 1, reconnects: 0, toolCallsStarted: 0, toolCallsSucceeded: 0, toolCallsFailed: 0, requestBytes: 0, responseBytes: 0, lastSeenAt: 100, lastErrorCode: null },
        schema: { toolCount: 16, toolSchemaBytes: 16225, toolSchemaTokenEstimate: 4057, tokenEstimateMethod: 'utf8_bytes_div_4_estimate', tokenUsageKind: 'schema_estimate_not_billing' }
      } }));
      setTimeout(() => ws.send(JSON.stringify({ protocol_version: 1, type: 'status_snapshot', device_id: message.device_id, connection_epoch: 1, payload: {
        accepted: true,
        account: { connected: true, label: 'HCU Gateway' },
        device: { id: message.device_id, name: 'ThinkBook', online: true, connectionEpoch: 1, connectedAt: 100, lastSeenAt: 200 },
        usage: { connections: 1, reconnects: 0, toolCallsStarted: 1, toolCallsSucceeded: 1, toolCallsFailed: 0, requestBytes: 123, responseBytes: 456, lastSeenAt: 200, lastErrorCode: null },
        schema: { toolCount: 16, toolSchemaBytes: 16225, toolSchemaTokenEstimate: 4057, tokenEstimateMethod: 'utf8_bytes_div_4_estimate', tokenUsageKind: 'schema_estimate_not_billing' }
      } })), 20);
    }
  }));

  const channel = new GatewayDeviceChannel({
    gatewayUrl: `ws://127.0.0.1:${port}/device`,
    enrollmentToken: 'pair-grant',
    identity,
    adapter: { async call() { return {}; } },
    onStatus: payload => { seen.push(payload); }
  });
  await channel.start();
  const deadline = Date.now() + 1000;
  while (seen.length < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(seen.length, 2);
  assert.equal(seen[0].account.label, 'HCU Gateway');
  assert.equal(seen[1].usage.toolCallsSucceeded, 1);
  await channel.stop();
  await new Promise(resolve => wss.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}

await testStatusCallbacksReceiveAuthAndSnapshots();
console.log('Gateway channel status callback test passed');
