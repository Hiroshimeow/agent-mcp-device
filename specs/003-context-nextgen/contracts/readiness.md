# Final Readiness Contract — P5

Status: final reconciliation contract for the 003-context-nextgen implementation package. No product implementation is authorized by this document.

## 1. Verdict categories

The package uses only:
- **READY_FOR_IMPLEMENTATION** — all prerequisite baseline, durability, compatibility and phase-review gates are verified.
- **NOT_READY_FOR_IMPLEMENTATION** — one or more required prerequisite is missing/unverified.
- **READY_WITH_DISABLED_OPTIONAL_CAPABILITY** is not a substitute verdict. Optional capability enablement may be disabled inside an otherwise ready package, but required baseline gates must still pass.

Missing evidence is NOT_MEASURED/UNVERIFIED, never PASS.

## 2. Required baseline before 003 implementation execution

003 implementation tasks T063-T104 require an accepted post-002 baseline.

The baseline record MUST include:
- repository/worktree + exact commit SHA;
- proof that the intended 002 implementation scope through T062 is complete or an explicitly revised equivalent scope is accepted;
- public six-tool/capability/schema snapshot;
- Windows/Linux acceptance evidence required by 002;
- final G-110 handoff state;
- N3 device-wide quota + local-owner cleanup gate disposition;
- clean Critical/High independent review state;
- release/runtime/Node floor compatibility disposition.

Do not infer completion from task numbering, planning readiness, or commit messages alone.

## 3. Current observed baseline state on 2026-10-05

Observed feature worktree:
- `E:/git-project/wt-mcp-device-111-context`
- branch `feat/mcp-device-1.0.11-context`
- HEAD `dea0b5b3c14d0aab92515756a90fedd1f2bcf3cc`.

Durable commit history identifies:
- Phase 1 checkpoint T001-T006;
- Phase 2 checkpoint T007-T015;
- Phase 3/US1 checkpoint T016-T023;
- subsequent hardening/review fixes for that checkpoint.

Observed source includes store/redaction/import/index/search/read/status foundation, but no production registration of the public `local_*` tools was found under `src`; the names currently appear in test fixtures/contracts.

The 002 task document still has 62 unchecked boxes, so checkbox state itself is not authoritative. Commit/source/handoff evidence is authoritative enough to conclude that completion through T062 is **not verified**.

Observed `evidence/context/handoff-110.json` still records:
- canonical observer adapter: `BLOCKED_MISSING_HOOK`;
- process correlation: `BLOCKED_INCOMPLETE`;
- shared resource accounting live wiring: blocked/deferred;
- observer exclusion hook: `BLOCKED_MISSING_HOOK`;
- context flush contract: `NOT_IMPLEMENTED`;
- owner semantic handoff acceptance: `NOT_RECORDED`;
- live wiring gate: `BLOCKED`.

Observed `evidence/context/decisions.md` also keeps N3 device-wide quota/owner-admin cleanup as a Phase 5 gate before live capture/public enablement.

Therefore the required post-T062 baseline does not currently have sufficient evidence to PASS.

## 4. Artifact durability gate

The 003 Spec-Kit package currently exists under the main checkout as untracked `specs/003-context-nextgen/**`.

Before READY_FOR_IMPLEMENTATION:
- the complete accepted 003 package must be committed or otherwise durably recorded in the intended implementation branch/worktree;
- exact baseline and package commit SHAs must be recorded;
- no accepted contract may exist only as untracked local state;
- independent review must refer to those durable artifacts.

PLAN does not silently commit or choose the implementation branch on the owner's behalf.

## 5. Cross-phase compatibility map

Preserve 002 semantics unless additive capability/version negotiation explicitly says otherwise.

### P2
- optional `local_search.view=navigate`;
- capability `progressive-retrieval-v1`;
- omitted view preserves 002 search;
- old device rejects unsupported new behavior before dispatch.

### P3
- optional `local_search.branch=code`;
- optional `local_graph.graph_kind=code`;
- optional `local_index.index_kind=code`;
- capability `code-graph-v1`;
- omitted fields preserve 002/P2 semantics;
- activity and code generations/authorities remain distinct.

### P4
- enable existing reserved `local_wiki` under `wiki-v1`;
- no second wiki tool family;
- old device remains disabled/unsupported;
- provider generation/update has additional runtime authorization prerequisites.

Final implementation must freeze one context capability/schema version mapping that represents the supported combination of the above. G-SCHEMA must measure per-tool and total catalog impact before rollout.

## 6. Wiki provider provenance gate

Current runtime search found no verified generic execution-context signal that proves a `local_wiki generate/update` call originated from an explicit user request. Pairing approval is unrelated and cannot be reused.

