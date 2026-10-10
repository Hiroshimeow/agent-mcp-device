# P2 Plan — Progressive Retrieval Router

Status: docs/contracts only. No implementation authorization.

## Scope

P2 owns only:
- compact NAVIGATE semantics;
- compatibility/capability negotiation for the additive navigation view;
- authority-specific EXPAND/HYDRATE routing rules;
- token-efficiency benchmark protocol;
- contract-test/acceptance task decomposition.

P2 does not own:
- code-graph extractor/storage/node/edge design (P3);
- wiki generation/provider/content design (P4);
- product implementation.

## Existing owners/boundaries

- 002 `local_search` owns history/checkpoint/activity search.
- 002 `local_graph` owns activity/provenance traversal.
- 002 `local_read` owns retained historical evidence.
- filesystem `read_file` owns current file content but currently lacks graph-revision guard.
- NMem remains a separate tool surface.
- `local_wiki` remains disabled until P4.

## Proposed smallest compatible delta

Add only optional `local_search.view`:
- omitted/`results` = 002 behavior;
- `navigate` = compact branch cards.

Gate `navigate` behind `progressive-retrieval-v1`.

No new public tool.
No new 002 `source_types`.
No generic mega-EXPAND action.
No ContextService NMem proxy.
No code graph implementation in P2.

## Invariants

1. Legacy 002 calls preserve semantics.
2. Old device never receives unsupported new input after gateway capability check.
3. NAVIGATE performs no hidden body query, provider, NMem, sync/rebuild or hydration.
4. Trivial tasks can skip NAVIGATE and directly use file tools.
5. Each authority hydrates through its own surface.
6. Current-source hydration cannot accept stale graph ranges without revision/fingerprint guard.
7. Branch freshness/coverage is explicit.
8. Runtime token cost and schema cost are measured separately.

## Acceptance evidence

P2 is contract-complete only when an independent reviewer confirms:
- retrieval-router contract is compatible and not a mega-router;
- benchmark rules cannot hide token regression;
- estimator/accounting boundary is reproducible;
- P2 tasks do not implement P3/P4 accidentally;
- no unresolved Critical/High blocker.

Implementation remains unauthorized until P3-P5 complete and final readiness review passes.
