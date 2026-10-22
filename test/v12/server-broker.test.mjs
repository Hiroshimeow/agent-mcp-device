import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { Server as NetServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

import { buildDeviceAuthChallenge, createDeviceBroker } from '../../control-plane/scripts/device-broker.mjs';
import { createDeviceStore } from '../../control-plane/scripts/device-store.mjs';
import { createDevicePairingStore } from '../../control-plane/scripts/device-pairing-store.mjs';
import { createAccountStore } from '../../control-plane/scripts/account-store.mjs';

// This slice is deliberately incapable of opening any port, including port 0.
const originalListen = NetServer.prototype.listen;
NetServer.prototype.listen = function () {
  throw new Error('The embedded broker must not create a network listener.');
};
after(() => { NetServer.prototype.listen = originalListen; });

function keyPair() {
  const pair = generateKeyPairSync('ed25519');
  return { privateKey: pair.privateKey, publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
}
function signer(deviceId, keys) {
  return nonce => sign(null, buildDeviceAuthChallenge({ deviceId, nonce }), keys.privateKey).toString('base64');
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(t) {
  const stateRoot = mkdtempSync(path.join(os.tmpdir(), 'mcp-v12-broker-'));
  const dbPath = path.join(stateRoot, 'gateway.sqlite');
  const accounts = createAccountStore({ dbPath });
  const alice = accounts.createAccount({ email: 'alice@example.test', password: 'fixture-password-alice' });
  const bob = accounts.createAccount({ email: 'bob@example.test', password: 'fixture-password-bob' });
  const devices = createDeviceStore({ dbPath });
  const pairings = createDevicePairingStore({ dbPath });
  const broker = createDeviceBroker({ deviceStore: devices, pairingStore: pairings, requestTimeoutMs: 1000, helloTimeoutMs: 1000 });
  t.after(async () => {
    await broker.shutdown();
    pairings.close(); devices.close(); accounts.close();
    rmSync(stateRoot, { recursive: true, force: true });
  });
  const deviceId = 'embedded-fixture';
  const keys = keyPair();
  function grant(owner = alice) {
    const verifier = randomBytes(32).toString('base64url');
    const started = pairings.start({
      clientId: 'embedded-fixture-client', deviceId, deviceName: 'Fixture Device',
      publicKeyPem: keys.publicKeyPem,
      codeChallenge: createHash('sha256').update(verifier).digest('base64url')
    });
    assert.equal(pairings.poll({ deviceCode: started.deviceCode, clientId: 'embedded-fixture-client', codeVerifier: verifier }).status, 'authorization_pending');
    assert.throws(() => pairings.poll({ deviceCode: started.deviceCode, clientId: 'embedded-fixture-client', codeVerifier: 'wrong-verifier' }), /PKCE/);
    pairings.approve({ userCode: started.userCode, accountId: owner.accountId, accountLabel: owner.email });
    return pairings.poll({ deviceCode: started.deviceCode, clientId: 'embedded-fixture-client', codeVerifier: verifier }).enrollmentGrant;
  }
  function connect(overrides = {}) {
    return broker.attachLocalDevice({
      deviceId, publicKeyPem: keys.publicKeyPem, signChallenge: signer(deviceId, keys),
      invoke: async (_tool, args) => ({ echo: args }), capabilities: ['read_file'],
      executionRuntimeGeneration: 'same-core-runtime', runtimeReady: true,
      agentVersion: 'mcp-device/1.0.12', packageVersion: '1.0.12', ...overrides
    });
  }
  const call = (overrides = {}) => broker.callDevice({
    accountId: alice.accountId, deviceId, tool: 'read_file', arguments: { path: 'fixture.txt' }, ...overrides
  });
  return { accounts, alice, bob, devices, pairings, broker, deviceId, keys, grant, connect, call };
}

test('embedded claim uses ordinary PKCE + signed grant; ownerless and cross-account calls never reach Core', async t => {
  const f = fixture(t);
  let invoked = 0;
  await assert.rejects(f.connect(), /unknown|revoked|auth/i);
  assert.equal(f.devices.get(f.deviceId), null);
  await f.connect({ enrollmentGrant: f.grant(), invoke: async (tool, args) => { invoked += 1; return { tool, args, core: 'same-instance' }; } });
  assert.equal(f.devices.get(f.deviceId).ownerAccountId, f.alice.accountId);
  assert.deepEqual(f.broker.listDevices(), []);
  assert.deepEqual(f.broker.listDevices({ accountId: f.bob.accountId }), []);
  await assert.rejects(f.call({ accountId: null }), /ACCOUNT_ID_REQUIRED/);
  await assert.rejects(f.call({ accountId: f.bob.accountId }), /DEVICE_ACCESS_DENIED/);
  assert.equal(invoked, 0);
  const result = await f.call({ includeDispatchContext: true });
  assert.deepEqual(result.result, { tool: 'read_file', args: { path: 'fixture.txt' }, core: 'same-instance' });
  assert.equal(result.dispatchContext.executionRuntimeGeneration, 'same-core-runtime');
  assert.equal(invoked, 1);
});

test('invalid proof cannot consume enrollment grant; a valid retry can claim exactly once', async t => {
  const f = fixture(t);
  const enrollmentGrant = f.grant();
  await assert.rejects(f.connect({ enrollmentGrant, signChallenge: signer(f.deviceId, keyPair()) }), /signature|auth/i);
  assert.equal(f.devices.get(f.deviceId), null);
  const endpoint = await f.connect({ enrollmentGrant });
  assert.equal(endpoint.isOpen(), true);
  assert.throws(() => f.pairings.consumeGrant({ enrollmentGrant, deviceId: f.deviceId, publicKeyPem: f.keys.publicKeyPem }), /consumed/);
});

test('replacing embedded endpoint rejects old pending result without replay and preserves process affinity checks', async t => {
  const f = fixture(t);
  const started = deferred(); const completion = deferred();
  let firstInvocations = 0; let replacementInvocations = 0;
  const first = await f.connect({ enrollmentGrant: f.grant(), invoke: async () => { firstInvocations += 1; started.resolve(); return completion.promise; } });
  const pending = f.call();
  const rejection = assert.rejects(pending, /replaced.*not replayed/i);
  await started.promise;
  const replacement = await f.connect({ invoke: async () => { replacementInvocations += 1; return { fresh: true }; } });
  await rejection;
  completion.resolve({ stale: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(first.isOpen(), false);
  assert.ok(replacement.connectionEpoch > first.connectionEpoch);
  await assert.rejects(f.call({ expectedConnectionEpoch: first.connectionEpoch }), error => error.code === 'PROCESS_SESSION_STALE');
  await assert.rejects(f.call({ expectedExecutionRuntimeGeneration: 'old-runtime' }), error => error.code === 'PROCESS_SESSION_STALE');
  assert.equal(replacementInvocations, 0);
  assert.deepEqual(await f.call(), { fresh: true });
  assert.equal(firstInvocations, 1);
  assert.equal(replacementInvocations, 1);
});

test('rotation ABA invalidates pending embedded result by authorization generation', async t => {
  const f = fixture(t);
  const started = deferred(); const completion = deferred();
  await f.connect({ enrollmentGrant: f.grant(), invoke: async () => { started.resolve(); return completion.promise; } });
  const pending = f.call();
  const rejection = assert.rejects(pending, /authorization|disconnected|offline/i);
  await started.promise;
  const next = keyPair();
  f.devices.rotate({ deviceId: f.deviceId, expectedPublicKeyPem: f.keys.publicKeyPem, publicKeyPem: next.publicKeyPem });
  f.devices.rotate({ deviceId: f.deviceId, expectedPublicKeyPem: next.publicKeyPem, publicKeyPem: f.keys.publicKeyPem });
  completion.resolve({ mustNotBeAccepted: true });
  await rejection;
  assert.equal(f.broker.listDevices({ accountId: f.alice.accountId })[0].online, false);
  await assert.rejects(f.call(), error => error.code === 'DEVICE_OFFLINE');
  await f.connect();
  assert.deepEqual(await f.call(), { echo: { path: 'fixture.txt' } });
});

test('capability updates use broker authorization checks; revoked embedded endpoints cannot dispatch', async t => {
  const f = fixture(t);
  let invoked = 0;
  const endpoint = await f.connect({
    enrollmentGrant: f.grant(), capabilities: ['read_file', 'knowledge.search'],
    invoke: async () => { invoked += 1; return { ok: true }; }
  });
  endpoint.updateCapabilities(['read_file']);
  assert.deepEqual(f.broker.listDevices({ accountId: f.alice.accountId })[0].capabilities, ['read_file']);
  await assert.rejects(f.call({ tool: 'knowledge.search' }), /does not advertise/);
  assert.deepEqual(await f.call(), { ok: true });
  f.devices.revoke(f.deviceId);
  endpoint.updateCapabilities(['read_file', 'knowledge.search']);
  assert.equal(endpoint.isOpen(), false);
  await assert.rejects(f.call(), error => error.code === 'DEVICE_OFFLINE');
  assert.equal(invoked, 1);
});

test('embedded proof reconnect never lowers remote inner-TLS protocol floor', async t => {
  const f = fixture(t);
  const first = await f.connect({ enrollmentGrant: f.grant() });
  first.close();
  f.devices.raiseProtocolFloor(f.deviceId, 2);
  const replacement = await f.connect();
  assert.equal(replacement.isOpen(), true);
  assert.equal(f.devices.get(f.deviceId).minProtocol, 2);
  assert.deepEqual(await f.call(), { echo: { path: 'fixture.txt' } });
});

test('embedded dispatch retains bounded payload behavior and Core error codes', async t => {
  const f = fixture(t);
  let invoked = 0;
  await f.connect({ enrollmentGrant: f.grant(), invoke: async (_tool, args) => {
    invoked += 1;
    if (args.error) throw Object.assign(new Error('Core denied a protected path.'), { code: 'ACCESS_DENIED' });
    return { value: 'x'.repeat(65536) };
  } });
  await assert.rejects(f.call({ arguments: { value: 'x'.repeat(65536) } }), error => error.code === 'DEVICE_INPUT_TOO_LARGE');
  assert.equal(invoked, 0);
  await assert.rejects(f.call(), error => error.code === 'DEVICE_OUTPUT_TOO_LARGE');
  await assert.rejects(f.call({ arguments: { error: true } }), error => error.code === 'ACCESS_DENIED');
  assert.equal(invoked, 2);
});
