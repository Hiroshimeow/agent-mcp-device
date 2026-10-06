import test from 'node:test';
import assert from 'node:assert/strict';
import { hostname } from 'node:os';
import crypto, { generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ContextStore } from '../../dist/context/store.js';
import * as service from '../../dist/context/service.js';
import { temporary } from './helpers.js';

function fixture(t) {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
  store = new ContextStore(root);
  const owner = store.activateOwner('c2'), repo = store.repository(owner, 'c2');
  return { store, root, owner, repo, db: store.repoDatabase(owner, repo) };
}

function lease(f, id, epoch, expires = Date.now() + 60000) {
  f.store.registry.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?)').run(id, f.repo, process.pid, hostname(), Date.now(), expires, 100000, f.owner);
  f.store.registry.prepare('INSERT OR REPLACE INTO epoch_counter VALUES(?,?)').run(f.repo, epoch);
  f.store.registry.prepare('INSERT INTO reservation_epochs VALUES(?,?)').run(id, epoch);
  f.db.prepare('UPDATE fencing_state SET authoritative_epoch=?,active_reservation_id=?').run(epoch, id);
}

test('C2-3 reap revokes epoch and late worker cannot commit even before another admission', t => {
  const f = fixture(t);
  lease(f, 'reaped', 1, 0);
  assert.equal(f.store.reconcileQuota(), 0);
  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 0);
  assert.equal(f.store.registry.prepare('SELECT epoch FROM epoch_counter WHERE repo_uuid=?').get(f.repo).epoch, 2);
  // Resume the old worker with its original token, not a newly admitted lease.
  f.store.registry.exec('BEGIN IMMEDIATE');
  f.store.activeReservation = 'reaped';
  f.db.exec('BEGIN IMMEDIATE');
  try {
    f.db.prepare("INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES('late','late','hash',4,4,'retained',0)").run();
    assert.throws(() => f.store.commitRepository(f.db, 'reaped'), /RESERVATION_FENCED_OFF/);
  } finally { f.db.exec('ROLLBACK'); f.store.activeReservation = undefined; f.store.registry.exec('ROLLBACK'); }
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM evidence').get().n, 0);
  f.store.append(f.owner, f.repo, 'new');
  assert.equal(f.store.reconcileQuota(), 3);
});

test('C2-3 allocation automatically reclaims dead quota leases before QUOTA_EXCEEDED', t => {
  const f = fixture(t);
  f.store.unscopedDatabase(f.owner);
  const used = f.store.refreshAccounting();
  f.store.configureQuota({ device_bytes: used + 500000 });
  lease(f, 'dead', 1);
  f.store.registry.prepare('UPDATE reservations SET pid=?,allocation=?').run(2147483647, 1000000);
  f.store.append(f.owner, f.repo, 'reclaimed');
  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 0);
  assert.equal(f.store.reconcileQuota(), 9);
  f.store.configureQuota({ device_bytes: 0 });
  assert.throws(() => f.store.append(f.owner, f.repo, 'over quota'), /QUOTA_EXCEEDED/);
});

test('C2-2 admission refuses a second living writer lease for the same repository', t => {
  const f = fixture(t);
  lease(f, 'living', 1);
  assert.throws(() => f.store.append(f.owner, f.repo, 'second writer'), error => error.message === 'BUSY' && error.errcode === undefined, 'application lease BUSY is not SQLITE_BUSY errcode 5');
  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 1);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM evidence').get().n, 0);
});

test('C2-2 two out-of-order reservations cannot overwrite the newer committed watermark', t => {
  const f = fixture(t);
  lease(f, 'older', 1);
  lease(f, 'newer', 2); // Inject historic invalid state to exercise the defensive store fence.
  f.store.registry.exec('BEGIN IMMEDIATE');
  try {
    f.store.activeReservation = 'newer';
    f.db.exec('BEGIN IMMEDIATE'); f.store.commitRepository(f.db, 'newer');
    const newer = f.db.prepare('SELECT * FROM repository_fence').get();
    // Even if an old registry snapshot incorrectly says epoch 1 is current,
    // the newer durable repo watermark must independently reject epoch 1.
    f.store.registry.prepare('UPDATE epoch_counter SET epoch=1 WHERE repo_uuid=?').run(f.repo);
    f.store.activeReservation = 'older';
    f.db.exec('BEGIN IMMEDIATE');
    assert.throws(() => f.store.commitRepository(f.db, 'older'), /RESERVATION_FENCED_OFF/);
    f.db.exec('ROLLBACK');
    assert.deepEqual(f.db.prepare('SELECT * FROM repository_fence').get(), newer);
    assert.equal(newer.last_committed_epoch, 2);
  } finally { f.store.activeReservation = undefined; f.store.registry.exec('ROLLBACK'); }
});

