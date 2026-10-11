# 006 — Tasks (log-first; one step at a time)

All changes must name exact Git commit and test output. **[x] means code/tests demonstrated in this worktree**, not a deployment or public release.

## P0 — Completed at eaa5192
- [x] **T001** Audit Device legacy Context baseline with independent Explore/Review evidence, record limitations.
- [x] **T002** Replace legacy capture-oriented P0.5 implementation goal with user's existing-log-first direction in this spec.

## P1 — Existing log CLI, active
- [x] **T003** Inspect actual Pi/Codex/MCP JSONL formats on G6 without dumping private log content.
- [x] **T004** Provide opt-in log file/directory registration and standard source discovery.
- [x] **T005** Add SQLite FTS5 local index and bounded locate-only search. No live observer, no duplicate full source log store.
- [x] **T006** Add exact source-range read with hash verification and source-change errors.
- [x] **T007** Incremental append indexing, pending final-line avoidance, idempotent re-index, truncate/rotation invalidation.
- [x] **T008** Normalize Pi toolCall/toolResult and Codex call/output by actual IDs; parse legacy MCP and generic text.
- [x] **T009** Provide bounded graph links by explicit call/session/turn and proven file identity; avoid same-basename and reused-ID false positives.
- [x] **T010** Add a local CLI dispatch path without altering v1.0.11 Context public tools or Gateway runtime.
- [x] **T011** Add regression fixtures for the above behavior, including offline/negative cases.
- [x] **T012** Isolated G6 real-log smoke: 3 sources, 6,270,444 bytes, 1,652 records, index 483 ms, one query 3.48 ms, repeat 0 new, original SHA unchanged. Receipt: _mcp-consolidation-20261011/palace-real-smoke-result.json.
- [x] **T013** npm run build PASS, P1 11/11 PASS, legacy Context 10/10 PASS, Context acceptance checker PASS; full Device suite NOT RUN (receipts in HANDOFF.md).
- [x] **T014** Benchmark source discovery/index fairness and FTS5 query p50/p95 on larger local corpora; document measured limits. Final correctness commit `2526811`; maxFiles=1 cross-root fairness regression added. Fresh 10,020-file run: 51 bounded calls, index-call p50 317 ms / p95 463 ms / max 567 ms, total indexing 16.68 s with fixture creation measured separately; real Pi/Codex/MCP p50/p95 and storage/RSS/response-byte metrics are in HANDOFF.
- [x] **T015** Handle giant individual lines that exceed the scan budget, with explicit resumability/partial state; test Windows/Linux. Final correctness commit `2526811`; Windows and WSL Linux independent-script cases PASS for >8 MiB late-term, durable partial resume/restart and raw immutability; >64 MiB parity remains covered by DEV fixtures. Fresh independent TEST still must verify the committed checkpoint before PLAN closure.
- [x] **T016** Review log aliasing, rotation across renamed paths, overlapping source registrations, and missing-file visibility. Final correctness commit `2526811`; regressions now include same-size interior mutation invalidation and source-lineage scoping for reused session IDs, plus overlap, missing/stale refs, copytruncate/regrow, partial append and Linux parity.
- [x] **T017** P1 source commit d5d28f5, README/STATUS/spec/handoff documentation follow-up in main, checked source/test receipts. Verify final docs commit via git log.

## P2 — LLM Wiki Palace (not implemented)
- [ ] **T018** Pin and audit ReMe/OpenViking upstream versions/license/features on identical sanitized *indexed log* corpus.
- [ ] **T019** Choose one Wiki backend with evidence refs, incremental digest and bounded total LLM cost.
- [ ] **T020** Implement adapter from selected log refs to wiki pages/links. No new custom Wiki engine.
- [ ] **T021** Verify stale/contradictory advice, no-match and raw-evidence provenance.

## P3 — Portable memory (not implemented)
- [ ] **T022** Scope same-owner Palace knowledge across repo/clone/device without copying private raw logs automatically.
- [ ] **T023** Cold-start locator/no-guide recall from G6→new G8 repo and reverse, with correct applicability checks.
- [ ] **T024** Validate forbidden scope, missing source, interrupted sync and unrelated-task no-memory path.

## P4 — Self-learning lazy skills (not implemented)
- [ ] **T025** Learn short agent-owned procedures grounded in Wiki/log evidence, including failed attempts.
- [ ] **T026** Reuse skill catalog metadata + lazy body loading; do not increase MCP catalog noise.
- [ ] **T027** Bounded scheduled automatic dedupe/merge/archive, no per-skill human approvals, machine verification + rollback.
- [ ] **T028** Measure skill reuse correctness and amortized background tokens; disable no-change LLM calls.

## P5 — Compatibility / release (not implemented)
- [ ] **T029** Prove token economy including indexing/search and Wiki/curator costs, compare no-memory baseline.
- [ ] **T030** Independent review of owner access, source truth, regression and latency; publish known limitations.
- [ ] **T031** Only with separate approval, integrate from canonical Gateway develop and release/reload with rollback.

## Stop line

At the end of each small increment: build/test → commit → report SHA/evidence + explicit open items → STOP before the next feature lane unless asked. User does not want PI involved in this implementation.