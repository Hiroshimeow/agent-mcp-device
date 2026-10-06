# P1–P4 blocker revision review packet

Build: `npm run build` exited 0.
Tests: `node --test test/context/*.test.js > raw-tap.txt 2>&1` exited 0.

Implementation: `src/context/cli.ts`, `src/context/store.ts`, `src/context/migrations/index.ts`.
Regressions: `test/context/review-blockers.test.js`, `test/context/reservation-liveness.test.js`, `test/context/retrieval.test.js`, `test/context/fixtures/maintenance-worker.js`.

R1 requires a matching owner-provisioned one-time nonce before the UUID-bound prompt. The stripped-marker TTY-capable regression without a token is rejected before any prompt. This is terminal-branch coverage, not native ConPTY integration. Formal owner acceptance of residual boundaries is PENDING in `decisions.md`; no owner signature is fabricated and no live enablement/release approval is implied.
B1 sets secure_delete on every context connection; purge optimizes FTS and truncates WAL, rejecting a busy checkpoint. Byte scans cover main DB, WAL and FTS shadow tables.
R2 durable leases are preserved for living, unexpired workers. A forked worker paused after repo commit survives reconciliation; killing its PID permits reaping without evidence loss.

Raw SHA-256: `d812b4ef76b4d52bab8e1b8681107773a51997b8a090134d4550f419673c1791`

## Exact node -v output

```text
v22.22.2
```

## 100% unedited combined test-runner stdout/stderr

