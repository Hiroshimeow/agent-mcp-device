---
description: "Round 4 future tasks: immutable source/build lineage; no task executed"
---
# Tasks: MCP Device 1.0.10 Runtime and Compatibility Review

**Input**: [spec](spec.md), [plan](plan.md), [research](research.md), [model](data-model.md),
[runtime](contracts/runtime-contract.md), [output](contracts/process-output-contract.md),
[lineage](contracts/round3-execution-contract.md), [evidence](contracts/evidence-contract.md).
**1.0.10 scope amendment**: Aggregate resource accounting is **Deferred -> 1.0.11**.
T034-T038 (Process sessionNonce, raw global ranges, per-stream text ranges and their
composition/acceptance gates) are **Deferred -> 1.0.11**, not shipped in 1.0.10.
Historical trial checkmarks below do not establish shipped runtime enforcement:
`resource-accounting.ts` was removed because it was not integrated. T030-T033 and
aggregate portions of T039-T049/T058 remain historical trial records only; no
all-route or aggregate memory/count/disk guarantee is made. See
`evidence/1.0.10/claims-matrix.md` for current release verification.

**Status**: Historical planning/trial record; not a release completion checklist. [Owner matrix](owner-decisions.md)
is canonical for AUTH/OD direct blockers; dependencies inherit prerequisites transitively.
**Tests**: Required. Oracle before code; runtime execution only with current build BP below.

## Format / roots / mandatory build protocol BP

Every task lists Depends, root/path and output. Paths with root aliases refer only to
future isolated roots defined by lineage contract, never current integrate or siblings.
ORIGINAL and ACCEPTED roots immutable; tests go in identified ORACLE/WORK clones.
`evidence/110/` is bounded output under authorization, not product source.

**BP**: Before any runtime test/benchmark/gate: writable BUILD_ROOT of exact source;
pinned Node/npm; locked `npm ci` including recorded prepare effects; explicit `npm run build`;
verify source/lock unchanged, record dependency restore/build exit/log hash/distTreeHash;
verify current source↔build↔dist before launch. Source/input changes invalidate build and
require BP again. Pure JS oracle changes only overlay identity if build inputs unchanged.
Every task saying BP invokes the full protocol, never uses stale dist. Compound npm test
scripts are split into build -> record/guard -> direct Node runner, per lineage contract;
no runtime launch before the post-build checkpoint, including nested rebuilds. Gate binds source,
build, oracle, dependency, harness and evidence identities. Build failures block task.

## Phase A — Setup: inventory/provenance

- [x] T001 Record AUTH-D proposal and request bounded human discovery permission in `specs/001-mcp-runtime-review/owner-decisions.md`; Depends: none; output `evidence/110/auth/discovery.json`; PENDING is not permission.
- [x] T002 Freeze baseline ee87d0f3057e01e8087db99615d14bd1b4c626d4 surfaces/stdio status/Gateway policy and mappings in `evidence/110/inventory/surfaces.json`; Depends: T001 and approved AUTH-D; inspect package.json, README.md, src/mcp-device.ts and read-only Gateway scripts.
- [x] T003 Inventory bootstrap/topology/context/security import/read/write/classification and exact tests/rollback in `evidence/110/inventory/runtime-seams.json`; Depends: T002; paths `src/bootstrap.ts`, `src/index.ts`, `src/mcp-device.ts`, `src/server.ts`, `src/device/device.ts`, `src/device/execution-engine.ts` plus minimum lineage seam list; output refinement checkpoint freezes all discovered paths before edits.
- [x] T004 Capture file 2968280+6a5f43f, process baseline+tracked binary patch+untracked paths/bytes/modes, bench d388843 and compat fixture identities in `evidence/110/candidates/originals.json`; Depends: T003; archive historical dirty results separately, lane DONE not final acceptance.

## Phase B — Foundational: immutable materialization

