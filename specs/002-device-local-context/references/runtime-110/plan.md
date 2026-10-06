# Implementation Plan: MCP Device 1.0.10 Runtime and Compatibility Review

**Branch**: `feat/mcp-device-1.0.10-integrate` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Existing `/specs/001-mcp-runtime-review/spec.md`, revision-cycle request and both reviews.

**Status**: PROPOSED — NOT READY FOR IMPLEMENTATION. Full document revision is authorized;
implementation is not. Generic plan gate ERROR remains for owner decisions OD-1/OD-2/OD-3;
continuing to tasks is review-artifact generation per the explicit request, not gate bypass.
Setup script BRANCH=001-mcp-runtime-review is feature fallback, not actual Git branch change.

## Summary

Use **reconcile -> verify -> keep/revise/revert -> integrate**. File commits 2968280 and
6a5f43f are accepted lane inputs to independently revalidate, not rewrite. Capture dirty
process candidate before alteration, then repair only proven deficiencies. Extend bench
through d388843 and existing compat contract. Canonical dispatch is an independent gated
architecture increment: extract/reuse existing server registration/handlers, keep external
stdio as adapter and remove only the Gateway internal self-MCP hop after migration proof.
Avoid a speculative src/runtime subsystem or duplicate evidence stack.

## Technical Context

**Language/Version**: Existing strict TypeScript ^5.3.3, ES2020/Node16 modules; package
Node >=18 is declared, supported pinned runtime/native dependencies require discovery.

**Primary Dependencies**: Existing MCP SDK 1.30.0 for external adapter, Zod, Node fs/
child_process/streams, @vscode/ripgrep, fuzzy worker and existing document/media libraries.
SDK Client/StdioClientTransport removed from remote self-hop only after acceptance.

**Storage**: Existing process/search state and candidate budget utility, proposed lazy
owned spill only where justified. All metadata/queue/lease/evidence byte/count/age bounds
calibrated and approved before activation; no assumption of unlimited legacy bypass.

**Testing**: Reuse bench fixtures/helpers and test/compat contract; extend existing Node
product regression and add missing independent comparator/gate cases, no tests run now.

**Target Platform**: Native Windows/Linux; external stdio plus Gateway mapped capabilities,
UI/media and lifecycle/security routes. Required real-device authorization is OD-3.

**Project Type**: Local MCP/device runtime with shared in-process canonical tool behavior.

**Performance Goals**: Frozen calibrated primary/protected metrics; correctness fix and
architecture acceptance do not require speed gains. Previous 10%/5%,5/30 values are proposals.

**Constraints**: Proposed constitution unratified; OD-1 limits/legacy drift, OD-2 retention/
kill escalation, OD-3 statistics/routes/scope unresolved. Runtime contract classifies
observed versus proposed numbers. Discovery is not approval. No new product file without
existing-module insufficiency rationale and independent prerequisite gate.

**Scale/Scope**: Six stories; existing benchmark workloads plus startup process count/RSS/
latency/serialization and Gateway-vs-stdio differential. Prior 10000/60-minute/10-cycle
tier is provisional; approved final native stress remains required, not optional.

## Constitution Check

*GATE before research and re-evaluated after design; approval is not inferred.*

| Proposed principle | Pre-research | Post-design |
| --- | --- | --- |
| I compatibility/security | REQUIRED | Design coverage present; baseline/drift approval pending |
| II evidence/classes | REQUIRED | Three classes defined; OD-3 calibration/approval BLOCKED |
| III aggregate boundedness | REQUIRED | All-route accounting specified; OD-1/OD-2 enforcement BLOCKED |
| IV native platforms | REQUIRED | Both required; execution evidence pending, not passed |
| V independent reconciliation | REQUIRED | Candidate-first gates/rollback ordered; actual acceptance pending |
| VI simplicity/canonical behavior | REQUIRED | Shared dispatcher target specified; extraction/equivalence unexecuted |
| Ratification | UNRATIFIED | TODO adoption date; no human approval invented |

Planning ERROR: owner decisions remain. These review artifacts do not claim mandatory
gates pass. No exception is approved; blanket exclusions are not silently introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-mcp-runtime-review/
  spec.md; checklists/requirements.md; plan.md; research.md
  data-model.md; contracts/runtime-contract.md; contracts/evidence-contract.md
  quickstart.md; tasks.md
