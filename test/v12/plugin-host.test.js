import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PluginHost } from '../../dist/platform/plugin-host.js';
import { compatible } from '../../dist/platform/plugin-contract.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-v12-plugin-'));
  const host = new PluginHost({ stateRoot: root, deviceId: 'fixture-device' });
  t.after(async () => { await host.close(); await fs.rm(root, { recursive: true, force: true }); });
  const write = async (name, body) => { const entry = path.join(root, name + '.mjs'); await fs.writeFile(entry, body); return entry; };
  const manifest = (id, entry, caps = [{ name: 'text.echo', version: '1.0.0' }], extra = {}) => ({ id, version: '1.0.0', dataSchemaVersion: 1, isolation: 'in-process', trusted: true, entry, capabilities: caps, timeoutMs: 1000, ...extra });
  return { root, host, write, manifest };
}

test('unrelated plugin lifecycle preserves data and Core-owned state; reinstall resumes', async t => {
  const { root, host, write, manifest } = await fixture(t);
  const coreMarker = path.join(root, 'identity-marker'); await fs.writeFile(coreMarker, 'do not own this');
  const entry = await write('echo', `import fs from 'node:fs/promises'; import path from 'node:path'; export function createPlugin(c){return {async start(){await fs.writeFile(path.join(c.dataRoot,'retained.txt'),'retained')},invoke(n,i){return {echo:i,device:c.deviceId}}}}`);
  const m = manifest('reference', entry); await host.install(m, { enabled: true }); await host.start();
  assert.deepEqual(await host.invoke('text.echo', { text: 'hello' }), { echo: { text: 'hello' }, device: 'fixture-device' });
  await host.disable('reference'); assert.deepEqual(host.capabilities(), []);
  assert.equal(await fs.readFile(path.join(host.dataRoot('reference'), 'retained.txt'), 'utf8'), 'retained');
  await host.enable('reference'); assert.deepEqual(host.capabilities(), ['text.echo']);
  await host.uninstall('reference'); assert.equal(await fs.readFile(coreMarker, 'utf8'), 'do not own this');
  assert.equal(await fs.readFile(path.join(host.dataRoot('reference'), 'retained.txt'), 'utf8'), 'retained');
  await host.install(m, { enabled: true }); assert.deepEqual(await host.invoke('text.echo', 42), { echo: 42, device: 'fixture-device' });
  await host.disable('reference'); await host.purge('reference'); await assert.rejects(fs.stat(host.dataRoot('reference')), { code: 'ENOENT' });
});

test('capability dependencies, priority, augmentation and graceful loss are generic', async t => {
  const { host, write, manifest } = await fixture(t);
  const base = await write('base', `export const createPlugin=()=>({invoke:(n,i)=>({value:i})});`);
  const augment = await write('augment', `export const createPlugin=()=>({invoke:(n,{result})=>({...result,augmented:true})});`);
  await host.install(manifest('base', base, [{ name: 'text.echo', version: '1.0.0', priority: 10 }]), { enabled: true });
  await host.install(manifest('augment', augment, [{ name: 'text.echo', version: '1.0.0', role: 'augmenter' }], { requires: [{ name: 'text.echo', version: '^1.0.0' }] }), { enabled: true });
  await host.start(); assert.deepEqual(await host.invoke('text.echo', 'x'), { value: 'x', augmented: true });
  await host.disable('base'); assert.deepEqual(host.capabilities(), []); assert.equal(host.list().find(p => p.manifest.id === 'augment').state, 'faulted');
});

test('missing dependencies and cycles fail without bringing down the host', async t => {
  const { host, write, manifest } = await fixture(t);
  const entry = await write('plugin', `export const createPlugin=()=>({invoke:()=>true});`);
  await host.install(manifest('one', entry, [{ name: 'cap.one', version: '1.0.0' }], { requires: [{ name: 'cap.two', version: '1.x' }] }), { enabled: true });
  await host.install(manifest('two', entry, [{ name: 'cap.two', version: '1.0.0' }], { requires: [{ name: 'cap.one', version: '1.x' }] }), { enabled: true });
  await host.start(); assert.deepEqual(host.capabilities(), []); assert.ok(host.list().every(p => p.state === 'faulted'));
  await host.install(manifest('independent', entry, [{ name: 'cap.independent', version: '1.0.0' }]), { enabled: true });
  assert.equal(await host.invoke('cap.independent', {}), true);
});

