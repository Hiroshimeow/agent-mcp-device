---
description: "Dependency-ordered future work; STOPPED BEFORE IMPLEMENTATION"
---

# Tasks: MCP Device 1.0.10 Runtime and Compatibility Review

**Input**: Design documents from `/specs/001-mcp-runtime-review/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md).

**Tests**: Explicitly required by scope. Write contract/oracle tests first, establish
baseline observations and red tests for additive behavior, then implement only after
separate authorization. Every checkbox is intentionally unchecked.

**Organization**: Tasks are grouped by independently testable user story. This document
is a future execution proposal, not permission to implement, commit, merge or release.

## Format: `[ID] [P?] [Story] Description`

- `[P]` means different files with no dependency on an incomplete peer in the named wave.
- `[US1]` through `[US5]` map to the five specification stories.
- Paths are repository-relative. New paths below are proposed deliverables, not files
  created by this documentation-only cycle. Evidence paths are future bounded outputs.

## Path Conventions

Use existing `src/`, `test/`, and `scripts/`. Proposed focused primitives live in
`src/runtime/`; independent harnesses in `test/review-110/` and `scripts/review-110/`.
Use isolated execution roots and `evidence/review-110/<run-id>/` for immutable outputs;
never build, write, or clean in the read-only sibling evidence worktrees.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ratify the design and establish execution prerequisites without changing
product behavior. Tasks start only in a separately authorized implementation cycle.

- [ ] T001 Record explicit future execution authorization, ratify proposed thresholds/resource profile, freeze scope and named author/reviewer roles in `specs/001-mcp-runtime-review/approval.md`; unresolved default/schema drift must remain blocked.
- [ ] T002 Inventory actual local/gateway/stdio/UI/media schemas, timeout defaults, restrictions, completed replay, and unsupported routes against baseline in `test/review-110/fixtures/baseline-contract.json`; include all FR-001 through FR-016 categories and evidence links.
- [ ] T003 [P] Pin supported Node/npm/native search dependencies and native Windows/Linux runner prerequisites in `test/review-110/environment.md`; verify dependency engine compatibility and isolate config/user state.
- [ ] T004 [P] Retain/hash historical raw data and reports read-only with source revision/diff/ignored-artifact identity in `evidence/review-110/history/manifest.json`; preserve 60/443 Windows standard and 15/108 stress invalid counts and distinguish Linux summary-invalid resource attribution.

**Checkpoint**: Approval is explicit; raw history is retained; native runner gaps remain
blockers, not passes. No sibling adoption or merge is implied.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: A common isolated harness and frozen contract schema precede every story.
Product resource primitives are implemented in their owning story, not before evidence.

- [ ] T005 Create isolated subprocess/direct/stdio/gateway capture harness in `test/review-110/harness.js` with explicit target build provenance, config/temp roots, bounded diagnostics and emergency cleanup recorded separately from product cleanup.
- [ ] T006 Define evidence run/sample/gate schemas in `test/review-110/fixtures/evidence-schema.json` with `failed samples remain in raw evidence`, `unavailable metrics are null with reason`, and `candidate identity includes dirty diff hash when applicable`.
- [ ] T007 Capture and freeze baseline expectations plus narrow PID/temp-root/timestamp normalization in `test/review-110/fixtures/baseline-transcripts.json`; never normalize output, newline, errors, cursors, completeness, restrictions or exit semantics away.
- [ ] T008 Discover actual serialized ceilings and timeout layers for stdio/gateway/direct/UI/media routes in `test/review-110/fixtures/transport-policy.json`; preserve unsupported route errors and block activation where ceiling evidence is unavailable.
- [ ] T009 Run baseline self-comparison on both native platforms through `test/review-110/harness.js` and retain `evidence/review-110/foundation/self-compare.json`; prove zero false differences and fail an intentionally altered transcript.

**Checkpoint**: Foundation is ready only after oracle sensitivity and provenance are
verified. All story execution depends on T001-T009; no product acceptance is asserted.

## Phase 3: User Story 1 - Trust baseline comparison and decisions (Priority: P1) — MVP

**Goal**: Reproducible equivalent-work comparisons and honest optimization decisions.

**Independent Test**: Baseline-versus-baseline on both platforms has zero false drift;
planted failed samples, changed source identity, and missing metrics remain visible.

### Tests for User Story 1

- [ ] T010 [P] [US1] Add schema/summary correctness tests in `test/review-110/evidence-schema.test.js` for failed/warmup retention, counterbalanced order, nearest-rank p95, dirty identity, metric scope, `warmups = 5 and measured repeats = 30 by default`, and `acceptance p95 requires >= 20 successful comparable samples`.
- [ ] T011 [P] [US1] Freeze workload and protected-metric fixtures in `test/review-110/fixtures/workloads.json` for small/large/multi-file, search/context, exact/fuzzy/conditional batch edits, repeated drains, dual-stream output, background/lifetime and 1/4/16 concurrency; assert fixture/output equivalence, not merely fewer response bytes.

### Implementation for User Story 1

- [ ] T012 [US1] Implement explicit baseline/candidate CLI and counterbalanced measurement orchestration in `scripts/review-110/benchmark.js` using T005/T006/T011, immutable run roots, bounded raw logs, correctness digests and nonzero failure exits.
- [ ] T013 [US1] Add attributable process/child CPU/RSS collection, metric unavailability and final serialized byte accounting to `scripts/review-110/benchmark.js`; keep resource instrumentation separate from primary latency samples.
- [ ] T014 [US1] Implement median/p95/spread and KEEP/REVERT/INCONCLUSIVE reporting in `scripts/review-110/benchmark.js` with SC-002 thresholds, frozen primary/protected workloads, failed samples preserved and missing/noisy evidence inconclusive.
- [ ] T015 [US1] Reproduce historical background/concurrency survivors, buffer-cap wait failure, inherited pipes and slow search/read outliers in `test/review-110/history-repro.test.js`; record harness/product/environment disposition without accepting emergency cleanup as product success.
- [ ] T016 [US1] Run latest matched-harness baseline measurements on native Windows/Linux and record provenance, invalid sample rates and resource attribution in `evidence/review-110/baseline/manifest.json`; do not reuse old harness data as canonical acceptance.
- [ ] T017 [US1] Independently review equivalent-work evidence, threshold sensitivity and all historical failure families in `evidence/review-110/benchmark-review.json`; leave missing reproductions/platform metrics as blockers and each candidate decision INCONCLUSIVE until measured.

**Checkpoint**: Evidence-only MVP is useful without modifying the runtime. T010-T017
completes US1; later candidate measurements reuse this harness without moving thresholds.

## Phase 4: User Story 2 - Reliably consume bounded process output (Priority: P1)

**Goal**: Add bounded process hot paths without silently changing legacy semantics.

**Independent Test**: Deterministic emitter/interactive child proves byte completeness,
consumer ownership, observer non-consumption, wait/lifetime separation and cleanup.

### Tests for User Story 2

- [ ] T018 [P] [US2] Add process contract cases in `test/review-110/process-contract.test.js` for legacy completed replay/absolute/tail, partial-line suffixes, exhausted-first-line cursor arithmetic, evicted cursor offsets, initial-tail acknowledgement, close-after-exit data, split UTF-8, nonzero fast exit and spawn error.
- [ ] T019 [P] [US2] Add policy/spill/queue boundary and fault cases in `test/review-110/resource-policy.test.js` for below/equal/above every contract limit, disk full/permissions/deleted spill, cancellation, FIFO stdin, cursor conflict, runtime restart and resource reservation release.

### Implementation for User Story 2

- [ ] T020 [US2] Implement finite centralized opt-in policy in `src/runtime/resource-policy.ts` with `active sessions <= 16/runtime`, `retained output <= 1 MiB/session and 32 MiB/runtime`, `observer lookback <= 64 KiB/session within retained-output cap`, and `completed history <= 128 sessions with 15-minute TTL`; do not apply unapproved default drift.
- [ ] T021 [US2] Implement shared byte reservations and final-envelope fitting in `src/runtime/output-budget.ts` with `serialized text response <= 256 KiB including envelope`, UTF-8-safe content boundaries, metadata reservation and distinct media policy from T008.
- [ ] T022 [US2] Implement authorized lazy leases and failure/cleanup handling in `src/runtime/spill-store.ts` with `spill <= 64 MiB/session and 512 MiB/runtime`, `spill TTL = 15 minutes after final drain/operation completion`, `allocate lazily on overflow`, `authorize every recovery`, and `release reservation once`.
- [ ] T023 [US2] Implement raw stream records, generation cursors and bounded observers in `src/runtime/process-output.ts` with `cursor is monotonic within one consumer`, `observer reads never advance consumer cursors`, `concurrent consumes serialize per consumer`, and `stale generation is an error`; advance only delivered ranges and expose gaps/spill recovery.
- [ ] T024 [US2] Adapt `src/terminal-manager.ts` to confirmed spawn, fast-exit retention, separate call wait/lifetime, close/final-drain state, bounded history and event-driven wakeup; retain legacy pagination adapter and preserve legacy completed replay unless T001 approves evidenced drift.
- [ ] T025 [US2] Implement FIFO accepted input, writable backpressure and independently verifiable tree-kill outcomes in `src/tools/improved-process-tools.ts` with `outstanding stdin <= 256 KiB/session and 64 requests`; serialize interaction/kill races and never acknowledge partial input as complete.
- [ ] T026 [US2] Add only reviewed opt-in schemas/registration in `src/tools/schemas.ts`, `src/handlers/terminal-handlers.ts`, `src/server.ts` and `src/device/gateway-tool-adapter.ts`; preserve existing timeout/default/error schemas and virtual node-session behavior.
- [ ] T027 [US2] Wire final envelope accounting and complete/error metadata through `src/custom-stdio.ts`, `src/device/execution-engine.ts` and `src/device/gateway-channel.ts`; preserve UI/media contracts and do not label unrecoverable output complete.
- [ ] T028 [US2] Run US2 contract/boundary/concurrency tests and paired benchmarks on both platforms; retain raw output and per-process KEEP/REVERT/INCONCLUSIVE plus independent adversarial cursor/tree/spill review in `evidence/review-110/process/gate.json`.

**Checkpoint**: No process candidate is accepted merely because the focused suite passes;
T028 depends on US1 measurement readiness and all US2 tests/implementation.

## Phase 5: User Story 3 - Read, search, and edit without hidden data loss (Priority: P2)

**Goal**: Bounded opt-in file/search/exact-edit paths with retained specialized/stateful/fuzzy behavior.

**Independent Test**: Temporary resource fixtures prove ordered bounded reads, visible
matches despite context, exact preflight failures and no lost concurrent updates.

### Tests for User Story 3

- [ ] T029 [P] [US3] Add file/search/edit contract tests in `test/review-110/file-search-edit-contract.test.js` for negative/intra-line continuation, changed snapshots, huge lines, multi-file mixed errors, media/PDF/Excel, high-context hidden matches, multi-file global caps, legacy stateful search and fuzzy diagnostic preservation.
- [ ] T030 [P] [US3] Add alias/conflict/atomicity tests in `test/review-110/resource-queue.test.js` for write/append/edit/move/patch participants, canonical symlink/junction aliases, external writer changes, sorted multi-resource locks, absent/ambiguous/overlapping edits and cancellation while queued.

### Implementation for User Story 3

- [ ] T031 [US3] Implement canonical authorized FIFO queues in `src/runtime/resource-queue.ts` with `file/search work <= 4 active/runtime and 64 queued` and `per-resource mutation queue <= 64 operations`; remove cancelled waiters and lock move resources in sorted canonical order.
- [ ] T032 [US3] Implement bounded plain-text acquisition and precise snapshot/intra-line continuation in `src/tools/filesystem.ts`; use T021/T022/T031, preserve legacy read defaults, negative offsets/newlines and specialized document/media routes.
- [ ] T033 [US3] Implement input-order multi-file assembly with shared total budget and explicit per-file omission/error in `src/handlers/filesystem-handlers.ts`; replace unbounded opt-in acquisition with bounded workers, reject oversized metadata before work and avoid line-length continuation skips.
- [ ] T034 [US3] Implement additive one-shot grep/glob/native path in `src/runtime/one-shot-search.ts` with bounded partial parsing, close/error/timeout distinctions, verified fallback or explicit native-tool error and declared document-search scope.
- [ ] T035 [US3] Preserve stateful lifecycle while enforcing independent global match/context quotas in `src/search-manager.ts` with `actual match records <= 1000`, `context records <= 2000`, `maxResults counts actual matches globally, not context`, and `partial parser records are bounded by the response policy`.
- [ ] T036 [US3] Preserve typed match/context groups through final rendering in `src/handlers/search-handlers.ts` with `context cannot consume reserved match budget`; expose found/returned counts, context omission and match-limit reasons instead of blind prefix truncation.
- [ ] T037 [US3] Implement original-snapshot exact preflight/replacement in `src/runtime/exact-edit.ts` with `exact-edit opt-in input <= 16 MiB`, `all edit entries resolve against original snapshot`, `overlaps reject before mutation`, and `snapshot mismatch rejects before replacement`; retain final newline and authorize/revalidate canonical resource.
- [ ] T038 [US3] Route text write/append/edit/move operations through canonical queues and snapshot conflicts in `src/tools/filesystem.ts` and `src/tools/edit.ts`; preserve specialized range editing, legacy exact count guards and fuzzy diagnostic worker behavior.
- [ ] T039 [US3] Register reviewed bounded-read/one-shot/exact schemas and handlers in `src/tools/schemas.ts`, `src/handlers/edit-search-handlers.ts` and `src/server.ts`; keep legacy names/defaults/errors and mark unsupported hot-path scope explicitly.
- [ ] T040 [US3] Benchmark fuzzy near/missing diagnostics and 2/16/64 exact batches/patch preflight with equivalent outputs in `evidence/review-110/file-search-edit/conditional-decision.json`; classify value and record whether optional batch/patch proceeds without deleting fuzzy support.
- [ ] T041 [US3] If T040 supports KEEP, implement opt-in original-snapshot batches in `src/runtime/exact-edit.ts` with `batch entries <= 64/resource`, one preflighted replacement and no implied multi-file atomicity; otherwise record reviewed deferral in `evidence/review-110/file-search-edit/conditional-decision.json`.
- [ ] T042 [US3] If T040 supports patch scope, implement restricted authorized patch preflight in `src/runtime/apply-patch.ts` and rejection/partial-failure tests in `test/review-110/patch-contract.test.js`; otherwise record reviewed deferral without registering an unimplemented tool in `evidence/review-110/file-search-edit/conditional-decision.json`.
- [ ] T043 [US3] Run contract, alias/conflict, context-quota, media/transport and paired benchmark checks on both platforms; independently gate bounded-file, search, exact-edit and optional batch/patch increments separately in `evidence/review-110/file-search-edit/gates.json`.

**Checkpoint**: Conditional deferral is a documented disposition, not a checked
implementation claim. T043 requires T021/T022 and US1 evidence but file/search/edit
behavior can be tested independently of process hot paths.

## Phase 6: User Story 4 - Verify compatibility and boundedness under stress (Priority: P2)

**Goal**: An independent comparator and seeded resource acceptance catch real regressions.

**Independent Test**: Compare baseline with itself, then plant a schema/content/path/
cursor difference and ensure it fails; seeded stress replay yields identical operation
sequence and retains failures/resources before emergency cleanup.

### Tests for User Story 4

- [ ] T044 [P] [US4] Add comparator sensitivity/category tests in `test/review-110/compatibility.test.js` covering process/file/search/restrictions/transport/truncation/spill/concurrency/Unicode/newline/errors and approved-versus-unapproved drift, using T007 fixtures.
- [ ] T045 [P] [US4] Add stress-runner determinism/leak-detection tests in `test/review-110/stress.test.js` for persisted seeds, failure retention, logical resource growth, before-emergency-cleanup survivors, spill expiry and memory-noise calibration.

### Implementation for User Story 4

- [ ] T046 [US4] Implement baseline/candidate capture comparator in `scripts/review-110/compare.js` with narrow normalization, raw transcripts, stable case IDs, nonzero unexplained-mismatch exit and new-feature contracts separate from legacy equivalence.
- [ ] T047 [US4] Extend comparator route/restriction coverage in `scripts/review-110/compare.js` to symlink/junction/case/traversal, local/gateway/stdio/UI/media ceilings, unsupported errors, specialized reads, stateful search, virtual node and legacy offsets; missing authorized device/platform evidence is explicit NOT_MEASURED.
- [ ] T048 [US4] Implement seeded mixed workload/fault runner in `scripts/review-110/stress.js` with `>= 10000 mixed operations and >= 60 minutes per platform`, minute checkpoints, native process descendants, cancellation/reconnect, large dual streams, queue saturation and spill/native-search faults.
- [ ] T049 [US4] Implement `10 workload/cleanup cycles` and `post-cleanup RSS noise envelope = max(16 MiB, 10% warmed idle RSS)` in `scripts/review-110/stress.js`; compare matched-baseline slope confidence and require no growing handles/listeners/queues/children/spill inventory even below the RSS envelope.
- [ ] T050 [US4] Execute independent full regression and boundary matrix on both platforms with `zero unexplained mismatches`, including retained legacy API workflows and intentional-drift approvals, in `evidence/review-110/compatibility/report.json`.
- [ ] T051 [US4] Execute independent seeded stress and reproduce every historical failure family on both platforms; retain seeds, raw checkpoints, product-versus-harness cleanup and blockers in `evidence/review-110/stress/report.json`.
- [ ] T052 [US4] Review transport/path/error security and resource-growth evidence independently of candidate authors; retain missing metrics/routes and historical-failure dispositions in `evidence/review-110/compatibility/independent-review.json` before acceptance.

**Checkpoint**: Comparator/stress infrastructure is independently useful on baseline.
Candidate acceptance tasks T050-T052 depend on selected increment implementations;
missing native or real-device evidence is not silently skipped.

## Phase 7: User Story 5 - Integrate only independently accepted increments (Priority: P3)

**Goal**: Separate increment gates and a final combined gate, without unauthorized release actions.

**Independent Test**: Gate blocks a planted mismatch, missing platform, unresolved
history, rejected measurement or reviewer equal to author; material changes invalidate acceptance.

### Tests for User Story 5

- [ ] T053 [P] [US5] Add gate state/sensitivity tests in `test/review-110/gate.test.js` for proposed/evidence_pending/review_pending/accepted/rejected/blocked, missing raw evidence, INCONCLUSIVE decisions, unresolved drift and author/reviewer identity equality.
- [ ] T054 [P] [US5] Define increment/combination fixture records in `test/review-110/fixtures/gate-records.json` with `reviewer identity differs from author`, `missing platform evidence blocks acceptance`, and `material change invalidates acceptance`; include planted superficially green but leaking candidate.

### Implementation for User Story 5

- [ ] T055 [US5] Implement `scripts/review-110/gate.js` validating evidence schemas/provenance, independent identities, requirement coverage, decision thresholds, historical blockers, drift approval and native win32/linux evidence; exit nonzero unless every required gate accepts.
- [ ] T056 [US5] Record independent adversarial review of cursor/initial-output ownership, spawn/close/wait/lifetime, tree/stdin, match/context rendering, spill authorization, alias serialization and envelope limits in `evidence/review-110/adversarial/findings.json`; attach reproductions and unresolved severity blockers.
- [ ] T057 [US5] Assess shared primitives and process/file/search/exact/conditional increments individually in `evidence/review-110/increments/gates.json`; retain KEEP/REVERT/INCONCLUSIVE, reject unsupported claims and require independent sign-off before combining.
- [ ] T058 [US5] Document a separately authorized disposable combination trial in `evidence/review-110/integration/manifest.json` pinning accepted revisions/diff hashes and gate dependencies; do not merge or modify sibling worktrees and invalidate evidence after material changes.
- [ ] T059 [US5] Re-run full baseline/candidate regression, benchmark and final 10000-operation/60-minute Windows/Linux stress for the combined trial in `evidence/review-110/integration/final-gate.json`; individual green increments do not substitute for this gate.
- [ ] T060 [US5] Produce release-eligibility-only review in `evidence/review-110/integration/decision.md` with all blockers, historical dispositions and independent approval; explicitly prohibit publish/tag/release/deploy/push/merge without separate authorization.

**Checkpoint**: T055 can be tested with fixtures independently. Real increment and
combination acceptance requires US1-US4 outputs, not task generation or short tests.

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verify documentation, scope and acceptance traceability; no release action.

- [ ] T061 [P] Update approved effective policy, actual implemented CLI usage and expected output in `specs/001-mcp-runtime-review/quickstart.md`; remove planned-only caveats only after commands exist and are verified.
- [ ] T062 Reconcile FR-001 through FR-016 and SC-001 through SC-006 with raw acceptance/gate results in `specs/001-mcp-runtime-review/acceptance-traceability.md`; include deferred optional work and missing evidence explicitly.
- [ ] T063 Run the verified quickstart commands and existing `npm test`/`npm run test:integration` in isolated authorized Windows/Linux trial roots; retain actual suite counts, failures and scope cleanliness in `evidence/review-110/final-validation.json` without publishing or merging.
- [ ] T064 Record final artifact hashes, unchanged release metadata and authorization limits in `evidence/review-110/stop-report.md`; stop for independent human review rather than committing, pushing, tagging, publishing, deploying or merging.

## Dependencies & Execution Order

### Phase Dependencies

Setup T001-T004 -> Foundation T005-T009 -> independently buildable story infrastructure.
US1 evidence readiness precedes product optimization decisions. T020-T023 are shared
resource prerequisite units for US3; T031 is prerequisite to file/edit mutation changes.
US4 infrastructure can start after foundation; its acceptance execution waits for
selected US2/US3 candidates. US5 fixture tests can start after foundation, real acceptance
waits for US1-US4 evidence. Final polish follows completed desired scope and final gates.

### User Story Dependencies

```text
Setup -> Foundation -> US1 evidence MVP
                   -> US2 process -> process gate (needs US1)
                   -> US3 files/search/edit (needs US2 shared primitives, not process lifecycle)
                   -> US4 comparator/stress infrastructure
                   -> US5 gate infrastructure
