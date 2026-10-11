# HANDOFF — MCP Device P1 log-first search (2026-10-11 JST)

**Start here after agent takeover. This file, not a past chat/PI session, is the durable continuation contract.**

## 1. Verified identity and version

- **G6 Device repo:** E:\git-project\agent-mcp-device, branch main.
- **Original P0 baseline:** `eaa51927a491bebe8b5f2760659a65e09ddb9e57`.
- **Initial P1 source checkpoint:** `d5d28f5c191ee8087b30f6e96b366ee3134706b6`.
- **P1 quality/correctness implementation checkpoint:** `cb706ef69e19579f2c83ab682c9221a18a7db2f9`.
- No push, npm release, production reload, G8 Device/Gateway change or Gateway Context merge occurred.

## 2. Owner intent / hard scope

CORE: search and graph across **already-existing authorized** Pi/Codex/MCP/custom log files; incremental local index; compact search locators; exact selected-source read; graph only relationships actually evidenced in logs.

PRESERVE: original log files immutable and authoritative, existing filesystem permissions, v1.0.11 Context compatibility, source-only CLI compatibility.

NON-GOALS: no live observer/capture, event broker, duplicate raw-log store, new auth/redaction gate, code-AST graph, Wiki/P2, cross-device Palace sync or release/deploy work.

## 3. Implemented at cb706ef

- `src/log-palace/formats.ts`: complete searchable body coverage with bounded preview generation; Pi/Codex/MCP/text adapters preserved.
- `src/log-palace/store.ts`:
  - durable per-source discovery cursor + deterministic bounded pages;
  - round-robin source scheduling and discovery epochs;
  - durable `scan_position` for partial/giant records;
  - explicit 128 MiB complete-record hard limit (`RECORD_TOO_LARGE` above it);
  - open-descriptor `fstat`, dev/inode + head/tail fingerprint mutation detection;
  - small contentless FTS plus mapped overlapping chunk FTS for large records;
  - <=7000-code-unit long-token segmentation to avoid SQLite FTS5 32768-byte silent token truncation;
  - per-record query-term preservation (over-budget query terms fail explicitly rather than being silently dropped);
  - batch transaction + per-file savepoint rollback;
  - evidence-only call/session/turn/file graph scoping, including cross-file reused-ID protection.
- `test/log-palace/log-palace.test.js`: 26 regressions, including >64 MiB JSONL, >10k files, restart/fairness, overlap/missing/stale refs, same-size rewrite, copytruncate/regrow, partial append, reused IDs and long/chunked FTS cases.
- CLI/public Context tool surface unchanged.

## 4. Fresh verification on final implementation SHA

Environment: G6 Windows, Node **22.22.2**, SQLite **3.51.2**.

- `npm run build`: **PASS** on final source. Clean full `npm test` also rebuilt twice successfully because the existing test runner invokes its own build.
- `node --test test/log-palace/log-palace.test.js`: **26/26 PASS**, final clean receipt ~32.6 s.
- `node --test test/context/access.test.js test/context/graph-query.test.js test/context/mcp-contract.test.js`: **10/10 PASS**, ~4.3 s.
- `node scripts/check-context-acceptance.mjs`: **PASS** (implementation consistency only, not independent approval).
- Built CLI E2E through `node dist/mcp-device.js logs add/index/search`: **PASS** with isolated state and exact marker retrieval.
- Clean full Device suite `npm test`: **66/66 PASS**, 0 failures; runner test duration 199.6 s, total execution 214.4 s. Earlier false full-suite failures were caused by two task-owned concurrent `npm test`/build processes racing on `dist`; both duplicate process trees were stopped and one clean run was then executed.
- Linux parity on **WSL Ubuntu 22.04 / Node 22.21.0** using the same built `dist/log-palace/store.js`:
  - partial-line resume, same-size rewrite detection, overlapping roots: **PASS**;
  - >64 MiB JSONL: **PASS**, 4 durable partial advances, late marker retrieved, ~5.78 s.
- No original real Pi/Codex/MCP source file was modified.

## 5. Benchmarks / receipts

### Representative existing G6 logs — isolated derived index

