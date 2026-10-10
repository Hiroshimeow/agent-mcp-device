# Phase R0 — Context NextGen research and evaluation framework

Date/access date: **2026-10-06** (execution-host date). Phase: R0 RESEARCH/AUDIT. Governing document: `C:/Users/admin/Downloads/GOAL-mcp-device-1.0.12.md`. Accepted compatibility baseline and 003 audit: [baseline.md](baseline.md).

## 1. Evidence discipline and conclusion

The product question is not how many search features to add. It is: **what uncertainty needs resolving, which authority can resolve it, and does that retrieval improve a completed task after its entire cost is counted?**

This synthesis combines accepted repository inspection, prior 003 research and fresh primary-source HTTP review. On the access date, Aider docs, GitNexus README, SCIP README, Sourcegraph precise-navigation docs, Serena README, Graphiti README, Cognition DeepWiki announcement, CodeGraph README, Codex README, Claude Code overview, OpenHands README, SWE-agent README and the MCP 2025-11-25 tools specification returned HTTP 200. The installed `agent-browser` did not support its documented `skills get core` command; bounded Node HTTP fetches were used instead, without installing or changing browser tooling. Mutable `main` URLs are observations on this date, not reproducibly pinned external releases. No external system was installed, benchmarked or audited end-to-end. Performance/accuracy statements in their READMEs remain upstream claims, not MCP Device evidence. Primary docs constrain our summary; they do not prove proprietary internal algorithms.

**Recommendation:** preserve native tools and accepted history semantics; prove optional routing/no-search value first; evaluate a product-owned pinned TypeScript semantic analyzer for bounded current-code facts; publish explicit generations off the query path; reuse guarded source hydration; keep wiki behind W4 and NMem separate. No graph DB, vector pipeline, LLM extractor or provider becomes core on this evidence. R0 does not freeze transport shapes, analyzer package version or implementation defaults; S1/V1/B0/P2/P3 own those choices.

## 2. Nine-system comparison

### 2.1 Aider — budgeted repository orientation

**Sources / accessed 2026-10-06:** https://aider.chat/docs/repomap.html ; https://github.com/Aider-AI/aider/blob/main/aider/repomap.py

**Actually does:** Aider sends a compact repository map with change requests. It contains key classes/functions, types/signatures and critical declaration lines. Its docs describe a graph of files/dependencies and graph-ranking selection within an active token budget (default around 1,000 map tokens, with adaptive expansion). Tree-sitter definition/reference extraction supports this orientation; it is not a guarantee that every selected item is needed by the task or that all runtime calls are known.

**Useful idea:** compact landmarks under a hard budget can identify the next file/symbol to inspect, separating orientation from body hydration.

**Cost/complexity:** parser/grammar coverage, dependency/ranking work, cache invalidation and map tokens. Deterministic extraction avoids embedding inference but still has repository-size and freshness costs.

**MCP Device applicability:** candidate representation inside an explicitly selected code EXPAND path for unfamiliar broad tasks. Benchmark against direct grep and symbol lookup, not an artificially full-file baseline.

**Deliberately do not copy:** automatic map injection on every request, PageRank as task relevance proof, map text in NAVIGATE, universal grammar breadth or asserted token savings without local trials.

### 2.2 GitNexus — task-shaped symbol, impact and process context

**Source / accessed 2026-10-06:** https://github.com/abhigyanpatwari/GitNexus (README fetched from `raw.githubusercontent.com/abhigyanpatwari/GitNexus/main/README.md`).

**Actually does:** builds a local repository knowledge graph including dependencies, symbols, clusters and execution/process views. The current README exposes 19 MCP tools, including process-grouped `query`, symbol `context`, depth-grouped `impact`, diff `detect_changes`, rename, grep and read tools; resources expose setup, stats/staleness, clusters, processes and schemas. Query describes BM25 + semantic + reciprocal-rank fusion. Current README says local embedding runtime is **opt-in**, not part of default install. `analyze` may also install skills/hooks and write agent context files. These are documented product behaviors, not proof that every inferred flow is statically sound.

**Useful idea:** name intent clearly: find a symbol, inspect bounded references, explore a flow, assess structural blast radius; compact next-step hints can reduce aimless file hopping.

**Cost/complexity:** graph persistence, parsers/native grammar support, index maintenance, clustering/flow precomputation, large catalog and optional model runtime. Repo/branch selection versus working-tree reads requires freshness discipline.

