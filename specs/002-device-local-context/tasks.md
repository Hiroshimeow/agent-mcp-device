# Tasks: Device-local Context

**Feature**: 002-device-local-context  
**Status**: Proposed implementation backlog after Opus review round 1. All tasks remain unchecked.  
**Prerequisites**: [spec](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [context API](contracts/context-api.md), [policy](contracts/context-policy.md), [1.0.10 handoff](integration-110.md).

## Format

Every task follows `- [ ] Txxx [P?] [US?] action with exact path`. [P] means independent files after listed prerequisites, not permission to ignore gates.

## Phase 1 — Freeze implementation inputs

- [ ] T001 Record explicit implementation authorization and accepted revision-2 spec/policy decisions in `evidence/context/decisions.md`; do not infer merge/release authorization.
- [ ] T002 Refresh `evidence/context/handoff-110.json` from final 1.0.10 owner when available, including the 10 fields in `integration-110.md`; mark live-wiring tasks BLOCKED until complete.
- [ ] T003 [P] Snapshot current gateway/device tool catalog, annotations, schema bytes/token estimate and old-device capabilities in `test/context/fixtures/tool-manifest-baseline.json`.
- [ ] T004 [P] Add Node >=22.13 / `node:sqlite` / FTS5 platform probe test in `test/context/sqlite-platform.test.js` and record Windows/Linux runtime evidence in `evidence/context/sqlite-platform.md`.
- [ ] T005 Freeze numeric defaults from `contracts/context-policy.md` into `test/context/fixtures/policy-v1.json`; tests must fail if implementation silently exceeds hard bounds.
- [ ] T006 Freeze six-tool proposed manifest/actions/errors/annotations in `test/context/fixtures/context-tool-contract.json` without registering public tools yet.

**Checkpoint**: 002 independent lane may implement after T001/T004/T005/T006. T002 is not required until live capture/gateway phase.

## Phase 2 — Foundation: scope, redaction, store

- [ ] T007 [P] Write repository/worktree/clone/non-Git/ambiguous-path resolution tests in `test/context/repositories.test.js`.
- [ ] T008 [P] Write owner/re-pair/sealed-namespace/path/ref/cursor authorization tests in `test/context/access.test.js`, including wrong-scope cursor and no fallback on sandbox denial.
- [ ] T009 [P] Write canary-secret/binary/oversized/path-exclusion redaction tests in `test/context/redaction.test.js` covering DB/blob/FTS/error surfaces.
- [ ] T010 [P] Write SQLite WAL/migration/manifest/ref/cursor/generation tests in `test/context/store.test.js`, including HMAC/server-state cursor tamper and shadow rebuild publication.
- [ ] T011 Implement persistence-safe redaction/exclusion in `src/context/redact.ts`; only its output may cross into Store/blob/index.
- [ ] T012 Implement registry, owner/unscoped/repo store schema and migrations in `src/context/store.ts` and `src/context/migrations/` using built-in `node:sqlite`; no arbitrary DB path.
- [ ] T013 Implement owner/repository/worktree resolver and sealed-namespace rules in `src/context/repositories.ts`, reusing accepted path guards where available.
- [ ] T014 Implement `ContextService.status`, bounded store/job ownership and capture health model in `src/context/service.ts`; no auto scheduler.
- [ ] T015 Run independent foundation tests/review T007-T014 and retain results/hashes in `evidence/context/foundation-review.md`; reviewer must not be the implementation author.

**Checkpoint**: Scope/redaction/store are stable before importer/search/capture consumers.

## Phase 3 — User Story 1: evidence import, index, search/read (P1, independent of G-110)

**Independent test**: Q1 + retrieval portion of Q6 in `quickstart.md` on temporary state root; no gateway/live observer required.

- [ ] T016 [P] [US1] Write legacy JSONL importer tests in `test/context/import.test.js` for malformed lines, repeated import, unknown owner/repo and source preservation.
- [ ] T017 [US1] Implement idempotent legacy importer/quarantine in `src/context/importer.ts` without mutating legacy files or auto-assigning unknown owner to current pairing.
- [ ] T018 [P] [US1] Freeze retrieval ground-truth corpus in `test/context/fixtures/retrieval.json` covering Vietnamese natural language, exact path/identifier, errors, commands, negatives and cross-scope canaries.
- [ ] T019 [P] [US1] Write sync/FTS watermark tests in `test/context/indexer.test.js`: pending events, no hidden source scan, incremental generation, redacted text only, no full-copy ordinary sync.
- [ ] T020 [US1] Implement event normalization + FTS5 incremental sync/watermark in `src/context/indexer.ts`; no source-code parser.
- [ ] T021 [P] [US1] Write search/read/status tests in `test/context/retrieval.test.js` and `test/context/read.test.js` for byte budgets, Unicode, retention/redaction, cursor expiry/tamper, missing/stale index and no hidden writes.
- [ ] T022 [US1] Implement exact/FTS retrieval and evidence read in `src/context/search.ts` plus ContextService dispatch; preserve source refs/coverage and aggregate response bounds.
- [ ] T023 [US1] Run retrieval acceptance: exact path/identifier top-3 = 100%, history Recall@8 >=0.90, unauthorized hits = 0; retain raw query outcomes in `evidence/context/us1-retrieval.md`.

**Checkpoint**: Useful repo history search/read exists on imported/synthetic evidence before live capture.

## Phase 4 — User Story 2: local CLI and portable skill (P1)

**Independent test**: Q4/Q9 with gateway blocked.

- [ ] T024 [P] [US2] Write CLI/domain parity and sandbox tests in `test/context/cli.test.js`: stdout JSON, stderr redaction, exit codes, gateway offline, inaccessible state root and no permission-bypass fallback.
- [ ] T025 [US2] Implement context CLI adapter in `src/context/cli.ts` and isolated command registration seam; all operations call ContextService directly, never gateway.
- [ ] T026 [P] [US2] Write checkpoint observed-vs-reported tests in `test/context/checkpoint.test.js` with Git metadata, unsupported native command/test claims and evidence refs.
- [ ] T027 [US2] Implement checkpoint in `src/context/service.ts`; no transcript/native-tool fabrication.
- [ ] T028 [P] [US2] Write skill behavioral contract tests in `test/context/skill-contract.test.js` for search-first, selective sync, no per-turn maintenance, sandbox denial, sealed namespace and disabled wiki.
- [ ] T029 [US2] Create portable source `skills/mcp-device-context/SKILL.md` (+ minimal references if needed) using only commands already covered by CLI tests; no installer or host-specific data.
- [ ] T030 [US2] Validate manual/explicit skill discovery on approved Codex/Pi/VS Code versions and record exact versions/locations/limitations in `evidence/context/skill-compat.md`; do not claim universal auto-invocation.

## Phase 5 — User Story 3: durability, quota, concurrency, crash semantics (P1)

**Independent test**: Q3/Q7 without live observer where possible; capture fault cases can use fake observer until G-110.

- [ ] T031 [P] [US3] Write pre-intent/post-intent/post-side-effect/pre-outcome crash model tests in `test/context/event-model.test.js`, including `unknown_after_restart` and explicit capture-gap semantics.
- [ ] T032 [P] [US3] Write quota/store-count/payload-cap/metadata-reserve tests in `test/context/quota.test.js` using `policy-v1.json`; no silent old-event eviction.
- [ ] T033 [P] [US3] Write concurrent writer/busy/disk-full/corrupt-DB tests in `test/context/concurrency.test.js`, asserting capture priority, bounded wait and maintenance yield.
- [ ] T034 [P] [US3] Write generation/cursor/rebuild interruption tests in `test/context/generation.test.js`; pinned cursor behavior and last-good pointer must be explicit.
- [ ] T035 [US3] Implement quota accounting, capture-gap counters, bounded busy handling and generation publication in `src/context/store.ts`/`src/context/service.ts`.
- [ ] T036 [P] [US3] Run privacy persistence scan in `test/context/privacy.test.js` across SQLite/WAL/blob/FTS/errors; canary secrets must be absent and known coverage gaps visible.
- [ ] T037 [US3] Run independent durability/privacy review T031-T036 and retain `evidence/context/us3.md` with failures/NOT_MEASURED preserved.

## Phase 6 — User Story 4: activity relations and bounded graph (P2)

**Independent test**: Q5/Q6 activity sections; no Tree-sitter/source parser.

- [ ] T038 [P] [US4] Write activity relation truth fixtures in `test/context/activity-graph.test.js` for read/edit success/failure/dry-run/process/output/error/test/checkpoint and forbidden causal edges.
- [ ] T039 [US4] Implement typed activity nodes/edges/evidence refs in `src/context/graph.ts` and hook materialization from explicit sync only.
- [ ] T040 [P] [US4] Write high-degree/cycle/path/timeline/related traversal tests in `test/context/graph-query.test.js` with visited/examined/node/edge/time/byte assertions.
- [ ] T041 [US4] Implement bounded `neighbors/path/timeline/related` in `src/context/graph.ts` and candidate expansion integration in `src/context/search.ts`.
- [ ] T042 [P] [US4] Write index-job/no-auto-maintenance/cancel/idempotency tests in `test/context/index-jobs.test.js`; startup/read/search/status/idle must perform zero sync.
- [ ] T043 [US4] Implement sync/rebuild/cancel job semantics in `src/context/service.ts`; offline maintenance is foreground/bounded and never spawns hidden persistent worker.
- [ ] T044 [US4] Run activity graph correctness/performance acceptance and retain `evidence/context/us4.md` with actual visited/examined work counts; zero-degree traversal is not representative latency.

## Phase 7 — User Story 5A: live capture integration after G-110 (P2, BLOCKED until T002)

**Independent test**: Q2 capture lifecycle on final 1.0.10 handoff.

- [ ] T045 [P] [US5] Write live route coverage tests in `test/context/capture-routes.test.js` for file/edit/shell/process/project/image/errors and `local_*` observer exclusion.
- [ ] T046 [P] [US5] Write capture fault-injection tests in `test/context/capture-faults.test.js` for pre-intent busy/failure, crash after intent, outcome-write failure and transport failure; never replay side effects.
- [ ] T047 [US5] Implement canonical observer adapter in `src/context/capture.ts` and minimal wiring at 1.0.10 handoff seam; pre-intent is bounded, post-outcome updates same event, no inner duplicate recorder.
- [ ] T048 [US5] Integrate canonical process execution/range correlation handed off by 1.0.10 and add tests in `test/context/process-evidence.test.js`; PID alone is never durable identity.
- [ ] T049 [US5] Reconcile legacy `toolHistory.ts` ownership/import path after live recorder adoption so active public calls have one canonical recorder; retain migration support without double write.

## Phase 8 — User Story 5B: six public tools/gateway rollout (P2)

**Independent test**: Q8 + CLI/MCP parity. Requires G-110 and accepted local domain behavior.

- [ ] T050 [P] [US5] Generate/test six full MCP schemas from `test/context/fixtures/context-tool-contract.json` in `test/context/mcp-contract.test.js`; verify annotations, rejected unknown actions and total schema token estimate <=10,000 or stop for owner decision.
- [ ] T051 [P] [US5] Write gateway no-context-persistence canary tests in `gateway:tests/context-no-persistence.test.mjs` covering success/error/truncation/debug/metrics.
- [ ] T052 [US5] Add device context capabilities and routing in `src/device/gateway-tool-adapter.ts`/accepted adapter seams plus gateway custom-tool schemas/risk routing; gateway contains no Store/search implementation.
- [ ] T053 [US5] Implement old-device unsupported, ownership/permission checks and safe error/telemetry mapping in device/gateway adapters; no server fallback.
- [ ] T054 [US5] Run CLI/MCP domain parity test in `test/context/adapter-parity.test.js`; normalize only transport metadata, not content/scope/error/coverage.
- [ ] T055 [US5] Verify catalog refresh/re-registration behavior on representative client accounts and document `evidence/context/catalog-rollout.md`; do not assume reinstall semantics without observation.
- [ ] T056 [US5] Run combined final-1.0.10 compatibility/regression suite and write `evidence/context/us5.md`; any later material 1.0.10 change invalidates affected evidence.

## Phase 9 — Acceptance / polish

- [ ] T057 Extend accepted benchmark harness with correctness-checked capture/search/sync/activity/contention workloads in `bench/scenarios/context.mjs` (or final 1.0.10 equivalent); include actual work counts and environment identity.
- [ ] T058 Run Windows/Linux platform matrix for crash/concurrency/privacy/retrieval/parity/performance and retain raw outputs + `evidence/context/platform-matrix.md`; failed/NOT_MEASURED samples remain visible.
- [ ] T059 Update package/runtime compatibility only in the post-1.0.10 integration branch: set Node floor >=22.13, document node:sqlite requirement/migration in `package.json`, `README.md`, `docs/context.md` and release notes; do not rewrite 1.0.10 patch history.
- [ ] T060 Finalize public help/schema/skill source/privacy docs and license/attribution impacts in `README.md`, `PRIVACY.md`, `docs/context.md`, `skills/mcp-device-context/`.
- [ ] T061 Request independent reviewer different from implementation author; record Critical/High/Medium disposition in `evidence/context/independent-review.md`.
- [ ] T062 Run final Spec Kit consistency/coverage/acceptance check and write `evidence/context/acceptance.md`; stop before merge/publish/release unless separately authorized.

## Dependencies

```text
T001 + T004 + T005 + T006
  -> Phase 2 foundation
  -> US1 independent retrieval
  -> US2 CLI/skill
  -> US3 durability
  -> US4 activity relations

T002 (G-110 handoff)
  -> US5A live capture
  -> US5B gateway/public tools

US1 + US2 + US3 + US4 + US5A + US5B
  -> Phase 9 acceptance
```

Store/redaction/repo resolver/search lane does not wait for T002. Tasks touching the same `store.ts`/`service.ts` must be sequenced even if their tests are [P].

## Parallel opportunities

- Foundation tests T007-T010 are separate files.
- US1 T016/T018/T019/T021 can be authored in parallel after foundation model freeze.
- US2 T024/T026/T028 are separate test files.
- US3 T031-T034/T036 are separate fixtures/tests.
- US4 T038/T040/T042 are separate tests; graph implementations T039/T041 are sequential.
- US5A T045/T046 are separate tests after handoff.
- US5B T050/T051 can proceed in parallel before adapter integration.

## Suggested MVP

Implementation MVP is **Phase 1–5 + minimal US4 activity relations**: persistent repo-scoped evidence import/search/read/status, local CLI/skill/checkpoint, quotas/crash semantics and on-demand activity graph. It already gives local agents useful shared history without waiting for gateway capture.

Live capture/public MCP rollout is the integration increment after G-110. Source-code parser graph and wiki provider are explicitly not part of MVP.

## Requirement coverage

| Requirement | Tasks |
| --- | --- |
| FR-001 | T012,T013,T032,T035 |
| FR-002 | T031,T045-T047 |
| FR-003 | T031,T033,T046,T047 |
| FR-004 | T009,T011,T036 |
| FR-005 | T010,T012,T021,T022 |
| FR-006 | T008,T010,T012,T050,T053 |
| FR-007 | T007,T013 |
| FR-008 | T018-T023,T041 |
| FR-009 | T021,T022 |
| FR-010 | T014,T021,T024,T042 |
| FR-011 | T045,T047,T049 |
| FR-012 | T024,T025,T030 |
| FR-013 | T024,T025,T054 |
| FR-014 | T028-T030 |
| FR-015 | T026,T027 |
| FR-016 | T026,T028,T029 |
| FR-017 | T010,T033,T035 |
| FR-018 | T010,T034,T035 |
| FR-019 | T005,T012,T032,T035 |
| FR-020 | T016,T017 |
| FR-021 | T008,T013,T037 |
| FR-022 | T001,T037,T060 |
| FR-023 | T019,T020,T042,T043 |
| FR-024 | T038-T041 |
| FR-025 | T038-T044 |
| FR-026 | T042,T043 |
| FR-027 | T003,T006,T050-T055 |
| FR-028 | T006,T050,T053 |
| FR-029 | T006,T042,T043,T050 |
| FR-030 | T006,T050,T060 |
| FR-031 | T003,T050,T055,T056 |
| FR-032 | T002,T045-T049,T056 |

## Success-criteria coverage

- SC-001: T031,T045-T047,T058
- SC-002: T008,T036,T051,T053,T058
- SC-003: T024,T025,T054
- SC-004: T019,T021,T042,T043
- SC-005: T018,T023,T058
- SC-006: T016,T034,T035,T058
- SC-007: T044,T057,T058,T061
- SC-008: T003,T006,T050,T055

## Deferred feature 003

`local_wiki` generation/provider/source-quality/revision tasks are intentionally absent. 002 only reserves disabled/status semantics and verifies zero provider calls. The former wiki contract is review input for feature 003, not a 002 implementation checklist.
