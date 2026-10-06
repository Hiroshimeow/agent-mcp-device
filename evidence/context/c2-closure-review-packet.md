# v1.0.11 C2-1 through C2-6 closure evidence

Worktree: E:/git-project/wt-mcp-device-111-context. Verification executed in bash on Windows.
Pre-delivery HEAD: 77b4b566dd425b3358143caaf3f8bac9e21ad1b1. Node: v22.22.2.
The delivery commit is the commit containing this packet (its own hash cannot be embedded without changing it).
No release, version bump, fleet deployment or SOC authorization was performed; package metadata remains 1.0.10.

## Finding-by-finding implementation

### C2-3: reaping and admission reconciliation
Under registry BEGIN IMMEDIATE, expired/dead leases bump epoch_counter before DELETE FROM reservations. Deletion cascades to reservation_epochs. The late-worker test resumes the exact reaped token while holding both transactions and expects RESERVATION_FENCED_OFF before repo COMMIT, with no retained evidence and exact quota after the next append. There need not be a replacement admission to revoke the worker.
Automatic reconciliation already preceded every quota allocation decision; retained that stronger unconditional trigger and added a regression proving a dead allocation larger than available quota is reclaimed automatically, then genuine exhaustion still throws QUOTA_EXCEEDED.

### C2-2: single writer and watermark
Formal invariant: each repository has at most one active writer lease. Admission checks for an existing living lease under registry BEGIN IMMEDIATE and refuses BUSY before allocating. The durable reservation/reacquisition gap therefore cannot admit another writer. Registry-first writer lock is held through repo COMMIT and quota finalization.
All production repository writes begin BEGIN IMMEDIATE. commitRepository additionally rejects calls without an active registry and repository transaction, preventing autocommit watermark mutation. The predicate check and update are one conditional UPDATE in the same repo transaction as evidence, followed by COMMIT. Out-of-order test commits epoch 2 and attempts epoch 1; it deliberately makes the old registry epoch current so the repository watermark independently rejects the old writer and remains unchanged.
Separate SQLite files are not a distributed atomic transaction; existing crash recovery and PID/expiry reconciliation remain mandatory and tested.

### C2-1: positive controls and secure deletion
The migrated auto_vacuum=NONE regression checks secure_delete=1, canary bytes PRESENT in main SQLite before purge, positive FTS vocabulary controls, and bytes ABSENT after purge in main DB, WAL, SHM and all five FTS shadow tables. Both pre-control and post-purge wal_checkpoint(TRUNCATE) assert busy === 0. Existing blocked-checkpoint test proves PURGE_CHECKPOINT_BUSY fails closed. Existing reservation-liveness tests cover secure_delete on registry, writable, read-only, unscoped and CLI-style handles.
Scanned ASCII fragment byte lengths (also emitted verbatim in raw TAP): full tokens canarytokenprefixalphaunique=27 and canarytokenprefixbetaunique=26; prefix canarytokenprefix=16; suffixes alphaunique=11 and betaunique=10; partial fragments canarytoken=11, tokenprefix=11, alphauniq=9, betauniq=8. Every fragment has a positive raw-byte control before purge.

### C2-5/6: hard approval boundary
FEATURE_LIVE_CAPTURE and FEATURE_PUBLIC_GATEWAY default false in src/context/service.ts. Constructor validates explicit true flags; initializeFeature and executeFeature refuse absent, malformed, expired, tampered, untrusted or wrong-scope approval with:
FEATURE_GATE_LOCKED: Phase 7/8 requires valid SOC security approval artifact
Default artifact location is config/soc-approval.json. Trusted local runtime may configure the directory; no agent tool can configure it. Approval requires an out-of-band pinned Ed25519 SOC public key; an artifact cannot introduce its own trust anchor. Signed UTF-8 bytes are JSON.stringify({schema_version:1,features:[...],expires_at:<integer>}) in that exact field order. signature is canonical base64 of a 64-byte Ed25519 signature. File size is limited to 16 KiB. Execution rechecks approval so removal/expiry/tampering revokes it.
Tests use ephemeral generated test keys, not production approvals. No signed production approval was created or committed. This introduces mandatory service initialization/execution boundaries for Phase 7/8; no actual live-capture hooks, public routes or new MCP tools exist or are enabled in this patch. Future Phase 7/8 implementation must use these boundaries; this is not a claim to have implemented Phase 7/8.

## C2-4: exact execution and evidence

