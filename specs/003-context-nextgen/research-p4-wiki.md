# P4 Research — Human-Facing Derived Wiki

**Date:** 2026-10-05  
**Scope:** wiki contract only. No product implementation, no P5 reconciliation.

## 1. Baseline from 002/P0-P3

Preserve:
- `local_wiki` is the already-reserved public name; do not add a second wiki MCP surface.
- wiki is a derived human-comprehension layer, never current-source authority.
- current source > deterministic code graph > generated wiki for current code claims.
- activity/history evidence remains a separate authority for past events.
- NMem remains separate.
- ordinary search/read/status/NAVIGATE must not invoke a wiki provider.
- a wiki page may be stale and still readable if its state is explicit.
- source/provider work is device-local orchestration; gateway does not persist wiki/source corpus.
- P2 progressive disclosure still applies to agent reads: metadata/card first, selective section/body only on explicit request.

The 002 deferred wiki contract already contains useful safety constraints: explicit generation/update only, allowlisted provider egress, source manifests, last-good publication, cost honesty, no auto-resume, and derived-result semantics.

## 2. Current external patterns checked

### microsoft/llmwiki

Sources:
- https://github.com/microsoft/llmwiki
- https://github.com/microsoft/llmwiki/blob/main/ARCHITECTURE.md
- https://github.com/microsoft/llmwiki/blob/main/docs/mcp-tools.md
- https://github.com/microsoft/llmwiki/blob/main/package.json

Current useful patterns:
- explicit three-layer distinction: immutable/raw sources, LLM-generated wiki, schema/conventions;
- page/index/status/read/lint concepts;
- backlinks/crosslinks and stale-entry linting;
- MIT license;
- Node >=20;
- core package already exposes its own MCP server with 14 tools.

Fit decision:
- **reuse concepts, not the runtime package/MCP surface in P4 v1**.
- Directly embedding `@llmwiki/core` would introduce a second page store/index/search/MCP tool model beside the already-reserved `local_wiki` and existing context store.
- Its source-ingestion/personal-knowledge model is adjacent but not the same as a source-code dossier built from P3 refs.
- If implementation later copies/adapts a small isolated helper, DEV must pin commit/version and retain MIT attribution; there is no current need to depend on the whole core.

### FSoft-AI4Code/CodeWiki 2.0

Source:
- https://github.com/FSoft-AI4Code/CodeWiki

Current useful patterns:
- dependency-graph-guided module documentation;
- hierarchical pages;
- Mermaid diagrams;
- artifact-aware documentation;
- explicit incremental update records;
- provider abstraction and generation budgets;
- MIT license.

Current cost/surface:
- Python 3.12+ runtime plus Node/npm install-time dependency;
- own dependency analyzers/graphs for multiple languages;
- own module clustering, provider stack, MCP mode and docs store.

Fit decision:
- **do not make CodeWiki a dependency for P4 v1**.
- P3 already defines the authoritative deterministic TypeScript code graph; importing CodeWiki would duplicate analyzers/graph authority and add a Python/provider stack.
- Reuse product patterns only: graph-guided scoped dossiers, validated Mermaid, source-aware incremental updates, update records.

### DeepWiki-style systems

Useful product pattern:
- repository overview;
- browsable architecture/module explanations;
- diagrams;
- code Q&A/navigation.

Fit decision:
- use as UX/content inspiration only.
- P4 does not introduce a separate cloud wiki/index service or make generated prose a retrieval authority.

## 3. Minimal P4 product decision

P4 v1 uses:
- existing device-local ContextService/store;
- P3 code refs/graph as structural source;
- selective current-source hydration through the P2/P3 guarded path;
- selected 002 activity/history refs only when the target asks for recent changes/history;
- explicit spec/test/config file refs under the same repository/worktree authorization;
- one provider profile selected from local owner configuration for generation;
- canonical generated wiki pages stored as derived local context artifacts.

P4 v1 does **not** add:
- a second MCP server;
- a wiki-specific full-text/vector index;
- automatic module clustering;
- automatic one-page-per-symbol generation;
- repo-wide generation on sync/idle/startup;
- provider SDK families unless implementation evidence requires them;
- arbitrary model tool access;
- automatic NMem/history fan-out;
- repo docs writes/export through MCP.

