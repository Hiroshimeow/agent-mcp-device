import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { deviceStatePaths, migrateLegacyDeviceState } from '../dist/device/device-state.js';
import { effectiveGatewayStatus, formatGatewayStatus } from '../dist/device/device-status.js';
import { deviceIdentityNeedsPairing } from '../dist/device/gateway-identity.js';
import { gatewaySocketUrl } from '../dist/device/gateway-url-policy.js';
import { RuntimeOwner, acquireRuntimeOwner, probeRuntimeOwner } from '../dist/device/runtime-owner.js';

function sampleStatus() {
  return {
    version: 1,
    gatewayUrl: 'https://mcp-v2.hcu-lab.me/mcp',
    deviceId: 'device-test',
    deviceName: 'Device',
    identityPresent: true,
    account: { connected: true, label: 'user@example.com' },
    connection: { online: true, connectionEpoch: 3, lastConnectedAt: 1234 },
    usage: null,
    schema: null,
    usageFreshAt: null
  };
}

async function testMigrationIsNonDestructiveAndIdempotent() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-state-'));
  const paths = deviceStatePaths(home);
  try {
    await fs.mkdir(paths.legacyRoot, { recursive: true });
    const identity = { deviceId: 'device-one', publicKeyPem: 'PUBLIC', privateKeyPem: 'PRIVATE', enrolled: true };
    await fs.writeFile(path.join(paths.legacyRoot, 'gateway-identity.json'), JSON.stringify(identity));
    await fs.writeFile(path.join(paths.legacyRoot, 'gateway-config.json'), JSON.stringify({ version: 1, gatewayUrl: 'https://example.test/', proxy: { mode: 'direct', url: null }, allowedRoots: [], appCaPem: null, securityProtocolFloor: 1 }));
    await fs.writeFile(path.join(paths.legacyRoot, 'gateway-status.json'), JSON.stringify(sampleStatus()));

    const first = await migrateLegacyDeviceState(paths);
    assert.deepEqual(first.migrated.sort(), ['gateway-config.json', 'gateway-identity.json', 'gateway-status.json']);
    assert.equal((await fs.readFile(paths.identity, 'utf8')).includes('device-one'), true);
    assert.equal((await fs.readFile(path.join(paths.legacyRoot, 'gateway-identity.json'), 'utf8')).includes('device-one'), true, 'legacy state must be retained');
    const second = await migrateLegacyDeviceState(paths);
    assert.deepEqual(second.migrated, []);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function testMigrationIdentityConflictFailsClosed() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-conflict-'));
  const paths = deviceStatePaths(home);
  try {
    await fs.mkdir(paths.legacyRoot, { recursive: true });
    await fs.mkdir(paths.root, { recursive: true });
    await fs.writeFile(path.join(paths.legacyRoot, 'gateway-identity.json'), JSON.stringify({ deviceId: 'legacy', publicKeyPem: 'A' }));
    await fs.writeFile(paths.identity, JSON.stringify({ deviceId: 'canonical', publicKeyPem: 'B' }));
    await assert.rejects(() => migrateLegacyDeviceState(paths), /identities differ/i);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function testRuntimeOwnerSerializesBootstrap() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-owner-'));
  const paths = deviceStatePaths(home);
  const first = new RuntimeOwner({ paths, mode: 'foreground' });
  const second = new RuntimeOwner({ paths, mode: 'bootstrap' });
  try {
    await first.acquire();
    const status = await probeRuntimeOwner(paths);
    assert.equal(status?.pid, process.pid);
    assert.equal(status?.mode, 'foreground');
    assert.equal(status?.executable, process.execPath);
    await assert.rejects(() => second.acquire(), /already owned/i);
  } finally {
    await first.release();
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function testHealthyRuntimeTakeoverUsesAuthenticatedOwnerStop() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-takeover-'));
  const paths = deviceStatePaths(home);
  let first;
  first = new RuntimeOwner({ paths, mode: 'foreground', onStop: async () => { await first.release(); } });
  const second = new RuntimeOwner({ paths, mode: 'foreground' });
  try {
    await first.acquire();
    let prompts = 0;
    const result = await acquireRuntimeOwner(second, {
      confirmTakeover: async existing => {
        prompts += 1;
        assert.equal(existing.mode, 'foreground');
        return true;
      },
      waitMs: 1000
    });
    assert.equal(result.takenOver, true);
    assert.equal(prompts, 1);
    assert.equal((await probeRuntimeOwner(paths))?.pid, process.pid);
  } finally {
    await second.release();
    await first.release().catch(() => {});
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function testRuntimeTakeoverNoIsNonMutatingAndBootstrapIsNotTakenOver() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-takeover-no-'));
  const paths = deviceStatePaths(home);
  const first = new RuntimeOwner({ paths, mode: 'foreground' });
  const second = new RuntimeOwner({ paths, mode: 'foreground' });
  try {
    await first.acquire();
    await assert.rejects(() => acquireRuntimeOwner(second, { confirmTakeover: async () => false }), /already running|takeover declined/i);
    assert.equal((await probeRuntimeOwner(paths))?.mode, 'foreground');
    await first.release();

    const bootstrap = new RuntimeOwner({ paths, mode: 'bootstrap' });
    await bootstrap.acquire();
    await assert.rejects(() => acquireRuntimeOwner(second, { confirmTakeover: async () => true }), /bootstrap.*busy/i);
    await bootstrap.release();
  } finally {
    await first.release().catch(() => {});
    await second.release().catch(() => {});
    await fs.rm(home, { recursive: true, force: true });
  }
}

function testPairingDecisionUsesDurableIdentityNotStaleStatus() {
  assert.equal(deviceIdentityNeedsPairing({ enrolled: false }), true);
  assert.equal(deviceIdentityNeedsPairing({ enrolled: true }), false, 'an enrolled identity must not be re-paired merely because cached status is stale');
}

function testGatewayRoutingAndEffectiveStatus() {
  assert.equal(gatewaySocketUrl('https://mcp-v2.hcu-lab.me/mcp'), 'wss://mcp-v2.hcu-lab.me/device');
  assert.equal(gatewaySocketUrl('http://127.0.0.1:8101/mcp?x=1'), 'ws://127.0.0.1:8101/device');
  assert.equal(gatewaySocketUrl('wss://gateway.example.test/custom-device'), 'wss://gateway.example.test/custom-device');
  assert.throws(() => gatewaySocketUrl('http://gateway.example.test/mcp'), /plaintext/i);

  const stale = sampleStatus();
  const stopped = effectiveGatewayStatus(stale, { runtimeOwned: false, serviceRunning: false });
  assert.equal(stopped.connection.online, false);
  assert.equal(stopped.connection.lastConnectedAt, 1234);
  const text = formatGatewayStatus(stopped, {
    security: { protocolFloor: 2, appCaProvisioned: true },
    runtime: { mode: 'foreground', pid: 4321 },
    managers: [{ manager: 'systemd', installed: true, running: false, autostart: true }]
  });
  assert.match(text, /Connection: offline/);
  assert.match(text, /Runtime: foreground \(pid 4321\)/);
  assert.match(text, /Manager: systemd installed\/stopped\/autostart/);
  assert.match(text, /Security: v2 required\/offline/);
  const json = JSON.parse(formatGatewayStatus(stopped, {
    json: true,
    runtime: { mode: 'foreground', pid: 4321 },
    managers: [{ manager: 'systemd', installed: true, running: false, autostart: true }]
  }));
  assert.deepEqual(json.runtime, { mode: 'foreground', pid: 4321 });
  assert.equal(json.managers[0].manager, 'systemd');
  const liveForeground = effectiveGatewayStatus(stale, { runtimeOwned: true, serviceRunning: false });
  assert.equal(liveForeground.connection.online, true, 'live foreground owner must not be forced offline by stopped background registration');
}

await testMigrationIsNonDestructiveAndIdempotent();
await testMigrationIdentityConflictFailsClosed();
await testRuntimeOwnerSerializesBootstrap();
await testHealthyRuntimeTakeoverUsesAuthenticatedOwnerStop();
await testRuntimeTakeoverNoIsNonMutatingAndBootstrapIsNotTakenOver();
testPairingDecisionUsesDurableIdentityNotStaleStatus();
testGatewayRoutingAndEffectiveStatus();
console.log('MCP Device productization foundation tests passed');
