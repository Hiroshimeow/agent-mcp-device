# P4 Tasks — Human-Facing Wiki Contract Only

These are future implementation-package tasks. They intentionally stop before final P5 reconciliation and before product implementation.

- [ ] T090 Freeze local_wiki v1 action/schema fixture for status/list/read/estimate/generate/update/lint/cancel, wiki-v1 capability, old-device behavior and CLI/MCP parity; no second wiki tool.
- [ ] T091 Add structured WikiPage/WikiSection/WikiDiagram/source-manifest fixtures with scoped evidence refs, authority labels, freshness and stable section IDs.
- [ ] T092 Add progressive-read contract tests: list/card no body, section only selected section, full explicit bounded continuation; zero provider/sync/index side effects on read paths.
- [ ] T093 Add estimate/plan fixtures: scoped target/source selection, deterministic local token estimate, owner hard-cap enforcement, zero network/provider calls, expiring plan_ref that is not human consent and cannot establish explicit-user-request provenance.
- [ ] T094 Add provider-egress authorization/security fixtures: local allowlisted profile only; owner policy without trusted explicit-user-request provenance -> typed denial and zero provider calls; plan_ref/MCP args/agent token cannot forge approval; stale/replayed/unrelated request provenance cannot authorize another target/job; valid provenance is bound to operation/request scope + repo/worktree + planned targets. Also assert no endpoint/key args, secret/excluded/cross-repo canaries absent, and provider has no local tool/filesystem access.
- [ ] T095 Add generate/update consistency tests: provider call allowed only when owner policy + trusted explicit-user-request provenance + valid plan all pass; missing trusted provenance fails closed; plan/source revalidation, stale-plan/source-drift conflict, selected-target-only update, bounded retries within the original authorized request/job budget, idempotency, restart/interruption no authorization refresh, staged validation and atomic last-good publication.
- [ ] T096 Add wiki job lifecycle tests: timeout/rate-limit/empty/invalid output, cancel, restart/interrupted no-auto-resume, retry cap/deadline/concurrency and usage/cost-known accounting.
- [ ] T097 Add wiki lint tests for ref scope/existence, broken links, authority mixing, placeholder/empty sections, redaction leaks, content hashes and prohibited verified wording; default lint remains page-local, while explicit source-currentness lint is bounded to the page manifest and reports checked work.
- [ ] T098 Add diagram fixtures for architecture/flow/sequence: evidence refs, safe Mermaid subset/validation, no external scripts/links and no unsupported dynamic-call invention; measure any added validator package before adoption.
- [ ] T099 Add freshness/last-good tests: code/activity/source manifest changes -> stale/unknown conservatively, ordinary read does no source scan, explicit lint/estimate/update may revalidate.
- [ ] T100 Add grounding/content acceptance fixtures for repository_overview/feature/module/symbol pages: purpose/specs/entrypoints/files/symbols/flows/invariants/tests/recent changes/gaps appear only when evidence exists.
- [ ] T101 Add cost/budget evidence: source/egress bytes, estimated/provider-reported tokens, attempts, model/network vs local latency, unknown-price honesty, local artifact quota.
- [ ] T102 Run G-SCHEMA planning check for enabled local_wiki actions and capability metadata; retain old-device typed disabled/unsupported behavior and total catalog target.
- [ ] T103 Run token-efficiency integration fixtures showing trivial/code tasks make zero automatic wiki body/provider calls and wiki card/section reads remain within P2 accounting; generated card summaries remain explicitly derived and never outrank freshness/evidence metadata.
- [ ] T104 Independent P4 review: wiki authority, egress/privacy, source consistency, last-good, progressive disclosure, jobs/cost, diagrams, schema minimality and P5 scope leakage.

## Dependencies

T090 -> T091/T092/T102.
T091 -> T093/T095/T097/T099/T100.
T093/T094 -> T095.
T095 -> T096/T101.
T097 -> T098.
T092/T100 -> T103.
T090-T103 -> T104.

## Stop condition

After T104:
- any Critical/High -> PLAN revises P4 only;
- clean review -> PLAN may open P5 final reconciliation/readiness;
- no DEV implementation route from P4 planning alone.