test('process crash and synchronous hang are isolated and bounded', { timeout: 15000 }, async t => {
  const { host, write, manifest } = await fixture(t);
  const entry = await write('fatal', `export const createPlugin=()=>({invoke(n,i){if(i==='crash')process.exit(19);while(true){}}});`);
  await host.install(manifest('fatal', entry, [{ name: 'fault.run', version: '1.0.0' }], { isolation: 'process', trusted: false, timeoutMs: 1000 }), { enabled: true });
  await host.start(); await assert.rejects(host.invoke('fault.run', 'crash'));
  await new Promise(resolve => setTimeout(resolve, 100)); assert.deepEqual(host.capabilities(), []);
  await host.enable('fatal'); const start = Date.now(); await assert.rejects(host.invoke('fault.run', 'hang'), error => error.code === 'PLUGIN_TIMEOUT');
  assert.ok(Date.now() - start < 5000); await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(host.list()[0].state, 'faulted'); assert.equal(2 + 2, 4);
});

test('ordinary domain errors preserve a cooperative provider; thrown exceptions fault only that plugin', async t => {
  const { host, write, manifest } = await fixture(t);
  const entry = await write('errors', `export const createPlugin=()=>({invoke(n,i){if(i==='invalid')throw Object.assign(new Error('input'),{code:'INVALID_ARGUMENT'});if(i==='throw')throw new Error('bug');return 'ok'}});`);
  await host.install(manifest('errors', entry), { enabled: true }); await host.start();
  await assert.rejects(host.invoke('text.echo', 'invalid'), { code: 'INVALID_ARGUMENT' }); assert.equal(await host.invoke('text.echo', 'valid'), 'ok');
  await assert.rejects(host.invoke('text.echo', 'throw')); await new Promise(resolve => setTimeout(resolve, 50)); assert.equal(host.list()[0].state, 'faulted');
});

test('explicit upgrade migrates private data and failed migration rolls back', async t => {
  const { host, write, manifest } = await fixture(t);
  const v1 = await write('v1', `import fs from 'node:fs/promises';import path from 'node:path';export const createPlugin=c=>({async start(){try{await fs.access(path.join(c.dataRoot,'value'))}catch{await fs.writeFile(path.join(c.dataRoot,'value'),'one')}},invoke:()=>1});`);
  await host.install(manifest('versioned', v1), { enabled: true }); await host.start();
  const v2 = await write('v2', `import fs from 'node:fs/promises';import path from 'node:path';export async function migrate(o){await fs.writeFile(path.join(o.dataRoot,'value'),'two')}export const createPlugin=()=>({invoke:()=>2});`);
  await host.upgrade(manifest('versioned', v2, undefined, { version: '2.0.0', dataSchemaVersion: 2 }));
  assert.equal(await host.invoke('text.echo', {}), 2); assert.equal(await fs.readFile(path.join(host.dataRoot('versioned'), 'value'), 'utf8'), 'two');
  const bad = await write('bad', `import fs from 'node:fs/promises';import path from 'node:path';export async function migrate(o){await fs.writeFile(path.join(o.dataRoot,'value'),'corrupted');throw new Error('migration fail')}export const createPlugin=()=>({invoke:()=>3});`);
  await assert.rejects(host.upgrade(manifest('versioned', bad, undefined, { version: '3.0.0', dataSchemaVersion: 3 })));
  assert.equal(await fs.readFile(path.join(host.dataRoot('versioned'), 'value'), 'utf8'), 'two'); assert.equal(await host.invoke('text.echo', {}), 2);
});

test('uninstall tombstone survives restart; bundle does not silently reinstall', async t => {
  const { root, host, write, manifest } = await fixture(t);
  const entry = await write('bundle', `export const createPlugin=()=>({invoke:()=>true});`), m = manifest('bundle', entry);
  await host.ensureBundled([m]); await host.start(); await host.uninstall('bundle'); await host.close();
  const restarted = new PluginHost({ stateRoot: root, deviceId: 'fixture-device' }); t.after(() => restarted.close());
  await restarted.ensureBundled([m]); await restarted.start(); assert.deepEqual(restarted.capabilities(), []); assert.equal(restarted.list()[0].state, 'uninstalled');
});