test('C2-2 commit gate rejects watermark update outside a repository transaction', t => {
  const f = fixture(t);
  lease(f, 'no-transaction', 1);
  f.store.registry.exec('BEGIN IMMEDIATE');
  f.store.activeReservation = 'no-transaction';
  try { assert.throws(() => f.store.commitRepository(f.db), /RESERVATION_FENCED_OFF/); }
  finally { f.store.activeReservation = undefined; f.store.registry.exec('ROLLBACK'); }
  assert.equal(f.db.prepare('SELECT last_committed_epoch FROM repository_fence').get().last_committed_epoch, 0);
});

for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY']) {
  test(`C2-5/6 ${feature} defaults off and refuses initialization/execution without signed SOC approval`, t => {
    const f = fixture(t), options = { configDirectory: join(f.root, 'config') };
    assert.equal(service[feature], false);
    const instance = new service.ContextService(f.store, options);
    let ran = false;
    assert.throws(() => instance.initializeFeature(feature), /FEATURE_GATE_LOCKED: Phase 7\/8 requires valid SOC security approval artifact/);
    assert.throws(() => instance.executeFeature(feature, () => { ran = true; }), /FEATURE_GATE_LOCKED/);
    assert.throws(() => new service.ContextService(f.store, { ...options, [feature]: true }), /FEATURE_GATE_LOCKED/);
    assert.equal(ran, false);
  });
  test(`C2-5/6 ${feature} validates pinned signature, expiry, feature scope and rechecks execution`, t => {
    const f = fixture(t), configDirectory = join(f.root, 'config'); mkdirSync(configDirectory);
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const original = crypto.createPublicKey;
    crypto.createPublicKey = () => publicKey;
    syncBuiltinESMExports();
    t.after(() => { crypto.createPublicKey = original; syncBuiltinESMExports(); });
    // Redirect installed configuration reads in this test process only.
    const installed = fileURLToPath(new URL('../../config/', import.meta.url));
    const originals = { statSync: fs.statSync, readFileSync: fs.readFileSync };
    for (const name of Object.keys(originals)) fs[name] = (path, ...args) => {
      const mapped = typeof path === 'string' && path.startsWith(installed) ? join(configDirectory, path.slice(installed.length)) : path;
      return originals[name](mapped, ...args);
    };
    syncBuiltinESMExports();
    t.after(() => { Object.assign(fs, originals); syncBuiltinESMExports(); });
    const options = { [feature]: true };
    const payload = { expires_at: Date.now() + 60000, features: [feature], schema_version: 1 };
    const artifact = { ...payload, signature: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64') };
    const path = join(configDirectory, 'soc-approval.json');
    writeFileSync(path, JSON.stringify(artifact));
    writeFileSync(join(configDirectory, 'revoked-approvals.json'), '[]');
    const instance = new service.ContextService(f.store, options);
    assert.equal(instance.executeFeature(feature, () => 'approved'), 'approved');
    const other = feature === 'FEATURE_LIVE_CAPTURE' ? 'FEATURE_PUBLIC_GATEWAY' : 'FEATURE_LIVE_CAPTURE';
    assert.throws(() => instance.initializeFeature(other), /FEATURE_GATE_LOCKED/);
    crypto.createPublicKey = original; syncBuiltinESMExports();
    assert.throws(() => new service.ContextService(f.store, options), /FEATURE_GATE_LOCKED/);
    crypto.createPublicKey = () => publicKey;
    syncBuiltinESMExports();
    writeFileSync(path, JSON.stringify({ ...artifact, expires_at: Date.now() + 120000 }));
    assert.throws(() => instance.executeFeature(feature, () => 'tampered'), /FEATURE_GATE_LOCKED/);
    const expired = { ...payload, expires_at: 0 };
    writeFileSync(path, JSON.stringify({ ...expired, signature: sign(null, Buffer.from(JSON.stringify(expired)), privateKey).toString('base64') }));
    assert.throws(() => instance.executeFeature(feature, () => 'expired'), /FEATURE_GATE_LOCKED/);
    writeFileSync(path, '{invalid');
    assert.throws(() => instance.executeFeature(feature, () => 'malformed'), /FEATURE_GATE_LOCKED/);
    unlinkSync(path);
    assert.throws(() => instance.executeFeature(feature, () => 'revoked'), /FEATURE_GATE_LOCKED/);
  });
}