Both requested commands exited 0:
- npm run build (complete output: evidence/context/c2-build.txt)
- node --test test/context/*.test.js > raw-tap.txt 2>&1 (complete combined output: raw-tap.txt)

Node's experimental SQLite warning is retained in TAP; it is not a test failure.
Initial red run: evidence/context/c2-red-tap.txt, 9 tests, 2 pass and 7 fail (epoch bump, second writer, transaction check, missing feature gate). Automatic reconciliation and historic out-of-order defense already passed. Initial targeted green run is evidence/context/c2-targeted-tap.txt; the final full suite below includes the tightened independent watermark and valid-transaction late-worker tests.

```text
1..129
# tests 129
# suites 0
# pass 129
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 22534.8924
```

### Actual pre-delivery git status --porcelain
```text
 M raw-tap.txt
M  src/context/service.ts
M  src/context/sqlite.d.ts
M  src/context/store.ts
A  test/context/c2-closure.test.js
M  test/context/review-blockers.test.js
?? evidence/context/c2-build.txt
?? evidence/context/c2-red-tap.txt
?? evidence/context/c2-targeted-tap.txt
?? evidence/context/create-c2-closure-packet.mjs
```
This is an intentionally dirty pre-delivery snapshot, not a claimed clean post-commit state. Post-commit HEAD/status are reported in the delivery response.

## Exact code snippets

### Store commit boundary
```typescript
  commitRepository(db: DatabaseSync, token = this.activeReservation): void {
    if (!token || token !== this.activeReservation || !db.isTransaction || !this.registry.isTransaction) throw new Error('RESERVATION_FENCED_OFF');
    this.assertReservationLive();
    const row = this.registry.prepare(`SELECT r.owner_key,r.repo_uuid,e.epoch FROM reservations r
      JOIN reservation_epochs e USING(reservation_id) WHERE r.reservation_id=?`).get(token)!;
    if (db !== this.repoDatabase(String(row.owner_key), String(row.repo_uuid))) throw new Error('RESERVATION_FENCED_OFF');
    // Callers begin repo work with BEGIN IMMEDIATE. The conditional watermark
    // check/update is one SQL statement in that same transaction (never autocommit).
    // The watermark and receipt commit with evidence, so recovery can distinguish
    // a repo commit from an abandoned allocation even after registry rollback.
    const updated = db.prepare(`UPDATE repository_fence SET last_committed_epoch=?,reservation_id=?
      WHERE singleton=1 AND last_committed_epoch<?`).run(row.epoch, token, row.epoch);
    if (!updated.changes) throw new Error('RESERVATION_FENCED_OFF');
    db.exec('COMMIT');
  }

```

### Phase 7/8 boundary
```typescript
export const FEATURE_LIVE_CAPTURE = false;
export const FEATURE_PUBLIC_GATEWAY = false;
type GatedFeature = 'FEATURE_LIVE_CAPTURE' | 'FEATURE_PUBLIC_GATEWAY';
export interface ContextServiceOptions {
  FEATURE_LIVE_CAPTURE?: boolean;
  FEATURE_PUBLIC_GATEWAY?: boolean;
  /** Trusted runtime configuration only; never accepted from tool arguments. */
  configDirectory?: string;
  /** Pinned SOC Ed25519 public key, supplied out of band (not by the artifact). */
  socApprovalPublicKey?: string;
}
const GATE_ERROR = 'FEATURE_GATE_LOCKED: Phase 7/8 requires valid SOC security approval artifact';

  constructor(private readonly store: ContextStore, private readonly options: ContextServiceOptions = {}) {
    for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'] as const) {
      if (options[feature] === true) this.initializeFeature(feature);
    }
  }

  /** All future Phase 7/8 tool initialization must pass this fail-closed boundary.
   * No capture hooks, public routes or MCP tools are enabled by this change. */
  initializeFeature(feature: GatedFeature): void {
    try {
      if (!['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'].includes(feature) || this.options[feature] !== true || !this.options.socApprovalPublicKey) throw new Error();
      const path = join(this.options.configDirectory ?? join(process.cwd(), 'config'), 'soc-approval.json');
      if (statSync(path).size > 16384) throw new Error();
      const artifact = JSON.parse(readFileSync(path, 'utf8'));
      if (artifact.schema_version !== 1 || !Array.isArray(artifact.features) || artifact.features.length < 1 || artifact.features.length > 2 ||
          !artifact.features.every((value: unknown) => value === 'FEATURE_LIVE_CAPTURE' || value === 'FEATURE_PUBLIC_GATEWAY') ||
          new Set(artifact.features).size !== artifact.features.length || !artifact.features.includes(feature) ||
          !Number.isSafeInteger(artifact.expires_at) || artifact.expires_at <= Date.now() || typeof artifact.signature !== 'string') throw new Error();
      const key = createPublicKey(this.options.socApprovalPublicKey);
      if (key.asymmetricKeyType !== 'ed25519') throw new Error();
      const signature = Buffer.from(artifact.signature, 'base64');
      if (signature.length !== 64 || signature.toString('base64') !== artifact.signature) throw new Error();
      // Fixed field order defines the signed bytes; an artifact cannot supply its
      // own trust anchor. Expiry, schema and the complete feature scope are signed.
      const payload = JSON.stringify({ schema_version: artifact.schema_version, features: artifact.features, expires_at: artifact.expires_at });
      if (!verify(null, Buffer.from(payload), key, signature)) throw new Error();
    } catch { throw new Error(GATE_ERROR); }
  }

  /** Revalidate on every execution, so removal/expiry/tampering revokes approval. */
  executeFeature<T>(feature: GatedFeature, action: () => T): T {
    this.initializeFeature(feature);
    return action();
  }

