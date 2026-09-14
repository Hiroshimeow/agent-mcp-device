import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { WebSocketServer } from 'ws';

import { GatewayDeviceChannel } from '../dist/remote-device/gateway-channel.js';
import { GatewayDeviceIdentity } from '../dist/remote-device/gateway-identity.js';

async function testPairHelloAndLogout() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-account-link-'));
  const identity = new GatewayDeviceIdentity(path.join(root, 'identity.json'));
  const record = await identity.loadOrCreate();
  await identity.markEnrolled();
  const wss = new WebSocketServer({ port: 0 });
  await new Promise(resolve => wss.once('listening', resolve));
  const port = wss.address().port;
  let sawPairHello = false;
  let sawLogout = false;
  const statuses = [];

  wss.on('connection', (ws, request) => {
    assert.equal(request.headers.authorization, 'Bearer relink-grant');
    ws.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'pair_hello') {
        sawPairHello = true;
        assert.equal(message.device_id, record.deviceId);
        assert.equal(message.payload.public_key_pem, record.publicKeyPem);
        ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_challenge', device_id: record.deviceId, payload: { nonce: 'pair-nonce' } }));
      } else if (message.type === 'auth_response') {
        ws.send(JSON.stringify({ protocol_version: 1, type: 'auth_ok', device_id: record.deviceId, connection_epoch: 3, payload: {
          accepted: true,
          account: { connected: true, label: 'Example Gateway' },
          device: { id: record.deviceId, name: 'ThinkBook', online: true, connectionEpoch: 3, connectedAt: 10, lastSeenAt: 10 },
          usage: null,
          schema: null
        } }));
      } else if (message.type === 'account_logout') {
        sawLogout = true;
        ws.send(JSON.stringify({ protocol_version: 1, type: 'status_snapshot', device_id: record.deviceId, connection_epoch: 3, payload: {
          accepted: true,
          account: { connected: false, label: null },
          device: { id: record.deviceId, name: 'ThinkBook', online: true, connectionEpoch: 3, connectedAt: 10, lastSeenAt: 20 },
          usage: null,
          schema: null
        } }));
      }
    });
  });

  const channel = new GatewayDeviceChannel({
    gatewayUrl: `ws://127.0.0.1:${port}/device`,
    pairingGrant: 'relink-grant',
    identity,
    adapter: { async call() { return {}; } },
    onStatus: payload => statuses.push(payload)
  });
  await channel.start();
  assert.equal(sawPairHello, true);
  assert.equal(statuses[0].account.connected, true);
  const logout = await channel.logoutAccount();
  assert.equal(sawLogout, true);
  assert.equal(logout.account.connected, false);
  assert.equal(statuses.at(-1).account.connected, false);
  await channel.stop();
  await new Promise(resolve => wss.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
}

await testPairHelloAndLogout();
console.log('Gateway account link/logout client test passed');