## 4. Human page types

Initial explicit target kinds:
- `repository_overview`;
- `feature`;
- `module`;
- `symbol`.

Generation is target-driven. The user/agent supplies explicit seed refs/paths/spec refs; P4 does not automatically generate every module/symbol.

A feature/module/symbol dossier may contain only evidence-supported sections:
- purpose and scope;
- specs/requirements;
- entry points;
- important files/symbols;
- architecture/components;
- code/control flow;
- data flow;
- sequence flow;
- invariants/security boundaries;
- tests;
- relevant recent changes;
- known gaps/unsupported dynamics;
- source/evidence references.

Do not emit empty template sections merely to satisfy a fixed template.

## 5. Structured page before rendered Markdown

Provider output should be validated as a structured page model rather than accepted as arbitrary Markdown.

Proposed internal shape:
- page kind/title/summary;
- sections with stable section id, heading, Markdown content and evidence refs;
- diagrams with kind/source refs;
- internal links by wiki ref;
- explicit gaps/uncertainty;
- generation metadata.

Renderer derives human-readable Markdown/HTML from that model.

Rationale:
- source refs can be validated deterministically;
- broken links can be linted;
- section-level progressive reads are possible;
- unsupported refs can fail publication;
- diagram provenance can be retained separately from display text.

This is an internal storage/generation shape, not an additional public tool schema.

## 6. Progressive agent access

Human UI may render a full page, but MCP agent access remains progressive.

`local_wiki list` returns compact page cards only.

`local_wiki read` modes:
- `card` default: metadata, summary, section table-of-contents, freshness, source counts;
- `section`: one requested section plus its evidence refs;
- `full`: explicit bounded full-page Markdown.

This prevents a normal architecture lookup from injecting an entire generated repository wiki into agent context.

There is no automatic wiki branch body retrieval in P2 NAVIGATE.

## 7. Source planning and generation

Generation is deliberately two-step because provider egress is rare/costly.

### Estimate/plan

`estimate`:
- no provider/network call;
- resolves explicit target(s), scope, selected source classes, provider profile metadata and owner hard caps;
- constructs a bounded source plan/manifest summary;
- estimates source bytes/agent-independent token budget;
- returns an opaque `plan_ref` with TTL.

`plan_ref` binds selection/budget/source generations. It is **not human consent**.

### Generate/update

`generate` or `update`:
- requires owner-local wiki/provider/egress policy **and** trusted execution-context provenance that the user explicitly requested this generate/update operation;
- requires a valid scoped `plan_ref`;
- rechecks source generation/fingerprints before egress;
- materializes only manifest-selected evidence;
- calls only the locally configured provider profile/allowlisted endpoint;
- provider receives no arbitrary tool/command access;
- stages output;
- validates refs/content/diagrams;
- atomically publishes only if validation/source-consistency passes.

The explicit-user-request signal is not an MCP argument and cannot be minted by the agent, `plan_ref`, preview hash or idempotency key. It must be bound to the relevant operation/request scope and planned targets sufficiently to prevent stale, replayed or unrelated authorization. If no trustworthy runtime provenance exists, provider generation/update remains disabled/unsupported and egress is zero. Bounded retry may stay within the original authorized job/request budget; restart never grants or refreshes authorization.

Source drift after estimate => typed conflict/stale-plan outcome. Do not silently re-plan or call the model again.

## 8. Source selection and authority

Allowed evidence classes:
- P3 code refs/edges/generation metadata;
- selectively hydrated current source spans;
- selected repository specs/tests/config files under authorization;
- selected 002 activity/checkpoint refs when history/recent changes are requested.

Disallowed as authority:
- previous wiki prose without backing current refs;
- NMem for code facts;
- reported historical summary as current source fact;
- provider inference without source ref.

Current-code claims cite code/source refs.
Historical-change claims cite activity/checkpoint refs with time/revision.
Tests/build/deploy claims require current test/config/source refs.
Unknown/dynamic code behavior remains explicitly uncertain.

## 9. Staleness model — conservative first

