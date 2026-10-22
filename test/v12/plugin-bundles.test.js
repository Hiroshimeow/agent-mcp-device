import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PluginHost } from '../../dist/platform/plugin-host.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-v12-bundle-'));
  const hosts = [];
  const create = () => { const host = new PluginHost({ stateRoot: root, deviceId: 'bundle-fixture' }); hosts.push(host); return host; };
  t.after(async () => { for (const host of hosts.reverse()) await host.close(); await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); });
  const write = async (name, body) => { const entry = path.join(root, name + '.mjs'); await fs.writeFile(entry, body); return entry; };
  const manifest = (entry, extra = {}) => ({ id: 'bundle', entry, version: '1.0.0', dataSchemaVersion: 1,
    capabilities: [{ name: 'bundle.value', version: '1.0.0' }], isolation: 'in-process', trusted: true, timeoutMs: 2000, ...extra });
  const registry = async () => JSON.parse(await fs.readFile(path.join(root, 'plugins', 'registry.json'), 'utf8'));
  return { root, create, host: create(), write, manifest, registry };
}
const retaining = "import fs from 'node:fs/promises';import path from 'node:path';export const createPlugin=c=>({async invoke(){return {value:await fs.readFile(path.join(c.dataRoot,'value'),'utf8'),setting:c.settings?.label}}});";
const simple = "export const createPlugin=()=>({invoke:()=>true});";

test('bundled provenance permits entry-only relocation with identical contract and retained settings/data', async t => {
  const { host, create, write, manifest, registry } = await fixture(t);
  const oldEntry = await write('original', retaining), oldManifest = manifest(oldEntry);
  await host.ensureBundled([oldManifest]);
  await host.configure('bundle', { label: 'retained setting' });
  await fs.mkdir(host.dataRoot('bundle'), { recursive: true });
  await fs.writeFile(path.join(host.dataRoot('bundle'), 'value'), 'retained data');
  await host.start();
  assert.equal(host.list()[0].installationSource, 'distribution');
  assert.deepEqual(await host.invoke('bundle.value', {}), { value: 'retained data', setting: 'retained setting' });
  await host.close(); await fs.unlink(oldEntry);
  const relocated = await write('relocated', retaining);
  // Property order is not a contract change.
  const moved = Object.fromEntries(Object.entries({ ...oldManifest, entry: relocated }).reverse());
  const restarted = create(); await restarted.ensureBundled([moved]);
  const beforeStart = (await registry()).plugins.bundle;
  assert.equal(beforeStart.manifest.entry, relocated); assert.equal(beforeStart.enabled, true);
  assert.equal(beforeStart.schemaVersion, 1); assert.equal(beforeStart.settings.label, 'retained setting');
  assert.equal(beforeStart.installationSource, 'distribution'); assert.equal(beforeStart.bundleUpgradeRequired, undefined);
  await restarted.start();
  assert.deepEqual(await restarted.invoke('bundle.value', {}), { value: 'retained data', setting: 'retained setting' });
});

test('disabled bundles relocate without activation and uninstall tombstones remain byte-for-byte unchanged', async t => {
  const { host, create, write, manifest, registry, root } = await fixture(t);
  const entry = await write('disabled-old', simple);
  await host.ensureBundled([manifest(entry)]); await host.disable('bundle');
  await fs.mkdir(host.dataRoot('bundle'), { recursive: true }); await fs.writeFile(path.join(host.dataRoot('bundle'), 'marker'), 'keep');
  await host.close(); await fs.unlink(entry);
  const nextEntry = await write('disabled-new', simple), next = manifest(nextEntry);
  const restarted = create(); await restarted.ensureBundled([next]); await restarted.start();
  assert.deepEqual(restarted.capabilities(), []); assert.equal(restarted.list()[0].state, 'disabled');
  assert.equal(restarted.list()[0].manifest.entry, nextEntry); assert.equal(restarted.list()[0].enabled, false);
  assert.equal(await fs.readFile(path.join(restarted.dataRoot('bundle'), 'marker'), 'utf8'), 'keep');
  await restarted.uninstall('bundle'); await restarted.close();
  const registryPath = path.join(root, 'plugins', 'registry.json'), bytes = await fs.readFile(registryPath, 'utf8');
  const third = create(); await third.ensureBundled([manifest(nextEntry, { version: '9.0.0', dataSchemaVersion: 9 })]); await third.start();
  assert.equal(await fs.readFile(registryPath, 'utf8'), bytes);
  assert.equal((await registry()).plugins.bundle.installed, false); assert.deepEqual(third.capabilities(), []);
});