- [x] T005 Allocate safe empty root map in `evidence/110/trials/roots.json`; Depends: T004; every ORIGINAL/ORACLE/WORK/DOMAIN/BUILD/COMBINED root outside integrate/siblings/Gateway; reject traversal and symlink escapes.
- [x] T006 Materialize immutable BASE_ORIGINAL and FILE_ORIGINAL exact Git archives, verifying full 6a5f43fdfdee1774c3c18458b5cebe58f11b2751 tree and 29682809b8ac7c8a8ac76bfb58375651389bb815 ancestry in `evidence/110/trials/base-file.json`; Depends: T005.
- [x] T007 Materialize immutable PROCESS_ORIGINAL baseline+captured tracked binary patch+captured untracked file bytes/modes, and BENCH_ORIGINAL d388843ba5c374e6d06a61d7ebbdb06fff0ff68a source without dirty result overlay in `evidence/110/trials/process-bench.json`; Depends: T006; mismatch stops.
- [x] T008 Materialize immutable COMPAT_ORIGINAL fixture overlay and derive BASE/FILE/PROCESS_ORACLE, BENCH_WORK, COMPAT_WORK with separate overlay manifests in `evidence/110/trials/oracles.json`; Depends: T007; product hashes equal originals until explicit source composition, never edit ORIGINAL.
- [x] T009 Verify all materialization/hash/root/refinement prerequisites in `evidence/110/trials/materialization-gate.json`; Depends: T008; record sourceTree/repositoryTree/test overlay identities and no candidate-only edit before this gate.

## Phase C — US1 Evidence/build MVP (P1)

**Goal**: Harness/provenance/sensitivity under AUTH-D, no product-semantic edits.
**Independent Test**: Original source/build with separate oracles self-compares and planted drift fails.

- [x] T010 [P] [US1] Write stale-source/stale-dist/prepare/overlay provenance oracles in `BENCH_WORK/bench/test/core.test.mjs`; Depends: T009; output `evidence/110/oracles/build-guard.json`.
- [x] T011 [P] [US1] Freeze baseline mapped schema/line-session/security cases in `COMPAT_WORK/test/compat/compat-contract-v1.0.9.json`; Depends: T009; output oracle hash manifest, migration comparator distinct from final retained adapter.
- [x] T012 [US1] Implement BP identity/target loading in `BENCH_WORK/bench/lib/core.mjs`, `BENCH_WORK/bench/lib/mcp-stdio.mjs`, `BENCH_WORK/bench/lib/fixtures.mjs`; Depends: T010,T011; output `evidence/110/harness/build-identity.json`; no product source edits.
- [x] T013 [US1] Perform BP for baseline/file/process original source copies and harness dependencies under AUTH-D; Depends: T012; output per-target `evidence/110/builds/originals.json` with source/lock/Node/npm/restore/command/exit/dist/log hashes, originals unchanged.
- [x] T014 [US1] Implement missing runner/comparator in `COMPAT_WORK/test/compat/run.mjs`, `COMPAT_WORK/test/compat/compare.mjs`, reusing existing bench helpers; Depends: T013; BP-guarded baseline-self and planted-drift tests output `evidence/110/oracle/sensitivity.json`.
- [x] T015 [US1] Add original-candidate oracles only to `PROCESS_ORACLE/test/test-process-runtime-110.js`, `PROCESS_ORACLE/test/test-read-completed-process.js`, `FILE_ORACLE/test/test-file-search-edit-compact.js`; Depends: T014; output overlay hashes separately from unchanged product source hashes.
- [x] T016 [US1] Compare FILE_ORIGINAL/PROCESS_ORIGINAL product builds with T015 overlay, no architecture/core bundles, via BP guard; Depends: T015; output `evidence/110/candidates/original-reconciliation.json` keep/revise/revert/static-risk dispositions with exact source/build/oracle IDs.
- [x] T017 [US1] Extend `BENCH_WORK/bench/run.mjs`, `BENCH_WORK/bench/lib/resource-preload.cjs`, `BENCH_WORK/bench/scenarios/all.mjs` for discovery calibration/raw attribution within AUTH-D (AUTH-N for real devices); Depends: T016; output `evidence/110/discovery/profile-proposal.json`, safety exhaustion explicit, no acceptance thresholds approved.
- [x] T018 (automated checks only; independent signoff required in `E:/git-project/mcp110-execution-01a1040a/evidence/110/discovery/mvp-gate.json`) [US1] Independently gate bounded discovery/provenance/self-compare/planted drift/failure retention/attribution in `evidence/110/discovery/mvp-gate.json`; Depends: T017; BP bound; no OD-3A approval implied and no product change.

