import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, unlinkSync } from 'node:fs';
import { approvalFixture } from './fixtures/capture-approval.js';
import * as gateway from '../../dist/context/gateway.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/context-tool-contract.json', import.meta.url)));
test('six full public schemas match contract annotations and fit the 10,000 token catalog budget', t => {
  const f = approvalFixture(t, ['FEATURE_PUBLIC_GATEWAY']);
  const tools = gateway.contextToolCatalog();
  assert.equal(tools.length, 6);
  for (const expected of fixture.tools) {
    const actual = tools.find(tool => tool.name === expected.name);
    assert.deepEqual(actual, { name: expected.name, description: expected.description, inputSchema: expected.inputSchema, annotations: expected.annotations, risk_lane: expected.risk_lane });
    if (expected.actions.length) for (const action of ['purge', 'adopt', 'relink', 'backup', 'export', 'provider', 'unknown']) {
      assert.throws(() => gateway.validateContextInput(expected.name, { device_id: 'd', cwd: '/repo', action, refs: ['ref'] }), /ACTION_UNSUPPORTED/);
    }
  }
  assert.ok(Buffer.byteLength(JSON.stringify(tools)) / 4 <= 10000);
  unlinkSync(f.path);
  assert.throws(() => gateway.contextToolCatalog(), /FEATURE_GATE_LOCKED/);
});

test('public forwarding denies old/offline/unowned devices and lane mismatch before transport', async t => {
  approvalFixture(t, ['FEATURE_PUBLIC_GATEWAY']);
  let calls = 0;
  const device = { owned: true, online: true, capabilities: ['local_search'], context_version: 1 };
  const route = { resolveDevice: async () => device, forward: async () => { calls++; return { ok: true }; } };
  const input = { device_id: 'd', cwd: '/repo', query: 'marker' };
  assert.deepEqual(await gateway.callContextTool('local_search', input, route, 'read'), { ok: true });
  for (const [patch, code] of [[{ owned: false }, 'ACCESS_DENIED'], [{ online: false }, 'DEVICE_OFFLINE'], [{ capabilities: [] }, 'DEVICE_UNSUPPORTED'], [{ context_version: undefined }, 'DEVICE_UNSUPPORTED']]) {
    const original = { ...device }; Object.assign(device, patch);
    assert.deepEqual(await gateway.callContextTool('local_search', input, route, 'read'), { ok: false, error: { code } });
    Object.assign(device, original);
  }
  assert.deepEqual(await gateway.callContextTool('local_search', input, route, 'write'), { ok: false, error: { code: 'ACCESS_DENIED' } });
  assert.deepEqual(await gateway.callContextTool('local_search', { ...input, cwd: undefined }, route, 'read'), { ok: false, error: { code: 'SCOPE_REQUIRED' } });
  assert.equal(calls, 1);
});

test('wiki is reserved disabled status with zero transport/provider calls', async t => {
  approvalFixture(t, ['FEATURE_PUBLIC_GATEWAY']);
  const route = { resolveDevice: () => assert.fail('wiki resolved device'), forward: () => assert.fail('wiki provider/transport called') };
  assert.deepEqual(await gateway.callContextTool('local_wiki', { action: 'status' }, route, 'read'), fixture.tools.at(-1).result);
  assert.deepEqual(await gateway.callContextTool('local_wiki', { action: 'generate' }, route, 'read'), { ok: false, error: { code: 'ACTION_UNSUPPORTED' } });
});
