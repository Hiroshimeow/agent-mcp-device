# P5 Plan — Final Reconciliation and Readiness

Status: docs/readiness only. No product implementation, merge, release or publish authorization.

## Goal

Reconcile P0/P2/P3/P4 against actual repository truth and decide whether the nextgen context package is ready to enter implementation execution.

## Verified phase state

- P0 research/spec delta: independently cleared.
- P2 retrieval/router contract: independently cleared.
- P3 deterministic code-graph contract: independently cleared.
- P4 human-facing wiki contract: independently cleared.
- P5 baseline/runtime readiness: NOT READY.

## Required prerequisite baseline

Implementation execution requires a durable accepted post-002 baseline, not the earlier planning assumption.

Observed 002 implementation worktree:
- branch: feat/mcp-device-1.0.11-context;
- HEAD: dea0b5b3c14d0aab92515756a90fedd1f2bcf3cc;
- durable commit history shows implementation checkpoints through T023 plus hardening;
- public local_* production registration is not observed in src;
- handoff-110.json still blocks live wiring;
- N3 quota/cleanup remains required before live enablement.

Therefore P5 must not claim T001-T062 completion from task numbering or the original user assumption alone.

## Prerequisite closure order

Repository truth now supports a narrower execution order than the original blanket assumption:

1. Continue the remaining 002 **independent lane T024-T044** first. These tasks cover CLI/checkpoint/skill, durability/privacy, activity graph and explicit index-job behavior and do not require G-110 live wiring.
2. Close **N3** device-wide quota + local-owner cleanup/GC before live capture/public enablement.
3. Refresh/close **G-110** observer/process/resource/lifecycle handoff against the actual accepted runtime revision.
4. Only then execute the live/public 002 lane **T045-T062**, including canonical capture, process correlation, MCP/gateway registrations, parity/catalog/platform acceptance and final independent review.
5. Freeze the accepted post-T062 baseline and only then begin 003 implementation I1/P2.

This ordering preserves the existing 002 integration contract: do not block independent context-domain work on G-110, but do not start live capture/public registration before N3/G-110 are closed.

## Blocking gates

### B1 — accepted post-T062 baseline
Required:
- exact commit/worktree;
- verified final 002 scope completion/equivalent accepted scope;
- final six-tool/capability/schema catalog;
- required Windows/Linux acceptance;
- clean independent Critical/High review.

Current: NOT VERIFIED.

### B2 — G-110/live wiring
Required:
- canonical exactly-once observer;
- pre-intent/post-outcome hooks;
- observer exclusion;
- process correlation;
- bounded shared resource accounting;
- readiness/shutdown/flush semantics;
- owner semantic handoff acceptance.

Current handoff evidence: BLOCKED.

### B3 — N3 quota/cleanup
Required before live capture/public enablement:
- device-wide quota enforcement;
- owner-admin local TTY cleanup;
- cursor-safe physical cleanup/GC behavior;
- recovery/security tests.

Current: required but not verified complete.

### B4 — 003 artifact durability
Required:
- accepted specs/contracts/plans/tasks committed or otherwise durably recorded in intended implementation branch/worktree;
- package SHA + baseline SHA recorded;
- final reviewer evaluates durable artifacts.

Current main checkout: specs/003-context-nextgen remains untracked.

## Conditional optional capability gate

Provider-backed wiki generate/update additionally requires trusted explicit-user-request provenance outside MCP args.

Current runtime evidence does not demonstrate such a generic provenance signal.

Disposition:
- provider egress remains disabled until verified;
- provider-free wiki actions may still be implemented later if baseline gates pass;
- if release requires provider generation enabled on day one, this becomes a release/readiness blocker.

## Implementation sequence after blockers close

I0 Baseline freeze.
I1 P2 T063-T074.
I2 P3 T075-T089.
I3 P4 T090-T104.
I4 Integrated cross-layer acceptance.

Each implementation slice gets its own independent review before advancing. No parallel leap into P3/P4 implementation merely because their contracts are already written.

## Final invariants

- preserve valid 002 behavior through additive capability negotiation;
- no hidden maintenance/provider work on read paths;
- current source > deterministic graph > wiki;
- activity/history != code graph;
- NMem remains separate;
- guarded source hydration;
- conservative static proof;
- visible freshness/coverage;
- token/schema/resource/security gates all remain explicit;
- no new graph/vector/provider/index stack without measured need.

## Current verdict

NOT_READY_FOR_IMPLEMENTATION.

Next work is not product DEV. It is prerequisite baseline closure/durability evidence, followed by a fresh readiness review.
