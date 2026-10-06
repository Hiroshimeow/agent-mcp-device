# B1–B5 closure packet

Platform: Windows (win32), Node v22.22.2, Bash.
Worktree: E:/git-project/wt-mcp-device-111-context

Executed commands (both exit 0):

```bash
npm run build
node --test test/context/*.test.js > raw-tap.txt 2>&1
```

Build output: [b1-b5-build.txt](b1-b5-build.txt). Full tests: 117 passed, 0 failed, 0 cancelled, 0 skipped.
Raw TAP SHA-256: **1c2081f2a7dbb747f9cdafdb8966928bdab8006a291eb5f68cb62ebc8178f93b**. Root [raw-tap.txt](../../raw-tap.txt) and the embedded bytes below are the actual command output, not reconstructed totals.

## Closure mapping

- B1: actual named ok lines below and full direct TAP artifact.
- B2/B3: registry lock spans evidence commit and accounting; store commit gate rejects stale tokens; pre-commit expiry rolls back, post-commit expiry still finalizes accounting; process kill in the cross-DB commit gap heals at writable startup.
- B4: durable purge_retries marker survives busy checkpoint; after reader closes, repeat purge succeeds with zero remaining refs and clears marker. Newly provisioned token required because authorization remains one-use.
- B5: shared-prefix canaries have positive vocabulary controls and zero post-purge decoded vocab rows, plus current DB/WAL/SHM and shadow-table byte checks.
- P2: canonical lowercase hex validated before conversion, argv and environment token/file transports denied, concurrent clean children consume one nonce exactly once.
- Independent Security Lead approval: **PENDING**, honestly recorded in decisions.md; no separate human review is represented as complete. READY_TO_PROCEED is not claimed.

Lock/commit order and retry instructions: [decisions.md](decisions.md), B1–B5 revision. Tests do not enable live capture or authorize publication.

## Actual targeted TAP lines

```text
ok 8 - B2 registry lock spans repository COMMIT through quota finalization even when lease expires after commit
ok 9 - B2 store commit gate rejects a stale reservation token before repository COMMIT
ok 10 - B3 crash between evidence commit and quota finalization heals quota at startup
ok 11 - P2 malformed token suffix cannot be truncated by hex buffer conversion
ok 12 - P2 clean rejects token transport --admin-token=value
ok 13 - P2 clean rejects token transport environment variables
ok 14 - P2 concurrent clean calls sharing one token consume exactly once under exclusive lock
ok 57 - R2 reconciliation preserves living leases and removes dead or expired leases
ok 58 - R2 commit-to-registry worker keeps registry lock until finalization or PID death
ok 59 - B1 secure_delete is enabled on writable, read, registry, unscoped and CLI-style connections
ok 87 - B1 maintenance uses incremental reclamation and explicit WAL truncate
ok 88 - B1 concurrent purge waits for an active writer and preserves every event
ok 89 - B1 capture writer waits for purge lock release with zero lost events
ok 90 - B2 admin purge rejects agent environments even with TTY input and output
ok 91 - B3 killed cross-database writer reconciles exact committed evidence bytes on restart
ok 92 - B3 reconciliation waits for a separate-process admission and retains sealed evidence totals
ok 93 - B1 migrated auto-vacuum NONE purge clears indexed payload bytes and logical quota without rebuilding
ok 94 - B2 stripped agent markers in TTY-capable child rejects generic PURGE
ok 95 - B2 stripped agent markers in TTY-capable child rejects repository challenge with extra whitespace
ok 96 - B2 stripped agent markers in TTY-capable child accepts exact repository challenge with one-time admin token
ok 97 - B2 stripped agent markers in TTY-capable child rejects PTY agent without admin token despite exact challenge
ok 98 - P2 argv admin token is rejected even with a local TTY
ok 99 - P2 admin token replay is rejected with TOKEN_ALREADY_USED
ok 100 - P2 expired token is rejected with TOKEN_EXPIRED
ok 101 - P2 token comparison uses constant-time crypto primitive and never argv
ok 102 - P3 every production SQLite connection uses the hardened factory
ok 103 - P3 blocked truncate checkpoint fails closed with PURGE_CHECKPOINT_BUSY
ok 104 - P4 expired reservation fences repository commit and rolls back evidence
ok 105 - P4 real append commit outliving lease is rejected before COMMIT
ok 106 - P4 EPERM preserves same-host lease and foreign host does not probe PID
```