Therefore:
- provider-backed wiki `generate/update` is **DISABLED_PENDING_TRUSTED_USER_REQUEST_PROVENANCE** until a trustworthy runtime/client provenance channel is demonstrated and tested;
- this gate is outside agent-mintable MCP args, `plan_ref`, hashes or tokens;
- absence of this provenance does not prevent implementing/testing provider-free wiki status/list/read/estimate/lint scaffolding;
- it does prevent enabling provider/network egress;
- no readiness review may waive this by treating the tool action itself as user approval.

If the intended release requires provider generation enabled on day one, this unresolved gate is a release/readiness blocker.

## 7. Implementation ordering

After the required post-002 baseline and artifact-durability gates pass:

### I0 — baseline freeze
Record exact accepted 002 commit, capability/schema catalog, G-110/N3 dispositions and platform acceptance evidence.

### I1 — P2 retrieval/router
Execute T063-T074 only.
Do not start P3/P4 implementation until P2 contract/benchmark review is clean.

### I2 — P3 deterministic code graph
Execute T075-T089 only after clean P2.
Preserve product-owned pinned analyzer, bounded CompilerHost, canonical edge orientation, guarded hydration, no query-path compiler.

### I3 — P4 wiki
Execute T090-T104 only after clean P3.
Provider-free actions may proceed under the P4 contract.
Provider egress tests/enabling require trusted user-request provenance; otherwise generate/update stay disabled.

### I4 — final integrated acceptance
Run cross-layer compatibility/token/security/resource/schema acceptance on the same durable candidate revision. No release/tag/publish is part of this Spec-Kit task.

## 8. Cross-layer invariants

- no hidden sync/index/provider work from read/search/status/NAVIGATE;
- source > deterministic graph > wiki for current-code authority;
- history/activity and code graph remain distinct;
- NMem remains separate;
- compact refs/cards before selective hydration;
- current-source hydration is revision/fingerprint guarded;
- dynamic/ambiguous code relations are not fabricated;
- stale/unknown is visible;
- old-device/cached-client behavior is typed and non-reinterpreting;
- security/isolation/redaction regressions are unconditional failures;
- schema cost and runtime retrieval tokens are measured separately;
- no new graph DB/vector/embedding/provider/index stack without measured need.

## 9. Carry-forward details for final implementation review

P3:
- symbol ownership fixtures must agree with final symbol model for arrows/function expressions/class-field/static-block/top-level sites;
- storage evidence-retention cap and response pagination cap remain separate;
- TypeScript 5.9.3 is a scoped compatibility target; TS6/TS7 incompatibility and upgrade/rebuild behavior must be explicit.

P4:
- generated wiki card summary remains derived;
- default lint is page-local; optional source-currentness lint is manifest-bounded with work accounting;
- manual human-edit/export conflict semantics remain deferred scope, not hidden requirements.

## 10. Concrete prerequisite closure sequence

Current 002 task truth gives the following smallest safe path:

- **Lane A — T024-T044:** may proceed before G-110 because the accepted 002 integration contract classifies CLI/checkpoint/skill, store durability/privacy, activity graph and explicit index jobs as independent domain work.
- **Gate N3:** close device-wide quota + owner-admin cleanup + cursor-safe GC before live capture/public tool enablement.
- **Gate G-110:** refresh and accept canonical observer/process/resource/lifecycle handoff against the actual runtime revision.
- **Lane B — T045-T062:** only after N3 + G-110, complete live capture/process correlation, six production MCP schemas/routes, gateway non-persistence/parity/catalog rollout, Windows/Linux matrix, compatibility/docs, independent review and final acceptance.
- **Baseline freeze:** record the resulting accepted 002 SHA/capability/schema/platform evidence before starting 003 T063.

P5 T105 and T111 are now evidence-complete. T106-T110/T112-T115 remain open; T114 cannot be truthfully completed until the intended 003 implementation branch/worktree is chosen and the accepted package is durably recorded.

## 11. Current P5 verdict

**NOT_READY_FOR_IMPLEMENTATION**

Blocking reasons:
1. accepted post-T062 002 baseline completion is not verified; current durable feature evidence only demonstrates checkpoints through T023 plus hardening;
2. G-110/live wiring remains blocked in the current handoff evidence;
3. N3 quota/cleanup gate remains a required 002 enablement prerequisite;
4. 003 Spec-Kit artifacts are not yet durably recorded in the intended implementation branch/worktree.

Conditional capability gate:
5. trusted explicit-user-request provenance for provider-backed wiki generation is not verified; provider egress must remain disabled unless resolved.

This verdict does not invalidate P0/P2/P3/P4 contract clearance. It prevents execution from pretending the prerequisite runtime/base state already exists.