## Phase D/E — US6 Decisions and canonical architecture (P1)

**Goal**: Required human choices, then tested minimum bootstrap/context/direct runtime.
**Independent Test**: Fresh-process init, mappings, no-child and lifecycle on exact architecture build.

- [x] T019 [US6] Request AUTH-A, OD-3A/OD-3B and OD-4 choices, record actual GOV-1 status without ratification in `specs/001-mcp-runtime-review/owner-decisions.md`; Depends: T018; output `evidence/110/auth/architecture.json`; no optional OD-3C dependency.
- [x] T020 [US6] Derive ARCH_WORK from BASE_ORIGINAL with architecture oracle overlay; Depends: T019 record plus approved AUTH-A and OD-4; OD-3A/B required only at acceptance gates per matrix; write bootstrap/user UV override/config/remote-feature/log/error/PDF/lifecycle/mapped route tests in `ARCH_WORK/test/compat/test-architecture.mjs`; output source+overlay manifest, BP red baseline cases.
- [x] T021 [US6] Preserve earliest bootstrap and runtime init in `ARCH_WORK/src/mcp-device.ts`, `ARCH_WORK/src/bootstrap.ts`, `ARCH_WORK/src/npm-scripts/remote.ts`; Depends: T020; BP fresh-process/native FS oracles; output `evidence/110/architecture/bootstrap.json`.
- [x] T022 [US6] Extract trial canonical invocation in `ARCH_WORK/src/server.ts` and conditional `ARCH_WORK/src/tool-dispatcher.ts`; Depends: T021; exact seam rationale, no duplicate handlers/global origin; BP and output `evidence/110/architecture/dispatch-trial.json`, not accepted yet.
- [x] T023 [US6] Migrate security/config/local-client seams in `ARCH_WORK/src/tools/filesystem.ts`, `ARCH_WORK/src/handlers/filesystem-handlers.ts`, `ARCH_WORK/src/config-manager.ts`, `ARCH_WORK/src/tools/config.ts`, `ARCH_WORK/src/utils/feature-flags.ts`; Depends: T022; BP and output `evidence/110/architecture/security-config.json` preserving trusted context/remote restrictions.
- [x] T024 [US6] Migrate telemetry/history/log/error/PDF seams in `ARCH_WORK/src/utils/usageTracker.ts`, `ARCH_WORK/src/utils/trackTools.ts`, `ARCH_WORK/src/utils/capture.ts`, `ARCH_WORK/src/utils/toolHistory.ts`, `ARCH_WORK/src/utils/logger.ts`, `ARCH_WORK/src/error-handlers.ts`, `ARCH_WORK/src/tools/pdf/markdown.ts`; Depends: T023; BP/no duplicate listeners/downloads, output `evidence/110/architecture/context.json`.
- [x] T025 [US6] Wire retained/migration adapters under OD-4 in `ARCH_WORK/src/server.ts`, `ARCH_WORK/src/index.ts`; Depends: T024; BP and independent extraction/bootstrap/context gate `evidence/110/architecture/extraction-gate.json` before direct Gateway adoption.
- [x] T026 [US6] Route Gateway directly and migrate readiness/generation/cwd/shutdown/reconnect/update nullable child PID in `ARCH_WORK/src/device/gateway-tool-adapter.ts`, `ARCH_WORK/src/device/device.ts`; Depends: T025; BP and output `evidence/110/architecture/direct-gateway.json`, preserve mapped units/errors, no hidden self fallback.
- [x] T027 [US6] Retire internal client/self-child and conditionally remove `ARCH_WORK/src/device/execution-engine.ts` only after caller migration including `ARCH_WORK/test/test-execution-engine-hardening.js`, `ARCH_WORK/test/test-gateway-device-channel.js`; Depends: T026; BP/rerun impacted extraction gates and output `evidence/110/architecture/removal.json`.
- [x] T028 [US6] Independently run native no-child/startup process-count/RSS/time/latency/serialization/bootstrap/security/lifecycle gates through `BENCH_WORK/bench/scenarios/all.mjs`; Depends: T027; BP exact build, AUTH-N if real calls; output `evidence/110/architecture/acceptance.json` with protected costs, no mandatory speed win.
- [x] T029 [US6] Freeze ARCH_ACCEPTED source/build/oracle/evidence and exact architecture path/import acceptance surface in `evidence/110/architecture/accepted-parent.json`; Depends: T028; all later work derives copies, parent never mutated.