**MCP Device applicability:** adopt task vocabulary and explicit bounds/provenance, not architecture wholesale. A structural trace must state supported relation types and direction; impact is reachability, not guaranteed runtime effect.

**Deliberately do not copy:** 19-tool surface, arbitrary graph queries, automatic skill/hook/document mutation, confidence scores promoted to proof, broad default context, clusters/PDG/taint/embeddings before measured demand. Correct the older research's alternative `nxpatterns/gitnexus` reference by using the primary project above.

### 2.3 SCIP and CodeGraph — deterministic fact interchange and local graphs

**Sources / accessed 2026-10-06:** https://github.com/sourcegraph/scip ; https://github.com/Lordymine/codegraph . SCIP and CodeGraph READMEs were freshly fetched. The unsupported LSIF reference has been removed; this comparison is bounded to the freshly reviewed SCIP and CodeGraph evidence, not an independent LSIF format review.

**Actually does:** SCIP defines a language-agnostic Protobuf index for symbols, documents, occurrences and relationships, with language-specific indexers and tooling. A format is not an analyzer or a guarantee of runtime call precision. CodeGraph is a local Go/SQLite adjacency-list graph with compact refs, explicit snippet retrieval and indexed structural queries. Its README delegates TS/JS call resolution to `scip-typescript`, Go analysis to `go/packages`/VTA, drops unresolved endpoints, exposes staleness and atomic reindex behavior, and auto-indexes on MCP launch. Its advertised cost/quality ratios remain project-specific claims; dropping invalid endpoints alone is not sufficient proof that every remaining call is a unique runtime target.

**Useful idea:** symbol/occurrence identity, source ranges, extractor provenance, explicit supported relation semantics, compact refs before snippets, last-good generation and truthful degradation.

**Cost/complexity:** compiler/build setup dominates extraction; interchange decoding/storage and parser/indexer dependencies add weight. CodeGraph uses a separate language/toolchain and can invoke indexers through `npx`; copying it would introduce trust/version/packaging questions.

**MCP Device applicability:** use the smallest local fact model required by S2. Prefer a pinned TS compiler/type checker as the first candidate for this TS-heavy repository. Separate precision, supported-set recall and broad repository coverage. Authorized compiler config/module reads must respect canonicalized roots/symlinks.

**Deliberately do not copy:** entire LSIF/SCIP pipeline, Go runtime/native parser fleet, automatic startup indexing, clone-similarity/dead-code claims, full architecture map as default, or runtime dispatch conclusions from declaration resolution. Omit/mark dynamic and ambiguous calls rather than guess.

### 2.4 Sourcegraph — precise navigation with explicit coverage boundaries

**Sources / accessed 2026-10-06:** https://sourcegraph.com/docs/code-navigation/precise-code-navigation ; https://github.com/sourcegraph/scip .

**Actually does:** opt-in precise navigation uses uploaded language-specific SCIP indexes. Docs recommend CI indexing for complex/authenticated builds; Sourcegraph can auto-index, and falls back to search-based navigation when precise data is unavailable. Current docs distinguish the precise service from its search fallback and list indexer/language support. Precise availability depends on successful indexing/build configuration, not just having a repository.

**Useful idea:** precise versus lexical evidence must be distinguishable; indexer/version/config/revision and coverage matter as much as the query label.

**Cost/complexity:** indexer execution, CI/build environment, index upload/storage/service configuration, refresh lag and deployment/licensing overhead.

**MCP Device applicability:** provenance-bearing local facts and transparent unsupported/degraded modes, without deploying Sourcegraph or moving corpus to the gateway. Direct search remains a fallback, labeled lexical rather than proven semantic.

**Deliberately do not copy:** hosted/server infrastructure, upload of local context, automatic fallback described as precision, or a standardized index treated as complete evidence of absence.

### 2.5 Serena — symbol-first IDE semantics

**Source / accessed 2026-10-06:** https://github.com/oraios/serena .

**Actually does:** semantic retrieval/editing/refactoring through LSP servers or an alternative JetBrains plugin, exposed to agents through MCP. README distinguishes backend capabilities: symbol lookup/overview/references, declarations/implementations with language limitations, and backend-specific rename/move/refactoring. It also has project configuration/memory. Current support breadth and agent testimonial/evaluation claims are upstream claims, not local benefit measurements.

**Useful idea:** file outline or symbol-first lookup plus narrow hydration can eliminate ambiguous lexical hops. Capability-specific support tables avoid pretending all backends support all relations.

