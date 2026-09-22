import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { GatewayDeviceIdentity } from '../dist/device/gateway-identity.js';
import { resolvePairingIdentity } from '../dist/npm-scripts/remote.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-forgotten-repair-'));
try {
  const identity = new GatewayDeviceIdentity(path.join(root, 'identity.json'));
  const original = await identity.loadOrCreate();
  await identity.markEnrolled();

  let probes = 0;
  const fresh = await resolvePairingIdentity(identity, {
    forcePair: true,
    probeCurrentIdentity: async () => {
      probes += 1;
      const error = new Error('Gateway connection closed (4003): unknown or revoked device');
      error.code = 'DEVICE_FORGOTTEN';
      throw error;
    }
  });
  assert.equal(probes, 1);
  assert.notEqual(fresh.deviceId, original.deviceId, 'forgotten server identity must be replaced before re-pairing');
  assert.notEqual(fresh.publicKeyPem, original.publicKeyPem, 'fresh pairing must use a new Ed25519 identity');
  assert.equal(fresh.enrolled, false);

  const stableIdentity = new GatewayDeviceIdentity(path.join(root, 'stable.json'));
  const stable = await stableIdentity.loadOrCreate();
  await stableIdentity.markEnrolled();
  const reused = await resolvePairingIdentity(stableIdentity, {
    forcePair: true,
    probeCurrentIdentity: async () => { probes += 1; }
  });
  assert.equal(reused.deviceId, stable.deviceId, 'healthy enrolled identity should be reused when switching/relinking account');

  const transientIdentity = new GatewayDeviceIdentity(path.join(root, 'transient.json'));
  const transient = await transientIdentity.loadOrCreate();
  await transientIdentity.markEnrolled();
  await assert.rejects(
    resolvePairingIdentity(transientIdentity, {
      forcePair: true,
      probeCurrentIdentity: async () => { throw Object.assign(new Error('network down'), { code: 'ECONNRESET' }); }
    }),
    /network down/
  );
  assert.equal((await transientIdentity.loadOrCreate()).deviceId, transient.deviceId, 'transient failures must never rotate identity');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
console.log('Forgotten-device re-pair identity tests passed');
