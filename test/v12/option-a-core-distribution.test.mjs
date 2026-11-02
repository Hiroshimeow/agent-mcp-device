import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const scratch = path.join(root, '.tmp', 'option-a-tests');
await fs.mkdir(scratch, { recursive: true });
const sharedRoot = await fs.mkdtemp(path.join(scratch, 'runtime-'));
process.env.MCP_DEVICE_CONFIG_DIR = sharedRoot;
test.after(() => fs.rm(sharedRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 }));
const { PluginHost } = await import('../../dist/platform/plugin-host.js');
const { createPlatformDeviceCore } = await import('../../dist/platform/device-runtime.js');

async function fixture(t) {
  const dir = sharedRoot;
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const entry = path.join(dir, 'fixture.mjs');
  await fs.writeFile(entry, 'export const createPlugin=()=>({invoke:()=>({items:[]})});');
  return { dir, manifest: { id: 'palace', version: '1.0.0', dataSchemaVersion: 1, isolation: 'in-process', trusted: true, entry, capabilities: [{ name: 'knowledge.search', version: '1.0.0' }] } };
}

test('Core manifest has no Palace executable, assets or install hook', async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.bin.palace, undefined);
  assert.equal(pkg.scripts.postinstall, undefined);
  assert.equal(pkg.files.includes('skills/palace-cli'), false);
  assert.equal(pkg.files.some(file => file.includes('install-palace-skill')), false);
  const { bundledPluginManifests } = await import('../../dist/distribution.js');
  assert.deepEqual(bundledPluginManifests(), []);
});

test('default Core neither provisions Palace nor disables native execution', async t => {
  const { dir } = await fixture(t);
  const core = await createPlatformDeviceCore({ deviceId: 'option-a', stateRoot: dir, allowedRoots: [dir] });
  try {
    assert.deepEqual(core.plugins.list(), []);
    const file = path.join(dir, 'native.txt');
    await fs.writeFile(file, 'OPTION_A_NATIVE');
    assert.match(JSON.stringify(await core.invokeNative('read_file', { path: file })), /OPTION_A_NATIVE/);
  } finally { await core.close(); }
});

test('legacy automatic Palace stays retained and inert; explicit enable survives restart', async t => {
  const { dir, manifest } = await fixture(t);
  const seed = new PluginHost({ stateRoot: dir, deviceId: 'option-a' });
  await seed.ensureBundled([manifest]);
  await fs.mkdir(seed.dataRoot('palace'), { recursive: true });
  const marker = path.join(seed.dataRoot('palace'), 'retained');
  await fs.writeFile(marker, 'KEEP');
  await seed.close();
  const options = { deviceId: 'option-a', stateRoot: dir, allowedRoots: [dir], pluginPolicy: 'core-first' };
  let core = await createPlatformDeviceCore(options);
  try {
    assert.equal(core.plugins.capabilities().includes('knowledge.search'), false);
    assert.equal(core.plugins.list()[0].enabled, true);
    await core.plugins.enable('palace');
    assert.equal(core.plugins.capabilities().includes('knowledge.search'), true);
  } finally { await core.close(); }
  core = await createPlatformDeviceCore(options);
  try {
    assert.equal(core.plugins.capabilities().includes('knowledge.search'), true, 'explicit enable must survive a new host');
    assert.equal(await fs.readFile(marker, 'utf8'), 'KEEP');
    await core.plugins.uninstall('palace');
  } finally { await core.close(); }
  core = await createPlatformDeviceCore(options);
  try {
    assert.equal(core.plugins.list()[0].installed, false);
    assert.equal(await fs.readFile(marker, 'utf8'), 'KEEP');
  } finally { await core.close(); }
});

test('knowledge CLI never provisions Palace on a fresh Core root', async t => {
  const { dir } = await fixture(t);
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, MCP_DEVICE_CONFIG_DIR: dir };
  delete env.MCP_DEVICE_SKIP_SKILL_INSTALL;
  delete env.MCP_DEVICE_PLUGIN_POLICY;
  const out = spawnSync(process.execPath, [path.join(root, 'dist/mcp-device.js'), 'knowledge', '--runtime-dir', dir, 'search', '{}'], { env, encoding: 'utf8', timeout: 30000 });
  assert.equal(out.status, 1, out.stdout + out.stderr);
  assert.match(out.stderr, /CAPABILITY_UNAVAILABLE/);
  const host = new PluginHost({ stateRoot: dir, deviceId: 'option-a' });
  await host.load();
  assert.deepEqual(host.list(), []);
  await host.close();
});
