import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PluginHost } from '../../dist/platform/plugin-host.js';
import { createPluginServices } from '../../dist/platform/plugin-services.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-v12-services-'));
  const host = new PluginHost({ stateRoot: root, deviceId: 'service-fixture' });
  t.after(async () => { await host.close(); await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); });
  const write = async (name, text, extension = 'mjs') => {
    const entry = path.join(root, name + '.' + extension); await fs.writeFile(entry, text); return entry;
  };
  const manifest = (id, entry, capability, extra = {}) => ({
    id, entry, version: '1.0.0', dataSchemaVersion: 1, isolation: 'in-process', trusted: true,
    capabilities: [{ name: capability, version: '1.2.0' }], timeoutMs: 2000, ...extra
  });
  return { root, host, write, manifest };
}
async function until(check, message) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.fail(message);
}

test('service binding restricts declarations and versions, carries cancellation, and closes with its parent scope', async () => {
  const controller = new AbortController(), calls = [];
  const requirements = [{ name: 'math.scale', version: '^1.2.0' }];
  const services = createPluginServices(requirements, async (name, input, options) => {
    calls.push({ name, input, options }); return Number(input) * 3;
  }, controller.signal);
  requirements[0].version = '*';
  assert.equal(await services.invoke('math.scale', 7), 21);
  assert.equal(calls[0].options.version, '^1.2.0');
  assert.equal(calls[0].options.compose, false);
  assert.equal(calls[0].options.signal, controller.signal);
  await assert.rejects(services.invoke('private.read', {}), { code: 'CAPABILITY_DEPENDENCY_UNDECLARED' });
  assert.equal(calls.length, 1);
  controller.abort();
  await assert.rejects(services.invoke('math.scale', 9), { code: 'CANCELLED' });
  assert.equal(calls.length, 1);
});

for (const isolation of ['in-process', 'process']) {
  test(isolation + ' dependent really invokes its version-compatible provider during init and invocation', { timeout: 15000 }, async t => {
    const { host, write, manifest } = await fixture(t);
    const old = await write('old', "export const createPlugin=()=>({invoke:()=>({wrongVersion:true})});");
    const provider = await write('provider', "export const createPlugin=()=>{let count=0;return {invoke(n,i){return {scaled:Number(i)*3,count:++count}}}};");
    const dependent = await write('dependent', "export async function createPlugin(c){const initial=await c.services.invoke('math.scale',2);return {async invoke(n,i,ctx){if(i==='expired')return c.services.invoke('math.scale',9);return {initial,live:await ctx.services.invoke('math.scale',i)}}}}");
    await host.install(manifest('old', old, 'math.scale', { capabilities: [{ name: 'math.scale', version: '1.0.0', priority: 100 }] }), { enabled: true });
    await host.install(manifest('provider', provider, 'math.scale'), { enabled: true });
    await host.install(manifest('dependent', dependent, 'math.derived', {
      isolation, trusted: isolation === 'in-process', requires: [{ name: 'math.scale', version: '^1.2.0' }]
    }), { enabled: true });
    await host.start();
    assert.deepEqual(await host.invoke('math.derived', 7), { initial: { scaled: 6, count: 1 }, live: { scaled: 21, count: 2 } });
    await assert.rejects(host.invoke('math.derived', 'expired'), { code: 'CANCELLED' });
    assert.deepEqual(await host.invoke('math.derived', 8), { initial: { scaled: 6, count: 1 }, live: { scaled: 24, count: 3 } });
  });
}

test('an augmenter can call its declared provider without composing itself recursively', async t => {
  const { host, write, manifest } = await fixture(t);
  const base = await write('base', "export const createPlugin=()=>({invoke:(n,i)=>({value:i})});");
  const augment = await write('augment', "export const createPlugin=()=>({async invoke(n,{input,result},ctx){return {...result,derived:await ctx.services.invoke('text.base',input+'!')}}});");
  await host.install(manifest('base', base, 'text.base'), { enabled: true });
  await host.install(manifest('augment', augment, 'text.base', {
    capabilities: [{ name: 'text.base', version: '1.2.0', role: 'augmenter' }], requires: [{ name: 'text.base', version: '^1.0.0' }]
  }), { enabled: true });
  await host.start();
  assert.deepEqual(await host.invoke('text.base', 'hello'), { value: 'hello', derived: { value: 'hello!' } });
});

test('undeclared services are denied before a real provider receives a call', async t => {
  const { host, write, manifest } = await fixture(t);
  const provider = await write('secret', "export const createPlugin=()=>{let count=0;return {invoke(){return ++count}}};");
  const dependent = await write('consumer', "export const createPlugin=()=>({invoke:(n,i,c)=>c.services.invoke('private.value',i)});");
  await host.install(manifest('secret', provider, 'private.value'), { enabled: true });
  await host.install(manifest('consumer', dependent, 'derived.value', { isolation: 'process', trusted: false }), { enabled: true });
  await host.start();
  await assert.rejects(host.invoke('derived.value', 1), { code: 'CAPABILITY_DEPENDENCY_UNDECLARED' });
  assert.equal(await host.invoke('private.value', {}), 1);
  assert.ok(host.capabilities().includes('derived.value'));
});