Each published page stores a source manifest:
- repository/worktree;
- code generation/source manifest used;
- exact code/source/history/spec/test refs;
- selected source fingerprints where applicable;
- activity generation/event watermark where used;
- provider/model profile id;
- prompt/template/schema version;
- page content hash.

P4 v1 prefers conservative freshness:
- if a referenced code/source/history generation is known to have changed and exact page dependencies have not been revalidated, page is `stale`;
- if currentness cannot be checked without new scanning, page is `unknown`;
- ordinary read/list/status does not scan/reindex sources merely to upgrade freshness to current;
- explicit lint/estimate/update may perform the bounded checks needed for revalidation.

Over-staling is acceptable; silently claiming current is not.

## 10. Provider/egress boundary

Provider profiles are owner-local configuration, not MCP arguments.

A profile contains non-secret id/model/endpoint class metadata and an auth-secret reference stored outside corpus. MCP args never contain API keys.

Generation requires:
- local wiki generation enabled;
- provider profile configured/allowlisted;
- source plan within owner hard caps;
- explicit `generate`/`update` action.

Provider gets only redacted manifest-selected material.
No `.env`, credentials, private keys, excluded paths, state-root paths, DB paths, owner secrets, unrelated repos/home files.

Provider cannot call mcp-device tools/commands or fetch arbitrary local files.

No provider call from:
- startup;
- status;
- list;
- read;
- lint;
- estimate;
- local_search/NAVIGATE;
- code/history sync.

A tool argument/plan token never claims human consent. Provider egress requires both owner-local provider/egress policy and trusted explicit-user-request provenance outside agent-mintable MCP data. A client/UI confirmation may supply that trusted runtime provenance, but it is not optional policy decoration. If no trustworthy provenance channel exists, `generate`/`update` remain disabled/unsupported with zero provider calls. An explicit `generate`/`update` action remains a side-effect-discipline condition only; it is not proof of user request.

## 11. Generation jobs and last-good

Generation/update may be a bounded job because it can exceed one tool round trip.

Every job has:
- scoped job ref/idempotency key;
- immutable plan ref;
- provider/model id (non-secret);
- page/source budgets;
- attempt/retry cap;
- deadline;
- state/progress;
- usage/cost-known metadata.

No indefinite agent loop.

Provider timeout/rate-limit/empty/invalid output:
- does not replace last-good;
- retry only within approved cap;
- interrupted process/restart leaves job interrupted/paused;
- no automatic resume/provider retry after restart.

Cancel stops only the wiki job; it does not kill user workload.

## 12. Diagram contract

Supported initial diagram purposes:
- architecture/component flow;
- code/control/data flow;
- sequence flow.

Generated Mermaid is derived display content, not evidence.

Every diagram:
- has evidence refs;
- uses an allowlisted diagram syntax/category;
- contains no external click/link/script/HTML behavior;
- must pass local bounded syntax/structure validation before publish;
- must not invent a dynamic call/sequence that P3 marks unknown.

If a robust validator requires a new package, implementation must record package/license/size cost; P4 does not preselect a Mermaid dependency.

## 13. Cost/budget contract

Owner config provides hard ceilings; request/plan may only tighten them.

Plan records bounded:
- source files/spans/refs;
- source bytes;
- estimated provider input tokens;
- max output tokens/pages/diagrams;
- attempts/retries;
- deadline/concurrency;
- local artifact quota;
- max egress bytes.

Do not freeze arbitrary numeric defaults in P4 planning without measurement.

`estimate` makes zero network/provider calls.

After job:
- retain provider-reported input/output/cached/reasoning usage when available;
- cost is computed only from owner-configured pricing for the exact profile/usage classes;
- unknown pricing/usage => cost unknown, never fabricated.

Network/model latency is reported separately from local source planning/store/lint time.

## 14. Upstream reuse conclusion

P4 v1 should **not** import the whole llmwiki or CodeWiki runtime.

This is not a rejection of their ideas. It is scope control:
- existing ContextService already owns scope/auth/store/generation semantics;
- P3 already owns deterministic code graph;
- `local_wiki` is already the stable public name;
- direct upstream dependencies would duplicate index/tool/provider/analyzer surfaces.

Any future code reuse is surgical and requires commit/version/license/dependency review.
