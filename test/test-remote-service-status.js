import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import * as remoteModule from '../dist/npm-scripts/remote.js';
import { GatewayDeviceStatusStore } from '../dist/remote-device/device-status.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dc-remote-service-status-'));
try {
  const store = new GatewayDeviceStatusStore(path.join(root, 'gateway-status.json'));
  await store.update({
    gatewayUrl: 'https://gateway.test',
    deviceId: 'thinkbook',
    deviceName: 'ThinkBook',
    identityPresent: true,
    account: { connected: true, label: 'HCU Gateway' },
    connection: { online: true, connectionEpoch: 7, lastConnectedAt: Date.now() }
  });

  assert.equal(typeof remoteModule.applyServiceCommandStatus, 'function');
  await remoteModule.applyServiceCommandStatus(store, 'stop');
  assert.equal((await store.load()).connection.online, false);

  await store.update({ connection: { online: true, connectionEpoch: 8, lastConnectedAt: Date.now() } });
  await remoteModule.applyServiceCommandStatus(store, 'uninstall');
  const afterUninstall = await store.load();
  assert.equal(afterUninstall.connection.online, false);
  assert.equal(afterUninstall.account.connected, true, 'stopping the runtime must not unlink the account');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log('Remote service status transition test passed');
