# P4 Plan — Human-Facing Derived Wiki

Status: docs/contracts only. No implementation authorization.

## Scope

P4 owns only:
- local_wiki action contract;
- human page/dossier model;
- source manifests and authority;
- provider/egress/job/cost lifecycle;
- staleness and last-good publication;
- diagram/lint rules;
- progressive agent reads;
- P4 acceptance/tasks.

P4 does not own:
- new code graph/index;
- automatic retrieval routing changes;
- NMem integration;
- product implementation;
- repo export/edit;
- P5 final reconciliation.

## Minimal product decision

Use:
- existing ContextService/store;
- existing reserved local_wiki tool;
- P3 code refs/graph;
- guarded current-source hydration;
- selected 002 activity refs;
- locally configured provider profile.

Do not add:
- llmwiki runtime/MCP server;
- CodeWiki runtime/Python stack;
- wiki vector/full-text index;
- new public tool;
- automatic repo-wide generation;
- automatic per-symbol docs;
- hidden provider work.

## Core invariants

1. Current source/raw evidence outranks generated wiki.
2. Wiki provider generation/update requires two independent gates: owner-local egress policy and trusted explicit-user-request provenance outside agent-mintable MCP data.
3. If trusted user-request provenance is unavailable, generate/update fail closed before provider egress.
4. Provider calls occur only in generate/update.
5. Estimate/list/read/lint/status are provider-free.
6. Source manifest is scoped and frozen before egress.
6. plan_ref binds selection/budget but is not human consent.
7. Source drift causes stale-plan/conflict, not silent re-plan.
8. Staged output publishes atomically only after deterministic validation/lint.
9. Last-good remains on provider/validation/source conflict failure.
10. Agent read path is progressive: card -> section -> explicit bounded full.
11. No wiki-specific search/vector index in P4 v1.
12. Diagrams are derived/evidence-linked and cannot invent unsupported dynamics.
13. Gateway never stores wiki corpus or provider credentials.
14. Provider credentials/endpoints are local policy, never arbitrary MCP args.
15. No automatic NMem/history fan-out.
16. No repo export/manual edit action in P4 v1.

## Acceptance evidence

P4 is contract-complete only when independent REVIEW confirms:
- authority/source-manifest rules prevent wiki-as-truth;
- read path stays token-small;
- no hidden provider path exists;
- egress/source conflict/last-good behavior is fail-closed;
- job/cost/retry semantics are bounded;
- diagram validation does not require unnecessary runtime surface;
- action/schema set remains compatible/minimal;
- no duplicate index/tool/provider framework was introduced.

A clean P4 review authorizes PLAN to open P5 final reconciliation/readiness only. It does not authorize DEV.
