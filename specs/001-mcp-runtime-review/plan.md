# Implementation Plan: MCP Device 1.0.10 Runtime and Compatibility Review

**Branch**: `feat/mcp-device-1.0.10-integrate` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)
**Input**: Round-4 document remediation, independent Astra and architecture/DAG findings.
**Status**: PROPOSED / NOT AUTHORIZED FOR IMPLEMENTATION. Feature unchanged; no trial exists.

## Summary

Exact immutable originals -> identified oracle overlays -> locked restore/build/hash ->
evidence-only MVP under bounded AUTH-D -> relevant owner approvals -> canonical runtime
architecture -> immutable ARCH_ACCEPTED -> derived CORE_WORK -> immutable ARCH_CORE_ACCEPTED
-> explicit process/file/media dependency compositions -> hardened domain native acceptance
-> one COMBINED_TRIAL/all-route proof -> optional accepted delta/recomposition -> independent
final evidence -> final docs/traceability/regression -> single eligibility/provenance stop.
No accepted tree is edited and no generated dist is assumed fresh.

## Technical Context

**Language/Version**: Existing strict TypeScript/Node16 modules, ES2020; pinned supported
Node/npm/native libs discovered, not automatic upgrades.
**Dependencies**: Existing MCP SDK/Zod/ripgrep/fs/streams/fuzzy/media/PDF; retain adapters
as OD-4 determines, not assumed permanent public stdio.
**Storage**: Immutable source bundles/manifests, identified writable trials, separate locked
dependency/build outputs, bounded evidence and approved per-instance output/leases.
**Testing**: Existing materialized bench/compat plus independent oracle/build-stale/PID-reuse/
per-stream output/context/bootstrap/route/resource fixtures; no product tests run here.
**Target Platform**: Native Windows/Linux and OD-3B-authorized routes; Gateway policy JSON
max 48 KiB distinct from lower grant/tool budget or unknown network ceiling.
**Project Type**: Authenticated runtime/canonical business dispatcher, not machine-wide broker.
**Performance Goals**: Three decision classes; correctness/architecture no arbitrary speed win.
AUTH-D safety budget is not OD-3A statistical acceptance; both remain PENDING.
**Constraints**: Source/build/oracle/dependency/evidence bound at every gate; stale artifacts
block execution; conditional OD-4 transport retention, no unit changes to legacy line API.
**Scale/Scope**: Existing candidates preserved/reconciled, finite policies owner-approved;
optional exploration/delivery isolated from required architecture decisions.

## Constitution Check

| Principle | Pre/post design status |
| --- | --- |
| Compatibility/security | Baseline/mapping/OD-4 coverage present; approvals/evidence pending |
| Evidence/classes | Build lineage/discovery-vs-acceptance separation explicit; future proof required |
| Bounded ownership | Per-instance core/domain/combined scopes distinct; OD-1/2 pending |
| Native platforms | Required; missing route evidence blocks rather than passes |
| Candidate reconciliation | Originals immutable, overlays/compositions reviewed, no blank-slate rewrite |
| Architecture simplicity | Canonical behavior, conditional adapter support, no hidden self-hop fallback |
| Governance | 3.0.1-proposed UNRATIFIED; no date/owner choices inferred |

Generic implementation-readiness gate remains BLOCKED on human AUTH/OD choices and future
evidence. Completing document revision is authorized, not completing runtime acceptance.

## Project Structure

### Documentation

Current feature plus owner-decisions.md and contracts/process-output-contract.md;
contracts/round3-execution-contract.md filename retained but content revised for Round 4.

### Future exact roots and paths

Source inputs from file accepted 2968280+6a5f43f, process captured tracked/untracked patch,
bench d388843 (dirty results evidence-only), compat hashed fixture. Integration repo and
siblings never writable trial roots. Execution contract defines all root transitions:
BASE/FILE/PROCESS/BENCH/COMPAT_ORIGINAL -> oracle/work copies -> ARCH_WORK -> ARCH_ACCEPTED
-> CORE_WORK -> ARCH_CORE_ACCEPTED -> PROCESS_DOMAIN/FILE_DOMAIN/MEDIA_DOMAIN -> accepted
domain increments -> COMBINED_TRIAL revision(s). Each runnable tree has distinct BUILD_ROOT.

Known seams: src/server.ts,device/device.ts,device/gateway-tool-adapter.ts,device/gateway-channel.ts,
device/execution-engine.ts,bootstrap.ts,mcp-device.ts,index.ts,npm-scripts/remote.ts,
config-manager.ts,tools/config.ts,tools/filesystem.ts,handlers/filesystem-handlers.ts,
utils/usageTracker.ts,utils/trackTools.ts,utils/capture.ts,utils/toolHistory.ts,
utils/feature-flags.ts,utils/logger.ts,error-handlers.ts,tools/pdf/markdown.ts,
terminal-manager.ts,tools/improved-process-tools.ts,types.ts,tools/schemas.ts,
search-manager.ts,handlers/search-handlers.ts,tools/edit.ts,custom-stdio.ts,
device/project-inspection.ts. Exact inventory/refinement precedes edits.
Candidate output-budget.ts reused; conditional tool-dispatcher.ts justified by side-effectful
server coupling; resource-accounting.ts justified by missing shared per-instance reservations;
spill-store.ts only if no existing utility suffices. Comparator/run/build-guard fixtures
fill missing harness behavior, not duplicate existing bench stack.

## Phase 0: Research

[research.md](research.md) retains source facts and independent review dispositions.
Confirmed generated ignored dist required by direct test imports; npm prepare/test can
rebuild and must be recorded. PID-string device mapping is static reuse risk requiring
explicit immutable-token migration; source/runtime tests not run. Global text cursor
was rejected for interleaved codepoints: [output contract](contracts/process-output-contract.md)
chooses per-stream text projections plus raw global ledger, exact examples/fences.

## Phase 1: Contracts and data model

[runtime](contracts/runtime-contract.md): bootstrap/context/lifetime/search/edit and conditional
transport mapping. [output](contracts/process-output-contract.md): exact byte/text/session semantics.
[lineage](contracts/round3-execution-contract.md): immutable originals/overlay/composition/build/
invalidation. [evidence](contracts/evidence-contract.md): AUTH-D safety vs approved acceptance.
[model](data-model.md): identities/states. [owner-decisions](owner-decisions.md): sole canonical
task decision matrix; task files do not maintain competing ranges.

## Execution and rollback

Tasks explicitly list predecessors/root/path/output; build protocol BP required at every
executable checkpoint and after source mutation. Domain composition applies baseline-relative
lane delta onto immutable ARCH_CORE parent with three-way conflict review, rebuild and
inherited architecture/core reruns. Gateway-adapter overlap never silently overwrites direct
path. Oracle evaluation of original candidate occurs BEFORE dependency composition.

Media/envelope edits use MEDIA_DOMAIN, never mutate ARCH_ACCEPTED. Architecture-surface
change stales architecture evidence, conservative rerun if uncertain. Only COMBINED_TRIAL
proves full covered-route accounting. Optional changes produce a new combination revision
and rerun affected gates. Rollback names exact parent source+build IDs, not a mutable folder.

Final ordering: combined full native/differential/adversarial/stress gate -> verified docs ->
FR/SC evidence traceability -> final regression/artifact/build/source cleanliness -> one
eligibility+provenance report -> final HUMAN REVIEW STOP. No task follows it.

## Complexity Tracking

No approved exceptions. Owner choices and execution evidence are blockers, not claims of
structural success. No per-reader destructive registry, device-wide quota broker, duplicated
business implementation, unexplained second benchmark stack or extra accounting-only trial.
