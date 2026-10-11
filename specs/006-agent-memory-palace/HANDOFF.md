# HANDOFF — MCP Device P1 log-first search (2026-10-11 JST)

**Start here after agent takeover. This file, not a past chat/PI session, is the durable continuation contract.**

## 1. Verified identity and version

- **G6 Device repo:** E:\git-project\agent-mcp-device, branch main.
- **Original P0 baseline:** `eaa51927a491bebe8b5f2760659a65e09ddb9e57`.
- **Initial P1 source checkpoint:** `d5d28f5c191ee8087b30f6e96b366ee3134706b6`.
- **P1 quality/correctness implementation checkpoints:** `cb706ef69e19579f2c83ab682c9221a18a7db2f9`, then independent-test fixes `2526811340dc9984e767f3ad043ddcc250bdf946`.
- No push, npm release, production reload, G8 Device/Gateway change or Gateway Context merge occurred.

## 2. Owner intent / hard scope

CORE: search and graph across **already-existing authorized** Pi/Codex/MCP/custom log files; incremental local index; compact search locators; exact selected-source read; graph only relationships actually evidenced in logs.

PRESERVE: original log files immutable and authoritative, existing filesystem permissions, v1.0.11 Context compatibility, source-only CLI compatibility.

NON-GOALS: no live observer/capture, event broker, duplicate raw-log store, new auth/redaction gate, code-AST graph, Wiki/P2, cross-device Palace sync or release/deploy work.

## 3. Implemented through final P1 correctness SHA 2526811

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
- `test/log-palace/log-palace.test.js`: 29 regressions, adding independent-test reproductions for maxFiles=1 cross-root fairness, same-size interior mutation, and cross-source reused-session graph isolation.
- CLI/public Context tool surface unchanged.

## 4. Fresh verification on final implementation SHA

Environment: G6 Windows, Node **22.22.2**, SQLite **3.51.2**.

- `npm run build`: **PASS** on final source. Clean full `npm test` also rebuilt twice successfully because the existing test runner invokes its own build.
- `node --test test/log-palace/log-palace.test.js`: **29/29 PASS**, ~40.2 s after independent-test fixes.
- `node --test test/context/access.test.js test/context/graph-query.test.js test/context/mcp-contract.test.js`: **10/10 PASS**, ~4.3 s.
- `node scripts/check-context-acceptance.mjs`: **PASS** (implementation consistency only, not independent approval).
- Independent TEST acceptance script now **PASS 7/7 on Windows and 7/7 on WSL Linux** after `2526811`, including maxFiles=1 cross-root fairness, same-size interior rewrite reset, cross-source reused-session isolation, >8 MiB late term, restart/partial append, overlap/deletion, and built CLI read/search.
- Clean full Device suite `npm test`: **66/66 PASS**, 0 failures on final fixes; runner duration 229.7 s, total execution 240.4 s.
- Linux parity on **WSL Ubuntu 22.04 / Node 22.21.0** using the same built `dist/log-palace/store.js`:
  - partial-line resume, same-size rewrite detection, overlapping roots: **PASS**;
  - >64 MiB JSONL: **PASS**, 4 durable partial advances, late marker retrieved, ~5.78 s.
- No original real Pi/Codex/MCP source file was modified.

## 5. Benchmarks / receipts

### Representative existing G6 logs — isolated derived index

Latest independent turn-7 sources: one Pi session, one Codex session, MCP history; **3 files / 6,690,674 bytes / 1,759 indexed records**. Source logs grew between runs; each benchmark verifies raw SHA unchanged during its own execution.

Fresh turn-7 independent receipt: `E:\git-project\_mcp-consolidation-20261011\palace-independent-real-bench-turn7.json`

- index wall p50 **899.8 ms**, p95 **1106.8 ms**;
- CPU p50 **953 ms**, p95 **1079 ms**;
- peak RSS **88,162,304 B**;
- SQLite index **3,530,752 B**; FTS pages **1,675,264 B**;
- search p50 **1.89 ms**, p95 **3.19 ms**;
- search response **2,545 B** p50/p95;
- selected read response **5,790 B**; graph response **3,904 B**;
- raw source SHA-256 unchanged.

A separate 7-run receipt (`palace-p1-bench-turn6-final.json`) exists from the same task and shows slower loaded-host timings; use the fresh turn-7 measurements above as the primary final-checkpoint numbers and expect host-load variance.

### >10k-file fairness/discovery

Fresh turn-7 receipt: `E:\git-project\_mcp-consolidation-20261011\palace-independent-10k-bench-turn7.json`

- **10,020 files / 10,020 records**, final cold file found;
- fixture creation **4.58 s** (measured separately);
- 51 bounded index calls;
- per-call p50 **316.9 ms**, p95 **463.4 ms**, max **567.2 ms**;
- total indexing **16.68 s**;
- peak RSS **85,078,016 B**;
- SQLite file **8,261,632 B**.

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

- **T014 COMPLETE at final P1 correctness SHA `2526811`:** durable cross-root fairness includes `maxFiles=1`; large-corpus + real-log p50/p95/storage/RSS/response-byte evidence recorded.
- **T015 COMPLETE at final P1 correctness SHA `2526811`:** giant-line resumability, explicit bounded hard limit, long-token coverage and Windows/Linux parity demonstrated.
- **T016 COMPLETE at final P1 correctness SHA `2526811`:** alias/overlap, rotation/copytruncate/rewrite, same-size interior mutation, missing/stale refs, concurrent append semantics and source-lineage-scoped graph identity regression-tested.
- This does **not** mean P1 is closed. Independent TEST and REVIEW are still mandatory; only PLAN may route DONE.

## 8. Known limitations / independent acceptance boundary

- Complete records above **128 MiB** fail explicitly with `RECORD_TOO_LARGE`. This is a deliberate bounded product limit, not unlimited-record support.
- Compressed rotated logs are not indexed.
- Source files remain authoritative; stale/missing/mutated selected reads fail rather than returning cached raw bodies.
- Large-directory performance is bounded and resumable but not constant-time; see measured 10k numbers above.
- TEST turn 1 originally found F1/F2/F3; DEV `2526811` fixes now reproduce **7/7 PASS** on the same independent script for Windows and Linux. A fresh independent TEST role must verify the committed checkpoint before PLAN closure; REVIEW must still challenge correctness, security, performance and reference parity.
- Stop before Wiki/P2, skills or cross-device integration unless separately instructed.

## 9. Operational guardrails

No worktree/branch creation, reset/clean/stash of unrelated work, force-push, release, deployment or production reload. Keep Spec 002 regressions and private benchmark/raw-log evidence outside Git. Use exact SHAs and reproducible receipts as the acceptance basis.