test('external lifecycle changes remove dependent capability advertisements without restart', { timeout: 10000 }, async t => {
  const { root, host, write, manifest } = await fixture(t);
  const entry = await write('external', `export const createPlugin=()=>({invoke:()=>true});`);
  await host.install(manifest('provider', entry, [{ name: 'base.value', version: '1.0.0' }]), { enabled: true });
  await host.install(manifest('dependent', entry, [{ name: 'derived.value', version: '1.0.0' }], { requires: [{ name: 'base.value', version: '1.x' }] }), { enabled: true });
  await host.start(); let updates = 0; host.onCapabilitiesChanged(() => updates++);
  const management = new PluginHost({ stateRoot: root, deviceId: 'management' });
  await management.disable('provider'); await management.close();
  const deadline = Date.now() + 5000;
  while (host.capabilities().length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(host.capabilities(), []); assert.ok(updates > 0);
  assert.equal(host.list().find(p => p.manifest.id === 'dependent').state, 'faulted');
});

test('capability version ranges do not silently cross incompatible zero-major versions', () => {
  assert.equal(compatible('1.9.0', '^1.2.0'), true);
  assert.equal(compatible('2.0.0', '^1.2.0'), false);
  assert.equal(compatible('0.3.0', '^0.2.1'), false);
  assert.equal(compatible('0.2.9', '^0.2.1'), true);
  assert.equal(compatible('0.0.2', '^0.0.1'), false);
  assert.equal(compatible('1.5.0', '1.x'), true);
});

test('unproven process termination blocks host closure and replacement until resource release succeeds', { timeout: 15000 }, async t => {
  const { host, write, manifest } = await fixture(t);
  const entry = await write('retained-process', "export const createPlugin=()=>({invoke:()=>true});");
  await host.install(manifest('retained-process', entry, undefined, { isolation: 'process', trusted: false }), { enabled: true });
  await host.start();
  // Simulate an OS refusing termination after the active advertisement is removed.
  // Public close/enable must still retain ownership of that exact live driver.
  const driver = host.drivers.get('retained-process'), originalStop = driver.stop.bind(driver);
  let attempts = 0;
  driver.stop = async () => { attempts++; throw Object.assign(new Error('fixture OS termination refusal'), { code: 'PLUGIN_TERMINATION_FAILED' }); };
  try {
    await assert.rejects(host.disable('retained-process'), { code: 'PLUGIN_TERMINATION_FAILED' });
    assert.deepEqual(host.capabilities(), []);
    await assert.rejects(host.enable('retained-process'), { code: 'PLUGIN_TERMINATION_FAILED' });
    await assert.rejects(host.close(), { code: 'PLUGIN_TERMINATION_FAILED' });
    assert.ok(attempts >= 3, 'Retired process ownership was forgotten');
  } finally {
    driver.stop = originalStop;
    await host.close();
  }
});

test('a cooperative cleanup rejection retains its instance and is retried before closure succeeds', async t => {
  const { host, write, manifest } = await fixture(t);
  const entry = await write('cooperative-cleanup', "import fs from 'node:fs/promises';import path from 'node:path';export const createPlugin=c=>{let attempts=0;return {invoke:()=>true,async stop(){if(++attempts===1)throw new Error('fixture cleanup refused');await fs.writeFile(path.join(c.dataRoot,'cleanup-complete'),String(attempts))}}};");
  await host.install(manifest('cooperative-cleanup', entry), { enabled: true }); await host.start();
  const concurrent = await Promise.allSettled([host.close(), host.close()]);
  for (const result of concurrent) { assert.equal(result.status, 'rejected'); assert.equal(result.reason.code, 'PLUGIN_TERMINATION_FAILED'); }
  assert.deepEqual(host.capabilities(), []);
  await assert.rejects(fs.stat(path.join(host.dataRoot('cooperative-cleanup'), 'cleanup-complete')), { code: 'ENOENT' });
  await host.close();
  assert.equal(await fs.readFile(path.join(host.dataRoot('cooperative-cleanup'), 'cleanup-complete'), 'utf8'), '2');
});
