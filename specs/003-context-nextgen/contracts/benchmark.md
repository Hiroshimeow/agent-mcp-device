# Token-Efficiency Benchmark Contract — P2

Status: proposed P2 benchmark contract for independent review.

## 1. Goal

Measure whether progressive retrieval reduces agent-facing context without reducing correctness or hiding cost in excessive calls/latency.

This benchmark freezes measurement before candidate implementation is judged.

## 2. Baseline

Baseline is the accepted post-T062 002 behavior plus direct file tools available to the same agent.

The same task corpus, agent/model configuration, tool permissions and repository revisions MUST be used for baseline and candidate.

If a required post-T062 baseline artifact is unavailable at execution time, the affected metric is NOT_MEASURED and cannot PASS.

## 3. Corpus classes

- S1 exact navigation: known/near-known path, symbol, definition.
- S2 structural flow/impact: references/imports/calls/impact on fixtures with deterministic truth.
- S3 history: past error/change/checkpoint questions.
- S4 mixed feature understanding: current code + selected history; wiki optional.
- S5 trivial single-file: task should require little or no context system routing.

Each case records:
- immutable repo revision/worktree fixture;
- question;
- expected answer or scoring rubric;
- labeled relevant source/evidence spans;
- allowed authority classes;
- forbidden unnecessary branches;
- graph truth fixtures where applicable.

## 4. Token estimator

For cross-client reproducibility, P2 uses the existing product estimate convention:

`estimated_tokens = ceil(UTF8_bytes / 4)`

This is an accounting estimate, not provider billing/tokenization.

Counted bytes:
- all tool response payload text/structured content delivered to the model for retrieval/navigation/hydration;
- all retrieval tool request argument payloads sent by the model, serialized canonically;
- continuation/status text that is model-visible.

Excluded:
- static tool schemas (measured separately by G-SCHEMA);
- hidden transport framing not exposed to the model;
- final natural-language answer tokens;
- model chain-of-thought/internal tokens;
- logs not surfaced to the model.

Canonical serialization for structured payloads: UTF-8 JSON with stable key ordering and no insignificant whitespace.

## 5. Measurement tolerance

The byte-based estimator is deterministic for an identical serialized trace; estimator tolerance is therefore **0 tokens**.

Run-to-run agent/tool-path variability is handled by repeated trials and distribution statistics, not by relaxing the estimator.

Any comparison tolerance for nondeterministic model behavior must be predeclared as a statistical protocol, not chosen after candidate results are visible.

## 6. Run protocol and terminal accounting

Before baseline/candidate evidence is inspected:
- freeze corpus version and repository revisions;
- freeze model/agent configuration;
- freeze temperature/sampling where controllable;
- freeze tool catalog/capabilities;
- choose repeat count per case (minimum 5 for stochastic agent runs; deterministic harness may use 1);
- freeze correctness rubric/pass rule per fixture;
- freeze aggregation order and pairing rule;
- freeze a bounded harness-error retry policy and deterministic replacement rule;
- record environment identity.

### Harness-error policy

The preferred minimal policy is:
- retry the same fixture + run identity for harness-only failure up to a predeclared bounded retry count;
- retries do not change the intended product run identity/seed/configuration;
- every failed harness attempt is retained in raw evidence with retry ordinal and error class;
- if no valid non-harness terminal result is obtained within the retry bound, that fixture/run comparison becomes `NOT_MEASURED`;
- a `NOT_MEASURED` fixture/run cannot PASS correctness or efficiency and cannot be silently removed from the required comparison set;
- do not substitute another seed/run identity after observing failure unless the frozen protocol defined that deterministic substitution in advance.

Every attempted run MUST end in exactly one terminal state:
`correct|incorrect|no_answer|timeout|budget_exhausted|harness_error`.

`harness_error` is an infrastructure outcome, not a product/agent correctness outcome. It MUST NOT lower either baseline or candidate correctness. Harness-error attempts remain in raw evidence but are invalid for product correctness/efficiency comparison until the predeclared retry policy below yields a valid run.

Every run records:
- `correctness` and rubric score/result;
- `tokens_consumed_to_terminal`;
- `tool_calls_to_terminal`;
- `wall_latency_to_terminal`;
- irrelevant-context bytes/ratio where measurable;
- CPU/RSS/IO where measurable;
- branch/tool trace.

`tokens_to_correct_answer` and `latency_to_correct_answer` exist **only** for terminal state `correct`. Failed runs MUST NOT be assigned a synthetic "tokens-to-correct" value and MUST NOT be silently dropped from the raw run table.

For repeated stochastic runs, report correct/failed counts plus median/p95 for each metric whose denominator is explicitly stated. All-run terminal-cost distributions and correct-run efficiency distributions are separate.

## 7. Correctness gate

Correctness is evaluated **before** any token/latency efficiency PASS can be emitted.

Per frozen fixture:
- deterministic run: candidate must satisfy the same rubric/pass rule as baseline; a baseline-correct fixture cannot become candidate-incorrect;
- repeated stochastic run: correctness denominators include only valid non-harness runs obtained under the frozen retry policy;
- baseline and candidate must each produce the required valid run count for the fixture; otherwise that comparison is `NOT_MEASURED` and cannot PASS;
- candidate correct-run count/rate must be >= baseline for that same fixture under the same required valid repeat count; where a numeric rubric is used, the predeclared per-fixture score rule must also not regress.