test('a non-Node JSON-lines sidecar invokes dependencies and callback ids cannot settle ordinary requests', { timeout: 15000 }, async t => {
  const executable = process.env.DEVICE_PARITY_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
  if (spawnSync(executable, ['--version'], { windowsHide: true }).status !== 0) { t.skip('Python executable unavailable'); return; }
  const { host, write, manifest } = await fixture(t);
  const provider = await write('scale', "export const createPlugin=()=>({invoke:(n,i)=>({scaled:i*5})});");
  const python = await write('external', [
    'import sys,json',
    'pending={}',
    'def send(value):',
    ' print(json.dumps(value),flush=True)',
    'for line in sys.stdin:',
    ' m=json.loads(line)',
    ' if m.get("type")=="host_result":',
    '  parent=pending.pop(m["id"],None)',
    '  if parent:',
    '   if "error" in m: send({"id":parent,"error":m["error"]})',
    '   else: send({"id":parent,"result":{"transport":"python","provider":m.get("result")}})',
    ' elif m.get("method")=="init": send({"id":m["id"],"result":{"ready":True}})',
    ' elif m.get("method")=="invoke":',
    '  pending[m["id"]]=m["id"]',
    '  value=m["params"]["input"]',
    '  send({"type":"host_call","id":m["id"],"parent_id":"expired" if value=="expired" else m["id"],"method":"capability.invoke","params":{"name":"math.external","input":value}})',
    ' elif m.get("method")=="stop":',
    '  send({"id":m["id"],"result":{"stopped":True}})',
    '  break',
    ''
  ].join('\n'), 'py');
  await host.install(manifest('scale', provider, 'math.external'), { enabled: true });
  await host.install(manifest('external', python, 'derived.external', {
    isolation: 'process', trusted: false, executable, args: [python], requires: [{ name: 'math.external', version: '1.x' }]
  }), { enabled: true });
  await host.start();
  assert.deepEqual(await host.invoke('derived.external', 6), { transport: 'python', provider: { scaled: 30 } });
  await assert.rejects(host.invoke('derived.external', 'expired'), { code: 'CAPABILITY_PARENT_EXPIRED' });
  assert.deepEqual(await host.invoke('derived.external', 9), { transport: 'python', provider: { scaled: 45 } });
});

for (const trigger of ['cancel', 'deadline', 'disable']) {
  test('process dependency work is cancelled on parent ' + trigger, { timeout: 15000 }, async t => {
    const { host, write, manifest } = await fixture(t);
    const provider = await write('waiting', "export const createPlugin=()=>{let started=0,aborted=0;return {invoke(n,i,c){if(i==='status')return {started,aborted};started++;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve('late'),8000);c.signal.addEventListener('abort',()=>{aborted++;clearTimeout(timer);reject(Object.assign(new Error('cancelled'),{code:'CANCELLED'}))},{once:true})})}}};");
    const dependent = await write('waiter', "export const createPlugin=()=>({invoke:(n,i,c)=>c.services.invoke('wait.base',i)});");
    await host.install(manifest('waiting', provider, 'wait.base', { timeoutMs: 10000 }), { enabled: true });
    await host.install(manifest('waiter', dependent, 'wait.derived', {
      isolation: 'process', trusted: false, timeoutMs: trigger === 'deadline' ? 1200 : 4000,
      requires: [{ name: 'wait.base', version: '^1.0.0' }]
    }), { enabled: true });
    await host.start();
    const controller = new AbortController();
    const count = trigger === 'disable' ? 4 : 1;
    const outcomes = Array.from({ length: count }, () => host.invoke('wait.derived', 'wait', { signal: controller.signal })
      .then(value => ({ value }), error => ({ error })));
    await until(async () => (await host.invoke('wait.base', 'status')).started === count, 'Provider never started all requests');
    if (trigger === 'cancel') controller.abort();
    if (trigger === 'disable') await host.disable('waiter');
    for (const completed of await Promise.all(outcomes)) {
      assert.ok(completed.error, 'Cancelled dependency unexpectedly succeeded');
      assert.equal(completed.error.code, trigger === 'deadline' ? 'PLUGIN_TIMEOUT' : trigger === 'disable' ? 'PLUGIN_STOPPED' : 'CANCELLED');
    }
    await until(async () => (await host.invoke('wait.base', 'status')).aborted === count, 'Provider did not receive all aborts');
    assert.ok(host.capabilities().includes('wait.base'));
  });
}

test('loss of a pinned provider cannot turn a formerly acyclic dependency graph into fallback recursion', async t => {
  const { host, write, manifest } = await fixture(t);
  const entry = await write('graph', "export const createPlugin=()=>({invoke:()=>true});");
  await host.install(manifest('root-provider', entry, 'graph.x', { capabilities: [{ name: 'graph.x', version: '1.2.0', priority: 100 }] }), { enabled: true });
  await host.install(manifest('middle', entry, 'graph.y', { requires: [{ name: 'graph.x', version: '1.x' }] }), { enabled: true });
  await host.install(manifest('leaf', entry, 'graph.x', { requires: [{ name: 'graph.y', version: '1.x' }] }), { enabled: true });
  await host.start();
  assert.deepEqual(host.capabilities(), ['graph.x', 'graph.y']);
  await host.disable('root-provider');
  assert.deepEqual(host.capabilities(), []);
  assert.equal(host.list().find(item => item.manifest.id === 'middle').state, 'faulted');
  assert.equal(host.list().find(item => item.manifest.id === 'leaf').state, 'faulted');
  await assert.rejects(host.enable('middle'), { code: 'CAPABILITY_CYCLE' });
  assert.deepEqual(host.capabilities(), []);
});