## Phase F — US2 Accounting core on derived parent (P1)

**Goal**: Synthetic core proof on accepted topology, not full route guarantee.
**Independent Test**: Reserve/count/byte/age fault tests; inherited architecture revalidated after changes.

- [x] T030 [US2] Obtain AUTH-R/OD-1 and derive CORE_WORK from immutable ARCH_ACCEPTED; Depends: T029; freeze synthetic reservation/count/age tests in `CORE_WORK/test/compat/test-accounting-core.mjs`; output `evidence/110/core/trial.json`.
- [x] T031 [US2] Implement narrow core in `CORE_WORK/src/utils/resource-accounting.ts` with existing-helper insufficiency rationale; Depends: T030; per-instance bounded reservations/release, BP and output `evidence/110/core/build-tests.json`.
- [x] T032 [US2] Independently gate core synthetic failures and rerun stale architecture gates using BP exact CORE_WORK; Depends: T031; output `evidence/110/core/gate.json`, explicitly no all-route claim.
- [x] T033 [US2] Freeze ARCH_CORE_ACCEPTED source/build/dependency/oracle tuple in `evidence/110/core/accepted-parent.json`; Depends: T032; parent immutable, inherited acceptance valid only for this tuple.

## Phase G/H — US2 Process composition/hardening (P1)

**Goal**: Original comparison already T016; now exact composition then repairs/session identity.
**Independent Test**: Parent invariants, strict per-stream/raw examples, PID reuse and legacy line adapter.

- [ ] T034 [Deferred -> 1.0.11] [US2] Obtain OD-2; compose PROCESS_DOMAIN from ARCH_CORE_ACCEPTED plus baseline-relative PROCESS_ORIGINAL production delta and separate domain oracle overlay; Depends: T033,T016; three-way conflict review, especially Gateway adapter, output `evidence/110/process/composition.json` with parent/conflict/source/overlay hashes and BP/inherited re-gates before hardening.
- [ ] T035 [Deferred -> 1.0.11] [US2] Freeze output-contract five byte examples plus fixed-fence/valid-prefix pending and text/raw replay-at-envelope-cap before/after exit/EOF/termination, grant-profile change/bound-violation, PID-reuse/EOF/root-pipe/line-Gateway oracles in `PROCESS_DOMAIN/test/compat/test-output-contract.mjs`; Depends: T034; oracle first, BP red cases, output `evidence/110/process/oracles.json`.
- [ ] T036 [Deferred -> 1.0.11] [US2] Harden proven output/lifetime/stdin/accounting gaps in `PROCESS_DOMAIN/src/terminal-manager.ts`, `PROCESS_DOMAIN/src/types.ts`, `PROCESS_DOMAIN/src/tools/improved-process-tools.ts`, `PROCESS_DOMAIN/src/tools/schemas.ts`; implement immutable device key lookup across read/interact/terminate in `PROCESS_DOMAIN/src/device/gateway-tool-adapter.ts`; Depends: T035; raw global/text per-stream semantics, PID attribute only, legacy PID/line adapter separate, conditional `PROCESS_DOMAIN/src/utils/spill-store.ts` only justified; new source hash/BP and output `evidence/110/process/hardened.json`.
- [ ] T037 [Deferred -> 1.0.11] [US2] Independently gate native process/session-reuse/raw-text/accounting/lease/tree/root-pipe and stale architecture/core reruns; Depends: T036; BP, OD-3A/B and AUTH-N where needed; output `evidence/110/process/domain-gate.json`, not unchanged original evidence.
- [ ] T038 [Deferred -> 1.0.11] [US2] Measure paired protected costs/performance separately and freeze PROCESS_ACCEPTED delta/source/build/overlay/dependency IDs in `evidence/110/process/accepted.json`; Depends: T037; BP, no fix speed-win prerequisite.

## Phase I/J — US3 File/search/edit and remaining domain adoption (P2)

**Goal**: Exact accepted lane input on accepted architecture/core, separate route rollback/gates.
**Independent Test**: Read/search/edit/media/envelope cases preserve required semantics and approved budgets.

