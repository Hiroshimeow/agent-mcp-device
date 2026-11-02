import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sharedRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'v12-core-first-'));
process.env.MCP_DEVICE_CONFIG_DIR = sharedRoot;
test.after(() => fs.rm(sharedRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 }));
async function resetRoot() {
  await fs.rm(sharedRoot, { recursive: true, force: true });
  await fs.mkdir(sharedRoot, { recursive: true });
}

test('Core-only default does not provision Palace with a compatibility policy input', { timeout: 30000 }, async t => {
  await resetRoot();
  const root = sharedRoot;
  const [{ createPlatformDeviceCore }, { PluginHost }, { bundledPluginManifests }] = await Promise.all([
    import('../../dist/platform/device-runtime.js'),
    import('../../dist/platform/plugin-host.js'),
    import('./optional-palace-fixture.mjs')
  ]);

  let first;
  try {
    first = await createPlatformDeviceCore({
      deviceId: 'core-first-fixture',
      stateRoot: root,
      allowedRoots: [root],
      projectRoots: [],
      sourceRoots: [],
      pluginPolicy: 'core-first'
    });
    assert.equal(first.plugins.list().some(record => record.manifest.id === 'palace'), false);
    assert.equal(first.capabilities.includes('knowledge.search'), false);
    const nativeFile = path.join(root, 'native-core.txt');
    await fs.writeFile(nativeFile, 'Core-first native tools remain available');
    const nativeRead = await first.invokeNative('read_file', { path: nativeFile });
    assert.notEqual(nativeRead.isError, true);
    assert.match(JSON.stringify(nativeRead), /Core-first native tools remain available/);
  } finally {
    await first?.close();
  }

  const seed = new PluginHost({ stateRoot: root, deviceId: 'core-first-fixture' });
  await seed.ensureBundled(bundledPluginManifests());
  await seed.close();

  const second = await createPlatformDeviceCore({
    deviceId: 'core-first-fixture',
    stateRoot: root,
    allowedRoots: [root],
    projectRoots: [],
    sourceRoots: [],
    pluginPolicy: 'core-first'
  });
  t.after(async () => {
    await second.close();
    await fs.rm(root, { recursive: true, force: true });
  });

  const palace = second.plugins.list().find(record => record.manifest.id === 'palace');
  assert.ok(palace);
  assert.equal(palace.enabled, true);
  assert.equal(palace.state, 'installed');
  assert.equal(second.capabilities.includes('knowledge.search'), false);
});

test('Device compatibility policy validates CLI over environment without changing the Core-only default', async () => {
  const { resolveDevicePluginPolicy } = await import('../../dist/platform/plugin-policy.js');
  assert.equal(resolveDevicePluginPolicy(['node', 'mcp-device.js', 'start', '--plugin-policy', 'core-first'], {}), 'core-first');
  assert.equal(resolveDevicePluginPolicy(['node', 'mcp-device.js', 'start'], {}), undefined);
  assert.equal(resolveDevicePluginPolicy(['node', 'mcp-device.js', 'start'], { MCP_DEVICE_PLUGIN_POLICY: 'core-first' }), 'core-first');
  assert.equal(resolveDevicePluginPolicy(['--plugin-policy=bundled'], { MCP_DEVICE_PLUGIN_POLICY: 'core-first' }), 'bundled');
  assert.equal(resolveDevicePluginPolicy([], { MCP_DEVICE_PLUGIN_POLICY: '' }), undefined);
  assert.equal(resolveDevicePluginPolicy(['--plugin-policy=core-first'], { MCP_DEVICE_PLUGIN_POLICY: 'invalid-env' }), 'core-first');
  assert.throws(() => resolveDevicePluginPolicy([], { MCP_DEVICE_PLUGIN_POLICY: 'invalid-env' }), /bundled or core-first/);
  assert.throws(() => resolveDevicePluginPolicy(['--plugin-policy'], {}), /bundled or core-first/);
  assert.throws(() => resolveDevicePluginPolicy(['node', 'mcp-device.js', 'start', '--plugin-policy=unknown'], {}), /bundled or core-first/);
  assert.throws(() => resolveDevicePluginPolicy(['node', 'mcp-device.js', 'start', '--plugin-policy='], { MCP_DEVICE_PLUGIN_POLICY: 'core-first' }), /bundled or core-first/);
});

