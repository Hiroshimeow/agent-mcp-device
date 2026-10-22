import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquireServerLease } from '../../dist/platform/runtime-lease.js';
import { RuntimeOwner, probeRuntimeOwner, stopRuntimeOwner, acquireRuntimeOwner } from '../../dist/device/runtime-owner.js';
import { createPlatformTools } from '../../dist/platform/knowledge-mcp.js';
const exec = promisify(execFile);

async function rootFor(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v12-cli-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return root; }
test('runtime ownership rejects a concurrent owner and releases only its own lease', async t => {
  const root = await rootFor(t), release = await acquireServerLease(root);
  await assert.rejects(acquireServerLease(root), { code: 'RUNTIME_ALREADY_RUNNING' });
  await release(); const second = await acquireServerLease(root); await second();
  await fs.writeFile(path.join(root, 'server-runtime.lock'), '{broken');
  await assert.rejects(acquireServerLease(root), { code: 'RUNTIME_LOCK_INVALID' });
});

test('maintenance lease detects Device-only ownership and refuses unresponsive legacy control', async t => {
  const root = await rootFor(t), paths = { root, identity: path.join(root, 'gateway-identity.json'), config: path.join(root, 'gateway-config.json'), status: path.join(root, 'gateway-status.json'), runtime: path.join(root, 'runtime'), update: path.join(root, 'update') };
  let stopAttempts = 0;
  const owner = new RuntimeOwner({ paths, mode: 'foreground', onStop: async () => { stopAttempts++; throw new Error('fixture cleanup not proven'); } });
  await owner.acquire();
  try {
    await assert.rejects(acquireServerLease(root), { code: 'RUNTIME_ALREADY_RUNNING' });
    await assert.rejects(fs.stat(path.join(root, 'server-runtime.lock')), { code: 'ENOENT' });
    const release = await acquireServerLease(root, { allowDeviceOwnerPid: process.pid });
    await assert.rejects(acquireServerLease(root), { code: 'RUNTIME_ALREADY_RUNNING' });
    await release();
    assert.equal(await stopRuntimeOwner(paths), true, 'stop acknowledges the request');
    assert.equal((await probeRuntimeOwner(paths)).pid, process.pid, 'failed cleanup retains the actual owner');
    assert.equal(stopAttempts, 1);
    const contender = new RuntimeOwner({ paths, mode: 'foreground' });
    await assert.rejects(acquireRuntimeOwner(contender, { confirmTakeover: () => true, waitMs: 40, pollMs: 5 }), /did not release runtime ownership/);
    assert.equal((await probeRuntimeOwner(paths)).pid, process.pid);
  } finally { await owner.release(); }
  await fs.writeFile(path.join(root, 'runtime-control.json'), '{}');
  await assert.rejects(acquireServerLease(root), { code: 'DEVICE_RUNTIME_STOP_NOT_PROVEN' });
  await assert.rejects(fs.stat(path.join(root, 'server-runtime.lock')), { code: 'ENOENT' });
});

test('CLI help and plugin lifecycle work from the package entry without starting a runtime', async t => {
  const root = await rootFor(t), entry = fileURLToPath(new URL('../../dist/mcp-device.js', import.meta.url));
  const help = await exec(process.execPath, [entry, '--help']); assert.match(help.stdout, /Device-only runtime/); assert.match(help.stdout, /account\/OAuth/);
  const plugin = path.join(root, 'reference.mjs'); await fs.writeFile(plugin, 'export const createPlugin=()=>({invoke:()=>42});');
  const manifest = path.join(root, 'manifest.json'); await fs.writeFile(manifest, JSON.stringify({ id: 'cli-reference', version: '1.0.0', dataSchemaVersion: 1, isolation: 'in-process', trusted: true, entry: 'reference.mjs', capabilities: [{ name: 'test.reference', version: '1.0.0' }] }));
  const invoke = async (...args) => JSON.parse((await exec(process.execPath, [entry, 'plugins', '--runtime-dir', root, ...args])).stdout);
  assert.equal((await invoke('install', manifest, '--enable')).plugins[0].enabled, true);
  assert.equal((await invoke('disable', 'cli-reference')).plugins[0].enabled, false);
  assert.equal((await invoke('uninstall', 'cli-reference')).plugins[0].installed, false);
  assert.equal((await invoke('list')).plugins[0].state, 'uninstalled');
  await assert.rejects(fs.stat(path.join(root, 'gateway-identity.json')), { code: 'ENOENT' });
});