```text
TAP version 13
# (node:35352) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero
ok 1 - frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero
  ---
  duration_ms: 1690.0787
  type: 'test'
  ...
# (node:24884) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: re-pair seals old namespace; refs and cursors never authorize another scope
ok 2 - re-pair seals old namespace; refs and cursors never authorize another scope
  ---
  duration_ms: 463.419
  type: 'test'
  ...
# Subtest: read cursor binds repository scope and sealed state
ok 3 - read cursor binds repository scope and sealed state
  ---
  duration_ms: 1627.8169
  type: 'test'
  ...
# Subtest: durable cursor signature protects generation, query, expiry and position
ok 4 - durable cursor signature protects generation, query, expiry and position
  ---
  duration_ms: 1731.8314
  type: 'test'
  ...
# Subtest: sandbox denial is propagated once, without Git or alternate-path fallback
ok 5 - sandbox denial is propagated once, without Git or alternate-path fallback
  ---
  duration_ms: 3.2034
  type: 'test'
  ...
# (node:44448) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: explicit sync constructs directed evidence-backed relations without causal inference
ok 6 - explicit sync constructs directed evidence-backed relations without causal inference
  ---
  duration_ms: 779.4264
  type: 'test'
  ...
# Subtest: graph shares opaque entity identities but never persists metadata secrets
ok 7 - graph shares opaque entity identities but never persists metadata secrets
  ---
  duration_ms: 1845.8911
  type: 'test'
  ...
# (node:45152) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: checkpoint separates observed Git metadata from reported summary and refs
ok 8 - checkpoint separates observed Git metadata from reported summary and refs
  ---
  duration_ms: 6689.6377
  type: 'test'
  ...
# Subtest: checkpoint claims remain reported after indexing and search
ok 9 - checkpoint claims remain reported after indexing and search
  ---
  duration_ms: 1705.9283
  type: 'test'
  ...
# Subtest: checkpoint redacts reported secrets without breaking structured evidence
ok 10 - checkpoint redacts reported secrets without breaking structured evidence
  ---
  duration_ms: 2686.2985
  type: 'test'
  ...
# Subtest: checkpoint rejects unknown evidence refs without fabricating checkpoint evidence
ok 11 - checkpoint rejects unknown evidence refs without fabricating checkpoint evidence
  ---
  duration_ms: 809.2698
  type: 'test'
  ...
# (node:43148) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: CLI search/read/status preserve ContextService JSON semantics with gateway offline
ok 12 - CLI search/read/status preserve ContextService JSON semantics with gateway offline
  ---
  duration_ms: 6471.1752
  type: 'test'
  ...
# Subtest: CLI keeps inaccessible local state typed and redacted without remote bypass
ok 13 - CLI keeps inaccessible local state typed and redacted without remote bypass
  ---
  duration_ms: 818.6661
  type: 'test'
  ...
# Subtest: CLI ACCESS_DENIED remains local and uses the stable access exit code
ok 14 - CLI ACCESS_DENIED remains local and uses the stable access exit code
  ---
  duration_ms: 988.8529
  type: 'test'
  ...
# Subtest: CLI executable emits JSON, human output, and safe usage errors
ok 15 - CLI executable emits JSON, human output, and safe usage errors
  ---
  duration_ms: 3360.304
  type: 'test'
  ...
# Subtest: CLI paginates search and read and explicitly syncs/rebuilds without source mutation
ok 16 - CLI paginates search and read and explicitly syncs/rebuilds without source mutation
  ---
  duration_ms: 1732.1839
  type: 'test'
  ...
# Subtest: read-only CLI leaves persisted databases unchanged and reports safe accounting
ok 17 - read-only CLI leaves persisted databases unchanged and reports safe accounting
  ---
  duration_ms: 787.9828
  type: 'test'
  ...
# Subtest: CLI scope failure and sealed namespace cannot fall back
ok 18 - CLI scope failure and sealed namespace cannot fall back
  ---
  duration_ms: 748.3274
  type: 'test'
  ...
# Subtest: CLI rejects caller-controlled device/account/store selectors and exposes only contracted commands
ok 19 - CLI rejects caller-controlled device/account/store selectors and exposes only contracted commands
  ---
  duration_ms: 0.7342
  type: 'test'
  ...
# (node:44452) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: device quota serializes all repos and includes sealed namespaces, without evicting evidence
ok 20 - device quota serializes all repos and includes sealed namespaces, without evicting evidence
  ---
  duration_ms: 1597.0054
  type: 'test'
  ...
# Subtest: repo quota pauses sync and import without publishing partial generations
ok 21 - repo quota pauses sync and import without publishing partial generations
  ---
  duration_ms: 1726.2043
  type: 'test'
  ...
# Subtest: transaction failure rolls back evidence and event together
ok 22 - transaction failure rolls back evidence and event together
  ---
  duration_ms: 1490.9724
  type: 'test'
  ...
# Subtest: restart abandons shadow generations and marks unresolved intents unknown without sync
ok 23 - restart abandons shadow generations and marks unresolved intents unknown without sync
  ---
  duration_ms: 2174.1419
  type: 'test'
  ...
# Subtest: process kill rolls back uncommitted WAL writes and preserves last-good generation
ok 24 - process kill rolls back uncommitted WAL writes and preserves last-good generation
  ---
  duration_ms: 1208.3108
  type: 'test'
  ...
# Subtest: cleanup invalidates stateless search cursors and supports explicit sealed namespace selection
ok 25 - cleanup invalidates stateless search cursors and supports explicit sealed namespace selection
  ---
  duration_ms: 2371.2571
  type: 'test'
  ...
# Subtest: admin clean CLI refuses non-TTY input and cannot accept agent confirmation flags
ok 26 - admin clean CLI refuses non-TTY input and cannot accept agent confirmation flags
  ---
  duration_ms: 130.447
  type: 'test'
  ...
# Subtest: explicit local admin payload purge reclaims quota and leaves metadata and content-free audit
ok 27 - explicit local admin payload purge reclaims quota and leaves metadata and content-free audit
  ---
  duration_ms: 477.4998
  type: 'test'
  ...
# (node:42884) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: fresh status creates no repo database; unknown intent and wrong job scope are visible
ok 28 - fresh status creates no repo database; unknown intent and wrong job scope are visible
  ---
  duration_ms: 1902.1891
  type: 'test'
  ...
# Subtest: migration rejects a newer schema without replacing it and publication rejects invalid watermarks
ok 29 - migration rejects a newer schema without replacing it and publication rejects invalid watermarks
  ---
  duration_ms: 2889.9183
  type: 'test'
  ...
# Subtest: symlink sandbox escape is denied on its canonical target
ok 30 - symlink sandbox escape is denied on its canonical target
  ---
  duration_ms: 1352.8932
  type: 'test'
  ...
# (node:39500) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: graph CLI is read-only domain parity and search optionally returns bounded related refs
ok 31 - graph CLI is read-only domain parity and search optionally returns bounded related refs
  ---
  duration_ms: 6325.9142
  type: 'test'
  ...
# (node:45292) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: high-degree traversal enforces examined, visited, node, depth and aggregate byte caps
ok 32 - high-degree traversal enforces examined, visited, node, depth and aggregate byte caps
  ---
  duration_ms: 3189.3012
  type: 'test'
  ...
# Subtest: cycles terminate and path, direction, relation filtering and timeline are deterministic
ok 33 - cycles terminate and path, direction, relation filtering and timeline are deterministic
  ---
  duration_ms: 1816.438
  type: 'test'
  ...
# Subtest: generation, retention, repository and sealed-owner boundaries are enforced before graph lookup
ok 34 - generation, retention, repository and sealed-owner boundaries are enforced before graph lookup
  ---
  duration_ms: 1864.4874
  type: 'test'
  ...
# (node:46060) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope
ok 35 - JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope
  ---
  duration_ms: 1841.0933
  type: 'test'
  ...
# Subtest: legacy id wins over changed content, and excluded paths never persist payloads
ok 36 - legacy id wins over changed content, and excluded paths never persist payloads
  ---
  duration_ms: 1878.3284
  type: 'test'
  ...
# (node:36056) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: scoped foreground jobs reject overlap, cancel safely and keep sync idempotent
ok 37 - scoped foreground jobs reject overlap, cancel safely and keep sync idempotent
  ---
  duration_ms: 1976.2378
  type: 'test'
  ...
# Subtest: startup, read, search, graph, status and idle never materialize pending evidence
ok 38 - startup, read, search, graph, status and idle never materialize pending evidence
  ---
  duration_ms: 1978.4525
  type: 'test'
  ...
# (node:33488) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: sync indexes only pending retained events and advances watermark without copying old rows
ok 39 - sync indexes only pending retained events and advances watermark without copying old rows
  ---
  duration_ms: 2027.2894
  type: 'test'
  ...
# PASS: frozen policy bounds, six-tool contract, baseline byte accounting and proposed local catalog budget
# Subtest: test\\context\\policy-contract.test.js
ok 13 - test\\context\\policy-contract.test.js
  ---
  duration_ms: 3491.9157
  type: 'test'
  ...
# (node:3324) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: Vietnamese and emoji byte-budget pages preserve code points and byte offsets
ok 41 - Vietnamese and emoji byte-budget pages preserve code points and byte offsets
  ---
  duration_ms: 2686.3989
  type: 'test'
  ...
# Subtest: evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes
ok 42 - evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes
  ---
  duration_ms: 1967.1873
  type: 'test'
  ...
# (node:20156) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes
ok 43 - secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes
  ---
  duration_ms: 1895.8793
  type: 'test'
  ...
# Subtest: import deduplicates redacted content and indexes only redacted text
ok 44 - import deduplicates redacted content and indexes only redacted text
  ---
  duration_ms: 1920.9435
  type: 'test'
  ...
# Subtest: secret markers use keyed tags, never offline-guessable plain hashes
ok 45 - secret markers use keyed tags, never offline-guessable plain hashes
  ---
  duration_ms: 1.0287
  type: 'test'
  ...
# Subtest: UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs
ok 46 - UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs
  ---
  duration_ms: 1.5123
  type: 'test'
  ...
# Subtest: excluded paths, binary/base64, UTF-8 byte caps and boundary secrets
ok 47 - excluded paths, binary/base64, UTF-8 byte caps and boundary secrets
  ---
  duration_ms: 77.7871
  type: 'test'
  ...
# Subtest: Git roots, worktrees, separate clones and nested repositories
ok 48 - Git roots, worktrees, separate clones and nested repositories
  ---
  duration_ms: 7821.3279
  type: 'test'
  ...
# Subtest: non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved
ok 49 - non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved
  ---
  duration_ms: 69.1117
  type: 'test'
  ...
# (node:34636) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: R2 reconciliation preserves living leases and removes dead or expired leases
ok 50 - R2 reconciliation preserves living leases and removes dead or expired leases
  ---
  duration_ms: 1664.3657
  type: 'test'
  ...
# Subtest: R2 living commit-to-registry worker retains lease until PID death
ok 51 - R2 living commit-to-registry worker retains lease until PID death
  ---
  duration_ms: 3365.1404
  type: 'test'
  ...
# Subtest: B1 secure_delete is enabled on writable, read, registry, unscoped and CLI-style connections
ok 52 - B1 secure_delete is enabled on writable, read, registry, unscoped and CLI-style connections
  ---
  duration_ms: 1048.3985
  type: 'test'
  ...
# (node:30056) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: v1 repo migration preserves evidence and installs incremental retrieval schema
ok 53 - v1 repo migration preserves evidence and installs incremental retrieval schema
  ---
  duration_ms: 10.7618
  type: 'test'
  ...
# Subtest: v2 migration adds snapshot tombstones and folds existing redacted FTS content
ok 54 - v2 migration adds snapshot tombstones and folds existing redacted FTS content
  ---
  duration_ms: 2.2649
  type: 'test'
  ...
# Subtest: FTS filters first generation, retention, source and time without returning cross-scope evidence
ok 55 - FTS filters first generation, retention, source and time without returning cross-scope evidence
  ---
  duration_ms: 2065.2362
  type: 'test'
  ...
# (node:13628) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: pinned pagination retains page-two reindexed rows and excludes new generations
ok 56 - pinned pagination retains page-two reindexed rows and excludes new generations
  ---
  duration_ms: 2196.9146
  type: 'test'
  ...
# Subtest: pinned generation excludes a clock-skewed G+1 event older than the cursor
ok 57 - pinned generation excludes a clock-skewed G+1 event older than the cursor
  ---
  duration_ms: 1368.7423
  type: 'test'
  ...
# Subtest: read continuation cannot be replayed against different refs in the same repo
ok 58 - read continuation cannot be replayed against different refs in the same repo
  ---
  duration_ms: 1066.8559
  type: 'test'
  ...
# Subtest: pinned keyset pagination uses deterministic bucket and timestamp ordering across generation advances
ok 59 - pinned keyset pagination uses deterministic bucket and timestamp ordering across generation advances
  ---
  duration_ms: 4075.5456
  type: 'test'
  ...
# Subtest: stable exact-match bucket precedes newer FTS-only matches across keyset pages
ok 60 - stable exact-match bucket precedes newer FTS-only matches across keyset pages
  ---
  duration_ms: 299.9281
  type: 'test'
  ...
# Subtest: documents matching both exact and FTS preserve match_reason 0 and never repeat across keyset page boundaries with limit 1
ok 61 - documents matching both exact and FTS preserve match_reason 0 and never repeat across keyset page boundaries with limit 1
  ---
  duration_ms: 699.3116
  type: 'test'
  ...
# Subtest: expired authenticated search and read cursors are stale at the domain boundary
ok 62 - expired authenticated search and read cursors are stale at the domain boundary
  ---
  duration_ms: 353.5812
  type: 'test'
  ...
# Subtest: read cursor issued at G is stale after publication of G+1
ok 63 - read cursor issued at G is stale after publication of G+1
  ---
  duration_ms: 341.042
  type: 'test'
  ...
# Subtest: one-byte payload tampering with the original MAC is invalid
ok 64 - one-byte payload tampering with the original MAC is invalid
  ---
  duration_ms: 307.8999
  type: 'test'
  ...
# Subtest: query mismatch and search/read/durable kind confusion are invalid
ok 65 - query mismatch and search/read/durable kind confusion are invalid
  ---
  duration_ms: 284.1402
  type: 'test'
  ...
# Subtest: current retention availability overrides pinned generation for purged evidence
ok 66 - current retention availability overrides pinned generation for purged evidence
  ---
  duration_ms: 427.5632
  type: 'test'
  ...
# Subtest: Vietnamese stroked d folds on index and query sides
ok 67 - Vietnamese stroked d folds on index and query sides
  ---
  duration_ms: 344.9949
  type: 'test'
  ...
# Subtest: v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL
ok 68 - v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL
  ---
  duration_ms: 282.2256
  type: 'test'
  ...
# (node:13628) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: concurrent migration opener waits and rechecks v3, then commits without DDL
ok 69 - concurrent migration opener waits and rechecks v3, then commits without DDL
  ---
  duration_ms: 333.7477
  type: 'test'
  ...
# Subtest: concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction
ok 70 - concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction
  ---
  duration_ms: 325.0752
  type: 'test'
  ...
# Subtest: v3 migration rolls back pre-commit failure and process crash, then reruns cleanly
ok 71 - v3 migration rolls back pre-commit failure and process crash, then reruns cleanly
  ---
  duration_ms: 376.0539
  type: 'test'
  ...
# Subtest: parseVersion rejects unreadable and invalid versions directly
ok 72 - parseVersion rejects unreadable and invalid versions directly
  ---
  duration_ms: 0.8051
  type: 'test'
  ...
# Subtest: migration rejects unreadable and invalid versions before and after BEGIN IMMEDIATE
ok 73 - migration rejects unreadable and invalid versions before and after BEGIN IMMEDIATE
  ---
  duration_ms: 2.2311
  type: 'test'
  ...
# Subtest: migration preserves the original error when COMMIT already released the transaction
ok 74 - migration preserves the original error when COMMIT already released the transaction
  ---
  duration_ms: 66.6595
  type: 'test'
  ...
# Subtest: substring and FTS matches collapse to one row with exact score zero
ok 75 - substring and FTS matches collapse to one row with exact score zero
  ---
  duration_ms: 259.1259
  type: 'test'
  ...
# Subtest: FTS search binds every SQL placeholder and uses all-null first-page keyset sentinels
ok 76 - FTS search binds every SQL placeholder and uses all-null first-page keyset sentinels
  ---
  duration_ms: 265.547
  type: 'test'
  ...
# Subtest: FTS syntax characters are quoted as tokens and never interpreted as operators
ok 77 - FTS syntax characters are quoted as tokens and never interpreted as operators
  ---
  duration_ms: 298.7063
  type: 'test'
  ...
# Subtest: empty-token queries skip FTS and return only substring matches
ok 78 - empty-token queries skip FTS and return only substring matches
  ---
  duration_ms: 248.5628
  type: 'test'
  ...
# Subtest: search/status are read-only, Unicode-aware, bounded and never sync implicitly
ok 79 - search/status are read-only, Unicode-aware, bounded and never sync implicitly
  ---
  duration_ms: 402.0255
  type: 'test'
  ...
# (node:41168) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: B1 maintenance uses incremental reclamation and explicit WAL truncate
ok 80 - B1 maintenance uses incremental reclamation and explicit WAL truncate
  ---
  duration_ms: 1603.7504
  type: 'test'
  ...
# Subtest: B1 concurrent purge waits for an active writer and preserves every event
ok 81 - B1 concurrent purge waits for an active writer and preserves every event
  ---
  duration_ms: 2664.6162
  type: 'test'
  ...
# Subtest: B1 capture writer waits for purge lock release with zero lost events
ok 82 - B1 capture writer waits for purge lock release with zero lost events
  ---
  duration_ms: 4013.6251
  type: 'test'
  ...
# Subtest: B2 admin purge rejects agent environments even with TTY input and output
ok 83 - B2 admin purge rejects agent environments even with TTY input and output
  ---
  duration_ms: 525.6095
  type: 'test'
  ...
# Subtest: B3 killed cross-database writer reconciles exact committed evidence bytes on restart
ok 84 - B3 killed cross-database writer reconciles exact committed evidence bytes on restart
  ---
  duration_ms: 660.8452
  type: 'test'
  ...
# Subtest: B3 reconciliation waits for a separate-process admission and retains sealed evidence totals
ok 85 - B3 reconciliation waits for a separate-process admission and retains sealed evidence totals
  ---
  duration_ms: 1307.6352
  type: 'test'
  ...
# Subtest: B1 migrated auto-vacuum NONE purge clears indexed payload bytes and logical quota without rebuilding
ok 86 - B1 migrated auto-vacuum NONE purge clears indexed payload bytes and logical quota without rebuilding
  ---
  duration_ms: 462.5683
  type: 'test'
  ...
# Subtest: B2 stripped agent markers in TTY-capable child rejects generic PURGE
ok 87 - B2 stripped agent markers in TTY-capable child rejects generic PURGE
  ---
  duration_ms: 268.3045
  type: 'test'
  ...
# Subtest: B2 stripped agent markers in TTY-capable child rejects repository challenge with extra whitespace
ok 88 - B2 stripped agent markers in TTY-capable child rejects repository challenge with extra whitespace
  ---
  duration_ms: 249.1788
  type: 'test'
  ...
# Subtest: B2 stripped agent markers in TTY-capable child accepts exact repository challenge with one-time admin token
ok 89 - B2 stripped agent markers in TTY-capable child accepts exact repository challenge with one-time admin token
  ---
  duration_ms: 399.6501
  type: 'test'
  ...
# Subtest: B2 stripped agent markers in TTY-capable child rejects PTY agent without admin token despite exact challenge
ok 90 - B2 stripped agent markers in TTY-capable child rejects PTY agent without admin token despite exact challenge
  ---
  duration_ms: 230.9679
  type: 'test'
  ...
# Subtest: quota rejection bursts create one deduplicated gap per minute
ok 91 - quota rejection bursts create one deduplicated gap per minute
  ---
  duration_ms: 550.4509
  type: 'test'
  ...
# Subtest: graph neighbor SQL fetch is bounded by remaining examined-edge budget plus one
ok 92 - graph neighbor SQL fetch is bounded by remaining examined-edge budget plus one
  ---
  duration_ms: 0.5483
  type: 'test'
  ...
# Subtest: graph path cannot traverse a purged intermediate node
ok 93 - graph path cannot traverse a purged intermediate node
  ---
  duration_ms: 332.9186
  type: 'test'
  ...
# (node:23660) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: portable skill freezes search-first and selective-maintenance behavior
ok 94 - portable skill freezes search-first and selective-maintenance behavior
  ---
  duration_ms: 7.7862
  type: 'test'
  ...
# Subtest: portable skill forbids sandbox bypass and sealed namespace auto-selection
ok 95 - portable skill forbids sandbox bypass and sealed namespace auto-selection
  ---
  duration_ms: 3.8414
  type: 'test'
  ...
# Subtest: portable skill mentions only commands and flags covered by the CLI contract
ok 96 - portable skill mentions only commands and flags covered by the CLI contract
  ---
  duration_ms: 3.7224
  type: 'test'
  ...
# {"ok":true,"platform":"win32","arch":"x64","node":"22.22.2","sqlite":"3.51.2","constructor":"PASS","busy_timeout_ms":5,"fts5":"PASS","warnings":["ExperimentalWarning"],"json_stdout":"PASS","warning_stderr":"(node:26468) ExperimentalWarning: SQLite is an experimental feature and might change at any time\\n(Use `node --trace-warnings ...` to show where the warning was created)"}
# Subtest: test\\context\\sqlite-platform.test.js
ok 22 - test\\context\\sqlite-platform.test.js
  ---
  duration_ms: 1372.0839
  type: 'test'
  ...
# (node:45684) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors
ok 98 - WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors
  ---
  duration_ms: 2062.2872
  type: 'test'
  ...
# Subtest: cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing
ok 99 - cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing
  ---
  duration_ms: 642.0751
  type: 'test'
  ...
# Subtest: JSON MAC encoding rejects colon-delimiter scope collisions across owners
ok 100 - JSON MAC encoding rejects colon-delimiter scope collisions across owners
  ---
  duration_ms: 308.6112
  type: 'test'
  ...
# Subtest: status is read-only, capture gaps are visible and jobs/stores have ownership bounds
ok 101 - status is read-only, capture gaps are visible and jobs/stores have ownership bounds
  ---
  duration_ms: 386.3153
  type: 'test'
  ...
1..101
# tests 101
# suites 0
# pass 101
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 17005.0907
```