A gain on one fixture/class cannot compensate for a correctness regression on another fixture/class. Any per-fixture correctness regression makes the candidate FAIL regardless of token savings.

Security/isolation/redaction failure is unconditional FAIL.

For graph-backed tasks P3 adds precision/recall/coverage criteria; P2 does not invent graph truth.

## 8. Efficiency comparison and token gates

Efficiency gates are evaluated only after the correctness gate passes for the compared fixture set.

### Comparison set and aggregation

Baseline and candidate use the same frozen fixtures and repeat counts.

- If deterministic seeds/run identities are controllable, compare paired runs by fixture + run identity.
- Otherwise aggregate within each fixture first, then aggregate fixtures with equal fixture weight; class-level aggregation must not let a high-repeat fixture dominate.
- The report MUST show total runs, correct runs, failed runs, and all-run `tokens_consumed_to_terminal`/latency alongside correct-run `tokens_to_correct_answer`.
- Candidate failures are never removed from the run inventory. Their terminal consumption remains visible even though `tokens_to_correct_answer` is undefined for them.

### NAVIGATE
For correct NAVIGATE cases, p95 model-visible request+response estimate <=1500 tokens. Any correctness regression fails before this gate is considered.

### Simple tasks S1/S5
For correct runs after the per-fixture correctness gate passes, p95 total retrieval/navigation/hydration `tokens_to_correct_answer` <=4000 tokens.

### S2-S4
After per-fixture correctness non-regression:
1. hard token non-regression: candidate median `tokens_to_correct_answer` <= baseline median on the frozen aggregation rule;
2. improvement target: candidate median <=70% baseline OR <=8000 absolute.

The absolute target cannot override gate 1.

If baseline median is zero for a correctness-qualified case/class, candidate must also be zero unless the case's authority requirement changed explicitly before the run.

A candidate that fails the correctness gate cannot receive an efficiency PASS label even if its failed runs terminate cheaply.

## 9. Irrelevant-context ratio

For each run:

`irrelevant_ratio = 1 - relevant_delivered_bytes / total_delivered_retrieval_bytes`

Relevant bytes are only spans/refs labeled by the frozen corpus as necessary or directly supporting the correct answer. Metadata required for provenance/freshness/security is counted as relevant control context when explicitly labeled in the fixture.

Acceptance:
- median <=20%;
- p95 <=35%.

If labeling cannot be made reliable for a class, that metric is NOT_MEASURED for the class and cannot satisfy a gate that depends on it.

## 10. Tool-call discipline

S1/S5 p95 <=3 retrieval/navigation/hydration calls.

Branch trace for S1/S5:
- zero automatic wiki-provider calls;
- zero automatic NMem calls;
- zero history/code-graph branch calls when fixture marks them unnecessary.

Direct file read can be the first/only call for trivial tasks; NAVIGATE is not mandatory.

## 11. Latency/resource gate

Record Windows and Linux separately.

Metrics:
- all-run `wall_latency_to_terminal` including incorrect/no-answer/timeout/budget-exhausted runs;
- correct-run `latency_to_correct_answer`;
- median/p95 tool latency;
- peak/steady RSS where measurable;
- CPU time;
- bytes read/written;
- incremental index/update work counts where relevant.

Latency regression is judged only after correctness passes. Candidate p95 interactive `latency_to_correct_answer` >20% above comparable baseline fails unless separately accepted with an evidence-backed reason. All-run terminal latency is still reported so early failure cannot make the candidate look faster by omission.

Token savings alone do not waive this gate.

No absolute latency SLA is frozen in P2 because no nextgen implementation baseline exists yet.

## 12. Schema accounting

G-SCHEMA is separate from runtime retrieval tokens.

Record:
- total tool count;
- per-tool schema UTF-8 bytes;
- total schema UTF-8 bytes;
- estimated schema tokens using the existing utf8-bytes/4 method;
- annotations/risk lane;
- old-device behavior.

002 target <=10,000 estimated schema tokens remains the compatibility gate unless explicitly revised by owner decision.

## 13. Evidence format

Every benchmark report must retain:
- corpus/version hash;
- repo revision/worktree identity;
- model/agent/version;
- platform/runtime;
- frozen correctness rubric/pass rule;
- frozen repeat/pairing/aggregation rule;
- raw per-run trace or machine-readable summary sufficient to recompute byte/token counts;
- terminal state for every attempt/run;
- harness-error traces, retry ordinals, retry exhaustion and `NOT_MEASURED` rows separately from product failures;
- correct/failed counts per fixture and class using only valid non-harness product runs and the frozen denominator;
- `tokens_consumed_to_terminal`, calls and latency for every valid product run plus raw harness-attempt cost retained separately;
- `tokens_to_correct_answer` only for correct runs;
- failures and NOT_MEASURED rows;
- baseline and candidate side-by-side.

No result is PASS if only aggregate prose exists without recomputable raw measurements. No efficiency PASS is valid unless the per-fixture correctness gate already passed.
