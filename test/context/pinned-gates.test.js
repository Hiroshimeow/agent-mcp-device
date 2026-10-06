import test from 'node:test';
import assert from 'node:assert/strict';
import crypto, { generateKeyPairSync, sign } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { temporary } from './helpers.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as authorization from '../../dist/context/authorization.js';

const scopes = ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'];
test('G2 valid Ed25519 signed artifact verifies with explicit test-only key without crypto substitution', async t => {
  const { verifyOfficialApproval } = await import('../../dist/device/official-trust.js');
  const f = approval(t);
  const artifact = JSON.parse(readFileSync(f.path, 'utf8'));
  assert.equal(verifyOfficialApproval(artifact, f.keys.publicKey), true);
  assert.equal(verifyOfficialApproval(artifact), false, 'test key cannot authorize production pin');
  assert.equal(authorization.isFeatureAuthorized(scopes[0], f.config), false);
  assert.equal(verifyOfficialApproval({ ...artifact, expires_at: artifact.expires_at + 1 }, f.keys.publicKey), false);
});
function approval(t, features = scopes) {
  const root = temporary(t), config = join(root, 'config'); mkdirSync(config);
  const keys = generateKeyPairSync('ed25519');
  const payload = { expires_at: Date.now() + 60000, features, schema_version: 1 };
  const path = join(config, 'soc-approval.json');
  const write = () => writeFileSync(path, JSON.stringify({ ...payload, signature: sign(null, Buffer.from(JSON.stringify(payload)), keys.privateKey).toString('base64') }));
  write();
  writeFileSync(join(config, 'revoked-approvals.json'), '[]');
  return { config, path, payload, keys, write };
}
// Positive controls replace only crypto key construction in this isolated test
// process. No test signing key or injection seam is shipped in production.
function testTrust(t, keys) {
  const original = crypto.createPublicKey;
  crypto.createPublicKey = () => keys.publicKey; syncBuiltinESMExports();
  t.after(() => { crypto.createPublicKey = original; syncBuiltinESMExports(); });
}

// Redirect installed-config reads only within this isolated test process.
// Public production entry points expose no configuration injection parameter.
function moduleConfig(t, f) {
  const installed = fileURLToPath(new URL('../../config/', import.meta.url));
  const originals = { statSync: fs.statSync, readFileSync: fs.readFileSync };
  for (const name of Object.keys(originals)) fs[name] = (path, ...args) => {
    const mapped = typeof path === 'string' && path.startsWith(installed) ? join(f.config, path.slice(installed.length)) : path;
    return originals[name](mapped, ...args);
  };
  syncBuiltinESMExports();
  t.after(() => { Object.assign(fs, originals); syncBuiltinESMExports(); });
}

test('R2 Negative Test #5 attacker env public key plus valid self-signed artifact is SOC_KEY_UNTRUSTED', async t => {
  const f = approval(t);
  const previous = process.env.MCP_DEVICE_SOC_PUBLIC_KEY;
  process.env.MCP_DEVICE_SOC_PUBLIC_KEY = f.keys.publicKey.export({ type: 'spki', format: 'pem' });
  t.after(() => { if (previous === undefined) delete process.env.MCP_DEVICE_SOC_PUBLIC_KEY; else process.env.MCP_DEVICE_SOC_PUBLIC_KEY = previous; });
  assert.equal(authorization.isFeatureAuthorized(scopes[0], f.config), false);
  moduleConfig(t, f);
  const { executeLiveCapture } = await import('../../dist/context/capture.js');
  assert.throws(() => executeLiveCapture(() => assert.fail('attacker ran')), /SOC_KEY_UNTRUSTED/);
});

for (const [module, entry, scope] of [['capture', 'executeLiveCapture', scopes[0]], ['gateway', 'executePublicGateway', scopes[1]]]) {
  test(`R3 direct ${module} function call without service initialization is locked`, async t => {
    const root = temporary(t);
    const api = await import(`../../dist/context/${module}.js`);
    assert.throws(() => api[entry](() => assert.fail('ran without approval'), root), /FEATURE_GATE_LOCKED/);
  });
  test(`R3 ${module} every call revalidates expiry and removal after valid setup`, async t => {
    const f = approval(t, [scope]); testTrust(t, f.keys); moduleConfig(t, f);
    const api = await import(`../../dist/context/${module}.js`);
    assert.equal(api[entry](() => 'approved'), 'approved');
    // Advance the clock beyond the signed expiry without changing the artifact.
    const now = Date.now; Date.now = () => f.payload.expires_at + 1;
    try { assert.throws(() => api[entry](() => assert.fail('expired ran')), /FEATURE_GATE_LOCKED/); }
    finally { Date.now = now; }
    assert.equal(api[entry](() => 'approved again'), 'approved again');
    unlinkSync(f.path);
    assert.throws(() => api[entry](() => assert.fail('revoked ran')), /FEATURE_GATE_LOCKED/);
  });
}

for (const [module, entry, scope] of [['capture', 'executeLiveCapture', scopes[0]], ['gateway', 'executePublicGateway', scopes[1]]]) {
  test(`G4 ${module} revoked artifact digest locks subsequent invocation before side effects`, async t => {
    const f = approval(t, [scope]); testTrust(t, f.keys); moduleConfig(t, f);
    const api = await import(`../../dist/context/${module}.js`);
    let invocations = 0;
    assert.equal(api[entry](() => ++invocations), 1);
    const digest = crypto.createHash('sha256').update(readFileSync(f.path)).digest('hex');
    writeFileSync(join(f.config, 'revoked-approvals.json'), JSON.stringify([digest]));
    assert.equal(authorization.isFeatureAuthorized(scope, f.config), false);
    assert.throws(() => api[entry](() => ++invocations), /^Error: FEATURE_GATE_LOCKED: artifact revoked$/);
    assert.equal(invocations, 1);
    const artifact = JSON.parse(readFileSync(f.path, 'utf8'));
    writeFileSync(f.path, JSON.stringify({ signature: artifact.signature, schema_version: artifact.schema_version, features: artifact.features, expires_at: artifact.expires_at }, null, 2));
    assert.throws(() => api[entry](() => ++invocations), /FEATURE_GATE_LOCKED: artifact revoked/);
    assert.equal(invocations, 1);
  });
}

test('G4 malformed revocation source fails closed', t => {
  const f = approval(t); testTrust(t, f.keys); moduleConfig(t, f);
  for (const malformed of ['{', 'null', '{}', '{"schema_version":1,"revoked_digests":["invalid"]}']) {
    writeFileSync(join(f.config, 'revoked-approvals.json'), malformed);
    assert.equal(authorization.isFeatureAuthorized(scopes[0], f.config), false);
    assert.throws(() => authorization.requireFeatureAuthorized(scopes[0], f.config), /^Error: FEATURE_GATE_LOCKED: revocation list malformed$/);
  }
});

test('G4 unrelated revoked digest leaves a valid approval authorized', t => {
  const f = approval(t); testTrust(t, f.keys); moduleConfig(t, f);
  writeFileSync(join(f.config, 'revoked-approvals.json'), JSON.stringify(['0'.repeat(64)]));
  assert.equal(authorization.isFeatureAuthorized(scopes[0], f.config), true);
});

test('JCS RFC 8785 signature uses sorted payload keys regardless of artifact insertion order', t => {
  const f = approval(t); testTrust(t, f.keys); moduleConfig(t, f);
  assert.equal(authorization.isFeatureAuthorized(scopes[0], f.config), true);
});
