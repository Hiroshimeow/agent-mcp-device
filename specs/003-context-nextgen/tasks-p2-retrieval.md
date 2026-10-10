# P2 Tasks — Retrieval/Router Contract Only

These are planning tasks for the future implementation package. They intentionally stop before code-graph/wiki implementation.

- [ ] T063 Freeze accepted 002 legacy search/graph/read fixtures and capability/schema baseline for comparison.
- [ ] T064 Add contract fixture for optional `local_search.view=results|navigate` and `progressive-retrieval-v1`; legacy omission must preserve 002 semantics.
- [ ] T065 Add contract tests for old-device/cached-client behavior: unsupported navigate rejected before dispatch; legacy calls continue unchanged.
- [ ] T066 Add NAVIGATE response contract tests: common envelope + bounded branch cards only; no snippets/bodies/full argument plans.
- [ ] T067 Add side-effect trace tests proving NAVIGATE performs zero branch-body search, zero sync/rebuild, zero provider call and zero NMem call.
- [ ] T068 Add local CLI/MCP parity contract for navigation view without changing existing CLI search behavior.
- [ ] T069 Freeze benchmark corpus S1-S5, labeled relevant spans/authorities/forbidden branches, immutable repo revisions, per-fixture correctness rubric/pass rule, valid repeat count, pairing/aggregation rule, and bounded harness-error retry/replacement policy before any baseline/candidate evidence is inspected.
- [ ] T070 Implement benchmark accounting harness specification: canonical stable JSON, request+response model-visible bytes, `ceil(bytes/4)`, estimator tolerance 0, terminal state for every attempt, all-valid-run `tokens_consumed_to_terminal`/calls/latency, correct-run-only `tokens_to_correct_answer`, raw harness-error retry traces, and explicit `NOT_MEASURED` on retry exhaustion. Harness errors never lower product correctness denominators. Efficiency PASS is impossible until per-fixture correctness non-regression passes.
- [ ] T071 Run baseline-only benchmark on accepted post-T062 behavior and preserve per-fixture correctness plus terminal-state/tokens/calls/irrelevant-context/latency/resource rows; product failures stay in the run inventory, harness errors/retries are reported separately, and retry exhaustion remains NOT_MEASURED/non-PASS.
- [ ] T072 Freeze guarded-source-hydration fixture requirements for stale/moved/deleted/content-mismatch cases without selecting the P3 code-ref implementation yet.
- [ ] T073 Run G-SCHEMA planning check for the additive `view` field/capability metadata; if catalog target cannot be preserved, return to PLAN instead of adding a tool.
- [ ] T074 Independent P2 review: compatibility, token accounting, routing minimality, hidden fan-out, benchmark gaming, P3/P4 scope leakage.

## Dependencies

T063 -> T064/T065/T066/T068/T073.
T066 -> T067.
T069 -> T070 -> T071.
T072 is independent of extractor choice and only freezes the hydration acceptance cases.
T063-T073 -> T074.

## Stop condition

After T074:
- any Critical/High -> PLAN revises P2 only;
- clean review -> PLAN may open P3 deterministic code-graph contract phase;
- no DEV implementation route from P2 planning alone.
