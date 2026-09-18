import assert from 'assert';
import fs from 'fs/promises';
import { generateKeyPairSync } from 'crypto';
import os from 'os';
import path from 'path';

import { GatewayDeviceConfigStore } from '../dist/device/gateway-config.js';
import { GatewayDeviceIdentity } from '../dist/device/gateway-identity.js';

const forbiddenSecretOptions = {
  platform: 'win32',
  protectSecret: async () => { throw new Error('legacy secret API must not run'); },
  unprotectSecret: async () => { throw new Error('legacy secret API must not run'); }
};

async function testWindowsIdentityPersistsWithoutSecretApi() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-plain-identity-'));
  const identityPath = path.join(root, 'identity.json');
  const pair = generateKeyPairSync('ed25519');
  const seeded = {
    deviceId: 'plain-device',
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    enrolled: true
  };
  await fs.writeFile(identityPath, JSON.stringify(seeded, null, 2));
  try {
    const identity = new GatewayDeviceIdentity(identityPath, forbiddenSecretOptions);
    const loaded = await identity.loadOrCreate();
    assert.equal(loaded.deviceId, seeded.deviceId);
    assert.equal(loaded.privateKeyPem, seeded.privateKeyPem);
    const persisted = JSON.parse(await fs.readFile(identityPath, 'utf8'));
    assert.equal(persisted.privateKeyPem, seeded.privateKeyPem);
    assert.equal(persisted.enrolled, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testLegacyProtectedIdentityIsArchivedWithoutDecrypting() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-legacy-identity-'));
  const identityPath = path.join(root, 'identity.json');
  const legacy = {
    version: 2,
    deviceId: 'legacy-protected-device',
    publicKeyPem: 'legacy-public-key',
    privateKey: { scheme: 'dpapi-current-user-v1', blob: 'opaque-do-not-decrypt' },
    enrolled: true
  };
  await fs.writeFile(identityPath, JSON.stringify(legacy, null, 2));
  try {
    const identity = new GatewayDeviceIdentity(identityPath, forbiddenSecretOptions);
    const loaded = await identity.loadOrCreate();
    assert.notEqual(loaded.deviceId, legacy.deviceId);
    assert.equal(loaded.enrolled, false);
    const files = await fs.readdir(root);
    assert(files.some(name => name.startsWith('identity.json.legacy-protected.')));
    const persisted = JSON.parse(await fs.readFile(identityPath, 'utf8'));
    assert.equal(typeof persisted.privateKeyPem, 'string');
    assert(!('privateKey' in persisted));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function testWindowsProxyPersistsWithoutSecretApi() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-plain-proxy-'));
  const configPath = path.join(root, 'gateway-config.json');
  const proxyUrl = 'http://proxy-user:proxy-pass@127.0.0.1:8080';
  try {
    const store = new GatewayDeviceConfigStore(configPath, forbiddenSecretOptions);
    await store.update({ proxy: { mode: 'configured', url: proxyUrl } });
    const raw = await fs.readFile(configPath, 'utf8');
    assert(raw.includes('proxy-user'));
    assert(raw.includes('proxy-pass'));
    assert.deepEqual((await store.load()).proxy, { mode: 'configured', url: `${proxyUrl}/` });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

await testWindowsIdentityPersistsWithoutSecretApi();
await testLegacyProtectedIdentityIsArchivedWithoutDecrypting();
await testWindowsProxyPersistsWithoutSecretApi();
console.log('Windows local storage avoids legacy secret APIs');
