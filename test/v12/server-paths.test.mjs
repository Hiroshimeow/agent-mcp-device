import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as NetServer, Socket as NetSocket } from 'node:net';
import { EventEmitter } from 'node:events';
import { generateKeyPairSync } from 'node:crypto';
import { resolveServerConfigPath, startServerRuntime } from '../../control-plane/scripts/authenticated-mcp-wrapper.mjs';
import { loadExternalMcpConfig } from '../../control-plane/scripts/upstreams/config.mjs';

test('cold-package config resolution and upstream startup share the selected asset/explicit configuration', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-v12-paths-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const packageRoot = path.join(root, 'package');
  const assetRoot = path.join(packageRoot, 'control-plane');
  const configDirectory = path.join(assetRoot, 'config');
  fs.mkdirSync(configDirectory, { recursive: true });
  const assetConfig = path.join(configDirectory, 'mcp-servers.toml');
  fs.writeFileSync(assetConfig, '[external_mcp]\nenabled = false\nexposure_mode = "brokered"\n');
  const selected = resolveServerConfigPath({ packageRoot, assetRoot });
  assert.equal(selected, assetConfig);
  const originalListen = NetServer.prototype.listen;
  NetServer.prototype.listen = function () { throw new Error('Config tests must never listen.'); };
  t.after(() => { NetServer.prototype.listen = originalListen; });
  const loaded = await loadExternalMcpConfig({ repoRoot: packageRoot, env: { MCP_UPSTREAM_CONFIG: selected } });
  assert.equal(loaded.external.enabled, false);
  assert.equal(loaded.external.exposure_mode, 'brokered');
  const override = path.join(root, 'operator.toml');
  assert.equal(resolveServerConfigPath({ packageRoot, assetRoot, env: { MCP_UPSTREAM_CONFIG: override } }), override);
  assert.equal(resolveServerConfigPath({ packageRoot, assetRoot, env: { MCP_UPSTREAM_CONFIG: 'relative.toml' } }), path.join(packageRoot, 'relative.toml'));
  assert.equal(resolveServerConfigPath({ packageRoot, assetRoot, configPath: assetConfig, env: { MCP_UPSTREAM_CONFIG: override } }), assetConfig);
});

test('factory startup failure releases SQLite handles and its Core before any listener', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-v12-startup-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  let closeCalls = 0;
  let listenCalls = 0;
  const originalListen = NetServer.prototype.listen;
  NetServer.prototype.listen = function () { listenCalls += 1; throw new Error('Startup-failure test must never listen.'); };
  t.after(() => { NetServer.prototype.listen = originalListen; });
  const core = {
    capabilities: [],
    invoke: async () => { throw new Error('No dispatch expected.'); },
    close: async () => { closeCalls += 1; }
  };
  const identity = {
    loadOrCreate: async () => { throw new Error('Pairing must not start.'); },
    signChallenge: async () => { throw new Error('Pairing must not start.'); }
  };
  await assert.rejects(startServerRuntime({
    stateRoot: root,
    packageRoot,
    core,
    identity,
    contextTools: [],
    env: { MCP_DEVICE_INNER_TLS_CERT_PATH: 'deliberately-incomplete-test-configuration' }
  }), /MCP_DEVICE_INNER_TLS_CERT_PATH and MCP_DEVICE_INNER_TLS_KEY_PATH must be configured together/);
  assert.equal(listenCalls, 0);
  assert.equal(closeCalls, 1);
  assert.equal(fs.existsSync(path.join(root, 'gateway.sqlite')), true);
  // Windows refuses removal while SQLite handles remain open.
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(fs.existsSync(root), false);
});

function isolatedFactory(t, { coreFailure, embeddedFailure } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-v12-cleanup-'));
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const calls = { listen: 0, serverClose: 0, coreClose: 0, unsubscribe: 0 };
  const fakeServer = new EventEmitter();
  fakeServer.close = callback => { calls.serverClose += 1; queueMicrotask(() => callback()); };
  fakeServer.closeIdleConnections = () => {};
  fakeServer.closeAllConnections = () => {};
  const originalListen = NetServer.prototype.listen;
  const originalConnect = NetSocket.prototype.connect;
  NetServer.prototype.listen = function () {
    calls.listen += 1;
    queueMicrotask(() => fakeServer.emit('listening'));
    return fakeServer;
  };
  NetSocket.prototype.connect = function () { throw new Error('Cleanup regression must never open a socket.'); };
  t.after(() => {
    NetServer.prototype.listen = originalListen;
    NetSocket.prototype.connect = originalConnect;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const publicKeyPem = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const core = {
    capabilities: [], runtimeInstanceId: 'cleanup-regression',
    invoke: async () => { throw new Error('No dispatch expected.'); },
    onCapabilitiesChanged: () => () => {
      calls.unsubscribe += 1;
      if (embeddedFailure) throw embeddedFailure;
    },
    close: async () => {
      calls.coreClose += 1;
      if (coreFailure) throw coreFailure;
    }
  };
  const identity = {
    loadOrCreate: async () => ({ deviceId: 'cleanup-regression', publicKeyPem }),
    signChallenge: async () => { throw new Error('Unapproved Device must not attach.'); }
  };
  return {
    root, calls,
    start: () => startServerRuntime({ stateRoot: root, packageRoot, core, identity, contextTools: [] })
  };
}

test('normal shutdown propagates a failed Core cleanup to every concurrent and later caller', async t => {
  const failure = Object.assign(new Error('Fixture child process still exists.'), { code: 'PLUGIN_CLEANUP_FAILED' });
  const f = isolatedFactory(t, { coreFailure: failure });
  const runtime = await f.start();
  assert.equal(runtime.localDevice.status().state, 'pairing_required');
  const first = runtime.close();
  const concurrent = runtime.close();
  assert.equal(concurrent, first);
  await assert.rejects(first, error => error === failure);
  await assert.rejects(runtime.close(), error => error === failure);
  assert.deepEqual(f.calls, { listen: 1, serverClose: 1, coreClose: 1, unsubscribe: 1 });
  // Failed Core shutdown must not prevent the unrelated SQLite stores from closing.
  fs.rmSync(f.root, { recursive: true, force: true });
  assert.equal(fs.existsSync(f.root), false);
});

test('normal shutdown attempts later resources and preserves multiple cleanup failures', async t => {
  const embeddedFailure = new Error('Fixture capability subscription did not detach.');
  const coreFailure = new Error('Fixture process cleanup failed.');
  const f = isolatedFactory(t, { coreFailure, embeddedFailure });
  const runtime = await f.start();
  let observed;
  await assert.rejects(runtime.close(), error => {
    observed = error;
    return error instanceof AggregateError &&
      error.code === 'SERVER_CLEANUP_FAILED' &&
      error.errors.includes(embeddedFailure) &&
      error.errors.includes(coreFailure);
  });
  await assert.rejects(runtime.close(), error => error === observed);
  assert.deepEqual(f.calls, { listen: 1, serverClose: 1, coreClose: 1, unsubscribe: 1 });
  fs.rmSync(f.root, { recursive: true, force: true });
  assert.equal(fs.existsSync(f.root), false);
});
