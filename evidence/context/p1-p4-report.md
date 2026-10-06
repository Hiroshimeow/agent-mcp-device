# P1–P4 engineering closure

## Execution identity and evidence

Workspace: `E:/git-project/wt-mcp-device-111-context`.
Baseline HEAD: `b8147f49d2fd5fd6f68608b0df55977a2b8f699c`.
Baseline `git status --porcelain`: empty (clean).
Node: `v22.22.2`.

Executed `npm run build` successfully (exit 0); full log: `p1-p4-build.txt`.
Executed exactly `node --test test/context/*.test.js > raw-tap.txt 2>&1` successfully (exit 0). `raw-tap.txt` at repository root is unmodified combined stdout/stderr, protected by the existing `-text` Git attribute. SHA-256:

```text
865ab362a85d76c6689e43ade83657704ba2f5e026d88b8f0794c2552dc2dd8d
```

TAP totals: **110 tests, 0 suites, 110 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo**.
The current glob contains **23 test files with top-level `test()` calls, hence 0 suites**. The requested historical wording is **“15 test files (with top-level test() calls, hence 0 suites)”**, not “15 test suites”; however, reporting 15 for this actual run would be inaccurate. No files were excluded to force that older count.

`p1-p4-session-metadata.txt` captures baseline and pre-commit Git/node metadata. A commit cannot contain its own final hash; final commit hash and post-commit status are reported separately. Historical evidence snapshots are unchanged except the current raw TAP artifact and explicitly superseding decisions.

## P2 — Operator authorization

- `--admin-token` is rejected; token arrives only via stdin at the real CLI prompt, never command arguments or injected consent.
- Operator provisions a 32-byte lowercase hex nonce in a protected JSON file with epoch-millisecond expiration; validity is bounded to five minutes.
- Comparison uses `crypto.timingSafeEqual` on two decoded 32-byte buffers. A test verifies use of this primitive; this is not an empirical proof of timing behavior of the entire filesystem/CLI path.
- An exclusive `wx` claim serializes consumers. A fsynced append-only digest ledger marks consumption before unlink and confirmation, preserving replay rejection even after later tokens are provisioned. Interrupted claims fail closed and require operator recovery.
- Replay and expired-token tests assert `TOKEN_ALREADY_USED` and `TOKEN_EXPIRED`. Existing child-process confirmation tests now send tokens through stdin and prove cancelled/wrong confirmation still consumes authorization.
- Readline does not echo the token itself. Operator must protect stdin/terminal-driver echo, root ACLs and secrets from same-OS-identity agents. This is not an OS sandbox.
- `decisions.md` records the operator/agent boundary and the user-directed sign-off by `DuongNH66 (System Owner)` on 2026-10-05.

## P3 — Fail-closed erasure

- `createContextDatabase(path, options)` centralizes every production context SQLite open, including read-only access and quota reconciliation. It enforces secure_delete ON, busy_timeout 5000, foreign_keys ON and synchronous FULL, closing on initialization failure.
- Recursive source guard asserts only one `new DatabaseSync` constructor exists in production context sources; runtime tests inspect all four pragmas for writable/read-only factory handles.
- Purge retains metadata while deleting regular stored-content FTS/search rows and blanking evidence payload, optimizing FTS in the same transaction, reclaiming pages incrementally, and checking TRUNCATE checkpoint status.
- SQLite's busy handler retries up to its configured timeout. Missing/nonzero checkpoint status produces `PURGE_CHECKPOINT_BUSY`. A real concurrent read snapshot regression exercises this failure, with a shorter timeout for test speed.
- Single-token lowercase canary test proves pre-purge main-file presence and post-purge zero occurrence in main SQLite, extant WAL/SHM, and all five FTS shadow tables, including content/data values.
- Success establishes application-managed current SQLite logical erasure only. Backups, snapshots, physical storage remanence, prior copies, retained refs/hashes/event metadata and interrupted/failed purges are excluded. A failed checkpoint can occur after logical deletion commits: retry after the blocking reader closes; never claim complete erasure from the failure.

## P4 — Reservation fencing

- Durable reservation ID is checked under the registry writer lock after admission lock reacquisition, immediately before every production append/import/index repository COMMIT, after action completion, and before quota finalization.
- Missing/expired reservation raises `RESERVATION_FENCED_OFF`; pre-commit failures roll back repository transactions. No lease renewal permits expired work to commit.
- Tests expire a reservation inside repository work and inside the real append path, asserting rejected commit and zero persisted evidence.
- Single-host semantics: foreign-host reservations do not probe local PIDs; they rely on expiration. Same-host EPERM retains the live lease; only ESRCH establishes death. Tests verify both paths.
- Existing separate-process writer/purge contention, killed writer reconciliation and live commit-to-accounting lease regressions remain passing.

## Review and limits

Direct diff review and `git diff --check` were performed. Build and full context tests passed on Windows/Node v22.22.2 only; no Linux, Node-floor, native ConPTY, power-loss or physical-media erasure measurements are implied. No release, merge, live capture or public-tool enablement is included.