```

### Source Code (repository root)

Starting points for future trial reconciliation, not changes made here:

| Existing/candidate path | Responsibility / action |
| --- | --- |
| src/server.ts, src/handlers/, src/tools/schemas.ts | Extract/reuse registration and dispatch, preserve external MCP wrappers |
| src/device/{device,gateway-tool-adapter,execution-engine,gateway-channel}.ts | Direct dispatch migration, readiness/context/update/shutdown parity; conditional engine removal |
| src/terminal-manager.ts, src/tools/improved-process-tools.ts, src/types.ts | Dirty process candidate reconciliation; explicit-offset additive proposal and lifecycle hardening |
| src/utils/output-budget.ts (file candidate) | Adapt existing UTF-8 utility to full envelopes/accounting rather than invent second budget utility |
| src/tools/{filesystem,edit}.ts, src/search-manager.ts, src/handlers/{filesystem,search}-handlers.ts | Accepted file candidate revalidation and targeted hardening |
| bench/run.mjs, bench/lib/core.mjs, bench/scenarios/all.mjs and helpers | Existing harness reuse/provenance/calibration/route/stress extensions |
| test/compat/compat-contract-v1.0.9.json | Existing normalization/category fixture, independently review thresholds |

**Structure Decision / new-file justification**:
- `src/tool-dispatcher.ts` is a proposed narrow extraction only if current server.ts
  cannot expose pure list/invoke without registering MCP/global side effects. It owns
  canonical behavior, not duplicate handlers.
- `test/compat/run.mjs`, `test/compat/compare.mjs`, `test/compat/test-gates.mjs` are justified
  missing independent comparator/gate deliverables; reuse bench client/fixture helpers.
- `src/utils/spill-store.ts` is conditional on confirmed absence of equivalent utility
  and proven need for shared crash/lease ownership. No mandatory src/runtime/* rewrite.
- Any further abstraction needs recorded reason adaptation is insufficient before adding it.

## Phase 0: Research and Candidate Decisions

[research.md](research.md) records actual LocalExecutionEngine self-MCP path, source
coupling/security/lifecycle concerns, candidate identities/evidence, Astra blockers,
absolute-offset versus consumer-state comparison and historical raw facts. Document
unknown owner choices openly; calibration tasks address actual limits/statistics after
separate authorization. No runtime/platform/raw performance has been newly executed.

## Phase 1: Design and Contracts

[runtime contract](contracts/runtime-contract.md): canonical adapter mapping/context,
all-route accounting and provisional dimensions; simple idempotent offsets with expiry;
root/pipe/EOF/kill states; abandoned lease max age; explicit weak search consistency/
match-first budget; best-effort external edit conflicts and sequential candidate batches.
[data model](data-model.md) quotes semantic invariants and pending policy fields.
[evidence contract](contracts/evidence-contract.md) separates decisions, freezes proposed
calibration procedure, reuses bench/compat and proves no self child. [quickstart](quickstart.md)
distinguishes existing commands from future extensions and does not imply execution.

## Dependency-Ordered Reconciliation and Gates

1. Freeze baseline external contracts, route mappings and authorization; inventory
   self-MCP and context/lifecycle callers; capture candidate patch/untracked/evidence hashes.
2. Reconcile each existing increment: identify retained code, deficiencies requiring
   reproduction and disposition. Extend existing bench/compat oracle and self-compare.
3. Calibrate/discover limits and statistical/stress procedures, resolve OD-1/OD-2/OD-3
   and ratification before activation. Make route/drift matrix explicit.
4. Gate any adapted shared accounting/budget/spill/context primitive before consumers
   adopt it. Exploratory trials are isolated, not production integrated.
5. Extract canonical dispatcher and route stdio through it without behavior changes;
   independent stdio compatibility gate first. Then direct Gateway mapping/lifecycle
   trial and independent no-child/equivalence gate; engine removal only after caller proof.
6. Revalidate accepted file candidate reads/search/edit one increment at a time; adapt
   existing budget/queues only where measured reproduction proves insufficiency.
   Process candidate is hash-pinned, contract-tested and minimally revised, not rewritten
   merely because an abstract design seems cleaner.
7. Optional batch/patch: isolated semantically declared prototype -> equivalence ->
   exploratory measurement -> owner scope decision -> production acceptance. Existing
   sequential batch is measured as such; original-snapshot mode is not silently assumed.
8. Independently classify each increment, integrate only accepted ones in authorized
   trial roots, re-run affected gates after changes, then full compatibility/adversarial/
   native Windows+Linux stress and historical dispositions for final combination.
9. Eligibility report only. HUMAN REVIEW STOP before any release action.

## Rollback Criteria by Increment

| Increment | Rollback/block trigger |
| --- | --- |
| Shared resources/context | Any bypass, unapproved legacy saturation, count/age leak, context contamination |
| Dispatcher/stdio extraction | Any schema/result/error/UI/telemetry/security difference not approved |
| Gateway direct migration | Self child remains, isolation/readiness/update/shutdown drift or unavailable required route proof |
| File reads | Skipped continuation, transient resource bypass, media/error/default drift |
| Search | Hidden match/context count, ordering/regex/document/security drift, unbounded sort/parser |
| Edit/batch/patch | Unintended mutation, false external-conflict guarantee, alias/metadata/crash semantics failure |
| Process | Lost/replayed new-path bytes, altered legacy replay, wait/lifetime/EOF/tree/pipe cleanup failure |
| Benchmark/compat/stress | Wrong target attribution, unequal workload, erased failures or missing native evidence |

Rollback means reject trial/adoption to last pinned accepted increment and invalidate
its dependent evidence. It never means discard historical failures or silently fallback
to the removed internal self-server. No merge/cherry-pick is authorized in this cycle.

## Complexity Tracking

No approved constitution exception. Owner choices and evidence pending are blockers,
not justified violations. Stateful consumers/generation registries, second search/edit
implementations and duplicate scripts/review-110 stack are rejected absent concrete need.
The only required new production boundary is pure canonical dispatch if extraction
cannot remain safely in existing server module; existing candidate helpers are preferred.
