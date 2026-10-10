# Spec Delta - Context NextGen after 002/T062

Status: research/spec-delta only. Baseline 002 is preserved unless later measured evidence justifies a change.

## Goal
Reduce agent context cost while improving structural code understanding through progressive typed retrieval, a deterministic current-code graph sibling to the activity graph, and an explicit human wiki layer.

## PRESERVE
- Device-local durable context; gateway routes/authenticates but does not persist corpus.
- Owner/repo/worktree isolation, redaction-before-persistence, opaque refs/cursors, freshness/coverage.
- Activity/history graph authority and semantics.
- NMem remains separate; no automatic history-to-memory conversion.
- Read/status/search perform no hidden sync/provider call.
- Preserve the six existing public context names unless benchmarks prove a new tool is required.
- Preserve valid 002 call semantics; any incompatible schema change must be explicitly versioned/negotiated with old-device/cached-client behavior, CLI/MCP parity, typed unsupported outcomes, and G-SCHEMA measurement. Stable names alone are not compatibility.
- Current source/raw evidence outranks derived graph/wiki output.

## COMPLETE
- FR-101 Progressive retrieval: NAVIGATE -> EXPAND -> HYDRATE. NAVIGATE contains compact branch cards/refs only, not complete bodies.
- FR-102 Need-driven routing: expose code, flow, impact, history, wiki, memory branches; do not call all branches automatically.
- FR-103 Current-code graph is separate from activity/history. Proven relations require extractor/provenance + source location. Unknown dynamic relations are omitted or marked unsupported.
- FR-104 Bridge layers by explicit refs: event/edit -> file/symbol; checkpoint -> revision; code node -> source range; wiki claim -> evidence refs.
- FR-105 Prefer bounded read_file for current-source hydration, but only with an explicit consistency guard that binds the intended repo/worktree and verifies expected source revision/fingerprint before accepting the range. Changed/moved/deleted/mismatched source must return a typed stale/ref mismatch outcome. Do not add a duplicate public source-read tool unless guarded reuse cannot satisfy this invariant.
- FR-106 Code-graph generations expose revision, extractor/schema generation, coverage and freshness. Failed refresh preserves last-good but marks it stale/failed. No ordinary read/search/status triggers unbounded full-repo rebuild.
- FR-107 Impact/trace means bounded structural reachability, not guaranteed runtime causality.
- FR-108 Wiki is derived human comprehension only. Generation/update is explicit; each generation stores a source manifest and staleness state.
- FR-109 Benchmark correctness, tokens-to-correct-answer, tool calls, irrelevant-context ratio, latency, CPU/RSS/IO, coverage and false positives before freezing defaults.
- FR-110 Minimal surface: no provider, vector store, graph DB, embedding pipeline, new public MCP tool, or automatic retrieval branch without demonstrated value.
- FR-111 Compatibility gate: P2 must keep existing valid 002 source types, graph actions and historical refs semantically valid, or define explicit schema/capability-version negotiation. Old devices/clients with cached schemas must fail or degrade through typed behavior rather than silent reinterpretation; per-tool and total schema delta must pass G-SCHEMA before rollout.

## FIX
- F-101 Replace agent-facing wall-of-text default retrieval with compact discovery + selective expansion.
- F-102 Reject designs that merge activity/history and current-code facts into one indistinguishable authority.
- F-103 Reject wiki claims as current-source/raw-evidence proof unless backed by source refs.

## Package acceptance gates
- AC-101 NAVIGATE p95 <= 1500 estimated tokens and no full body.
- AC-102 Simple exact/single-file tasks p95 <= 4000 retrieval tokens until correct answer.
- AC-103 S2-S4 token usage has two gates: (a) hard non-regression versus the same baseline/corpus within a measurement tolerance frozen in P2, and (b) improvement target <=70% of baseline OR <=8000 absolute. The absolute target never waives non-regression. P2 freezes the tokenizer/estimator and whether request/response envelopes count.
- AC-104 Median irrelevant-context ratio <=20%; p95 <=35%.
- AC-105 Simple-task p95 <=3 retrieval/hydration calls.
- AC-106 Simple-task trace: zero automatic wiki provider calls, zero automatic NMem calls, zero unnecessary branch calls.
- AC-107 Relations labeled proven have 0 false positives on frozen truth fixtures, AND the package reports support matrix, fixture counts, recall/coverage and unsupported/unknown rate. P3 freezes a minimum non-regressing recall/coverage threshold for each declared supported relation before implementation readiness; empty/all-unsupported/NOT_MEASURED graph coverage cannot PASS.
- AC-108 stale/failed generations always surface revision/generation/freshness.
- AC-109 Windows+Linux resource metrics required; >20% p95 interactive latency regression versus comparable baseline fails unless explicitly accepted with evidence.
- AC-110 isolation/security/redaction regression is an unconditional failure.

## Micro-phases
P0 research + spec delta (this turn) -> P1 independent review -> P2 retrieval/router contract + minimal tasks -> review -> P3 code-graph contract + minimal tasks -> review -> P4 wiki contract + minimal tasks -> review -> P5 cross-layer reconciliation/final readiness.

Passing one phase does not authorize later architecture. A later phase may remove earlier proposals.

## Non-goals
No product implementation, branch switch, tag, publish, release, Graphiti/Neo4j core dependency, vector DB, embeddings by default, dynamic-call guessing, merged activity/code graph, automatic wiki generation, or hidden per-turn indexing.