```

## Actual implementation and regression diff

The following is the exact staged git diff for the five implementation/test files (not a reconstructed patch).

```diff
diff --git a/src/context/service.ts b/src/context/service.ts
index 35bb635..437abbf 100644
--- a/src/context/service.ts
+++ b/src/context/service.ts
@@ -1,11 +1,25 @@
-import { randomBytes, createHash } from 'node:crypto';
+import { randomBytes, createHash, createPublicKey, verify } from 'node:crypto';
 import { queryActivityGraph, type GraphOptions } from './graph.js';
 import { execFileSync } from 'node:child_process';
-import { realpathSync } from 'node:fs';
+import { realpathSync, readFileSync, statSync } from 'node:fs';
+import { join } from 'node:path';
 import { sync } from './indexer.js';
 import { ContextStore } from './store.js';
 import { search, readEvidence, type SearchOptions, type ReadOptions } from './search.js';
 
+export const FEATURE_LIVE_CAPTURE = false;
+export const FEATURE_PUBLIC_GATEWAY = false;
+type GatedFeature = 'FEATURE_LIVE_CAPTURE' | 'FEATURE_PUBLIC_GATEWAY';
+export interface ContextServiceOptions {
+  FEATURE_LIVE_CAPTURE?: boolean;
+  FEATURE_PUBLIC_GATEWAY?: boolean;
+  /** Trusted runtime configuration only; never accepted from tool arguments. */
+  configDirectory?: string;
+  /** Pinned SOC Ed25519 public key, supplied out of band (not by the artifact). */
+  socApprovalPublicKey?: string;
+}
+const GATE_ERROR = 'FEATURE_GATE_LOCKED: Phase 7/8 requires valid SOC security approval artifact';
+
 interface Job { job_ref: string; owner: string; repo: string; action: 'sync' | 'rebuild'; started_at: number }
 interface Gap { count: number; reasons: Set<string> }
 const GAP_REASONS = new Set(['storage_unavailable', 'busy', 'quota', 'outcome_failed']);