**Cost/complexity:** language-server lifecycle, initialization, configuration, dependency installation, possible IDE/plugin coupling and per-language resource differences.

**MCP Device applicability:** targeted structural primitives and explicit coverage. Native direct read stays cheapest for a known small file. Compiler batch extraction may be simpler than maintaining live LSP servers for the initial TS scope.

**Deliberately do not copy:** broad always-on server fleet, mandatory onboarding/memory, external-project traversal beyond filesystem authorization, a large editing/tool catalog or endorsements as acceptance data.

### 2.6 Graphiti — temporal provenance, not the current-code engine

**Source / accessed 2026-10-06:** https://github.com/getzep/graphiti .

**Actually does:** builds temporal context graphs from episodes, entities and validity-window relationships with provenance, learned/prescribed ontologies and hybrid semantic/keyword/graph retrieval. Current README requires Python and an external graph backend (Neo4j/FalkorDB/Neptune or deprecated Kuzu), defaults to OpenAI LLM inference/embeddings and supports alternate providers. Distinguish open Graphiti's bring-your-own DB from managed Zep's proprietary engine. Temporal statements do not make extracted entities/edges deterministic code facts.

**Useful idea:** event time versus validity, supersession and lineage can inform interpretation of existing history evidence.

**Cost/complexity:** graph service operations, LLM extraction, embeddings/search, credentials, ingestion updates, entity resolution and privacy/egress policy.

**MCP Device applicability:** conceptual temporal provenance only. Existing activity/history graph already has accepted semantics; evaluate any history enhancement separately, never as a reason to replace it or convert it into memory.

**Deliberately do not copy:** Graphiti/Neo4j core, learned code relations, hidden ingestion/provider calls, automatic memory conversion or history/code merged authority. GOAL rejects this stack absent measured necessity and a separate owner decision.

### 2.7 DeepWiki — derived human comprehension

**Sources:** https://cognition.com/blog/deepwiki (canonical Cognition announcement; accessed 2026-10-06); https://github.com/AsyncFuncAI/deepwiki-open (historical open-source comparison from prior research; not freshly verified here; access date unknown).

**Actually does:** Cognition's announcement describes free generated documentation and conversational repository understanding for public GitHub repos, with private repositories via Devin. It advertises up-to-date documentation, but the fetched announcement does not establish a source-fingerprint freshness SLA or consistency guarantee. The historical open-source comparison does not establish current indexing/generation behavior and must not be conflated with Cognition's proprietary service.

**Useful idea:** a cited architecture/feature dossier can compress explanation for human comprehension tasks, provided its source manifest and freshness are explicit.

**Cost/complexity:** generation/model cost, provider egress, page storage, source selection, citation checking, stale invalidation and user-intent/permission provenance.

**MCP Device applicability:** W4 optional decision only after S4 ablation demonstrates net benefit versus source + code/history. Explicit generation, provider/model identity, source manifest, costs and stale state would be required by a later contract.

**Deliberately do not copy:** automatic mandatory wiki, generated prose as current truth, ordinary-read regeneration, disabled future infrastructure before a positive gate, remote upload defaults or an assumed freshness guarantee.

### 2.8 Coding-agent context management — Codex / Claude Code / OpenHands / SWE-agent

**Sources / accessed 2026-10-06:** https://github.com/openai/codex ; https://code.claude.com/docs/en/overview ; https://github.com/OpenHands/OpenHands ; https://github.com/SWE-agent/SWE-agent . All four primary pages were fetched.

**Actually does:** these are agent runtimes/interfaces rather than one retrieval algorithm. Codex documents a locally running coding CLI. Claude Code documents reading/editing code, commands, MCP integration, project instructions, memory and session surfaces. OpenHands' current README describes Agent Canvas/backend orchestration and local/Docker/VM agents; do not assume its older monolithic layout is current. SWE-agent documents tool-mediated repository tasks and now recommends mini-SWE-agent for new use. Public overview pages do not disclose exact proprietary query-selection, compaction or ranking policies.

**Useful idea:** filesystem/terminal tools are a competitive baseline; an agent-computer interface and compact durable state can matter more than another corpus. Resume should retain intent and verified evidence refs, not replay entire transcripts.

**Cost/complexity:** model/context costs, tool latency, permissions and runtime/session implementation vary by client. Direct grep has near-zero setup, while repeated file hopping can cost tokens/calls. Compaction loses details unless authoritative refs are retained and checked.