test('manual and unmarked records are never adopted or replaced by bundled manifests', async t => {
  const { host, create, write, manifest, root } = await fixture(t);
  const manualEntry = await write('manual', simple), replacement = await write('distribution', simple);
  await host.install(manifest(manualEntry), { enabled: false });
  const registryPath = path.join(root, 'plugins', 'registry.json');
  const original = await fs.readFile(registryPath, 'utf8');
  await host.ensureBundled([manifest(replacement)]);
  assert.equal(await fs.readFile(registryPath, 'utf8'), original);
  assert.equal(host.list()[0].installationSource, 'manual');
  await host.close();
  const legacy = JSON.parse(original); delete legacy.plugins.bundle.installationSource;
  await fs.writeFile(registryPath, JSON.stringify(legacy));
  const unmarkedBytes = await fs.readFile(registryPath, 'utf8'), reopened = create();
  await reopened.ensureBundled([manifest(replacement)]);
  assert.equal(await fs.readFile(registryPath, 'utf8'), unmarkedBytes);
  assert.equal(reopened.list()[0].manifest.entry, manualEntry);
  await reopened.uninstall('bundle'); await reopened.install(manifest(replacement));
  assert.equal(reopened.list()[0].installationSource, 'manual');
});

test('same-path distribution version change blocks execution until explicit upgrade migrates once', { timeout: 15000 }, async t => {
  const { host, create, write, manifest } = await fixture(t);
  const v1 = "import fs from 'node:fs/promises';import path from 'node:path';export const createPlugin=c=>({async start(){const p=path.join(c.dataRoot,'value');try{await fs.access(p)}catch{await fs.writeFile(p,'one')}},invoke:()=>1});";
  const entry = await write('same-path', v1), m1 = manifest(entry, { isolation: 'process', trusted: false });
  await host.ensureBundled([m1]); await host.start(); assert.equal(await host.invoke('bundle.value', {}), 1); await host.close();
  const v2 = "import fs from 'node:fs/promises';import path from 'node:path';export async function migrate(o){await fs.appendFile(path.join(o.dataRoot,'migrations'),'m');await fs.writeFile(path.join(o.dataRoot,'value'),'two')}export const createPlugin=c=>({async start(){await fs.appendFile(path.join(c.dataRoot,'starts'),'s')},invoke:()=>2});";
  await fs.writeFile(entry, v2);
  const m2 = { ...m1, version: '2.0.0', dataSchemaVersion: 2 };
  const reopened = create(); await reopened.ensureBundled([m2]); await reopened.start();
  assert.deepEqual(reopened.capabilities(), []);
  assert.equal(reopened.list()[0].manifest.version, '1.0.0'); assert.equal(reopened.list()[0].schemaVersion, 1);
  assert.deepEqual(reopened.list()[0].bundleUpgradeRequired, { version: '2.0.0', dataSchemaVersion: 2 });
  await assert.rejects(reopened.enable('bundle'), { code: 'PLUGIN_UPGRADE_REQUIRED' });
  await assert.rejects(fs.access(path.join(reopened.dataRoot('bundle'), 'starts')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(reopened.dataRoot('bundle'), 'migrations')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(reopened.dataRoot('bundle'), 'value'), 'utf8'), 'one');
  await reopened.close();
  const restarted = create(); await restarted.start(); // Gate also survives a host that does not call ensureBundled.
  await assert.rejects(restarted.enable('bundle'), { code: 'PLUGIN_UPGRADE_REQUIRED' });
  assert.deepEqual(restarted.capabilities(), []);
  const failedMigration = "import fs from 'node:fs/promises';import path from 'node:path';export async function migrate(o){await fs.writeFile(path.join(o.dataRoot,'value'),'corrupted');throw new Error('migration rejected')}export const createPlugin=()=>({invoke:()=>99});";
  await fs.writeFile(entry, failedMigration);
  await assert.rejects(restarted.upgrade(m2), /migration rejected/);
  assert.equal(await fs.readFile(path.join(restarted.dataRoot('bundle'), 'value'), 'utf8'), 'one');
  assert.equal(restarted.list()[0].bundleUpgradeRequired.version, '2.0.0');
  await assert.rejects(restarted.enable('bundle'), { code: 'PLUGIN_UPGRADE_REQUIRED' });
  await fs.writeFile(entry, v2); await restarted.upgrade(m2);
  assert.equal(await restarted.invoke('bundle.value', {}), 2);
  assert.equal(await fs.readFile(path.join(restarted.dataRoot('bundle'), 'migrations'), 'utf8'), 'm');
  assert.equal(await fs.readFile(path.join(restarted.dataRoot('bundle'), 'starts'), 'utf8'), 's');
  assert.equal(restarted.list()[0].bundleUpgradeRequired, undefined);
  assert.equal(restarted.list()[0].installationSource, 'distribution');
  await restarted.ensureBundled([m2]);
  assert.equal(await fs.readFile(path.join(restarted.dataRoot('bundle'), 'migrations'), 'utf8'), 'm');
});