test('core-first suppression also blocks Palace reached through a dependency', { timeout: 30000 }, async t => {
  await resetRoot();
  const root = sharedRoot;
  const [{ createPlatformDeviceCore }, { PluginHost }, { bundledPluginManifests }] = await Promise.all([
    import('../../dist/platform/device-runtime.js'),
    import('../../dist/platform/plugin-host.js'),
    import('./optional-palace-fixture.mjs')
  ]);
  const entry = path.join(root, 'dependent.mjs');
  await fs.writeFile(entry, 'export const createPlugin=()=>({invoke:()=>true});');
  const seed = new PluginHost({ stateRoot: root, deviceId: 'core-first-dependency-fixture' });
  await seed.ensureBundled(bundledPluginManifests());
  await seed.install({
    id: 'alternate-search', version: '1.0.0', dataSchemaVersion: 1, isolation: 'in-process', trusted: true, entry,
    capabilities: [{ name: 'knowledge.search', version: '1.0.0' }]
  }, { enabled: true });
  await seed.install({
    id: 'depends-on-palace', version: '1.0.0', dataSchemaVersion: 1, isolation: 'in-process', trusted: true, entry,
    requires: [{ name: 'knowledge.search', version: '^1.0.0' }],
    capabilities: [{ name: 'test.dependent', version: '1.0.0' }]
  }, { enabled: true });
  await seed.close();
  const core = await createPlatformDeviceCore({ deviceId: 'core-first-dependency-fixture', stateRoot: root, allowedRoots: [root], projectRoots: [], sourceRoots: [], pluginPolicy: 'core-first' });
  t.after(async () => { await core.close(); });
  assert.equal(core.plugins.drivers.has('palace'), false);
  assert.equal(core.plugins.drivers.has('alternate-search'), true);
  assert.equal(core.plugins.drivers.has('depends-on-palace'), true);
  assert.equal(core.capabilities.includes('knowledge.search'), true);
  await core.plugins.disable('alternate-search');
  await core.plugins.install({
    id: 'requires-suppressed-palace', version: '1.0.0', dataSchemaVersion: 1, isolation: 'in-process', trusted: true, entry,
    requires: [{ name: 'knowledge.search', version: '^1.0.0' }],
    capabilities: [{ name: 'test.suppressed-dependent', version: '1.0.0' }]
  });
  await assert.rejects(core.plugins.enable('requires-suppressed-palace'), { code: 'CAPABILITY_DEPENDENCY_MISSING' });
  assert.equal(core.plugins.drivers.has('palace'), false);
});

test('core-first does not start an unchanged Palace record after an external settings change', { timeout: 30000 }, async t => {
  await resetRoot();
  const root = sharedRoot;
  const [{ createPlatformDeviceCore }, { PluginHost }, { bundledPluginManifests }] = await Promise.all([
    import('../../dist/platform/device-runtime.js'),
    import('../../dist/platform/plugin-host.js'),
    import('./optional-palace-fixture.mjs')
  ]);
  const seed = new PluginHost({ stateRoot: root, deviceId: 'core-first-refresh-fixture' });
  await seed.ensureBundled(bundledPluginManifests());
  await seed.close();
  const core = await createPlatformDeviceCore({ deviceId: 'core-first-refresh-fixture', stateRoot: root, allowedRoots: [root], projectRoots: [], sourceRoots: [], pluginPolicy: 'core-first' });
  t.after(async () => { await core.close(); });
  const registry = JSON.parse(await fs.readFile(core.plugins.registryPath, 'utf8'));
  registry.revision += 1;
  registry.plugins.palace.settings = { changedExternally: true };
  registry.plugins.palace.manifest.description = 'External metadata edit is not lifecycle intent';
  await fs.writeFile(core.plugins.registryPath, JSON.stringify(registry));
  await new Promise(resolve => setTimeout(resolve, 1300));
  assert.equal(core.plugins.drivers.has('palace'), false);
  assert.equal(core.capabilities.includes('knowledge.search'), false);
});

test('explicit Palace enable remains an opt-in escape hatch under core-first', { timeout: 30000 }, async t => {
  await resetRoot();
  const root = sharedRoot;
  const [{ createPlatformDeviceCore }, { PluginHost }, { bundledPluginManifests }] = await Promise.all([
    import('../../dist/platform/device-runtime.js'),
    import('../../dist/platform/plugin-host.js'),
    import('./optional-palace-fixture.mjs')
  ]);
  const seed = new PluginHost({ stateRoot: root, deviceId: 'core-first-explicit-fixture' });
  await seed.ensureBundled(bundledPluginManifests());
  await seed.close();
  const core = await createPlatformDeviceCore({ deviceId: 'core-first-explicit-fixture', stateRoot: root, allowedRoots: [root], projectRoots: [], sourceRoots: [], pluginPolicy: 'core-first' });
  t.after(async () => { await core.close(); });
  assert.equal(core.plugins.drivers.has('palace'), false);
  await core.plugins.enable('palace');
  assert.equal(core.plugins.drivers.has('palace'), true);
  assert.equal(core.capabilities.includes('knowledge.search'), true);
});

