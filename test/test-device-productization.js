import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { deviceStatePaths } from '../dist/device/device-state.js';
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

function testCanonicalDeviceStateHasNoLegacyRoot() {
  const paths = deviceStatePaths('/tmp/mcp-device-canonical-home');
  assert.equal(paths.root, path.resolve('/tmp/mcp-device-canonical-home', '.mcp-device'));
  assert.equal(Object.prototype.hasOwnProperty.call(paths, 'legacyRoot'), false, 'legacy state root must not remain part of the runtime contract');
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

testCanonicalDeviceStateHasNoLegacyRoot();
await testRuntimeOwnerSerializesBootstrap();
await testHealthyRuntimeTakeoverUsesAuthenticatedOwnerStop();
await testRuntimeTakeoverNoIsNonMutatingAndBootstrapIsNotTakenOver();
testPairingDecisionUsesDurableIdentityNotStaleStatus();
testGatewayRoutingAndEffectiveStatus();
console.log('MCP Device productization foundation tests passed');