test('non-entry contract changes also gate disabled bundles without changing user enablement', async t => {
  const { host, create, write, manifest } = await fixture(t);
  const entry = await write('contract', simple), m = manifest(entry);
  await host.ensureBundled([m]); await host.disable('bundle'); await host.close();
  const reopened = create(); await reopened.ensureBundled([{ ...m, timeoutMs: 9000 }]); await reopened.start();
  assert.equal(reopened.list()[0].enabled, false); assert.equal(reopened.list()[0].state, 'disabled');
  assert.equal(reopened.list()[0].manifest.timeoutMs, 2000);
  await assert.rejects(reopened.enable('bundle'), { code: 'PLUGIN_UPGRADE_REQUIRED' });
  assert.equal(reopened.list()[0].enabled, false); assert.deepEqual(reopened.capabilities(), []);
});

test('entry relocation recovers only a missing-entry fault and leaves unrelated faults explicit', async t => {
  const { host, create, write, manifest, root } = await fixture(t);
  const missing = path.join(root, 'missing.mjs');
  await host.ensureBundled([manifest(missing)]); await host.start();
  assert.equal(host.list()[0].state, 'faulted'); assert.match(host.list()[0].error, /^ENOENT:/); await host.close();
  const relocated = await write('present', simple), reopened = create();
  await reopened.ensureBundled([manifest(relocated)]); await reopened.start();
  assert.equal(await reopened.invoke('bundle.value', {}), true); await reopened.close();
  const registryPath = path.join(root, 'plugins', 'registry.json'), registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
  registry.plugins.bundle.state = 'faulted'; registry.plugins.bundle.error = 'PLUGIN_FAULT: observed plugin failure';
  await fs.writeFile(registryPath, JSON.stringify(registry)); await fs.unlink(relocated);
  const next = await write('present-again', simple), third = create();
  await third.ensureBundled([manifest(next)]); await third.start();
  assert.equal(third.list()[0].state, 'faulted'); assert.deepEqual(third.capabilities(), []);
});
