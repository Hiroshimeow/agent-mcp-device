# HANDOFF — MCP Device P1 log-first search (2026-10-11 JST)

**Start here after agent takeover. This file, not a past chat/PI session, is the durable continuation contract.**

## 1. Verified identity and version

- **G6 Device repo:** E:\git-project\agent-mcp-device, branch main.
- **Original P0 baseline:** `eaa51927a491bebe8b5f2760659a65e09ddb9e57`.
- **Initial P1 source checkpoint:** `d5d28f5c191ee8087b30f6e96b366ee3134706b6`.
- **P1 quality/correctness implementation checkpoints:** `cb706ef69e19579f2c83ab682c9221a18a7db2f9`, independent-test fixes `2526811340dc9984e767f3ad043ddcc250bdf946`, then REVIEW-R1 visibility fix `716f011464286a3610a64f19becafb27850feae7`.
- No push, npm release, production reload, G8 Device/Gateway change or Gateway Context merge occurred.

## 2. Owner intent / hard scope

CORE: search and graph across **already-existing authorized** Pi/Codex/MCP/custom log files; incremental local index; compact search locators; exact selected-source read; graph only relationships actually evidenced in logs.

PRESERVE: original log files immutable and authoritative, existing filesystem permissions, v1.0.11 Context compatibility, source-only CLI compatibility.

NON-GOALS: no live observer/capture, event broker, duplicate raw-log store, new auth/redaction gate, code-AST graph, Wiki/P2, cross-device Palace sync or release/deploy work.

## 3. Implemented through final P1 correctness SHA 716f011

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
- `test/log-palace/log-palace.test.js`: 30 regressions, including maxFiles=1 cross-root fairness, same-size interior mutation, cross-source reused-session graph isolation, and REVIEW-R1 byte-budget discovery visibility across restart.
- CLI/public Context tool surface unchanged.

## 4. Fresh verification on final implementation SHA

Environment: G6 Windows, Node **22.22.2**, SQLite **3.51.2**.

- `npm run build`: **PASS** on final source. Clean full `npm test` also rebuilt twice successfully because the existing test runner invokes its own build.
- `node --test test/log-palace/log-palace.test.js`: **30/30 PASS**, ~40.6 s after REVIEW-R1 fix.
- `node --test test/context/access.test.js test/context/graph-query.test.js test/context/mcp-contract.test.js`: **10/10 PASS**, ~4.3 s.
- `node scripts/check-context-acceptance.mjs`: **PASS** (implementation consistency only, not independent approval).
- Independent acceptance script remains **PASS 7/7 on Windows and 7/7 on WSL Linux** on final source `716f011`, including maxFiles=1 cross-root fairness, same-size interior rewrite reset, cross-source reused-session isolation, >8 MiB late term, restart/partial append, overlap/deletion, and built CLI read/search.
- Clean full Device suite `npm test`: **66/66 PASS**, 0 failures on REVIEW-R1 final source; runner duration 165.4 s, total execution 175.9 s.
- Linux parity on **WSL Ubuntu 22.04 / Node 22.21.0** using the same built `dist/log-palace/store.js`:
  - partial-line resume, same-size rewrite detection, overlapping roots: **PASS**;
  - >64 MiB JSONL: **PASS**, 4 durable partial advances, late marker retrieved, ~5.78 s.
- No original real Pi/Codex/MCP source file was modified.

## 5. Benchmarks / receipts

### Representative existing G6 logs — isolated derived index

Latest turn-8 sources: one Pi session, one Codex session, MCP history; **3 files / 6,690,674 bytes / 1,759 indexed records**. Source logs grew between earlier runs; each benchmark verifies raw SHA unchanged during its own execution.

Fresh REVIEW-R1 turn-8 receipt: `E:\git-project\_mcp-consolidation-20261011\palace-review-r1-real-turn8.json`

- index wall p50 **902.3 ms**, p95 **1054.3 ms**;
- CPU p50 **938 ms**, p95 **1047 ms**;
- peak RSS **89,874,432 B**;
- SQLite index **3,530,752 B**; FTS pages **1,675,264 B**;
- search p50 **1.52 ms**, p95 **2.22 ms**;
- search response **2,545 B** p50/p95;
- selected read response **5,790 B**; graph response **3,904 B**;
- raw source SHA-256 unchanged.