**MCP Device applicability:** measure the same frozen agent/client/model using native tools with and without candidate retrieval. Keep local execution and permission gates; require S6 restart/ref verification. Do not redesign the agent runtime inside the gateway.

**Deliberately do not copy:** undocumented internal algorithms as fact, auto-memory semantics, remote/cloud defaults, always-on orchestration, arbitrary compaction as freshness proof or benchmark headline scores as evidence of this product's retrieval value.

### 2.9 MCP — discovery, negotiation and progressive disclosure

**Source / accessed 2026-10-06:** https://modelcontextprotocol.io/specification/2025-11-25/server/tools . Historical 2025-03-26 URLs in the old draft are not the current reviewed snapshot.

**Actually does:** tools declare capabilities, names, descriptions and input schemas; clients list tools (with pagination), invoke them and may receive `notifications/tools/list_changed` where declared. The specification supports structured output/resource links and schema metadata. Discovery is distinct from execution. It does **not** mandate host-specific dynamic schema hiding, token ceilings, authority routing or a no-search decision.

**Useful idea:** negotiate capabilities/version explicitly and keep discovery metadata small; distinguish availability cards from body queries; compatible cached clients may keep legacy behavior.

**Cost/complexity:** catalog serialization/prompt bytes, listing round trips, schema caches, version skew and unsupported-device behavior. More optional fields can inflate context even without more tool names.

**MCP Device applicability:** preserve six accepted context names and legacy semantics; measure whole catalog plus per-tool deltas. Unsupported new inputs must fail typed before dispatch, not be stripped into an unintended legacy search. Gateway authenticates/routes; device owns execution/context.

**Deliberately do not copy:** assume every host honors list changes or supports deferred loading, embed corpus in descriptions/schemas, add public tools per internal component, or use a single endpoint to conceal multi-authority work.

## 3. Alternatives and measured decision boundaries

| Option | Expected value | Dependency / portability cost | R0 recommendation for S1 review and evidence needed |
| --- | --- | --- | --- |
| Native bounded read/grep/project/process | Best known-file/lexical path; no setup | Existing cross-platform tools | PRESERVE, B0 comparator; candidate must not handicap it. |
| Existing 1.0.11 retained history/activity | Past events/checkpoints with evidence refs | Accepted local storage/gates | PRESERVE; no code-authority reinterpretation. |
| Optional compact routing | Fewer wrong branches/context | Small contract/schema overhead can still regress simple tasks | Candidate P2; R2 must prove benefit/no-search behavior before P3. |
| Product-owned pinned TS Compiler API | Strong current TS symbol/reference evidence | Runtime package size, compiler API pin, cold RSS/time, authorized module reads | Preferred P3 candidate, not final version/packaging choice. |
| Project-local arbitrary TS compiler | Avoids product install footprint | Repo-dependent execution trust/version drift | REJECT default; isolated explicit opt-in requires separate review. |
| Tree-sitter syntax graph | Broader parsing/cheap syntax | Grammar/native packaging; cannot alone prove semantic calls | DEFER until unsupported-language demand is measured. |
| SCIP/indexer/LSP stack | Mature identities/navigation | Language/build/server lifecycle and interchange dependencies | Borrow semantics; full integration DEFERRED. |
| Explicit wiki | Potential S4 explanation compression | Provider cost/egress/staleness/manifest lifecycle | W4 gate; DEFER if no measured net gain. |
| Graphiti/vector/LLM graph | Temporal/semantic retrieval possibilities | Graph service + provider/embedding operational burden | REJECT core under current evidence. |

The prior TS probe (~7.46 s, 377 MB, 23.6 MB unpacked compiler, 127 roots) is neither a packaging gate nor a call-edge quality benchmark. It did not establish precise calls, compiler-host path containment, repeated cold/warm distributions or Windows/Linux equivalence. Analyzer choice requires pinned version, authorized config/resolution roots, semantic truth fixtures, package/license delta and explicit off-query-path work. Sound full affected-unit rebuilds are preferable to unsound fine-grained invalidation. Optimize after measuring no-change/local/API/config changes; preserve atomic last-good publication on cancellation/failure.

## 4. Central question: what, when and what not to search

### What should an agent search?

Search the smallest authoritative unit that resolves a named uncertainty:

| Uncertainty | First path | Stop evidence |
| --- | --- | --- |
| Known path/range, exact literal, small local edit | Native bounded read/grep/edit | Current source and relevant test; no context search required. |
| Near-known symbol, definition/reference/import | Direct native discovery or supported current-code graph | Correct symbol identity and guarded source range; lexical matches are not semantic proof. |
| Caller/callee/flow/impact | Bounded proven code relations | Relevant endpoints/paths with coverage/unknown state; no runtime-causality claim. |
| Past error/change/checkpoint | History/activity search then retained evidence read | Observed event refs/timestamps/raw evidence, not newer source substituted for history. |
| Architecture/feature explanation | Current code/spec/tests; wiki optional after W4 | Claims grounded in authoritative source; stale derived prose clearly labeled. |
| Durable preference/rule/decision | Separate NMem when explicitly appropriate | Memory provenance/conflict/validity; no automatic history conversion. |

### When should it search?

1. State the task and unresolved question; check whether existing evidence already suffices.
2. If a known native path answers it, bypass context routing entirely.
3. Otherwise NAVIGATE may inspect bounded published branch status only, without bodies, searches, NMem, providers or indexing.
4. Select **one** authority by need. EXPAND bounded refs/relationships, then HYDRATE only supporting bodies/ranges.
5. For a truly mixed task, obtain evidence from another authority only after naming the remaining uncertainty. This is sequential deliberate selection, not hidden/default fan-out.
6. Stop when the rubric/action is supported. Repeated queries require a stated new information gap.

### What should it NOT search?

Do not query every available store, whole-repo maps for tiny edits, history for ordinary discovery, memory because it exists, wiki as current-source proof, or dependency/generated/vendor corpora outside declared authorized scope. Do not resolve dynamic calls by guesswork, interpret missing relations as negatives, silently hydrate newer content through stale line numbers, index during reads or invoke providers during status/search. Do not convert a resume into full transcript replay; revalidate durable refs and hydrate only changed/needed evidence.

**Guarded source hydration:** bind owner/repo/worktree, authorized canonical path, expected revision or content fingerprint and intended range/ref. Changed/moved/deleted/mismatched sources return typed stale/ref mismatch. Prefer additive reuse of bounded `read_file`; do not decide a duplicate public read tool in R0.

## 5. Proposed benchmark framework: S1–S7

**Framework status:** GOAL governs the S1–S7 classes, five evaluation levels, repeated stochastic trials with frozen model/config and retained terminal results, correctness-first invariants, and mandatory B0 freeze/run against accepted 1.0.11 plus native tools before candidate implementation/results. The elaborations below are R0 research recommendations for fresh S1/B0 review, not additional accepted requirements or frozen decisions. In particular, a second repository shape, trial/retry counts, serialization/estimation choices and statistical adjudication remain proposals for B0 to assess and freeze. This is **not** a claim that executable corpus/fixtures, hashes or baseline measurements already exist. GOAL assigns `benchmark-contract.md`, `fixtures/` and `evidence/112/baseline/` to B0. Threshold choices cannot be tuned after viewing candidate outputs; proposed recall/coverage thresholds need P3 review before D3, and W4 cannot refreeze the corpus to favor wiki.

| Scenario | Representative frozen fixture | Required correctness / routing truth |
| --- | --- | --- |
| S1 Exact navigation | Known path/range and near-known symbol with same-name decoys | Correct definition/range and identity; direct route allowed; unrelated history/wiki/memory forbidden. |
| S2 Structural flow/impact | Imports/reexports/references/calls/inheritance plus dynamic/ambiguous negative cases | Independently labeled endpoints, direction and bounded paths; zero false proven edges; explicit unknown/coverage; compare actual patch/test or answer rubric. |
| S3 History | Past error, edit and checkpoint with retained raw evidence | Correct past revision/event and evidence refs; no substitution of present code; no memory conversion. |
| S4 Mixed understanding | Current feature explanation/change needing selected historical rationale | Grounded current claims plus relevant history; deliberate second authority permitted; wiki optional ablation, never required for correctness. |
| S5 Trivial single-file | Exact file small change with local test | Native read/edit/check; **zero unnecessary context-system calls**, not mandatory NAVIGATE. |
| S6 Interrupted/resumed | Stop after refs selected; restart with compact task packet; repeat unchanged, changed, renamed, deleted and revoked cases | Scope/ref authorization retained; stale mismatches typed; minimal rehydration; no whole transcript replay, stale-as-current claim or implicit rebuild. |
| S7 Negative routing | History/code/wiki/NMem all present; task already has sufficient evidence or known local file | No unnecessary authority call, no provider, no NMem and no hidden index work; correct task completion despite bypass. |