- [x] T039 [US3] Compose FILE_DOMAIN from ARCH_CORE_ACCEPTED plus baseline-relative FILE_ORIGINAL production delta; Depends: T033,T016; three-way exact conflict review, separate domain oracle overlay, BP/inherited gates; output `evidence/110/file/composition.json` before edits.
- [x] T040 [US3] Freeze read/continuation/context/oversize/search/fuzzy/exact/alias/external-race/metadata oracles in `FILE_DOMAIN/test/test-file-search-edit-compact.js`, `FILE_DOMAIN/test/compat/test-edit-races.mjs`; Depends: T039; output `evidence/110/file/oracles.json`, not original overlay identity.
- [x] T041 [US3] Harden demonstrated acquisition/response/continuation/file-lease/media allocation gaps in `FILE_DOMAIN/src/tools/filesystem.ts`, `FILE_DOMAIN/src/handlers/filesystem-handlers.ts`, `FILE_DOMAIN/src/utils/output-budget.ts`, `FILE_DOMAIN/src/tools/pdf/markdown.ts` under OD-1; Depends: T040; BP, inherited gates and independent read/media gate `evidence/110/file/read-gate.json`.
- [x] T042 [US3] Harden typed match-first/search parser/stderr/order/weak consistency in `FILE_DOMAIN/src/search-manager.ts`, `FILE_DOMAIN/src/handlers/search-handlers.ts`; Depends: T041; BP/inherited/native search gate `evidence/110/file/search-gate.json`, no context-hidden match.
- [x] T043 [US3] Harden canonical mutation/replacement expansion/sequential batch guards in `FILE_DOMAIN/src/tools/edit.ts`, `FILE_DOMAIN/src/tools/filesystem.ts`; Depends: T042; BP/inherited/native exact/fuzzy/cost gate then freeze FILE_ACCEPTED source/build/overlay/delta in `evidence/110/file/accepted.json`; best-effort external conflict only.
- [x] T044 [US3] Derive MEDIA_DOMAIN from immutable ARCH_CORE_ACCEPTED, freeze parent shell/image/project/envelope oracles in `MEDIA_DOMAIN/test/compat/test-media-envelope.mjs`; Depends: T033; output `evidence/110/media/trial.json`, no mutation of ARCH_ACCEPTED.
- [x] T045 [US3] Adopt parent native/media capture and complete envelope budgets in `MEDIA_DOMAIN/src/device/gateway-tool-adapter.ts`, `MEDIA_DOMAIN/src/device/project-inspection.ts`, `MEDIA_DOMAIN/src/device/gateway-channel.ts`, conditional OD-4-retained `MEDIA_DOMAIN/src/custom-stdio.ts`, canonical result boundary `MEDIA_DOMAIN/src/tool-dispatcher.ts` if extracted else `MEDIA_DOMAIN/src/server.ts`; Depends: T044; source changes stale architecture, BP; output `evidence/110/media/hardened.json` with 48 KiB policy/lower grant/full envelope accounting.
- [x] T046 [US3] Independently rerun native media/envelope/accounting plus affected architecture/core gates and freeze MEDIA_ACCEPTED in `evidence/110/media/accepted.json`; Depends: T045; BP, OD-3A/B, AUTH-N for real routes; retired stdio not final support requirement.

## Phase K — US3 One combined all-route verification (P2)

**Goal**: No unspecified accounting root; exact accepted domains compose before full coverage claim.
**Independent Test**: Cross-domain bypass/combined conflict fixtures and architecture reruns on exact build.

- [x] T047 [US3] Compose COMBINED_TRIAL from ARCH_CORE_ACCEPTED then PROCESS_ACCEPTED, FILE_ACCEPTED, MEDIA_ACCEPTED deltas in declared order with three-way conflict review; Depends: T038,T043,T046; output `evidence/110/combined/composition-v1.json`, fail ambiguity, new source hash and BP.
- [x] T048 [US3] Rerun affected architecture/core/route gates after composition and verify exact approved coverage matrix in `evidence/110/combined/inherited-gates-v1.json`; Depends: T047; BP and source/build/oracle/parent binding, no individual pass inheritance without rerun.
- [x] T049 [US3] Independently prove all-covered-route per-instance enforcement and freeze COMBINED_V1 identity in `evidence/110/combined/all-route-v1.json`; Depends: T048; BP, no synthetic-core-to-runtime inference or device-wide broker claim.