A separate 7-run receipt (`palace-p1-bench-turn6-final.json`) exists from the same task and shows slower loaded-host timings; use the fresh turn-8 measurements above as the primary final-checkpoint numbers and expect host-load variance.

### >10k-file fairness/discovery

Fresh REVIEW-R1 turn-8 receipt: `E:\git-project\_mcp-consolidation-20261011\palace-review-r1-10k-turn8.json`

- **10,020 files / 10,020 records**, final cold file found;
- fixture creation **4.24 s** (measured separately);
- 51 bounded index calls;
- per-call p50 **300.7 ms**, p95 **489.0 ms**, max **621.3 ms**;
- total indexing **16.52 s**;
- peak RSS **79,310,848 B**;
- SQLite file **8,269,824 B**.

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

- **T014 COMPLETE at final P1 correctness SHA `716f011`:** durable cross-root fairness includes `maxFiles=1`; discovery visibility is preserved even when byte budget is exhausted before every discovered file is indexed; large-corpus + real-log p50/p95/storage/RSS/response-byte evidence recorded.
- **T015 COMPLETE at final P1 correctness SHA `716f011`:** giant-line resumability, explicit bounded hard limit, long-token coverage and Windows/Linux parity demonstrated.
- **T016 COMPLETE at final P1 correctness SHA `716f011`:** alias/overlap, rotation/copytruncate/rewrite, same-size interior mutation, missing/stale refs, concurrent append semantics and source-lineage-scoped graph identity regression-tested.
- This does **not** mean P1 is closed. Independent TEST and REVIEW are still mandatory; only PLAN may route DONE.

## 8. Known limitations / independent acceptance boundary

- Complete records above **128 MiB** fail explicitly with `RECORD_TOO_LARGE`. This is a deliberate bounded product limit, not unlimited-record support.
- Compressed rotated logs are not indexed.
- Source files remain authoritative; stale/missing/mutated selected reads fail rather than returning cached raw bodies.
- Large-directory performance is bounded and resumable but not constant-time; see measured 10k numbers above.
- TEST turn 1 originally found F1/F2/F3; DEV `2526811` closed them. REVIEW turn 1 then found R1 (discovered valid files could be falsely marked missing when byte budget stopped indexing mid-page); DEV `716f011` marks discovery visibility independently of indexing budget. The same independent acceptance script remains **7/7 PASS** on Windows and Linux; fresh independent TEST/REVIEW must verify `716f011` before PLAN closure.
- Stop before Wiki/P2, skills or cross-device integration unless separately instructed.

## 9. 2026-10-12 bounded LOCATE→READ continuation (DEV in progress)

Historical P1 SHA `716f011` and docs `b748df4` do not close two observed bugs: a 132,023-byte source line returned one FTS hit but could not READ the late match under 65,536 bytes, and a UTF-8 split at 128 bytes emitted replacement characters and exceeded the budget. Current DEV work on the same G6 checkout adds SEARCH `hit_offset` (`source_record_byte` units) with `anchor_status=raw_match` only when a real source term was mapped; otherwise `hit_offset=null` and an honest `anchor_status`. READ `--from-byte` selects raw source bytes with complete record-hash verification, a UTF-8-safe bounded window, source-relative `range_start/range_end`, `next_offset` and truncation. Existing no-offset Pi selected-part behavior is retained. REVIEW then reproduced three additional defects at `ca595e1`: invalid UTF-8 could expand model-visible text past `maxBytes`; a truncated `selected_part` cursor incorrectly resumed in raw-source coordinates; and duplicate terms in separate Pi parts could anchor the later hit to the earlier part. DEV turn 2 fixes these narrowly: invalid UTF-8 READ fails `SOURCE_ENCODING_UNSUPPORTED`, truncated `selected_part` is explicitly non-resumable (`next_offset=null`, `resumable=false`), and Pi anchors are emitted only when the raw match is proven inside that exact indexed part (otherwise `unmapped`). REVIEW turn 2 then found that reserializing a selected part and globally searching it could still bind to an earlier metadata mirror when the real content part used noncanonical whitespace. DEV turn 3 replaces that proof with direct byte-level JSON navigation to the actual `message.content[part]` syntactic span; no reserialized global-match shortcut remains. REVIEW turn 3 then found duplicate `message`/`content` keys could diverge from `JSON.parse` last-wins indexing semantics. DEV turn 4 makes duplicate traversed keys fail closed to `unmapped`; it does not invent first/last-key provenance. The original indexed corpus/source file is not rewritten. Fresh independent Windows/WSL TEST, 1.0.11 compatibility and architecture REVIEW of the new final commit remain mandatory, and do not infer them from this handoff.