### 5.1 Recommended B0 freeze manifest

Freeze fixture IDs/counts/class weighting, repository/worktree snapshots including dirty-file content, history data/permissions, expected answers or patch-test rubric, independently labeled relevant spans/refs, allowed/forbidden authorities and graph truth. Consider a second representative TS repository shape to reduce single-repo overfit; GOAL does not mandate a repository count. Freeze model/client/agent version, prompt/instructions, sampling settings/seeds where available, tools/catalog/capabilities, runtime/platform/hardware, budgets/timeouts, warm/cold/cache state, repetitions and aggregation rule. Record hashes and immutable manifest version before candidate runs. Baseline is **accepted 1.0.11 plus native tools**, not the integration worktree's v1.0.10 package or a weakened grep strategy.

Stochastic task runs: GOAL requires repeated trials with frozen model/config and retained terminal results. R0 recommends at least five valid trials per fixture per arm with frozen pairing/order, and one run for deterministic truth checks, for B0 to assess rather than accept automatically. R0 also recommends predeclared bounded harness retries (proposed maximum two) with every attempt retained; B0 owns the trial counts and harness retry policy. Candidate tuning uses separate development fixtures, not hidden acceptance answers. Freeze correctness scoring and relevant-byte labels independently of candidate outputs; blinded adjudication where practical.

### 5.2 Five levels and accounting

Evaluate **routing -> retrieval -> task correctness -> context cost -> latency/resources**.

- Routing: chosen/forbidden/wrong branches, bypass accuracy, provider/index/NMem invocation counters; available-but-unused is a success on S5/S7.
- Retrieval: relevant evidence precision, graph edge precision, supported-set recall, eligible/analyzed/unsupported files and unknown/ambiguous rate. Empty/all-unsupported graphs cannot PASS.
- Task: answer rubric or patch/tests; terminal state and score per fixture, not only Recall@k. Preserve security/isolation/redaction and legacy semantics.
- Context: distinguish **actual retrieval request/response bytes** from **actual model-visible context delivered** (including arguments, responses/continuations and client presentation), with separate counters; neither may be replaced by reserialized JSON. Account for envelopes, whitespace, escaping, textual output, attachments and representation changes at each boundary, including native tools. If a boundary cannot be observed, report NOT_MEASURED rather than substituting a normalized count. Canonical stable-key UTF-8 JSON may be reported separately as **normalized comparison bytes** only, not actual traffic/context. The proposed estimator `ceil(bytes/4)` is deterministic, not provider billing; label its byte basis and keep normalized estimates separate from delivered-context estimates. Report irrelevant ratio, calls until correct answer and terminal costs for failed runs. Measure static schemas separately and include their actual model-visible catalog cost without double counting. B0 must freeze counter boundaries, envelopes, client representation/attachment rules and the reporting of instruction/final-answer costs before results.
- Time/resources: wall task latency, tool p50/p95, CPU/RSS/IO, install/index setup, no-change sync, local/API/config changes, parsed/revalidated/rewritten counts, contention/capture impact and cancelled/failed generation behavior. Compare Windows/Linux separately; record unmeasurable metrics as NOT_MEASURED, never zero.

Terminal states: `correct | incorrect | no_answer | timeout | budget_exhausted | harness_error`. Every attempt remains in raw evidence. Harness errors are infrastructure outcomes; retry policy must not quietly change seeds/tasks. Exhausted required comparisons are NOT_MEASURED/non-PASS. `tokens_to_correct` exists only for correct runs; report all-run terminal costs and correct-run efficiency separately, with explicit denominators. Do not drop failed/slow trials or reward early failures as cheap correct answers.

B0 must predeclare paired regression handling separately from statistical per-fixture rate comparisons. Prefer paired fixture/run identities with frozen configuration/seeds where available; report baseline-correct -> candidate-incorrect outcomes explicitly. For unresolved or unpaired comparisons, a predeclared adjudication rule is necessary; absent that rule/evidence, non-regression is NOT_MEASURED, not PASS. Equal correct counts alone cannot establish non-regression. R0 recommends aggregation within fixture then equal weighting across fixtures, subject to B0 review. Report per-fixture correctness, class distributions, correct/failed counts, p50/p95, paired outcomes/deltas and uncertainty. A high-repeat/easy fixture must not compensate for another fixture's regression. Retain trace/timing/resource records sufficient to recompute totals; prohibit prose-only PASS.