## Full byte-preserving raw TAP

```text
TAP version 13
# (node:41880) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero
ok 1 - frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero
  ---
  duration_ms: 1899.4275
  type: 'test'
  ...
# (node:4664) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: re-pair seals old namespace; refs and cursors never authorize another scope
ok 2 - re-pair seals old namespace; refs and cursors never authorize another scope
  ---
  duration_ms: 429.1398
  type: 'test'
  ...
# Subtest: read cursor binds repository scope and sealed state
ok 3 - read cursor binds repository scope and sealed state
  ---
  duration_ms: 834.1464
  type: 'test'
  ...
# Subtest: durable cursor signature protects generation, query, expiry and position
ok 4 - durable cursor signature protects generation, query, expiry and position
  ---
  duration_ms: 1267.2097
  type: 'test'
  ...
# Subtest: sandbox denial is propagated once, without Git or alternate-path fallback
ok 5 - sandbox denial is propagated once, without Git or alternate-path fallback
  ---
  duration_ms: 4.2656
  type: 'test'
  ...
# (node:31736) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: explicit sync constructs directed evidence-backed relations without causal inference
ok 6 - explicit sync constructs directed evidence-backed relations without causal inference
  ---
  duration_ms: 790.3053
  type: 'test'
  ...
# Subtest: graph shares opaque entity identities but never persists metadata secrets
ok 7 - graph shares opaque entity identities but never persists metadata secrets
  ---
  duration_ms: 1354.9439
  type: 'test'
  ...
# (node:36440) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: B2 registry lock spans repository COMMIT through quota finalization even when lease expires after commit
ok 8 - B2 registry lock spans repository COMMIT through quota finalization even when lease expires after commit
  ---
  duration_ms: 591.1794
  type: 'test'
  ...
# Subtest: B2 store commit gate rejects a stale reservation token before repository COMMIT
ok 9 - B2 store commit gate rejects a stale reservation token before repository COMMIT
  ---
  duration_ms: 1023.5335
  type: 'test'
  ...
# Subtest: B3 crash between evidence commit and quota finalization heals quota at startup
ok 10 - B3 crash between evidence commit and quota finalization heals quota at startup
  ---
  duration_ms: 4872.0038
  type: 'test'
  ...
# Subtest: P2 malformed token suffix cannot be truncated by hex buffer conversion
ok 11 - P2 malformed token suffix cannot be truncated by hex buffer conversion
  ---
  duration_ms: 726.7797
  type: 'test'
  ...
# Subtest: P2 clean rejects token transport --admin-token=value
ok 12 - P2 clean rejects token transport --admin-token=value
  ---
  duration_ms: 436.2257
  type: 'test'
  ...
# Subtest: P2 clean rejects token transport environment variables
ok 13 - P2 clean rejects token transport environment variables
  ---
  duration_ms: 217.2042
  type: 'test'
  ...
# Subtest: P2 concurrent clean calls sharing one token consume exactly once under exclusive lock
ok 14 - P2 concurrent clean calls sharing one token consume exactly once under exclusive lock
  ---
  duration_ms: 864.8671
  type: 'test'
  ...
# (node:33884) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: checkpoint separates observed Git metadata from reported summary and refs
ok 15 - checkpoint separates observed Git metadata from reported summary and refs
  ---
  duration_ms: 6007.7876
  type: 'test'
  ...
# Subtest: checkpoint claims remain reported after indexing and search
ok 16 - checkpoint claims remain reported after indexing and search
  ---
  duration_ms: 2338.0804
  type: 'test'
  ...
# Subtest: checkpoint redacts reported secrets without breaking structured evidence
ok 17 - checkpoint redacts reported secrets without breaking structured evidence
  ---
  duration_ms: 1203.8497
  type: 'test'
  ...
# Subtest: checkpoint rejects unknown evidence refs without fabricating checkpoint evidence
ok 18 - checkpoint rejects unknown evidence refs without fabricating checkpoint evidence
  ---
  duration_ms: 4739.5586
  type: 'test'
  ...
# (node:41192) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: CLI search/read/status preserve ContextService JSON semantics with gateway offline
ok 19 - CLI search/read/status preserve ContextService JSON semantics with gateway offline
  ---
  duration_ms: 4779.4821
  type: 'test'
  ...
# Subtest: CLI keeps inaccessible local state typed and redacted without remote bypass
ok 20 - CLI keeps inaccessible local state typed and redacted without remote bypass
  ---
  duration_ms: 1367.445
  type: 'test'
  ...
# Subtest: CLI ACCESS_DENIED remains local and uses the stable access exit code
ok 21 - CLI ACCESS_DENIED remains local and uses the stable access exit code
  ---
  duration_ms: 1895.6369
  type: 'test'
  ...
# Subtest: CLI executable emits JSON, human output, and safe usage errors
ok 22 - CLI executable emits JSON, human output, and safe usage errors
  ---
  duration_ms: 2186.483
  type: 'test'
  ...
# Subtest: CLI paginates search and read and explicitly syncs/rebuilds without source mutation
ok 23 - CLI paginates search and read and explicitly syncs/rebuilds without source mutation
  ---
  duration_ms: 5594.1944
  type: 'test'
  ...
# Subtest: read-only CLI leaves persisted databases unchanged and reports safe accounting
ok 24 - read-only CLI leaves persisted databases unchanged and reports safe accounting
  ---
  duration_ms: 663.1074
  type: 'test'
  ...
# Subtest: CLI scope failure and sealed namespace cannot fall back
ok 25 - CLI scope failure and sealed namespace cannot fall back
  ---
  duration_ms: 687.6861
  type: 'test'
  ...
# Subtest: CLI rejects caller-controlled device/account/store selectors and exposes only contracted commands
ok 26 - CLI rejects caller-controlled device/account/store selectors and exposes only contracted commands
  ---
  duration_ms: 0.7082
  type: 'test'
  ...
# (node:44476) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: device quota serializes all repos and includes sealed namespaces, without evicting evidence
ok 27 - device quota serializes all repos and includes sealed namespaces, without evicting evidence
  ---
  duration_ms: 1419.7073
  type: 'test'
  ...
# Subtest: repo quota pauses sync and import without publishing partial generations
ok 28 - repo quota pauses sync and import without publishing partial generations
  ---
  duration_ms: 1528.2736
  type: 'test'
  ...
# Subtest: transaction failure rolls back evidence and event together
ok 29 - transaction failure rolls back evidence and event together
  ---
  duration_ms: 3114.8444
  type: 'test'
  ...
# Subtest: restart abandons shadow generations and marks unresolved intents unknown without sync
ok 30 - restart abandons shadow generations and marks unresolved intents unknown without sync
  ---
  duration_ms: 1360.4959
  type: 'test'
  ...
# Subtest: process kill rolls back uncommitted WAL writes and preserves last-good generation
ok 31 - process kill rolls back uncommitted WAL writes and preserves last-good generation
  ---
  duration_ms: 1108.138
  type: 'test'
  ...
# Subtest: cleanup invalidates stateless search cursors and supports explicit sealed namespace selection
ok 32 - cleanup invalidates stateless search cursors and supports explicit sealed namespace selection
  ---
  duration_ms: 541.281
  type: 'test'
  ...
# Subtest: admin clean CLI refuses non-TTY input and cannot accept agent confirmation flags
ok 33 - admin clean CLI refuses non-TTY input and cannot accept agent confirmation flags
  ---
  duration_ms: 173.2889
  type: 'test'
  ...
# Subtest: explicit local admin payload purge reclaims quota and leaves metadata and content-free audit
ok 34 - explicit local admin payload purge reclaims quota and leaves metadata and content-free audit
  ---
  duration_ms: 4984.5044
  type: 'test'
  ...
# (node:39464) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: fresh status creates no repo database; unknown intent and wrong job scope are visible
ok 35 - fresh status creates no repo database; unknown intent and wrong job scope are visible
  ---
  duration_ms: 1900.424
  type: 'test'
  ...
# Subtest: migration rejects a newer schema without replacing it and publication rejects invalid watermarks
ok 36 - migration rejects a newer schema without replacing it and publication rejects invalid watermarks
  ---
  duration_ms: 4012.5837
  type: 'test'
  ...
# Subtest: symlink sandbox escape is denied on its canonical target
ok 37 - symlink sandbox escape is denied on its canonical target
  ---
  duration_ms: 937.9188
  type: 'test'
  ...
# (node:34636) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: graph CLI is read-only domain parity and search optionally returns bounded related refs
ok 38 - graph CLI is read-only domain parity and search optionally returns bounded related refs
  ---
  duration_ms: 5930.2741
  type: 'test'
  ...
# (node:41980) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: high-degree traversal enforces examined, visited, node, depth and aggregate byte caps
ok 39 - high-degree traversal enforces examined, visited, node, depth and aggregate byte caps
  ---
  duration_ms: 2890.7096
  type: 'test'
  ...
# Subtest: cycles terminate and path, direction, relation filtering and timeline are deterministic
ok 40 - cycles terminate and path, direction, relation filtering and timeline are deterministic
  ---
  duration_ms: 3419.1133
  type: 'test'
  ...
# Subtest: generation, retention, repository and sealed-owner boundaries are enforced before graph lookup
ok 41 - generation, retention, repository and sealed-owner boundaries are enforced before graph lookup
  ---
  duration_ms: 1354.723
  type: 'test'
  ...
# (node:36052) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope
ok 42 - JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope
  ---
  duration_ms: 1323.2593
  type: 'test'
  ...
# Subtest: legacy id wins over changed content, and excluded paths never persist payloads
ok 43 - legacy id wins over changed content, and excluded paths never persist payloads
  ---
  duration_ms: 1543.0869
  type: 'test'
  ...
# (node:30160) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: scoped foreground jobs reject overlap, cancel safely and keep sync idempotent
ok 44 - scoped foreground jobs reject overlap, cancel safely and keep sync idempotent
  ---
  duration_ms: 1329.4572
  type: 'test'
  ...
# Subtest: startup, read, search, graph, status and idle never materialize pending evidence
ok 45 - startup, read, search, graph, status and idle never materialize pending evidence
  ---
  duration_ms: 1618.5951
  type: 'test'
  ...
# (node:21552) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: sync indexes only pending retained events and advances watermark without copying old rows
ok 46 - sync indexes only pending retained events and advances watermark without copying old rows
  ---
  duration_ms: 1373.769
  type: 'test'
  ...
# PASS: frozen policy bounds, six-tool contract, baseline byte accounting and proposed local catalog budget
# Subtest: test\\context\\policy-contract.test.js
ok 14 - test\\context\\policy-contract.test.js
  ---
  duration_ms: 3160.9252
  type: 'test'
  ...
# (node:39392) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: Vietnamese and emoji byte-budget pages preserve code points and byte offsets
ok 48 - Vietnamese and emoji byte-budget pages preserve code points and byte offsets
  ---
  duration_ms: 2324.2528
  type: 'test'
  ...
# Subtest: evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes
ok 49 - evidence read preserves order, retention/redaction and aggregate UTF-8 byte budgets without writes
  ---
  duration_ms: 3429.3675
  type: 'test'
  ...
# (node:2808) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes
ok 50 - secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes
  ---
  duration_ms: 1531.1277
  type: 'test'
  ...
# Subtest: import deduplicates redacted content and indexes only redacted text
ok 51 - import deduplicates redacted content and indexes only redacted text
  ---
  duration_ms: 1216.9244
  type: 'test'
  ...
# Subtest: secret markers use keyed tags, never offline-guessable plain hashes
ok 52 - secret markers use keyed tags, never offline-guessable plain hashes
  ---
  duration_ms: 1.0174
  type: 'test'
  ...
# Subtest: UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs
ok 53 - UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs
  ---
  duration_ms: 1.5103
  type: 'test'
  ...
# Subtest: excluded paths, binary/base64, UTF-8 byte caps and boundary secrets
ok 54 - excluded paths, binary/base64, UTF-8 byte caps and boundary secrets
  ---
  duration_ms: 68.8735
  type: 'test'
  ...
# Subtest: Git roots, worktrees, separate clones and nested repositories
ok 55 - Git roots, worktrees, separate clones and nested repositories
  ---
  duration_ms: 5498.6747
  type: 'test'
  ...
# Subtest: non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved
ok 56 - non-Git, missing/ambiguous cwd, traversal and symlink escape are not weakly resolved
  ---
  duration_ms: 321.3773
  type: 'test'
  ...
# (node:17648) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: R2 reconciliation preserves living leases and removes dead or expired leases
ok 57 - R2 reconciliation preserves living leases and removes dead or expired leases
  ---
  duration_ms: 1260.4657
  type: 'test'
  ...
# Subtest: R2 commit-to-registry worker keeps registry lock until finalization or PID death
ok 58 - R2 commit-to-registry worker keeps registry lock until finalization or PID death
  ---
  duration_ms: 3696.7844
  type: 'test'
  ...
# Subtest: B1 secure_delete is enabled on writable, read, registry, unscoped and CLI-style connections
ok 59 - B1 secure_delete is enabled on writable, read, registry, unscoped and CLI-style connections
  ---
  duration_ms: 685.4713
  type: 'test'
  ...
# (node:35304) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: v1 repo migration preserves evidence and installs incremental retrieval schema
ok 60 - v1 repo migration preserves evidence and installs incremental retrieval schema
  ---
  duration_ms: 13.7731
  type: 'test'
  ...
# Subtest: v2 migration adds snapshot tombstones and folds existing redacted FTS content
ok 61 - v2 migration adds snapshot tombstones and folds existing redacted FTS content
  ---
  duration_ms: 3.9517
  type: 'test'
  ...
# Subtest: FTS filters first generation, retention, source and time without returning cross-scope evidence
ok 62 - FTS filters first generation, retention, source and time without returning cross-scope evidence
  ---
  duration_ms: 1569.1213
  type: 'test'
  ...
# (node:42856) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: pinned pagination retains page-two reindexed rows and excludes new generations
ok 63 - pinned pagination retains page-two reindexed rows and excludes new generations
  ---
  duration_ms: 3418.224
  type: 'test'
  ...
# Subtest: pinned generation excludes a clock-skewed G+1 event older than the cursor
ok 64 - pinned generation excludes a clock-skewed G+1 event older than the cursor
  ---
  duration_ms: 1199.6205
  type: 'test'
  ...
# Subtest: read continuation cannot be replayed against different refs in the same repo
ok 65 - read continuation cannot be replayed against different refs in the same repo
  ---
  duration_ms: 509.6324
  type: 'test'
  ...
# Subtest: pinned keyset pagination uses deterministic bucket and timestamp ordering across generation advances
ok 66 - pinned keyset pagination uses deterministic bucket and timestamp ordering across generation advances
  ---
  duration_ms: 6189.0091
  type: 'test'
  ...
# Subtest: stable exact-match bucket precedes newer FTS-only matches across keyset pages
ok 67 - stable exact-match bucket precedes newer FTS-only matches across keyset pages
  ---
  duration_ms: 265.1201
  type: 'test'
  ...
# Subtest: documents matching both exact and FTS preserve match_reason 0 and never repeat across keyset page boundaries with limit 1
ok 68 - documents matching both exact and FTS preserve match_reason 0 and never repeat across keyset page boundaries with limit 1
  ---
  duration_ms: 369.6628
  type: 'test'
  ...
# Subtest: expired authenticated search and read cursors are stale at the domain boundary
ok 69 - expired authenticated search and read cursors are stale at the domain boundary
  ---
  duration_ms: 270.5429
  type: 'test'
  ...
# Subtest: read cursor issued at G is stale after publication of G+1
ok 70 - read cursor issued at G is stale after publication of G+1
  ---
  duration_ms: 885.0613
  type: 'test'
  ...
# Subtest: one-byte payload tampering with the original MAC is invalid
ok 71 - one-byte payload tampering with the original MAC is invalid
  ---
  duration_ms: 312.8851
  type: 'test'
  ...
# Subtest: query mismatch and search/read/durable kind confusion are invalid
ok 72 - query mismatch and search/read/durable kind confusion are invalid
  ---
  duration_ms: 267.7608
  type: 'test'
  ...
# Subtest: current retention availability overrides pinned generation for purged evidence
ok 73 - current retention availability overrides pinned generation for purged evidence
  ---
  duration_ms: 408.7371
  type: 'test'
  ...
# Subtest: Vietnamese stroked d folds on index and query sides
ok 74 - Vietnamese stroked d folds on index and query sides
  ---
  duration_ms: 306.6294
  type: 'test'
  ...
# Subtest: v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL
ok 75 - v2 upgrade rebuilds folded FTS and initializes generation tombstones to NULL
  ---
  duration_ms: 249.416
  type: 'test'
  ...
# (node:42856) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: concurrent migration opener waits and rechecks v3, then commits without DDL
ok 76 - concurrent migration opener waits and rechecks v3, then commits without DDL
  ---
  duration_ms: 318.614
  type: 'test'
  ...
# Subtest: concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction
ok 77 - concurrent migration opener rejects post-lock v4 and rolls back without a dangling transaction
  ---
  duration_ms: 322.1957
  type: 'test'
  ...
# Subtest: v3 migration rolls back pre-commit failure and process crash, then reruns cleanly
ok 78 - v3 migration rolls back pre-commit failure and process crash, then reruns cleanly
  ---
  duration_ms: 341.1047
  type: 'test'
  ...
# Subtest: parseVersion rejects unreadable and invalid versions directly
ok 79 - parseVersion rejects unreadable and invalid versions directly
  ---
  duration_ms: 0.6714
  type: 'test'
  ...
# Subtest: migration rejects unreadable and invalid versions before and after BEGIN IMMEDIATE
ok 80 - migration rejects unreadable and invalid versions before and after BEGIN IMMEDIATE
  ---
  duration_ms: 2.0932
  type: 'test'
  ...
# Subtest: migration preserves the original error when COMMIT already released the transaction
ok 81 - migration preserves the original error when COMMIT already released the transaction
  ---
  duration_ms: 54.2735
  type: 'test'
  ...
# Subtest: substring and FTS matches collapse to one row with exact score zero
ok 82 - substring and FTS matches collapse to one row with exact score zero
  ---
  duration_ms: 231.5569
  type: 'test'
  ...
# Subtest: FTS search binds every SQL placeholder and uses all-null first-page keyset sentinels
ok 83 - FTS search binds every SQL placeholder and uses all-null first-page keyset sentinels
  ---
  duration_ms: 268.7889
  type: 'test'
  ...
# Subtest: FTS syntax characters are quoted as tokens and never interpreted as operators
ok 84 - FTS syntax characters are quoted as tokens and never interpreted as operators
  ---
  duration_ms: 277.9898
  type: 'test'
  ...
# Subtest: empty-token queries skip FTS and return only substring matches
ok 85 - empty-token queries skip FTS and return only substring matches
  ---
  duration_ms: 266.4656
  type: 'test'
  ...
# Subtest: search/status are read-only, Unicode-aware, bounded and never sync implicitly
ok 86 - search/status are read-only, Unicode-aware, bounded and never sync implicitly
  ---
  duration_ms: 410.4917
  type: 'test'
  ...
# (node:41116) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: B1 maintenance uses incremental reclamation and explicit WAL truncate
ok 87 - B1 maintenance uses incremental reclamation and explicit WAL truncate
  ---
  duration_ms: 2828.3175
  type: 'test'
  ...
# Subtest: B1 concurrent purge waits for an active writer and preserves every event
ok 88 - B1 concurrent purge waits for an active writer and preserves every event
  ---
  duration_ms: 2162.6106
  type: 'test'
  ...
# Subtest: B1 capture writer waits for purge lock release with zero lost events
ok 89 - B1 capture writer waits for purge lock release with zero lost events
  ---
  duration_ms: 6114.1491
  type: 'test'
  ...
# Subtest: B2 admin purge rejects agent environments even with TTY input and output
ok 90 - B2 admin purge rejects agent environments even with TTY input and output
  ---
  duration_ms: 384.5975
  type: 'test'
  ...
# Subtest: B3 killed cross-database writer reconciles exact committed evidence bytes on restart
ok 91 - B3 killed cross-database writer reconciles exact committed evidence bytes on restart
  ---
  duration_ms: 531.9295
  type: 'test'
  ...
# Subtest: B3 reconciliation waits for a separate-process admission and retains sealed evidence totals
ok 92 - B3 reconciliation waits for a separate-process admission and retains sealed evidence totals
  ---
  duration_ms: 1743.8492
  type: 'test'
  ...
# Subtest: B1 migrated auto-vacuum NONE purge clears indexed payload bytes and logical quota without rebuilding
ok 93 - B1 migrated auto-vacuum NONE purge clears indexed payload bytes and logical quota without rebuilding
  ---
  duration_ms: 370.9695
  type: 'test'
  ...
# Subtest: B2 stripped agent markers in TTY-capable child rejects generic PURGE
ok 94 - B2 stripped agent markers in TTY-capable child rejects generic PURGE
  ---
  duration_ms: 238.0854
  type: 'test'
  ...
# Subtest: B2 stripped agent markers in TTY-capable child rejects repository challenge with extra whitespace
ok 95 - B2 stripped agent markers in TTY-capable child rejects repository challenge with extra whitespace
  ---
  duration_ms: 220.5285
  type: 'test'
  ...
# Subtest: B2 stripped agent markers in TTY-capable child accepts exact repository challenge with one-time admin token
ok 96 - B2 stripped agent markers in TTY-capable child accepts exact repository challenge with one-time admin token
  ---
  duration_ms: 364.8334
  type: 'test'
  ...
# Subtest: B2 stripped agent markers in TTY-capable child rejects PTY agent without admin token despite exact challenge
ok 97 - B2 stripped agent markers in TTY-capable child rejects PTY agent without admin token despite exact challenge
  ---
  duration_ms: 227.0335
  type: 'test'
  ...
# Subtest: P2 argv admin token is rejected even with a local TTY
ok 98 - P2 argv admin token is rejected even with a local TTY
  ---
  duration_ms: 107.817
  type: 'test'
  ...
# Subtest: P2 admin token replay is rejected with TOKEN_ALREADY_USED
ok 99 - P2 admin token replay is rejected with TOKEN_ALREADY_USED
  ---
  duration_ms: 124.4259
  type: 'test'
  ...
# Subtest: P2 expired token is rejected with TOKEN_EXPIRED
ok 100 - P2 expired token is rejected with TOKEN_EXPIRED
  ---
  duration_ms: 123.6527
  type: 'test'
  ...
# Subtest: P2 token comparison uses constant-time crypto primitive and never argv
ok 101 - P2 token comparison uses constant-time crypto primitive and never argv
  ---
  duration_ms: 1.1145
  type: 'test'
  ...
# Subtest: P3 every production SQLite connection uses the hardened factory
ok 102 - P3 every production SQLite connection uses the hardened factory
  ---
  duration_ms: 154.879
  type: 'test'
  ...
# Subtest: P3 blocked truncate checkpoint fails closed with PURGE_CHECKPOINT_BUSY
ok 103 - P3 blocked truncate checkpoint fails closed with PURGE_CHECKPOINT_BUSY
  ---
  duration_ms: 317.4818
  type: 'test'
  ...
# Subtest: P4 expired reservation fences repository commit and rolls back evidence
ok 104 - P4 expired reservation fences repository commit and rolls back evidence
  ---
  duration_ms: 200.0932
  type: 'test'
  ...
# Subtest: P4 real append commit outliving lease is rejected before COMMIT
ok 105 - P4 real append commit outliving lease is rejected before COMMIT
  ---
  duration_ms: 193.2769
  type: 'test'
  ...
# Subtest: P4 EPERM preserves same-host lease and foreign host does not probe PID
ok 106 - P4 EPERM preserves same-host lease and foreign host does not probe PID
  ---
  duration_ms: 126.0276
  type: 'test'
  ...
# Subtest: quota rejection bursts create one deduplicated gap per minute
ok 107 - quota rejection bursts create one deduplicated gap per minute
  ---
  duration_ms: 479.0801
  type: 'test'
  ...
# Subtest: graph neighbor SQL fetch is bounded by remaining examined-edge budget plus one
ok 108 - graph neighbor SQL fetch is bounded by remaining examined-edge budget plus one
  ---
  duration_ms: 0.51
  type: 'test'
  ...
# Subtest: graph path cannot traverse a purged intermediate node
ok 109 - graph path cannot traverse a purged intermediate node
  ---
  duration_ms: 280.8146
  type: 'test'
  ...
# (node:40072) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: portable skill freezes search-first and selective-maintenance behavior
ok 110 - portable skill freezes search-first and selective-maintenance behavior
  ---
  duration_ms: 4.6667
  type: 'test'
  ...
# Subtest: portable skill forbids sandbox bypass and sealed namespace auto-selection
ok 111 - portable skill forbids sandbox bypass and sealed namespace auto-selection
  ---
  duration_ms: 2.7699
  type: 'test'
  ...
# Subtest: portable skill mentions only commands and flags covered by the CLI contract
ok 112 - portable skill mentions only commands and flags covered by the CLI contract
  ---
  duration_ms: 2.6813
  type: 'test'
  ...
# {"ok":true,"platform":"win32","arch":"x64","node":"22.22.2","sqlite":"3.51.2","constructor":"PASS","busy_timeout_ms":5,"fts5":"PASS","warnings":["ExperimentalWarning"],"json_stdout":"PASS","warning_stderr":"(node:20316) ExperimentalWarning: SQLite is an experimental feature and might change at any time\\n(Use `node --trace-warnings ...` to show where the warning was created)"}
# Subtest: test\\context\\sqlite-platform.test.js
ok 23 - test\\context\\sqlite-platform.test.js
  ---
  duration_ms: 985.7112
  type: 'test'
  ...
# (node:40744) ExperimentalWarning: SQLite is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors
ok 114 - WAL, timeout, foreign keys, migrations, opaque refs, generations and durable cursors
  ---
  duration_ms: 2441.5975
  type: 'test'
  ...
# Subtest: cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing
ok 115 - cursor v1 MAC binds kind and scope and rejects wrong-length signatures before payload parsing
  ---
  duration_ms: 757.7257
  type: 'test'
  ...
# Subtest: JSON MAC encoding rejects colon-delimiter scope collisions across owners
ok 116 - JSON MAC encoding rejects colon-delimiter scope collisions across owners
  ---
  duration_ms: 198.9828
  type: 'test'
  ...
# Subtest: status is read-only, capture gaps are visible and jobs/stores have ownership bounds
ok 117 - status is read-only, capture gaps are visible and jobs/stores have ownership bounds
  ---
  duration_ms: 438.5801
  type: 'test'
  ...
1..117
# tests 117
# suites 0
# pass 117
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 20872.6845

```
