# Cross-artifact Analysis — revision 2

**Date**: 2026-10-04  
**Mode**: read-only consistency analysis after revised `spec.md`/`plan.md`/`tasks.md`. This is not runtime acceptance.

## Inventory

- 5 user stories.
- 32 Functional Requirements.
- 8 Success Criteria.
- 62 unchecked tasks, T001–T062 sequential.
- 25 tasks marked [P] subject to stated dependencies.
- Required design artifacts present: spec, plan, research, data model, integration handoff, quickstart, context API, context policy, skill contract, checklists.
- `git diff --name-only HEAD` reports no tracked product-source change in the 002 documentation worktree.

Documentation validator passes.

## Opus round-1 findings disposition

| Finding | Disposition in revision 2 |
| --- | --- |
| C1 preview token was not human consent | Resolved: token no longer claimed as human approval; destructive admin removed from agent MCP. `local_wiki` provider work deferred to 003. |
| C2 capture durability ordering undefined | Resolved contract: bounded durable pre-intent attempt → one execution → post-outcome update; committed-no-outcome = unknown_after_restart; pre-intent failure = observable gap/degraded, no replay. |
| C3 unscoped event had no store | Resolved: per-owner `unscoped.sqlite` minimal metadata only, no payload/index. |
| H1 no redaction implementation task | Resolved: T009/T011 precede Store/capture consumers. |
| H2 local SQLite under sandbox undefined | Resolved typed LOCAL_STATE_UNAVAILABLE/ACCESS_DENIED + no fallback bypass, T024. |
| H3 re-pair local namespace semantics unclear | Resolved: active namespace default only; old namespace sealed from skill/MCP/default CLI. |
| mixed local_index read/destructive annotations | Resolved: new read-only `local_status`; local_index only sync/checkpoint/rebuild/cancel; destructive admin out of MCP. |
| transport_status overclaim | Resolved: only handed_to_adapter/gateway/unknown. |
| generation risk full FTS copy | Resolved: ordinary sync = incremental watermark; shadow generation only rebuild. |
| cursor forgery | Resolved: HMAC/equivalent server-side bound cursor. |
| unbounded repo-store creation | Resolved numeric repo-store quota + unscoped/quota behavior. |
| destructive audit | Resolved content-free registry tombstone for future owner-admin flow. |
| writer contention | Resolved policy budgets/capture priority/maintenance yield. |
| schema size risk | Resolved <=10k total estimate target + T050 measurement. |
| wiki scope too large | Resolved: implementation split to feature 003; 002 only reserves disabled/status tool contract. |
| Tree-sitter/installer/offline worker overengineering | Deferred from 002 MVP. |

## Internal consistency findings

### No Critical/High internal contradiction found in revision 2

- Spec, plan, data model, API and tasks agree on six public tool names.
- Read-only status/search/read/graph have no write/provider semantics.
- `local_index` action set is consistently `sync/checkpoint/rebuild/cancel`.
- Source-code parser graph is consistently deferred.
- Wiki provider engine is consistently deferred.
- G-110 blocks only live capture/process/gateway integration; independent storage/retrieval lane is not blocked.

### Medium / external-state notes

**A2-01 — 1.0.10 reference drift**  
All six previously snapshotted 001 planning documents still match their archived hashes but no longer match the live 001 worktree. Live 001 remains `PROPOSED / NOT AUTHORIZED FOR IMPLEMENTATION`. This is expected external drift, not a 002 contradiction. T002 requires a fresh handoff before US5 live wiring.

**A2-02 — node:sqlite stability wording**  
Research records the exact runtime-floor decision and current official Node state. Product acceptance must use project tests rather than treating module stability label as correctness proof.

**A2-03 — power-loss vs process-crash**  
Pre-intent ordering guarantees are specified for process-crash semantics. Power-loss durability remains dependent on SQLite synchronous mode and must be reported separately; no document now claims more.

**A2-04 — local_wiki future schema**  
002 reserves the tool name and disabled/status behavior, not the final provider action schema. This satisfies the user's desire to register the name once but does not guarantee 003 can add arbitrary incompatible fields without catalog refresh. G-SCHEMA must keep 003 evolution compatible or explicitly report a refresh need.

## Requirement/task coverage

All FR-001..FR-032 have at least one mapped task. All SC-001..SC-008 have mapped acceptance tasks. No task ID referenced by coverage is missing.

## Readiness interpretation

### Independent implementation lane
Spec/design is internally ready once the user explicitly authorizes implementation:
- redaction;
- owner/repo/store;
- importer;
- FTS/search/read/status;
- CLI;
- checkpoint;
- activity relations/query;
- skill source.

### Integration lane
Not ready until G-110 handoff:
- live pre-intent/post-outcome observer wiring;
- process correlation;
- active recorder reconciliation;
- gateway/public six-tool routing;
- combined 1.0.10 compatibility evidence.

This staged readiness is intentional; it does not claim full feature release readiness.

## Final independent review — Opus round 2

Same M365 conversation: `3fb56801-6eeb-49d1-8662-bd5400fa6b6c`. Durable follow-up job: `samechat-r2-20261004-015603-4b28098d`. Model-at-completion: Opus.

**Verdict: READY_FOR_IMPLEMENTATION.** Unresolved Critical/High blockers: **None**. Round-1 C1/C2/C3/H1/H2/H3 all passed after revision 2.

The reviewer left seven Medium implementation notes (N1–N7), not spec blockers:
- N1: make capture fail-open/gap late-outcome behavior explicit in implementation policy.
- N2: tune/measure maintenance write-lock hold time + event-loop yield, not only lock acquisition timeout.
- N3: add device-wide quota including sealed namespaces and a supported local-owner cleanup path before enabling live capture T047.
- N4: cursor snapshot visibility must filter rows by generation/watermark.
- N5: legacy importer needs redaction and should not imply unknown-owner JSONL becomes immediately searchable.
- N6: define cursor HMAC key storage/rotation/shared CLI-MCP use.
- N7: `local_wiki` reserved stub may cause unnecessary permission/schema cost; owner can keep a read-only status-only stub or omit it.

Raw review: [reviews/opus-round2.md](reviews/opus-round2.md).

### Final readiness interpretation

- **Implementation-ready now**: independent lane T001–T044 after explicit source-implementation authorization.
- **Still externally gated**: T045–T056 live observer/process/gateway integration waits for G-110; N3 must also be closed before T047 enables real capture.
- **Not release-ready**: runtime acceptance, Windows/Linux evidence and owner merge/release authorization remain future gates.

No further Spec Kit → Opus iteration is required before starting the independent implementation lane.