**P2 one-backend design boundary (not authorized to implement):** Compare pinned versions/license of ReMe and OpenViking on the same sanitized indexed Pi/Codex/MCP corpus. Evaluate exact source-evidence references, incremental page updates, stale/contradictory claims, offline operation, on-demand pages, total LLM tokens and expense. No-change idle must make zero LLM calls. Select ONE mature backend only after measured decision; do not start a scheduler, adapter, auto-sync, new control plane, self-built wiki or publication. Then separately validate cold-agent cross-repo recall, and only later lazy validated skill consolidation. P1 continues to be ONE small local tool rather than a security platform.

## 10. P1 source acceptance — 2026-10-13 JST (PLAN closure)

**Accepted G6 source SHA:** `e1f74715b60a008171d3e0a9c27c8f4f2964ce2c` (`main`), following `ca595e1` late-hit/UTF-8 repair, `b3e9655` source-anchor/cursor correction, `ab40106` raw Pi-part provenance binding, and `e1f7471` duplicate traversed-key fail-closed correction. This is **source acceptance only**: not published, deployed, loaded on G8 or exposed as a new public MCP tool.

**Independent final-SHA TEST turn 4:** Windows full `npm test` 66/66 PASS (exit 0), Log Palace 39/39 PASS (exit 0), targeted P1 9/9 PASS, custom provenance suite Windows/WSL 10/10 PASS each, Context consistency `passed=true`. Windows Context compatibility 10/10 is recorded by DEV on final SHA. Final TEST evidence: `.plan/device-006-mind-palace-tool-20261012/device-006-mind-palace-tool-20261012-test_turn4_cdpa-idem-2eb7f15e5faf56b1159a6087.md` and task-local logs/exit markers.

**Independent final-SHA REVIEW turn 4:** inspected final source delta and prior root causes, personally reran targeted 9/9 and Windows/WSL 10/10, no actionable in-scope correctness issue. Report: `.plan/device-006-mind-palace-tool-20261012/device-006-mind-palace-tool-20261012-review_turn4_cdpa-idem-2eb7f15e5faf56b1159a6087.md`. `T032` is closed by PLAN after these gates.

**Contract boundary:** FTS5 SEARCH returns a compact locator; `anchor_status=raw_match` and `hit_offset` (source-record-relative bytes) only when actual original bytes prove the selected hit/part. Ambiguous Pi duplicate traversed keys yield `unmapped`, never a false pointer. `logs read --from-byte <hit_offset>` returns source-verified UTF-8-safe window; `--max-bytes` (128–65,536) caps `result.text` bytes, **not complete JSON envelope**. Legacy selected-part reads remain bounded but non-resumable. Original files unchanged, existing OS/MCP privileges retained, legacy Context 1.0.11 API intact.

**Boundaries NOT_MEASURED on final SHA:** new 64 MiB / 10,020-file benchmark reruns, concurrent writer / TOCTOU race stress and constant RSS for legacy full-record Pi part. Earlier benchmark receipts in sections 4–5 are **historical `716f011` evidence only**, not measurements of final `e1f7471`. Single records >128 MiB and compressed rotations remain unsupported. No LLM token-cost savings demonstrated.

**Next phase is P2 design, NOT implementation:** compare pinned ReMe/OpenViking license/version/functionality on the SAME sanitized indexed Pi/Codex/MCP fixtures; evaluate original-evidence backlinks, incremental update, stale claim correction, offline use, minimum page/locator cost and total LLM tokens. Idle with unchanged sources must make ZERO LLM calls. Select ONE mature backend only after comparison; subsequently design owner-scoped cross-repo cold recall and (later) bounded, automatic agent-owned skill consolidation. No Wiki adapter, scheduler, sync, custom engine, Gateway deployment or production changes authorized in this milestone.

## 11. Operational guardrails

No worktree/branch creation, reset/clean/stash of unrelated work, force-push, release, deployment or production reload. Keep Spec 002 regressions and private benchmark/raw-log evidence outside Git. Use exact SHAs and reproducible receipts as the acceptance basis.
