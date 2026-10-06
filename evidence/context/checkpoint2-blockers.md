# Checkpoint 2 blocker remediation

Scope: B1–B3 and the three non-blocking additions. This is implementation evidence, not Phase 7/live-capture enablement approval.

## Maintenance policy (B1)

- Capture/sync quota admission, reconciliation, and purge share the registry `BEGIN IMMEDIATE` writer mutex, acquired before repository locks. All writable connections use `busy_timeout=5000`.
- A contending maintenance request waits for the writer; on timeout it fails without deleting payloads. Writers waiting for bounded maintenance resume after lock release. Two multiprocess tests verify both contention directions and exact event/evidence counts (21/21).
- New databases use incremental auto-vacuum. Purge reclaims at most 256 pages and uses only PASSIVE checkpointing, never full VACUUM or WAL truncate. No second full-size database is allocated.
- Existing auto-vacuum NONE databases are deliberately not rebuilt during online maintenance; cleared pages remain reusable. PASSIVE checkpoints retain WAL allocation. Immediate physical file-size shrink is not promised, and physical DB/WAL/SHM allocation still gates admission conservatively.
- Cursor epoch and attempted-purge audit commit before repository deletion; crash between separate SQLite commits cannot revive cursors or remove attempted-purge history.
- This does not establish N2's future 5/50 ms capture-lock or heartbeat budgets; synchronous busy waits still require Phase 7 evaluation.

## Admin origin policy (B2)

- Reject `MCP_DEVICE_SESSION`, `MCP_RUNNER`, `MCP_DEVICE_REMOTE`, `PI_SESSION_ID`, `PI_AGENT`, `CODEX_THREAD_ID`, and `CLAUDECODE` environments before terminal confirmation/state opening.
- Process-tool shells and Node fallback executions explicitly stamp `MCP_DEVICE_SESSION=process-tool`, inherited by nested shells/PTYs.
- Multiprocess CLI regression sets both streams to TTY and tests rejection with four agent markers; returns `ACCESS_DENIED`, exit 3, without reaching confirmation.
- This is a cooperative origin gate, not an OS security boundary against arbitrary same-user code that deliberately removes environment markers. No native Windows PTY harness is present; the TTY-capable agent-environment branch is tested directly. Human CLI still requires TTY and exact PURGE confirmation, with no `--yes` route.

## Quota recovery policy (B3)

- Existing admission does not commit a reservation: registry lock spans the repository action. A crash rolls back registry admission but may leave a committed repository payload, making registry accounting stale.
- Writable startup and explicit sync run `reconcileQuota()` under the registry writer mutex. Read-only repo snapshots sum actual `evidence.retained_bytes` into registry `quota_usage`; totals include active/sealed repositories, missing stores contribute zero, and no repo is created/migrated by reconciliation.
- Physical accounting is also refreshed under that lock. Successful quota writes and purge update logical totals before registry commit. Read-only CLI remains unchanged.
- Killed-process regression commits repository evidence while registry admission is still uncommitted, kills the process, restarts, and verifies exact committed bytes (24), both startup totals and explicit reconciliation.

## Additional hardening

- Purged A→B→C intermediate B yields an empty path, never a hidden hop.
- Neighbor SQL binds `LIMIT remaining_examined_budget + 1`; the extra row is a sentinel and never examined/returned. Existing high-degree traversal tests verify the public caps.
- Quota rejection gaps are transactionally deduplicated to one row per rolling minute per owner; a 30-rejection burst produces one gap. Other gap reasons remain unchanged.

## N1–N7 test map

| Finding | Tests / files | Scope and remaining gate |
| --- | --- | --- |
| N1 fail-open capture/gap | `store.test.js` status/capture gaps; `foundation-edge.test.js` unknown intent; `durability-quota.test.js` restart and process kill; `review-blockers.test.js` dedup | Domain gap visibility and durability covered; actual observer route integration remains Phase 7. |
| N2 writer batches/concurrency | `store.test.js` WAL/timeout; `retrieval.test.js` concurrent migration; `index-jobs.test.js` foreground overlap; `review-blockers.test.js` both purge/writer lock directions | B1 maintenance contention addressed; real batch yield/heartbeat and 5/50 ms budgets NOT CLOSED. |
| N3 total quota/admin cleanup | `durability-quota.test.js` all eight tests; `review-blockers.test.js` B1/B2/B3 and quota dedup | Registry/repo crash reconciliation, origin gate, sealed accounting and cleanup covered on Windows; final platform/privacy review pending. |
| N4 pinned membership | `retrieval.test.js` pinned pagination, clock skew, generation/tombstone, retention; `graph-query.test.js` generation/retention boundaries; `review-blockers.test.js` purged intermediate path | Membership/current retention covered; no historical content MVCC claim. |
| N5 persistence redaction | `redaction.test.js` all five tests; `import.test.js`; `checkpoint.test.js` secrets; `activity-graph.test.js` graph metadata secrets | Retained evidence redaction covered; live observer normalization integration remains Phase 7. |
| N6 shared root key | `store.test.js` cursor MAC/scope/collision; `access.test.js` scope/sealed refs; `redaction.test.js` keyed secret tags; `retrieval.test.js` tampering and kind confusion | Shared installation key/domain separation covered; platform ACL/rotation final matrix pending. |
| N7 disabled wiki | `policy-contract.test.js`; `index-jobs.test.js` no implicit materialization; `graph-integration.test.js` read-only CLI; `skill-contract.test.js` contracted commands | Reserved disabled manifest/no implicit provider maintenance covered; public registration/parity Phase 8. |

## Verification

Commands: `npm run build`; `node --test test/context/*.test.js`.
Full TAP: `checkpoint2-blockers.tap`. Build log: `checkpoint2-blockers-build.txt`.
Full named test inventory: `checkpoint2-blockers-test-list.md` (generated from actual TAP, not source declarations).