## Phase L — US3 Optional oracle/prototype/value/delivery (P2)

**Goal**: Optional scope independent of required architecture; deferral is a recorded path.
**Independent Test**: Frozen semantics oracle precedes code; equivalent prototype before measurement.

- [x] T050 [US3] Obtain OD-3C-E exploration scope or record deferral; if allowed derive OPTIONAL_WORK from FILE_ACCEPTED and freeze oracle in `OPTIONAL_WORK/test/compat/test-prototypes.mjs`; Depends: T043; output `evidence/110/optional/scope-oracle.json`, no original/accepted mutation.
- [ ] T051 [NOT_SELECTED] Build isolated unregistered prototype adapting `OPTIONAL_WORK/src/tools/edit.ts` after oracle.
- [ ] T052 [NOT_SELECTED] Measure equivalent prototype/single/sequential/fuzzy costs via `BENCH_WORK/bench/scenarios/all.mjs`.
- [x] T053 [US3] Request OD-3C-D scope/deferral from measurements in `specs/001-mcp-runtime-review/owner-decisions.md`; Depends: T052 if explored, otherwise T050 deferral; output `evidence/110/optional/disposition.json`; exploration deferral needs neither measurements nor OD-3C-D approval, unapproved branch cannot deliver.
- [ ] T054 [NOT_SELECTED] If approved, harden chosen optional delta in derived OPTIONAL_WORK `src/tools/edit.ts`, `src/tools/schemas.ts`, `src/handlers/edit-search-handlers.ts`.
- [x] T055 [US3] Independently gate optional native behavior/cost, freeze accepted delta, then create new COMBINED_TRIAL revision from COMBINED_V1 plus optional delta with conflict review/BP/all affected gates/all-route rerun in `evidence/110/combined/final-scope.json`; Depends: T049,T054 if delivering, otherwise T049,T053 deferral; always output final-scope record; deferred branch points to V1 unchanged and runs no optional gate/recomposition. Completing this record does not complete skipped T051/T052/T054.

## Phase M/N — US4 Independent final compatibility/adversarial/stress (P2)

**Goal**: Exact final combined source/build tested independently; histories and failures retained.
**Independent Test**: Planted mismatch/leak and stale source/build fixtures fail gate; seeds replay.

- [x] T056 [US4] Add three-class/stale-build/parent/route/owner-gate sensitivity fixtures in `COMPAT_WORK/test/compat/test-gates.mjs` and extend `COMPAT_WORK/test/compat/compare.mjs`; Depends: T018; output `evidence/110/independent/gate-oracles.json`, correctness accepted without speed win, not without protected-cost evidence.
- [x] T057 [US4] Select exact final scope record T055 (new accepted revision or unchanged V1 on recorded deferral), immutable source/build/oracle tuple and independent reviewers in `evidence/110/independent/final-target.json`; Depends: T055,T056; no source edits during evidence run, retired stdio only migration comparator if required.
- [x] T058 [US4] Run BP-guarded final baseline/retained-route/Gateway/session/bootstrap/no-child/resource/leak/growth/native Windows+Linux sustained stress and independent adversarial/history disposition via `COMPAT_WORK/test/compat/run.mjs`, `BENCH_WORK/bench/scenarios/all.mjs`; Depends: T057; output `evidence/110/independent/final-gate.json`; source changes require new final target and affected reruns, no emergency cleanup-as-product proof.

## Final Phase — US5 eligibility dependencies then final stop (P3)

**Goal**: Final eligibility after all evidence/docs/traceability/regression, never before polish.
**Independent Test**: Eligibility evaluator rejects any stale/missing owner/native/build/traceability input.

