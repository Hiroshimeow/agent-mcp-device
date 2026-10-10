# Measurement contract / acceptance fixtures — 006

**Status:** DESIGN TARGETS, NOT MEASURED. No result below is a present-tense claim.

## Method: correctness first, actual total token cost second

Freeze a `manifest.json` for every A/B run with the exact:
- G6/G8 device/agent version, Git ref, corpus and source SHA, timestamps, installed tool/schema version and permission state.
- Client/model, prompt, sampling parameters, task order/random seed, native tools, token estimator or API usage source, cache state and number of repeat trials.
- Ground-truth task completion condition, expected evidence and known failure/negative examples.
- Initial Wiki snapshot, skills snapshot, extraction/curation schedule, LLM/provider settings, byte budgets.
- All outcome receipts, including timeout, crash, retry, wrong answer, no memory lookup and denied ref.

### A/B comparison

- **A (control):** same agent/model/native tools, no Palace memory retrieval or automation; existing code/test/file access is identical.
- **B (candidate):** same initial repository and allowed tools, Palace enabled with frozen starting corpus/scheduled jobs. Do not manually give B a hidden hint.

Count **all** model usage across the measured lifecycle:

```text
TOTAL_MODEL_TOKENS =
  agent_prompt + agent_completion
  + memory_locator_or_search_calls
  + wiki_digest_generation_and_revisions
  + skill_generation_and_curator_calls
  + optional_embedding_equivalent_token_input
```

Tokens and actual paid costs are **different metrics**; show both if provider returns usage/prices. Report per-task foreground and *amortized per successful reuse* background cost, with real reuse frequency and at least one idle/no-change interval. Record tool calls, bytes, CPU/RSS, p50/p95 wall time and disk growth. No savings claim from search-result size alone.

## Frozen test matrix (minimum)

| Fixture | Control / candidate goal | Required outcome |
| --- | --- | --- |
| F01 Exact known file | Both receive explicit current file location | B does not call Palace or spend Wiki tokens |
| F02 Prior fix same repo | Historical G6 tool/error/edit/test evidence exists | B locates correct ref then reads only necessary evidence; no unsupported causal claim |
| F03 Transfer to new G8 repo | G6 producer has solved analogous problem; G8 consumer has no producer chat | B retrieves scoped Wiki/skill and correctly adapts without user guide; logs/Git still verified |
| F04 Reverse transfer | G8 producer → fresh G6 consumer | Same without user transcript |
| F05 Wrong-scope lookalike | Similar error but different environment/revision | B avoids applying incorrect recalled fix |
| F06 Repeated failure | Two failed attempts and one validated improvement | Graph and Wiki preserve failure chain, test evidence and learning conditions |
| F07 Gap/partial record | Intent with missing outcome and limited transcript | B shows unknown/partial, never claims solved |
| F08 Session graph | Multiple turns/tool invocations/files/errors/tests with stable IDs | Deterministic supported edges, pagination and bounded search |
| F09 Stale and contradictory | Old Wiki fix invalidated by newer test/code | B flags stale/superseded claim and does not silently reuse it |
| F10 Owner denial | Other owner's repo/Wiki/skill ref present | Zero unauthorized discovery/body/secret leakage |
| F11 Offline/reconnect | Disconnected Device/Wiki/provider, resumed import | Native tools still work; idempotent replay, no duplicate skills |
| F12 Skill lazy-load | Broad library, only one relevant skill | Catalog tiny; B loads only that skill body and necessary resources |
| F13 Skill merge | Two overlapping agent-owned skills, one pinned/user skill | Scheduled merge automatic, no user approval, preserved resources, pinned unchanged, verifiable rollback |
| F14 Malicious source log | Prompt-injection text appears in captured tool result | Treated as evidence data, not trusted instruction or executable step |
| F15 Idle no-change | No meaningful new events between scheduler cycles | No Wiki LLM/curator calls; bounded overhead |
| F16 Backend evaluation | Same corpus for ReMe/OpenViking and a native FTS-only fallback | Choose only backend with measured correctness, portability, security and amortized cost |

## Quantitative gates

| Metric | Target / hard gate |
| --- | --- |
| Task correctness and owner privacy | **Non-regression hard gate**; any cross-owner disclosure FAIL |
| Proven activity graph edges | **Zero false proven edges** on frozen fixture with nonzero supported-edge coverage |
| New-repo autonomous reuse | At least one successful full producer→consumer acquisition, G6→G8 and G8→G6, with no manual handoff |
| Search steps | Typical meaningful recall ≤2 foreground calls: locate + read; known-file case 0 |
| Bootstrapped locator | ≤250 estimated model-visible tokens, not entire wiki |
| Locate response | p95 ≤1,200 model-visible tokens, with real corpus |
| Repeated-task model-visible tokens | **Goal ≤70% of control** with equal/higher correctness, plus separately report amortized background cost |
| Total lifecycle cost | Candidate must show credible **net benefit under measured reuse frequency**. If no repeated-use savings, label `NOT_PROVEN` |
| Scheduler idle time | 0 content-generation LLM calls when input digest unchanged |
| Duplicate replay | 0 duplicate index events, graph edges or published skill versions after retransmit |
| Skill merge | Versioned, automatic, rollback-tested, 0 per-skill approval prompts |
| Freshness | Stale/partial/unavailable state explicit; no read-triggered full rebuild |
| Gateway/Device compatibility | Device 1.0.11 legacy contract tests PASS; Gateway UI/OAuth/device functionality unchanged |

Latency/CPU/RSS/storage limits must be pinned after P0 measurements using comparable fixtures; **do not invent SLA results**. If test harness cannot observe model/provider tokens, mark usage `NOT_MEASURED`.

## Test execution order

1. Validate repo/source identity and source event IDs.
2. Replay frozen event ingestion and graph correctness tests.
3. FTS locator→read, permission/secret/budget tests.
4. Wiki extraction/dream with contradictions and stale updates.
5. Cross repo cold-agent and unauthorized cases.
6. Skill candidate→lazy-load→scheduled merge→rollback.
7. A/B repeated task correctness, net tokens/costs, latency and resource use.
8. Full Device acceptance + Gateway compatibility and independent final review.

## Stop decisions

- `FAIL_SECURITY`: unauthorized evidence, secret propagation or bypass of auth/capture gate.
- `FAIL_CORRECTNESS`: false verified result, stale advice confidently asserted, wrong execution.
- `FAIL_COST`: unbounded extraction, repeated idle curator runs, no demonstrated net utility at realistic reuse.
- `INCOMPLETE`: any required metric/fixture not measured.
- `PASS_RESEARCH_ONLY`: upstream backend interface works, but product E2E not yet proved.

No partial/microbenchmark report authorizes merge/reload by itself.