### 5.3 Correctness-first failure rules

GOAL's unconditional FAIL conditions remain governing: regression on any baseline-correct fixture; isolation/security/redaction or permission regression; silently stale-as-current evidence; any false edge labeled proven on frozen truth; hidden provider/index/rebuild on ordinary query. For repeated runs, observed baseline-correct -> candidate-incorrect paired outcomes are regression evidence, not cancelled by improvements on other trials. Statistical per-fixture correct counts/rates and rubric scores are separate comparisons; equal totals alone do not satisfy the correctness gate (for example, `[correct, incorrect]` versus `[incorrect, correct]`). B0 owns the predeclared pairing/adjudication and statistical rules without weakening GOAL's non-regression invariant. Unresolved or unpaired comparisons require that predeclared rule and sufficient evidence; missing required data is NOT_MEASURED, not PASS.

No efficiency claim is accepted before these gates. Proven-edge zero false positives must be accompanied by nonzero truth counts and minimum declared supported-category recall/coverage frozen before candidate extraction; omission and unsupported cases remain visible. Prior 003 100%/95% recall proposals are hypotheses to validate, not established measurements.

### 5.4 Initial efficiency targets to validate/freeze in B0

- NAVIGATE p95 <=1,500 estimated request+response tokens, zero bodies/hidden work.
- S1/S5 p95 <=4,000 retrieval tokens and <=3 retrieval/hydration calls; S5/S7 unnecessary context/branch calls must be zero. These ceilings do not permit overhead against a zero-search baseline.
- S2–S4 median tokens-to-correct must not exceed baseline; separately target <=70% baseline **or** <=8,000 absolute. Absolute ceiling never waives non-regression.
- Irrelevant-context ratio median <=20%, p95 <=35%, using frozen span/control-metadata labels.
- >20% interactive p95 latency regression fails unless separately accepted with evidence; token savings do not waive latency/resource regressions.
- Record per-tool/catalog schema bytes/tokens, count/annotations, old-device/cached-schema outcomes. Prior 002 <=10,000 schema-token gate is compatibility input, not license to fill it with speculative fields.

The byte estimator has zero tolerance for identical serialization; agent variance requires frozen statistical treatment, not post-hoc tolerance. Baseline-zero costs remain zero unless an explicit pre-run authority requirement changes. Small-sample p95 is descriptive, not a service commitment.

### 5.5 How to prove retrieval helped rather than add a layer

Run baseline and candidate on the same frozen task state, with fair native tools and permissions. First require non-regressing task correctness and invariant truth. Then compare all-in context/calls/time and index/setup amortization, not isolated query output length. Ablate routing-only versus baseline, graph versus routing/native, and optional wiki versus code/history; do not credit the whole bundle when one component adds no value. S5/S7 enforce bypass, S6 catches replay/stale-ref costs, and S2 makes graph quality non-vacuous. A feature with no measurable task benefit should be removed/deferred even if its unit tests pass. Retain failed and NOT_MEASURED trials and report uncertainty; external ratios and FTS Recall@k are not release proof.

## 6. Research recommendations and next handoff

The following are proposed classifications for fresh S1 review, **not** an accepted S1 decision register: PRESERVE accepted history, six-tool semantics, native direct tools, local corpus and fail-closed isolation; consider COMPLETE for optional minimal navigation and truthful bounded code understanding only after B0/reviewed contracts; FIX stale P5 readiness assumptions and hydration consistency; consider DEFER for wiki, parser breadth, aggressive incremental optimization and speculative bridge persistence; REJECT default fan-out, merged authorities, dynamic-call guessing and unmeasured heavy dependencies (full register in baseline.md). GOAL-mandated compatibility, authority, security and phase invariants remain governing constraints; R0's additional scope/benchmark recommendations do not bind S1 or freeze B0.

R0 stops with `baseline.md` and `research.md`. Fresh S1 PLAN creates constitution/spec and explicit classification, V1 reviews it, B0 freezes/runs baseline before candidate implementation, P2/D2/R2 tests routing before code graph, P3/D3 slices review graph, and W4 decides wiki from evidence. No source/package changes, merge, push, tag, publish, release or deployment is authorized by these documents.