- [x] T059 [US5] Update verified commands/support/policy in `specs/001-mcp-runtime-review/quickstart.md`; Depends: T058; output documentation hash, no product source mutation.
- [x] T060 [US5] Map FR-001..FR-027/SC-001..SC-007 to exact accepted evidence or approved deferral in `specs/001-mcp-runtime-review/acceptance-traceability.md`; Depends: T059; output traceability hash, no unsupported pass.
- [x] T061 [US5] Verify final native regression/build/source/dist/oracle/evidence/release-metadata cleanliness under BP in `evidence/110/final-validation.json`; Depends: T060; split build/guard/direct Node runners per BP (never opaque npm test scripts); verify nested launches guarded, recheck after execution, rerun affected gates on any artifact mutation before eligibility.
- [x] T062 [US5] Produce single final eligibility+provenance report in `evidence/110/eligibility-stop.md`; Depends: T061 and all final target gates current; record AUTH/OD/GOV actual status, independent approvals/blockers; no release/repository action follows.

## Dependencies, parallel examples and implementation strategy

Canonical decision matrix owner-decisions.md defines direct AUTH/OD requirements; no other
phase summaries redefine ranges. Depends IDs propagate source/evidence prerequisites.
A/B materialization -> US1 build/evidence MVP -> US6 immutable architecture -> US2 immutable
core -> PROCESS/FILE/MEDIA derived composition -> accepted domains -> one combined/all-route
proof -> optional new combined revision or explicit deferral -> independent final target ->
docs/traceability/regression -> single eligibility stop. No source edit to accepted parents.

US1 T010||T011 are independent after T009. Other work serial by default; independent FILE/
MEDIA author work can be staffed only with separate derived roots, but their gates still
wait exact prerequisites. US2/US3 oracles and US4/US5 gate fixtures may be authored on their
isolated roots before candidate acceptance; runtime tests require BP and authorization.
MVP is evidence-only; no product semantics change. Domain tests useful independently on
accepted parent compositions. Optional deferral leaves T051/T052/T054 implementation checkboxes unchecked with NOT_SELECTED
and still produces T050/T053/T055 disposition/final-scope outputs; completing those records
is not a fabricated implementation completion. New source files need seam rationale.

## Coverage Summary

| Key | Task IDs |
| --- | --- |
| FR-001 | T002-T009,T015-T016,T034,T039 |
| FR-002 | T011,T014,T019-T029,T035-T038,T040-T049,T058 |
| FR-003 | T035-T038 |
| FR-004 | T035-T038 |
| FR-005 | T030-T038,T040-T049 |
| FR-006 | T040-T041,T043 |
| FR-007 | T040,T042-T043 |
| FR-008 | T040,T043,T050-T055 |
| FR-009 | T043,T050-T055 |
| FR-010 | T003,T020,T023-T029,T035,T040-T049,T058 |
| FR-011 | T011,T017,T041,T044-T049 |
| FR-012 | T010-T018,T028,T038,T052,T058 |
| FR-013 | T017-T019,T028,T056-T058 |
| FR-014 | T014,T020,T025,T028,T035,T040,T056-T058 |
| FR-015 | T004,T018,T058 |
| FR-016 | T047-T049,T055-T062 |
| FR-017 | T019-T029 |
| FR-018 | T026-T029,T058 |
| FR-019 | T003,T020-T029,T058 |
| FR-020 | T003,T020-T021,T024-T029 |
| FR-021 | T004-T009,T034,T039,T044,T047 |
| FR-022 | T029-T033,T037,T043,T046-T049,T055,T058 |
| FR-023 | T011,T035-T038 |
| FR-024 | T010,T012-T014,T028-T029,T033-T038,T047-T049,T057-T062 |
| FR-025 | T006-T009,T015-T016,T029-T034,T039,T044,T047,T055 |
| FR-026 | T001,T017-T019,T030,T050,T053,T056 |
| FR-027 | T035-T038,T058 |
| SC-001 | T014,T028,T037,T043,T046,T058,T061 |
| SC-002 | T018-T019,T028,T038,T052,T056-T062 |
| SC-003 | T030-T032,T035,T040,T044-T049,T058 |
| SC-004 | T017,T019,T058,T061 |
| SC-005 | T004,T018,T058,T062 |
| SC-006 | T011,T019,T058-T062 |
| SC-007 | T020-T029,T058,T061 |

62 future tasks: setup4/foundation5, US1 9, US6 11, US2 9, US3 17, US4 3, US5 4.
Historical checks are not release acceptance. Explicit deferred tasks remain unchecked.
No implementation permission or owner approval is inferred from this record.

# HUMAN REVIEW STOP
