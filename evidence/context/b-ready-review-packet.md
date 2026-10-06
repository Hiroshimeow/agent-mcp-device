# B1–B3 review remediation

Worktree: E:/git-project/wt-mcp-device-111-context; branch feat/mcp-device-1.0.11-context.
This packet supersedes the epoch/key-source implementation statements in c2-closure-review-packet.md. It does not constitute independent SOC approval, enable Phase 7/8, or claim READY_TO_PROCEED on behalf of the reviewer.

## B1 / C2-4 — Windows locking and FULL TAP delivery

The C2-1 legacy secure-deletion test checks both truncate checkpoints return busy === 0, and explicitly asserts the WAL file size is zero after truncate. All logical/FTS shadow-table checks complete before ContextStore.close() closes the registry and every repository/unscoped SQLite handle. Only then are raw files scanned with fs.readFileSync: repo.sqlite and any surviving repo.sqlite-wal/repo.sqlite-shm. Closing the final connection may remove sidecars; no SQLite file handles remain to lock them on Windows. Positive main-byte controls precede purge; the final negative scans happen after close.

FULL combined stdout/stderr, including every TAP line and experimental warning, is delivered without summarization in **evidence/context/b-full-raw-tap.txt**. It is an exact byte copy of the requested command's raw-tap.txt. No HTML escaping or reconstructed TAP.

- Command: npm run build — exit 0; full output evidence/context/b-build.txt.
- Command: node --test test/context/*.test.js > raw-tap.txt 2>&1 — exit 0.
- Full TAP bytes: 35611.
- SHA-256: 210ebc60cf5ba6db92dd634ec4428fe29678b37f4e7382ee91bddb42093ebcb5.
- 138 tests, 138 pass, 0 fail/cancelled/skipped/todo; duration_ms 20476.7253.

/raw-tap.txt is ignored AND removed from the Git index (ignore alone does not affect an already-tracked file). The committed full evidence copy remains available. Post-commit Git status is verified separately in the delivery report.

## B2 / C2-2, C2-3 — single-store authority

Repository persistence is now repo.sqlite. Legacy context.sqlite and its existing sidecars move together before this store opens them; query-only access retains legacy compatibility without writes. fencing_state(singleton INTEGER PRIMARY KEY, authoritative_epoch INTEGER NOT NULL, active_reservation_id TEXT) owns fencing authority. Admission increments authoritative_epoch and sets the reservation id directly in a committed repo.sqlite writer transaction; reaping increments it and clears the id directly in that same database. Registry epoch_counter is only a non-authoritative cache, and reservation_epochs records the admitted token. Neither defines the authoritative commit comparison.

commitRepository requires an active repository and registry transaction and a live token, then performs a conditional receipt UPDATE in the repository transaction whose EXISTS predicate requires exact authoritative_epoch/token epoch equality AND active_reservation_id/token id equality. Older epochs and equal epochs with a different id fail RESERVATION_FENCED_OFF. Every admission increments authority; last_committed_epoch remains a separate monotonic receipt, not the trust source. Crash gaps consume epochs safely and reconcile allocations; these separate files still do not implement distributed atomic commit.

Application living-lease refusal is Error('BUSY') with no SQLite errcode. Native writer contention is SQLITE_BUSY (errcode 5). Both are separately asserted.

### Required interleaving — SQLite feasibility boundary

A second process **cannot** bump any table in repo.sqlite while a worker holds BEGIN IMMEDIATE: SQLite admits only one writer. Claiming that exact concurrent write happened would be false. The deterministic in-flight regression therefore:
1. Admits a real worker token and begins its repository BEGIN IMMEDIATE.
2. Starts a separate process and proves its BEGIN IMMEDIATE fails SQLITE_BUSY (5).
3. Explicitly yields the empty worker transaction at the test hook (ROLLBACK).
4. Starts a separate process that commits authoritative_epoch+1 and clears the active id in repo.sqlite.
5. Reacquires the worker transaction, calls the real commit gate with the original still-live token, and gets RESERVATION_FENCED_OFF; evidence remains unchanged.

The pause is deterministic, not a timing/sleep race. No production transaction is silently released or weakened. This meets the stale in-flight worker intent with SQLite serialization; the literal simultaneous-writer requirement needs reviewer acceptance of this physically necessary clarification.

## B3 / C2-5, C2-6 — external trust and hard gates

src/context/authorization.ts loads a fixed system administrator-provisioned Ed25519 public trust anchor outside the repository:
- Windows: C:\ProgramData\MCPDevice\trust\soc-ed25519-public.pem
- POSIX: /etc/mcp-device/trust/soc-ed25519-public.pem

Provision the directory/file with administrator/root-only write access. This is an OS system-configuration trust root, not an approval-controlled or repository-local key. There is no env/config/service option to redirect or inject it; socApprovalPublicKey was removed. Missing/unprovisioned roots fail closed. crypto.verify validates canonical signed schema, complete scope and expiration. No production key or signed artifact was fabricated.

Four separate negative tests in test/context/review-blockers.test.js cover tampered signature, expired signed artifact, Phase 7 scope used for Phase 8, and forced env/config flags with invalid artifact/caller key. Tests replace only the fixed OS trust-store file read with an ephemeral generated key; this substitution is test-process code, not a production configuration capability. A valid-signature positive control ensures rejection tests are meaningful.

src/context/capture.ts and gateway.ts are fail-closed Phase 7/8 entry-point stubs: each checks isFeatureAuthorized(scope) at module initialization, so direct import without approval rejects. They enable no capture hooks/routes. ContextService constructor/init/execution also checks authorization and execution revalidates revocation. Future implementation must preserve these boundaries and recheck at execution; ESM module caching is not a substitute for execution authorization.

## Verification

Fresh build and entire context suite both exited 0. git diff --check is run before commit. Earlier failing regression evidence is retained in evidence/context/b-red-tap.txt. No release/version bump/deployment or independent reviewer sign-off was performed.
