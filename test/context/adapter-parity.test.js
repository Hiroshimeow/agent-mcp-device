import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, unlinkSync, cpSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { temporary, initGit } from './helpers.js';
import { approvalFixture } from './fixtures/capture-approval.js';
import { GatewayToolAdapter, gatewayCapabilities } from '../../dist/device/gateway-tool-adapter.js';
import { ContextStore } from '../../dist/context/store.js';
import { resolveRepository } from '../../dist/context/repositories.js';
import { sync } from '../../dist/context/indexer.js';
import { runContextCli } from '../../dist/context/cli.js';

test('public context route registration and dispatch retain explicit gate boundaries', () => {
  const adapter = readFileSync(new URL('../../src/device/gateway-tool-adapter.ts', import.meta.url), 'utf8');
  assert.match(adapter, /isFeatureAuthorized\('FEATURE_PUBLIC_GATEWAY'\) \? CONTEXT_TOOL_NAMES : \[\]/);
  assert.match(adapter, /if \(tool\.startsWith\('local_'\)\) \{\s*return executePublicGateway\(/);
  const gateway = readFileSync(new URL('../../src/context/gateway.ts', import.meta.url), 'utf8');
  assert.match(gateway, /contextToolCatalog\(\) \{ return executePublicGateway\(buildContextCatalog\)/);
  assert.match(gateway, /return executePublicGateway\(async \(\) =>/);
});

test('device public MCP preserves exact CLI content/scope/errors/coverage and gate', async t => {
  const f = approvalFixture(t, ['FEATURE_PUBLIC_GATEWAY']);
  const cwd = join(temporary(t), 'repo'); mkdirSync(cwd); initGit(cwd);
  const resolved = await resolveRepository(cwd, async p => p);
  const repo = f.store.repository(f.owner, resolved.identity);
  const ref = f.store.append(f.owner, repo, 'parity retained history'); sync(f.store, f.owner, repo);
  const adapter = new GatewayToolAdapter(undefined, { allowedRoots: [cwd], pathValidator: async p => p, context: { stateRoot: f.root, deviceId: 'device' } });
  const cli = async args => {
    const result = await runContextCli([...args, '--cwd', cwd, '--json'], { stateRoot: f.root });
    return JSON.parse(result.stdout || result.stderr);
  };
  for (const [tool, input, args] of [
    ['local_status', {}, ['status']],
    ['local_search', { query: 'parity' }, ['search', '--query', 'parity']],
    ['local_read', { refs: [ref] }, ['read', '--ref', ref]],
    ['local_read', { refs: ['missing'] }, ['read', '--ref', 'missing']],
    ['local_graph', { action: 'neighbors', refs: [ref] }, ['graph', '--action', 'neighbors', '--ref', ref]],
    ['local_search', { query: 'parity', cursor: 'tampered' }, ['search', '--query', 'parity', '--cursor', 'tampered']],
  ]) assert.deepEqual(await adapter.call(tool, { device_id: 'device', cwd, ...input }), await cli(args));
  // Write parity uses identical starting databases and deterministic invocation
  // identities/time. No domain field is stripped or normalized.
  f.close();
  for (const action of ['sync', 'rebuild']) {
    const copy = temporary(t); cpSync(f.root, copy, { recursive: true });
    const originalRandom = crypto.randomBytes, originalNow = Date.now;
    crypto.randomBytes = size => Buffer.alloc(size, 7); Date.now = () => 1700000000000; syncBuiltinESMExports();
    try {
      const actual = await adapter.call('local_index', { device_id: 'device', cwd, action });
      const result = await runContextCli([action, '--cwd', cwd, '--json'], { stateRoot: copy });
      assert.deepEqual(actual, JSON.parse(result.stdout || result.stderr));
    } finally { crypto.randomBytes = originalRandom; Date.now = originalNow; syncBuiltinESMExports(); }
  }
  assert.deepEqual(await adapter.call('local_status', { device_id: 'other', cwd }), { ok: false, error: { code: 'ACCESS_DENIED' } });
  assert.deepEqual(await adapter.call('local_status', { device_id: 'device', cwd: temporary(t) }), { ok: false, error: { code: 'ACCESS_DENIED' } });
  assert.deepEqual(await adapter.call('local_wiki', { action: 'status' }), { ok: false, code: 'WIKI_DISABLED', enabled: false, implementation_feature: '003-manual-repo-wiki' });
  assert.ok(gatewayCapabilities().includes('local_search'));
  unlinkSync(f.path);
  assert.ok(!gatewayCapabilities().includes('local_search'));
  for (const tool of ['local_status', 'local_search', 'local_read', 'local_graph', 'local_index', 'local_wiki']) {
    assert.ok(!gatewayCapabilities().includes(tool));
    await assert.rejects(adapter.call(tool, { device_id: 'device', cwd }), /FEATURE_GATE_LOCKED/);
    const { callDeviceContext } = await import('../../dist/context/device-adapter.js');
    await assert.rejects(callDeviceContext(tool, {}, { deviceId: 'device' }, () => assert.fail('locked route reached path guard')), /FEATURE_GATE_LOCKED/);
  }
});