Sources: one Pi session, one Codex session, MCP history; **3 files / 6,270,444 bytes / 1,652 indexed records**.

Fresh 5-run receipt: `E:\git-project\_mcp-consolidation-20261011\palace-p1-bench-turn6.json`

- index wall p50 **1005.3 ms**, p95 **1474.9 ms**;
- CPU p50 **1047 ms**, p95 **1484 ms**;
- peak RSS **84,410,368 B**;
- SQLite index **3,354,624 B**; FTS pages **1,576,960 B**;
- search p50 **2.60 ms**, p95 **3.97 ms**;
- search response **2,545 B** p50/p95;
- selected read response **5,790 B**; graph response **3,541 B**;
- raw source SHA-256 unchanged.

A separate 7-run receipt (`palace-p1-bench-turn6-final.json`) exists from the same task and shows slower loaded-host timings; use fresh measurements above as the primary turn-6 numbers and expect host-load variance.

### >10k-file fairness/discovery

Fresh receipt: `E:\git-project\_mcp-consolidation-20261011\palace-10k-bench-turn6.json`

- **10,020 files / 10,020 records**, final cold file found;
- fixture creation **4.46 s** (measured separately);
- 51 bounded index calls;
- per-call p50 **277.9 ms**, p95 **624.2 ms**, max **817.7 ms**;
- total indexing **16.08 s**;
- peak RSS **141,557,760 B**;
- SQLite file **7,266,304 B**.

Supplementary loaded-host receipt `palace-p1-10k-bench.json` also records FTS pages **282,624 B** and search p50/p95 **1.81/5.67 ms**.

## 6. Mature-reference technique map

Pinned/public references used for the finite P1 invariants:

- **OpenTelemetry Collector Contrib v0.162.0** (current released contrib line on 2026-10-11):
  https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.162.0/receiver/filelogreceiver
  Technique adapted: content fingerprint + persistent offsets / move-create and copytruncate rotation semantics. The live receiver/observer architecture was **not** copied.
- **Fluent Bit v5.1.3** (release commit shown by upstream as `d1be1ba`):
  https://github.com/fluent/fluent-bit/tree/v5.1.3/plugins/in_tail
  Technique adapted: SQLite checkpointing, inode/filename identity semantics, WAL and `synchronous=NORMAL` tradeoff for rebuildable derived state.
- **SQLite FTS5 official documentation**:
  https://www.sqlite.org/fts5.html
  Constraint addressed: tokens over 32768 bytes are silently truncated; P1 now normalizes long logical tokens into stable smaller segments and maps large-record FTS chunks back to a single record locator.
- ripgrep / claude-mem exact implementation parity is **not claimed**.

## 7. Task state

- **T014 COMPLETE in DEV worktree/commit:** large-corpus fairness + real-log p50/p95/storage/RSS/response-byte evidence recorded.
- **T015 COMPLETE in DEV worktree/commit:** giant-line resumability, explicit bounded hard limit, long-token coverage and Windows/Linux parity demonstrated.
- **T016 COMPLETE in DEV worktree/commit:** alias/overlap, rotation/copytruncate/rewrite, missing/stale refs, concurrent append semantics and scoped graph identity regression-tested.
- This does **not** mean P1 is closed. Independent TEST and REVIEW are still mandatory; only PLAN may route DONE.

## 8. Known limitations / independent acceptance boundary

- Complete records above **128 MiB** fail explicitly with `RECORD_TOO_LARGE`. This is a deliberate bounded product limit, not unlimited-record support.
- Compressed rotated logs are not indexed.
- Source files remain authoritative; stale/missing/mutated selected reads fail rather than returning cached raw bodies.
- Large-directory performance is bounded and resumable but not constant-time; see measured 10k numbers above.
- Independent TEST must reproduce critical fixtures/metrics without exposing private log content; REVIEW must challenge correctness, security, performance and reference parity.
- Stop before Wiki/P2, skills or cross-device integration unless separately instructed.

## 9. Operational guardrails

No worktree/branch creation, reset/clean/stash of unrelated work, force-push, release, deployment or production reload. Keep Spec 002 regressions and private benchmark/raw-log evidence outside Git. Use exact SHAs and reproducible receipts as the acceptance basis.
