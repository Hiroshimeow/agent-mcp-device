import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const scratch = path.join(root, '.tmp', 'legacy-palace-replacement');
await fs.mkdir(scratch, { recursive: true });
const fixture = await fs.mkdtemp(path.join(scratch, 'run-'));
process.env.MCP_DEVICE_CONFIG_DIR = path.join(fixture, 'state');
test.after(() => fs.rm(fixture, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 }));
const { PluginHost } = await import('../../dist/platform/plugin-host.js');
const { createPlatformDeviceCore } = await import('../../dist/platform/device-runtime.js');
const assembled = spawnSync(process.execPath, [path.join(root, 'scripts/v12/build-palace-package.mjs')], { encoding: 'utf8', timeout: 60000 });
assert.equal(assembled.status, 0, assembled.stdout + assembled.stderr);
const packageRoot = JSON.parse(assembled.stdout.trim()).output;
test.after(() => fs.rm(path.dirname(packageRoot), { recursive: true, force: true, maxRetries: 8, retryDelay: 50 }));
const manifestFile = path.join(packageRoot, 'palace.plugin.json');
const separate = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
const separateEntry = path.resolve(packageRoot, separate.entry);
await fs.access(separateEntry);

function cli(state, ...args) {
  const result = spawnSync(process.execPath, [path.join(root, 'dist/mcp-device.js'), 'plugins', '--runtime-dir', state, ...args], {
    encoding: 'utf8', timeout: 30000,
    env: { ...process.env, MCP_DEVICE_CONFIG_DIR: state, MCP_DEVICE_REMOTE: 'false', MCP_DEVICE_SKIP_SKILL_INSTALL: '1' }
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return JSON.parse(result.stdout);
}

test('product guide explains old bundled entry removal and stopped-runtime manifest migration', async () => {
  const guide = await fs.readFile(path.join(root, 'docs/v12-platform.md'), 'utf8');
  assert.match(guide, /### Migrating an old bundled Palace installation/);
  assert.match(guide, /old bundled entry.*disappears/i);
  assert.match(guide, /plugins --runtime-dir <state> upgrade <separate-package>\/palace\.plugin\.json/);
  assert.match(guide, /plugins --runtime-dir <state> enable palace/);
});

for (const explicit of [false, true]) test(`Core package replacement: ${explicit ? 'explicitly enabled' : 'automatic'} old distribution Palace migrates only by operator manifest upgrade`, { timeout: 60000 }, async () => {
  const state = process.env.MCP_DEVICE_CONFIG_DIR;
  await fs.rm(state, { recursive: true, force: true });
  const oldPackage = path.join(fixture, explicit ? 'old-explicit-device' : 'old-automatic-device');
  const oldEntry = path.join(oldPackage, 'dist/plugins/palace/plugin.js');
  await fs.mkdir(path.dirname(oldEntry), { recursive: true });
  await fs.copyFile(separateEntry, oldEntry);
  const legacyManifest = { ...separate, entry: oldEntry };
  const seed = new PluginHost({ stateRoot: state, deviceId: 'replacement-fixture' });
  await seed.ensureBundled([legacyManifest]);
  await seed.configure('palace', { autoIndex: false, discoverKnownSources: false });
  if (explicit) await seed.enable('palace');
  await fs.mkdir(seed.dataRoot('palace'), { recursive: true });
  const marker = path.join(seed.dataRoot('palace'), 'preserved-data');
  const identityFile = path.join(state, 'gateway-identity.json');
  const identity = '{"fixture":"preserve exact identity bytes"}\n';
  await fs.writeFile(marker, 'KEEP_PRIVATE_DATA');
  await fs.writeFile(identityFile, identity);
  // Actual pre-Option-A records had no explicitlyEnabled field. Only explicit
  // enable (not ensureBundled/configure/upgrade) gave distribution records a token.
  const registry = JSON.parse(await fs.readFile(seed.registryPath, 'utf8'));
  delete registry.plugins.palace.explicitlyEnabled;
  assert.equal(Boolean(registry.plugins.palace.lifecycleToken), explicit);
  await fs.writeFile(seed.registryPath, JSON.stringify(registry));
  await seed.close();
  // Simulate replacement at the old package path: Core no longer ships this tree.
  await fs.rm(path.join(oldPackage, 'dist/plugins/palace'), { recursive: true });
  const options = { deviceId: 'replacement-fixture', stateRoot: state, allowedRoots: [state] };
  let core = await createPlatformDeviceCore(options);
  try {
    const record = core.plugins.list()[0];
    assert.equal(record.manifest.entry, oldEntry, 'Core must not silently repin');
    assert.equal(core.capabilities.includes('knowledge.search'), false);
    assert.equal(record.state, explicit ? 'faulted' : 'installed');
    if (explicit) assert.match(record.error, /ENOENT/);
    else {
      await core.plugins.refresh();
      assert.equal(core.capabilities.includes('knowledge.search'), false, 'refresh must not bypass automatic suppression');
      assert.equal(core.plugins.list()[0].error, undefined);
    }
    assert.equal(await fs.readFile(marker, 'utf8'), 'KEEP_PRIVATE_DATA');
    assert.equal(await fs.readFile(identityFile, 'utf8'), identity);
  } finally { await core.close(); }
  // Real CLI stopped-runtime upgrade resolves the real separate package entry.
  cli(state, 'upgrade', manifestFile);
  const manager = new PluginHost({ stateRoot: state, deviceId: 'replacement-fixture' });
  await manager.load();
  assert.equal(manager.list()[0].manifest.entry, separateEntry);
  assert.equal(manager.list()[0].installationSource, 'manual');
  await manager.close();
  cli(state, 'enable', 'palace');
  for (let restart = 0; restart < 2; restart++) {
    core = await createPlatformDeviceCore(options);
    try {
      assert.equal(core.plugins.list()[0].state, 'enabled');
      assert.equal(core.plugins.list()[0].explicitlyEnabled, true);
      assert.ok(Array.isArray((await core.invoke('knowledge.search', { query: 'replacement fixture', scope: 'all' })).items));
      assert.equal(await fs.readFile(marker, 'utf8'), 'KEEP_PRIVATE_DATA');
      assert.equal(await fs.readFile(identityFile, 'utf8'), identity);
    } finally { await core.close(); }
  }
});