US1 + selected US2/US3 + US4 execution -> US5 increment/combination acceptance -> Polish
```

US3's tests can use primitives without launching a process; US4 and US5 infrastructure
can be validated against baseline/fixtures. Independent testability does not mean an
acceptance gate can disregard a required dependency.

### Within Each User Story

Tests/fixtures before implementation. Keep failing additive behavior separate from
baseline bugs requiring drift approval. Run exact listed test files with Node after
building in authorized execution roots. No test failure is resolved by weakening the
contract or dropping failed samples. Source edits in shared `schemas.ts`, `server.ts`,
filesystem tools, managers and transport adapters must be sequenced, not raced.

### Parallel Opportunities

- Setup: T003 and T004 after T001/T002.
- US1: T010 and T011 after foundation.
- US2: T018 and T019 after foundation; implementation T020-T027 is dependency-ordered.
- US3: T029 and T030 after foundation; share no test file.
- US4: T044 and T045 after foundation; comparator and stress implementation use separate
  files but acceptance cannot run before candidate readiness.
- US5: T053 and T054 after foundation; gate execution waits on both.
- Final: T061 can run beside evidence-only reporting if no peer writes quickstart.

## Parallel Examples per User Story

```text
US1: T010 evidence-schema.test.js || T011 fixtures/workloads.json
US2: T018 process-contract.test.js || T019 resource-policy.test.js
US3: T029 file-search-edit-contract.test.js || T030 resource-queue.test.js
US4: T044 compatibility.test.js || T045 stress.test.js
US5: T053 gate.test.js || T054 fixtures/gate-records.json
```

## Implementation Strategy

### MVP First (User Story 1 Only)

After separate authorization, complete Setup/Foundation and US1; stop and validate the
baseline evidence/comparison MVP. This provides review value without a product optimization
or release. Do not deploy as a substitute for missing acceptance.

### Incremental Delivery

Freeze contracts/evidence -> gate shared policy primitives -> process -> bounded reads ->
one-shot search -> exact edit -> measured conditional batch/patch. Run independent
compatibility, benchmark and adversarial gates for every increment. Finish with combined
native Windows/Linux sustained stress. Reject or defer failed/inconclusive increments.

### Parallel Team Strategy

Independent evidence/comparator/stress/gate test writers can work after foundation;
product developers must coordinate shared adapters and resource primitives. Reviewers
must not approve their own candidate. Native runners produce separate comparable datasets,
not cross-host speed ratios. No commit, merge, publish or deployment step is authorized
by this task list.

## Coverage and Completion Summary

| Requirement | Tasks |
| --- | --- |
| FR-001 baseline/provenance | T002, T004-T009, T012, T016 |
| FR-002 preservation/drift | T001-T002, T007, T026, T039, T046, T050, T055 |
| FR-003 cursors/consumption | T018, T023-T024, T028, T056 |
| FR-004 wait/lifetime/stdin/kill | T018-T019, T024-T026, T028 |
| FR-005 resource/spill bounds | T019-T025, T028, T048-T049 |
| FR-006 bounded file reads | T029, T031-T033, T043 |
| FR-007 search/context/legacy | T029, T034-T036, T039, T043 |
| FR-008 exact edit/serialization | T030-T031, T037-T039, T043 |
| FR-009 fuzzy/batch/patch evidence | T011, T029-T030, T038, T040-T042 |
| FR-010 restrictions/errors | T002, T008, T019, T022, T030-T039, T047, T052 |
| FR-011 full transport | T008, T021, T027, T033, T036, T047 |
| FR-012 workload/platform benchmarks | T003, T010-T014, T016-T017, T028, T040, T043 |
| FR-013 metrics/decisions | T006, T010, T012-T014, T017, T057 |
| FR-014 compatibility/stress | T044-T052, T059, T063 |
| FR-015 history/adversarial/final stress | T004, T015-T017, T051-T052, T056, T059-T060 |
| FR-016 incremental gates/stop | T001, T053-T064 |
| SC-001 zero unexplained drift | T044-T047, T050, T055, T059 |
| SC-002 measured decisions | T010-T014, T017, T028, T040, T043, T057 |
| SC-003 boundary/recovery | T019, T029-T030, T028, T043, T048 |
| SC-004 sustained stress/leaks/growth | T045, T048-T051, T059 |
| SC-005 historical/platform blockers | T003-T004, T015-T017, T051-T052, T055 |
| SC-006 legacy workflows/traceability | T002, T007, T050, T062-T064 |

Total: 64 future tasks. Setup 4; Foundation 5; US1 8; US2 11; US3 15; US4 9;
US5 8; Polish 4. All remain unchecked. Conditional tasks require a documented reviewed
disposition; do not falsely mark implementation done when the branch is deferred.

## Notes

STOPPED BEFORE IMPLEMENTATION. This cycle generated artifacts only. No task above has
been executed, and no implementation handoff, analyze stage, checklist command, commit,
push, merge, publish, tag, release, or deploy is invoked after task generation.