test('external bundled Palace reinstall with enable is picked up by a Core-first runtime', { timeout: 30000 }, async t => {
  await resetRoot();
  const root = sharedRoot;
  const [{ createPlatformDeviceCore }, { PluginHost }, { bundledPluginManifests }] = await Promise.all([
    import('../../dist/platform/device-runtime.js'),
    import('../../dist/platform/plugin-host.js'),
    import('./optional-palace-fixture.mjs')
  ]);
  const manifest = bundledPluginManifests().find(item => item.id === 'palace');
  const seed = new PluginHost({ stateRoot: root, deviceId: 'core-first-reinstall-fixture' });
  await seed.ensureBundled(bundledPluginManifests());
  await seed.close();
  const core = await createPlatformDeviceCore({ deviceId: 'core-first-reinstall-fixture', stateRoot: root, allowedRoots: [root], projectRoots: [], sourceRoots: [], pluginPolicy: 'core-first' });
  t.after(async () => { await core.close(); });
  const maintenance = new PluginHost({ stateRoot: root, deviceId: 'core-first-reinstall-fixture' });
  await maintenance.uninstall('palace');
  await maintenance.install(manifest, { enabled: true, installationSource: 'distribution' });
  await maintenance.close();
  await new Promise(resolve => setTimeout(resolve, 1300));
  assert.equal(core.plugins.drivers.has('palace'), true);
  assert.equal(core.capabilities.includes('knowledge.search'), true);
});

test('explicit bundled install with enable activates an already-installed Palace under Core-first', { timeout: 30000 }, async t => {
  await resetRoot();
  const root = sharedRoot;
  const [{ createPlatformDeviceCore }, { PluginHost }, { bundledPluginManifests }] = await Promise.all([
    import('../../dist/platform/device-runtime.js'),
    import('../../dist/platform/plugin-host.js'),
    import('./optional-palace-fixture.mjs')
  ]);
  const manifests = bundledPluginManifests();
  const palace = manifests.find(item => item.id === 'palace');
  const seed = new PluginHost({ stateRoot: root, deviceId: 'core-first-install-existing-fixture' });
  await seed.ensureBundled(manifests);
  await seed.close();
  const core = await createPlatformDeviceCore({ deviceId: 'core-first-install-existing-fixture', stateRoot: root, allowedRoots: [root], projectRoots: [], sourceRoots: [], pluginPolicy: 'core-first' });
  t.after(async () => { await core.close(); });
  assert.equal(core.plugins.drivers.has('palace'), false);
  const before = JSON.parse(await fs.readFile(core.plugins.registryPath, 'utf8'));
  await core.plugins.install(palace, { installationSource: 'distribution' });
  assert.deepEqual(JSON.parse(await fs.readFile(core.plugins.registryPath, 'utf8')), before);
  assert.equal(core.plugins.drivers.has('palace'), false);
  await core.plugins.install(palace, { enabled: true, installationSource: 'distribution' });
  assert.equal(core.plugins.drivers.has('palace'), true);
  assert.equal(core.capabilities.includes('knowledge.search'), true);
});

test('same-version bundled install with enable publishes intent to a running Core-first host', { timeout: 30000 }, async t => {
  await resetRoot();
  const [{ createPlatformDeviceCore }, { PluginHost }, { bundledPluginManifests }] = await Promise.all([
    import('../../dist/platform/device-runtime.js'), import('../../dist/platform/plugin-host.js'), import('./optional-palace-fixture.mjs')
  ]);
  const seed = new PluginHost({ stateRoot: sharedRoot, deviceId: 'external-matching-install' });
  const manifests = bundledPluginManifests();
  await seed.ensureBundled(manifests); await seed.close();
  const core = await createPlatformDeviceCore({ deviceId: 'external-matching-install', stateRoot: sharedRoot, allowedRoots: [sharedRoot], projectRoots: [], sourceRoots: [], pluginPolicy: 'core-first' });
  t.after(() => core.close());
  const maintenance = new PluginHost({ stateRoot: sharedRoot, deviceId: core.deviceId });
  try { await maintenance.install(manifests.find(item => item.id === 'palace'), { enabled: true, installationSource: 'distribution' }); }
  finally { await maintenance.close(); }
  const deadline = Date.now() + 10000;
  while (!core.capabilities.includes('knowledge.search') && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(core.plugins.drivers.has('palace'), true);
  assert.equal(core.capabilities.includes('knowledge.search'), true);
});

test('omitted and legacy bundled policy use the Core-only distribution', { timeout: 30000 }, async () => {
  const { createPlatformDeviceCore } = await import('../../dist/platform/device-runtime.js');
  for (const pluginPolicy of [undefined, 'bundled']) {
    await resetRoot();
    const core = await createPlatformDeviceCore({ deviceId: 'legacy-bundled-policy', stateRoot: sharedRoot, allowedRoots: [sharedRoot], projectRoots: [], sourceRoots: [], pluginPolicy });
    try {
      const palace = core.plugins.list().find(item => item.manifest.id === 'palace');
      assert.equal(palace, undefined);
      assert.equal(core.capabilities.includes('knowledge.search'), false);
    } finally { await core.close(); }
  }
});
