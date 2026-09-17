import assert from 'assert';
import { generateKeyPairSync } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { GatewayDeviceIdentity } from '../dist/device/gateway-identity.js';
import { protectWindowsSecret, unprotectWindowsSecret } from '../dist/device/windows-dpapi.js';

async function testDpapiRunnerKeepsSecretOffCommandLine() {
  const secret = Buffer.from('not-on-command-line');
  const runner = async (script, input) => {
    assert.equal(script.includes(secret.toString('utf8')), false);
    assert.equal(input, secret.toString('base64'));
    return Buffer.from('sealed-by-test').toString('base64');
  };
  const blob = await protectWindowsSecret(secret, 'identity', { platform: 'win32', runner });
  assert.equal(blob, Buffer.from('sealed-by-test').toString('base64'));
}

async function testLegacyIdentityMigratesAtomicallyWithInjectedDpapi() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hcu-dpapi-migrate-'));
  const identityPath = path.join(root, 'identity.json');
  const pair = generateKeyPairSync('ed25519');
  const legacy = {
    deviceId: 'legacy-device',
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    enrolled: true
  };
  await fs.writeFile(identityPath, JSON.stringify(legacy, null, 2));
  const protectSecret = async value => `sealed:${Buffer.from(value).toString('base64')}`;
  const unprotectSecret = async blob => Buffer.from(String(blob).slice('sealed:'.length), 'base64');
  try {
    const identity = new GatewayDeviceIdentity(identityPath, { platform: 'win32', protectSecret, unprotectSecret });
    const loaded = await identity.loadOrCreate();
    assert.equal(loaded.deviceId, legacy.deviceId);
    assert.equal(loaded.publicKeyPem, legacy.publicKeyPem);
    assert.equal(loaded.privateKeyPem, legacy.privateKeyPem);
    const persisted = JSON.parse(await fs.readFile(identityPath, 'utf8'));
    assert.equal('privateKeyPem' in persisted, false);
    assert.equal(persisted.privateKey?.scheme, 'dpapi-current-user-v1');
    assert.equal(typeof persisted.privateKey?.blob, 'string');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testMigrationFailureLeavesLegacyIdentityUntouched() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hcu-dpapi-fail-'));
  const identityPath = path.join(root, 'identity.json');
  const pair = generateKeyPairSync('ed25519');
  const legacy = {
    deviceId: 'legacy-failure',
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    enrolled: false
  };
  const original = JSON.stringify(legacy, null, 2);
  await fs.writeFile(identityPath, original);
  try {
    const identity = new GatewayDeviceIdentity(identityPath, {
      platform: 'win32',
      protectSecret: async () => { throw new Error('dpapi unavailable'); },
      unprotectSecret: async value => Buffer.from(String(value), 'base64')
    });
    await assert.rejects(identity.loadOrCreate(), /dpapi unavailable/i);
    assert.equal(await fs.readFile(identityPath, 'utf8'), original);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testRealWindowsDpapiRoundTrip() {
  if (process.platform !== 'win32') return;
  const secret = Buffer.from(`hcu-dpapi-roundtrip-${process.pid}-${Date.now()}`);
  const blob = await protectWindowsSecret(secret, 'identity');
  const restored = await unprotectWindowsSecret(blob, 'identity');
  assert.deepEqual(restored, secret);
}

await testDpapiRunnerKeepsSecretOffCommandLine();
await testLegacyIdentityMigratesAtomicallyWithInjectedDpapi();
await testMigrationFailureLeavesLegacyIdentityUntouched();
await testRealWindowsDpapiRoundTrip();
console.log('Windows DPAPI and identity migration tests passed');
