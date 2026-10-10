# P3 Plan — Deterministic Code Graph

Status: docs/contracts only. No implementation authorization.

## Scope

P3 owns only:
- analyzer strategy for deterministic current-code facts;
- code node/edge/ref/provenance model;
- code-generation freshness/incremental publication;
- code search + structural impact/trace contract;
- activity bridges;
- guarded hydration provenance;
- acceptance/tasks.

P3 does not own:
- wiki generation/content/provider (P4);
- product implementation;
- release/publish.

## Chosen minimal analyzer strategy

First analyzer is a product-owned pinned TypeScript compiler API implementation, target version 5.9.3.

Rationale:
- repository source is overwhelmingly TypeScript;
- compiler/type-checker already proves the semantic relations P3 needs;
- Tree-sitter is absent and would add another parser family without solving semantic resolution alone;
- project-local compiler packages are not accepted as default authority because behavior/trust would vary by repository.

Production packaging of the pinned compiler is a deliberate dependency/package decision for DEV, but behavior/version is contractually pinned before implementation.

## Public compatibility delta

No new public tool.

Additive fields only:
- `local_search.branch=code`;
- `local_graph.graph_kind=code`;
- `local_index.index_kind=code`;
- additive code freshness/coverage metadata in status/NAVIGATE;
- capability detail `code-graph-v1` inside existing context capability/version channel.

Omitted fields preserve 002/P2 behavior.

## Core invariants

1. Source is authority; graph is derived.
2. Activity and code graph remain separate.
3. Proven edge requires exact extractor/source evidence.
4. Every relation has frozen source/target node kinds and canonical direction; dependency relations are dependent/source -> dependency/target, `constructs` always targets the class symbol (constructor callable detail is separate), and repeated occurrences collapse to one logical edge with occurrence metadata.
5. Dynamic/ambiguous calls are omitted as calls, not guessed.
6. Query path invokes compiler zero times.
7. Explicit sync/rebuild owns analysis.
8. Failed/cancelled build leaves last-good generation.
9. Narrow invalidation is used only when sound; safe fallback is affected-unit reanalysis.
10. CompilerHost/config/module-resolution reads are constrained after canonical path/symlink resolution to authorized repo/worktree, product stdlib and explicitly allowed dependency roots; blocked external inputs degrade coverage rather than expand authority.
11. Authorized external resolution inputs that can affect semantics are freshness-manifest inputs; analyzer degradation metadata is redacted.
12. Source-span refs bind generation + file fingerprint + range.
13. Hydration mismatch is typed stale/source-changed, never silent newer-content substitution.
14. No graph DB/vector/embedding/provider dependency.
15. No full source-body persistence in graph.
16. No-fallback incremental acceptance applies only to a predeclared semantically-local fixture; ambiguous locality must widen safely.

## Acceptance evidence

P3 is contract-complete only when independent REVIEW confirms:
- analyzer pinning/trust boundary is adequate;
- support matrix does not overclaim calls/references;
- generation/freshness semantics are honest;
- incremental fallback cannot publish incomplete graph;
- impact/trace wording is structural, not causal;
- hydration refs enforce P2 consistency;
- privacy/minimal persistence is adequate;
- precision/recall gates are non-vacuous;
- dependency/resource cost is explicitly gated.

A clean P3 review authorizes PLAN to open P4 wiki contract only. It does not authorize DEV.
