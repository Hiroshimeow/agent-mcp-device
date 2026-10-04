# Implementation Gates — revision 2

**Feature**: [spec.md](../spec.md) | **Date**: 2026-10-04

A gate blocks only the lane named below. It must not unnecessarily block independent work.

## Before independent source implementation (store/search/CLI lane)

- [ ] User/owner authorizes source implementation of feature 002.
- [x] G-DB design choice is fixed: post-1.0.10 Node >=22.13 + built-in `node:sqlite`/FTS5.
- [x] Representative Windows/Linux FTS5 feasibility probe has passed; product tests still belong to implementation.
- [x] G-POLICY numeric defaults exist in [context-policy.md](../contracts/context-policy.md).
- [x] Retrieval quality targets and schema-token target are fixed.
- [x] Destructive MCP admin and wiki provider engine are out of 002 scope.

## Before live capture/process integration

- [ ] G-110: accepted 1.0.10 handoff identifies final source commit/dirty state.
- [ ] Canonical exactly-once public observer placement is documented.
- [ ] Pre-intent and post-outcome hook points are available.
- [ ] local_* observer exclusion hook is available.
- [ ] Process execution/range/completeness contract is final.
- [ ] Shared resource/readiness/shutdown semantics are final.
- [ ] Material handoff changes trigger revalidation, not fallback self-MCP code.

## Before public MCP rollout

- [ ] Six local_* schemas/actions/errors/annotations match context-api contract.
- [ ] Total public schema estimate <=10,000 tokens or owner-approved exception exists.
- [ ] Device old-version path returns DEVICE_UNSUPPORTED with no gateway execution fallback.
- [ ] Gateway marker scan proves no context content persistence for success/error/truncation/debug paths.
- [ ] Client catalog refresh/re-registration behavior is observed on representative accounts.
- [ ] project_list/NMem/external broker remain unchanged unless a separate approved migration exists.

## Before runtime acceptance/release eligibility

- [ ] Retrieval ground truth meets top-3/Recall@8 targets.
- [ ] Windows/Linux crash/concurrency/privacy/scope/parity suites pass with raw evidence.
- [ ] Capture/search/sync/activity benchmark includes correctness + actual work counts + p95/max/resource metrics.
- [ ] No known secret canary survives in DB/WAL/blob/FTS/error outputs.
- [ ] Independent reviewer different from implementation author has no unresolved Critical/High blocker.
- [ ] Owner separately authorizes merge/release/deployment.

## Deferred feature 003

Wiki provider/reuse/egress/last-good/cost gates are not blockers for 002. `local_wiki` remains disabled/status-only until 003 is implemented and reviewed.