@@ -14,7 +28,40 @@ const GAP_REASONS = new Set(['storage_unavailable', 'busy', 'quota', 'outcome_fa
 export class ContextService {
   private readonly jobs = new Map<string, Job>();
   private readonly gaps = new Map<string, Gap>();
-  constructor(private readonly store: ContextStore) {}
+  constructor(private readonly store: ContextStore, private readonly options: ContextServiceOptions = {}) {
+    for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'] as const) {
+      if (options[feature] === true) this.initializeFeature(feature);
+    }
+  }
+
+  /** All future Phase 7/8 tool initialization must pass this fail-closed boundary.
+   * No capture hooks, public routes or MCP tools are enabled by this change. */
+  initializeFeature(feature: GatedFeature): void {
+    try {
+      if (!['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'].includes(feature) || this.options[feature] !== true || !this.options.socApprovalPublicKey) throw new Error();
+      const path = join(this.options.configDirectory ?? join(process.cwd(), 'config'), 'soc-approval.json');
+      if (statSync(path).size > 16384) throw new Error();
+      const artifact = JSON.parse(readFileSync(path, 'utf8'));
+      if (artifact.schema_version !== 1 || !Array.isArray(artifact.features) || artifact.features.length < 1 || artifact.features.length > 2 ||
+          !artifact.features.every((value: unknown) => value === 'FEATURE_LIVE_CAPTURE' || value === 'FEATURE_PUBLIC_GATEWAY') ||
+          new Set(artifact.features).size !== artifact.features.length || !artifact.features.includes(feature) ||
+          !Number.isSafeInteger(artifact.expires_at) || artifact.expires_at <= Date.now() || typeof artifact.signature !== 'string') throw new Error();
+      const key = createPublicKey(this.options.socApprovalPublicKey);
+      if (key.asymmetricKeyType !== 'ed25519') throw new Error();
+      const signature = Buffer.from(artifact.signature, 'base64');
+      if (signature.length !== 64 || signature.toString('base64') !== artifact.signature) throw new Error();
+      // Fixed field order defines the signed bytes; an artifact cannot supply its
+      // own trust anchor. Expiry, schema and the complete feature scope are signed.
+      const payload = JSON.stringify({ schema_version: artifact.schema_version, features: artifact.features, expires_at: artifact.expires_at });
+      if (!verify(null, Buffer.from(payload), key, signature)) throw new Error();
+    } catch { throw new Error(GATE_ERROR); }
+  }
+
+  /** Revalidate on every execution, so removal/expiry/tampering revokes approval. */
+  executeFeature<T>(feature: GatedFeature, action: () => T): T {
+    this.initializeFeature(feature);
+    return action();
+  }
 
   graph(owner: string, repo: string, input: GraphOptions) { return queryActivityGraph(this.store, owner, repo, input); }
 
diff --git a/src/context/sqlite.d.ts b/src/context/sqlite.d.ts
index d0322b6..d4c8667 100644
--- a/src/context/sqlite.d.ts
+++ b/src/context/sqlite.d.ts
@@ -8,6 +8,7 @@ declare module 'node:sqlite' {
   }
   export class DatabaseSync {
     constructor(path: string, options?: { readOnly?: boolean });
+    readonly isTransaction: boolean;
     exec(sql: string): void;
     prepare(sql: string): StatementSync;
     close(): void;
diff --git a/src/context/store.ts b/src/context/store.ts
index 9800984..7f4cedd 100644
--- a/src/context/store.ts
+++ b/src/context/store.ts
@@ -43,11 +43,13 @@ export class ContextStore {
 
   /** Store-owned commit gate: stale caller tokens cannot commit repository work. */
   commitRepository(db: DatabaseSync, token = this.activeReservation): void {
-    if (!token || token !== this.activeReservation) throw new Error('RESERVATION_FENCED_OFF');
+    if (!token || token !== this.activeReservation || !db.isTransaction || !this.registry.isTransaction) throw new Error('RESERVATION_FENCED_OFF');
     this.assertReservationLive();
     const row = this.registry.prepare(`SELECT r.owner_key,r.repo_uuid,e.epoch FROM reservations r
       JOIN reservation_epochs e USING(reservation_id) WHERE r.reservation_id=?`).get(token)!;
     if (db !== this.repoDatabase(String(row.owner_key), String(row.repo_uuid))) throw new Error('RESERVATION_FENCED_OFF');
+    // Callers begin repo work with BEGIN IMMEDIATE. The conditional watermark
+    // check/update is one SQL statement in that same transaction (never autocommit).
     // The watermark and receipt commit with evidence, so recovery can distinguish
     // a repo commit from an abandoned allocation even after registry rollback.
     const updated = db.prepare(`UPDATE repository_fence SET last_committed_epoch=?,reservation_id=?
@@ -386,7 +388,7 @@ export class ContextStore {
   }
 
   private reconcileQuotaLocked(): number {
-    for (const row of this.registry.prepare('SELECT reservation_id,pid,host,expires_at FROM reservations').all()) {
+    for (const row of this.registry.prepare('SELECT reservation_id,repo_uuid,pid,host,expires_at FROM reservations').all()) {
       let active = Date.now() < Number(row.expires_at);
       if (active && row.host === hostname()) {
         try { process.kill(Number(row.pid), 0); }
@@ -395,7 +397,14 @@ export class ContextStore {
           if ((error as NodeJS.ErrnoException).code === 'ESRCH') active = false;
         }
       }
-      if (!active) this.registry.prepare('DELETE FROM reservations WHERE reservation_id=?').run(row.reservation_id);
+      if (!active) {
+        // Revoke before returning quota, atomically under the registry writer lock.
+        // Deletion cascades to the token epoch; the monotonic bump also invalidates
+        // any cached epoch even when no replacement writer has been admitted.
+        this.registry.prepare(`INSERT INTO epoch_counter VALUES(?,1)
+          ON CONFLICT(repo_uuid) DO UPDATE SET epoch=epoch+1`).run(row.repo_uuid);
+        this.registry.prepare('DELETE FROM reservations WHERE reservation_id=?').run(row.reservation_id);
+      }
     }
     let total = 0;
     for (const row of this.registry.prepare('SELECT repo_uuid,owner_key FROM repositories').all()) {
@@ -423,6 +432,10 @@ export class ContextStore {
   }
 
   /** Two-phase, recoverable protocol across separate Registry and Repo SQLite files:
+   * Single-writer invariant: each repository has at most one active writer lease.
+   * Admission checks for a living lease under registry BEGIN IMMEDIATE; the same
+   * mutex serializes reconciliation and is held through repo COMMIT/finalization.
+   * The durable allocation/reacquisition gap cannot admit a second writer lease.
    * 1. Registry durably reserves allocation + monotonic per-repo epoch + lease.
    * 2. Repo commits evidence with reservation_id and last_committed_epoch.
    * 3. Registry finalizes quota under the same registry-first writer mutex.
@@ -437,7 +450,10 @@ export class ContextStore {
     const reservation = opaque();
     this.registry.exec('BEGIN IMMEDIATE');
     try {
+      // Automatic reconciliation precedes every quota decision, including failed
+      // allocations: dead leases cannot cause a spurious QUOTA_EXCEEDED.
       this.reconcileQuotaLocked();
+      if (this.registry.prepare('SELECT 1 FROM reservations WHERE repo_uuid=? LIMIT 1').get(repo)) throw new Error('BUSY');
       const total = this.refreshAccounting();
       const policy = this.registry.prepare('SELECT * FROM quota_policy WHERE singleton=1').get()!;
       const ownerSize = Number(this.registry.prepare('SELECT accounted_bytes FROM owners WHERE owner_key=?').get(owner)?.accounted_bytes);
diff --git a/test/context/c2-closure.test.js b/test/context/c2-closure.test.js
new file mode 100644
index 0000000..57cd417
--- /dev/null
+++ b/test/context/c2-closure.test.js
@@ -0,0 +1,131 @@
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { hostname } from 'node:os';
+import { generateKeyPairSync, sign } from 'node:crypto';
+import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
+import { join } from 'node:path';
+import { ContextStore } from '../../dist/context/store.js';
+import * as service from '../../dist/context/service.js';
+import { temporary } from './helpers.js';
+
+function fixture(t) {
+  let store;
+  const root = temporary({ after: cleanup => t.after(() => { store?.close(); cleanup(); }) });
+  store = new ContextStore(root);
+  const owner = store.activateOwner('c2'), repo = store.repository(owner, 'c2');
+  return { store, root, owner, repo, db: store.repoDatabase(owner, repo) };
+}
+
+function lease(f, id, epoch, expires = Date.now() + 60000) {
+  f.store.registry.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?)').run(id, f.repo, process.pid, hostname(), Date.now(), expires, 100000, f.owner);
+  f.store.registry.prepare('INSERT OR REPLACE INTO epoch_counter VALUES(?,?)').run(f.repo, epoch);
+  f.store.registry.prepare('INSERT INTO reservation_epochs VALUES(?,?)').run(id, epoch);
+}
+
+test('C2-3 reap revokes epoch and late worker cannot commit even before another admission', t => {
+  const f = fixture(t);
+  lease(f, 'reaped', 1, 0);
+  assert.equal(f.store.reconcileQuota(), 0);
+  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 0);
+  assert.equal(f.store.registry.prepare('SELECT epoch FROM epoch_counter WHERE repo_uuid=?').get(f.repo).epoch, 2);
+  // Resume the old worker with its original token, not a newly admitted lease.
+  f.store.registry.exec('BEGIN IMMEDIATE');
+  f.store.activeReservation = 'reaped';
+  f.db.exec('BEGIN IMMEDIATE');
+  try {
+    f.db.prepare("INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES('late','late','hash',4,4,'retained',0)").run();
+    assert.throws(() => f.store.commitRepository(f.db, 'reaped'), /RESERVATION_FENCED_OFF/);
+  } finally { f.db.exec('ROLLBACK'); f.store.activeReservation = undefined; f.store.registry.exec('ROLLBACK'); }
+  assert.equal(f.db.prepare('SELECT count(*) AS n FROM evidence').get().n, 0);
+  f.store.append(f.owner, f.repo, 'new');
+  assert.equal(f.store.reconcileQuota(), 3);
+});
+
+test('C2-3 allocation automatically reclaims dead quota leases before QUOTA_EXCEEDED', t => {
+  const f = fixture(t);
+  f.store.unscopedDatabase(f.owner);
+  const used = f.store.refreshAccounting();
+  f.store.configureQuota({ device_bytes: used + 500000 });
+  lease(f, 'dead', 1);
+  f.store.registry.prepare('UPDATE reservations SET pid=?,allocation=?').run(2147483647, 1000000);
+  f.store.append(f.owner, f.repo, 'reclaimed');
+  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 0);
+  assert.equal(f.store.reconcileQuota(), 9);
+  f.store.configureQuota({ device_bytes: 0 });
+  assert.throws(() => f.store.append(f.owner, f.repo, 'over quota'), /QUOTA_EXCEEDED/);
+});
+
+test('C2-2 admission refuses a second living writer lease for the same repository', t => {
+  const f = fixture(t);
+  lease(f, 'living', 1);
+  assert.throws(() => f.store.append(f.owner, f.repo, 'second writer'), /BUSY/);
+  assert.equal(f.store.registry.prepare('SELECT count(*) AS n FROM reservations').get().n, 1);
+  assert.equal(f.db.prepare('SELECT count(*) AS n FROM evidence').get().n, 0);
+});
+
+test('C2-2 two out-of-order reservations cannot overwrite the newer committed watermark', t => {
+  const f = fixture(t);
+  lease(f, 'older', 1);
+  lease(f, 'newer', 2); // Inject historic invalid state to exercise the defensive store fence.
+  f.store.registry.exec('BEGIN IMMEDIATE');
+  try {
+    f.store.activeReservation = 'newer';
+    f.db.exec('BEGIN IMMEDIATE'); f.store.commitRepository(f.db, 'newer');
+    const newer = f.db.prepare('SELECT * FROM repository_fence').get();
+    // Even if an old registry snapshot incorrectly says epoch 1 is current,
+    // the newer durable repo watermark must independently reject epoch 1.
+    f.store.registry.prepare('UPDATE epoch_counter SET epoch=1 WHERE repo_uuid=?').run(f.repo);
+    f.store.activeReservation = 'older';
+    f.db.exec('BEGIN IMMEDIATE');
+    assert.throws(() => f.store.commitRepository(f.db, 'older'), /RESERVATION_FENCED_OFF/);
+    f.db.exec('ROLLBACK');
+    assert.deepEqual(f.db.prepare('SELECT * FROM repository_fence').get(), newer);
+    assert.equal(newer.last_committed_epoch, 2);
+  } finally { f.store.activeReservation = undefined; f.store.registry.exec('ROLLBACK'); }
+});
+
+test('C2-2 commit gate rejects watermark update outside a repository transaction', t => {
+  const f = fixture(t);
+  lease(f, 'no-transaction', 1);
+  f.store.registry.exec('BEGIN IMMEDIATE');
+  f.store.activeReservation = 'no-transaction';
+  try { assert.throws(() => f.store.commitRepository(f.db), /RESERVATION_FENCED_OFF/); }
+  finally { f.store.activeReservation = undefined; f.store.registry.exec('ROLLBACK'); }
+  assert.equal(f.db.prepare('SELECT last_committed_epoch FROM repository_fence').get().last_committed_epoch, 0);
+});
+
+for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY']) {
+  test(`C2-5/6 ${feature} defaults off and refuses initialization/execution without signed SOC approval`, t => {
+    const f = fixture(t), options = { configDirectory: join(f.root, 'config') };
+    assert.equal(service[feature], false);
+    const instance = new service.ContextService(f.store, options);
+    let ran = false;
+    assert.throws(() => instance.initializeFeature(feature), /FEATURE_GATE_LOCKED: Phase 7\/8 requires valid SOC security approval artifact/);
+    assert.throws(() => instance.executeFeature(feature, () => { ran = true; }), /FEATURE_GATE_LOCKED/);
+    assert.throws(() => new service.ContextService(f.store, { ...options, [feature]: true }), /FEATURE_GATE_LOCKED/);
+    assert.equal(ran, false);
+  });
+  test(`C2-5/6 ${feature} validates pinned signature, expiry, feature scope and rechecks execution`, t => {
+    const f = fixture(t), configDirectory = join(f.root, 'config'); mkdirSync(configDirectory);
+    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
+    const options = { configDirectory, socApprovalPublicKey: publicKey.export({ type: 'spki', format: 'pem' }), [feature]: true };
+    const payload = { schema_version: 1, features: [feature], expires_at: Date.now() + 60000 };
+    const artifact = { ...payload, signature: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64') };
+    const path = join(configDirectory, 'soc-approval.json');
+    writeFileSync(path, JSON.stringify(artifact));
+    const instance = new service.ContextService(f.store, options);
+    assert.equal(instance.executeFeature(feature, () => 'approved'), 'approved');
+    const other = feature === 'FEATURE_LIVE_CAPTURE' ? 'FEATURE_PUBLIC_GATEWAY' : 'FEATURE_LIVE_CAPTURE';
+    assert.throws(() => instance.initializeFeature(other), /FEATURE_GATE_LOCKED/);
+    assert.throws(() => new service.ContextService(f.store, { ...options, socApprovalPublicKey: undefined }), /FEATURE_GATE_LOCKED/);
+    writeFileSync(path, JSON.stringify({ ...artifact, expires_at: Date.now() + 120000 }));
+    assert.throws(() => instance.executeFeature(feature, () => 'tampered'), /FEATURE_GATE_LOCKED/);
+    const expired = { ...payload, expires_at: 0 };
+    writeFileSync(path, JSON.stringify({ ...expired, signature: sign(null, Buffer.from(JSON.stringify(expired)), privateKey).toString('base64') }));
+    assert.throws(() => instance.executeFeature(feature, () => 'expired'), /FEATURE_GATE_LOCKED/);
+    writeFileSync(path, '{invalid');
+    assert.throws(() => instance.executeFeature(feature, () => 'malformed'), /FEATURE_GATE_LOCKED/);
+    unlinkSync(path);
+    assert.throws(() => instance.executeFeature(feature, () => 'revoked'), /FEATURE_GATE_LOCKED/);
+  });
+}
diff --git a/test/context/review-blockers.test.js b/test/context/review-blockers.test.js
index 1f66b7e..1625e48 100644
--- a/test/context/review-blockers.test.js
+++ b/test/context/review-blockers.test.js
@@ -122,11 +122,13 @@ test('B1 migrated auto-vacuum NONE purge clears indexed payload bytes and logica
   assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
   assert.equal(db.prepare('PRAGMA auto_vacuum').get().auto_vacuum, 0);
   assert.equal(db.prepare('PRAGMA secure_delete').get().secure_delete, 1);
-  db.exec('PRAGMA wal_checkpoint(PASSIVE)');
-  assert.ok(readFileSync(path).includes(Buffer.from(payload)), 'positive byte-scan control before purge');
+  assert.equal(db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get().busy, 0, 'positive-control checkpoint completed');
+  t.diagnostic('C2-1 scanned fragment byte lengths: ' + fragments.map(fragment => `${fragment}:${Buffer.byteLength(fragment)}`).join(', '));
+  for (const fragment of fragments) assert.ok(readFileSync(path).includes(Buffer.from(fragment)), `positive byte-scan control before purge: ${fragment}`);
   db.exec("CREATE VIRTUAL TABLE evidence_fts_vocab USING fts5vocab(evidence_fts, 'row')");
   for (const term of [payload, sibling]) assert.equal(db.prepare('SELECT * FROM evidence_fts_vocab WHERE term = ?').all(term).length, 1, 'positive vocabulary control');
   assert.equal(f.store.cleanup(f.owner, f.repo, { before: Date.now() + 1000, localAdmin: true }).purged, 1);
+  assert.equal(db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get().busy, 0, 'post-purge truncate checkpoint completed');
   assert.equal(f.store.read(f.owner, f.repo, ref).text, '');
   assert.equal(db.prepare('SELECT count(*) AS n FROM evidence_fts').get().n, 0);
   assert.equal(db.prepare('SELECT count(*) AS n FROM search_documents').get().n, 0);
```