test('plugin maintenance retains ownership until cleanup is proven, including failed upgrades', async t => {
  const root = await rootFor(t), entry = fileURLToPath(new URL('../../dist/mcp-device.js', import.meta.url));
  const hostUrl = new URL('../../dist/platform/plugin-host.js', import.meta.url).href;
  const manifest = path.join(root, 'manifest.json');
  await fs.writeFile(manifest, JSON.stringify({ id: 'lease-fixture', entry: 'unused.mjs' }));
  for (const action of ['upgrade', 'purge']) {
    for (const cleanupFails of [true, false]) {
      const state = path.join(root, action + '-' + cleanupFails), lock = path.join(state, 'server-runtime.lock');
      const marker = path.join(root, action + '-' + cleanupFails + '.json'), preload = marker + '.mjs';
      await fs.writeFile(preload, `import fs from 'node:fs/promises';
import { PluginHost } from ${JSON.stringify(hostUrl)};
PluginHost.prototype[${JSON.stringify(action)}] = async function() { throw Object.assign(new Error('fixture operation failed'), { code: 'FIXTURE_OPERATION_FAILED' }); };
PluginHost.prototype.close = async function() {
  await fs.writeFile(${JSON.stringify(marker)}, await fs.readFile(${JSON.stringify(lock)}, 'utf8'));
  if (${cleanupFails}) throw Object.assign(new Error('fixture cleanup not proven'), { code: 'PLUGIN_TERMINATION_FAILED' });
};\n`);
      await assert.rejects(exec(process.execPath, ['--import', pathToFileURL(preload).href, entry, 'plugins', '--runtime-dir', state, action, action === 'upgrade' ? manifest : 'lease-fixture']), error => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, cleanupFails ? /PLUGIN_TERMINATION_FAILED/ : /FIXTURE_OPERATION_FAILED/);
        assert.doesNotMatch(error.stdout, /"ok": true/);
        return true;
      });
      assert.ok(JSON.parse(await fs.readFile(marker, 'utf8')).pid > 0, 'maintenance still owns the lease while closing');
      if (cleanupFails) assert.ok(JSON.parse(await fs.readFile(lock, 'utf8')).pid > 0, 'unproven cleanup retains the lease');
      else await assert.rejects(fs.stat(lock), { code: 'ENOENT' });
    }
  }
});

test('public knowledge tools preserve signed references across restart and isolate concurrent caller contexts', async t => {
  const root = await rootFor(t), calls = [];
  const card = account => ({ id: 'card-' + account, version: 1, contentHash: 'hash-' + account, summary: 'A useful fact', body: 'Exact useful fact', status: 'observed', originDeviceId: 'provider-' + account, servingDeviceId: 'provider-' + account, scope: { visibility: 'account' }, evidence: [], derivedFrom: [], provenance: ['provider-' + account], updatedAt: 1, lastVerifiedAt: 1 });
  const context = account => ({ accountId: account, sessionId: 'session-' + account,
    listDevices: () => [{ deviceId: 'client-' + account, online: true, capabilities: [] }, { deviceId: 'provider-' + account, online: true, capabilities: ['knowledge.search', 'knowledge.read', 'knowledge.stat'] }],
    async callDevice({ deviceId, tool }) { calls.push([account, deviceId, tool]); await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(deviceId, 'provider-' + account); const value = card(account); return tool === 'knowledge.search' ? { items: [value] } : tool === 'knowledge.stat' ? value : { card: value }; }
  });
  const tools = await createPlatformTools(root), search = tools.find(tool => tool.name === 'knowledge.search');
  const results = await Promise.all(['a', 'b'].map(account => search.handler({ device_id: 'client-' + account, query: 'fact' }, context(account))));
  assert.equal(results[0].items[0].id, 'card-a'); assert.equal(results[1].items[0].id, 'card-b');
  const restarted = await createPlatformTools(root), read = restarted.find(tool => tool.name === 'knowledge.read');
  const result = await read.handler({ device_id: 'client-a', ref: results[0].items[0].read_ref }, context('a'));
  assert.equal(result.card.id, 'card-a'); assert.equal(result.imported, false);
  await assert.rejects(read.handler({ device_id: 'client-b', ref: results[0].items[0].read_ref }, context('b')), { code: 'ACCESS_DENIED' });
  assert.equal(calls.some(call => call[2] === 'knowledge.import'), false);
  assert.equal(tools.some(tool => tool.name === 'knowledge.import'), false);
  const invoke = tools.find(tool => tool.name === 'capability.call');
  await assert.rejects(invoke.handler({ device_id: 'client-a', capability: 'knowledge.import', arguments: {} }, context('a')), { code: 'CAPABILITY_PRIVATE' });
  assert.deepEqual((await fs.readdir(root)).sort(), ['knowledge-reference.key']);
});
