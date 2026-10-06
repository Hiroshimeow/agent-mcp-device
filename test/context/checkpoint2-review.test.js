import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { temporary } from './helpers.js';

test('G6 production constructors ignore attempted interleaving hook injection', t => {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  let calls = 0;
  const injection = { afterAdmission: () => { calls++; }, interleavingHook: () => { calls++; } };
  store = new ContextStore(root, injection);
  const owner = store.activateOwner('review'), repo = store.repository(owner, 'review');
  const service = new ContextService(store, injection);
  store.append(owner, repo, 'production append');
  service.sync(owner, repo);
  assert.equal(calls, 0);
});

for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY']) {
  test(`B4 service ${feature} privileged entry points fail before side effects`, t => {
    let store;
    const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
    store = new ContextStore(root);
    const service = new ContextService(store);
    assert.throws(() => service.requireFeatureAuthorized(feature), /FEATURE_GATE_LOCKED/);
    assert.throws(() => service.initializeFeature(feature), /FEATURE_GATE_LOCKED/);
    assert.throws(() => service.executeFeature(feature, () => assert.fail('unauthorized side effect')), /FEATURE_GATE_LOCKED/);
  });
}
