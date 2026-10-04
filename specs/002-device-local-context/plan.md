# Implementation Plan: Device-local Context

**Branch**: `002-device-local-context` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)  
**Input**: Revised after independent Opus review round 1; evidence/decisions in [research.md](research.md).  
**Status**: REVIEW ITERATION 2 — documentation only until user authorizes implementation.

## Summary

Implement a device-local evidence/context engine inside mcp-device with one domain service for local CLI and remote MCP. Canonical public execution events are captured automatically; FTS and activity relations are materialized only by explicit sync/rebuild. Local coding agents use a portable skill + local CLI directly; remote clients use six stable `local_*` tools through gateway routing. No context content is persisted on gateway.

Feature 002 is deliberately narrower after review: store/redaction/repo resolver/FTS/search/read/CLI/checkpoint/activity relations are in scope; source-code parser graph, wiki generation, automatic installer and long-lived offline worker are deferred. `local_wiki` name/schema is reserved in 002 but stays disabled/status-only; provider generation is feature 003.

1.0.10 still owns canonical dispatcher/observer/process/resource accounting. 002 may build its independent storage/retrieval lane now, but live capture/process/gateway wiring waits for handoff. See [integration-110.md](integration-110.md).

## Technical Context

**Language/Version**: TypeScript/Node. Feature 002 targets **Node >=22.13** as a post-1.0.10 compatibility change; it does not silently change the 1.0.10 patch branch.

**Primary Dependencies**: Built-in `node:sqlite` with FTS5; existing Git/path/auth/config/budget utilities; no SQLite npm native addon, daemon DB, vector store, embedding or LLM dependency for core.

**Runtime evidence for Node choice**: all 8 online project devices observed on 2026-10-04 run Node 22.22+ or 24.x. FTS5 probe passed on representative Windows g6/fjp and Linux Node 22/24 devices. Public Node docs show `node:sqlite` introduced in 22.5 and unflagged from 22.13. Release docs must disclose the floor change.

**Storage**:
```text
<MCP_DEVICE_CONFIG_DIR or ~/.mcp-device>/
  context/
    registry.sqlite                 # store metadata, no evidence body
    owners/<owner-key>/
      unscoped.sqlite               # minimal capture-gap/ambiguous metadata only
      repos/<repo-key>/
        context.sqlite              # events, refs, FTS, activity relations, generations
        blobs/                      # redacted retained payloads, content-addressed
```
No canonical state in source repo. No gateway context DB.

**Testing**: Existing Node test infrastructure + fixture corpus; adversarial auth/ref/cursor tests; crash-point matrix; WAL/contention; malformed JSONL migration; CLI/MCP domain parity; Windows/Linux matrix; existing benchmark harness after 1.0.10 handoff.

**Target Platform**: Windows/Linux native. Offline CLI is supported only where OS/sandbox can access state root; access denial is typed, not bypassed.

**Project Type**: Device service/library + CLI/MCP adapters + portable guidance skill.

**Performance/quality targets**:
- Retrieval correctness first: exact path/identifier top-3 = 100%; history error/command/natural-language Recall@8 >= 0.90 on frozen corpus.
- Public total MCP schema estimate target <=10,000 tokens; above requires scope/compression decision.
- Capture/search/sync benchmark records correctness, median/p95/max, work counts and resource impact. No pre-approved “<1 ms” SLA.

**Constraints**: No hidden graph scheduling; no automatic wiki/provider; no native session ingestion; no destructive admin exposed to agent MCP; no 1.0.10 dispatcher rewrite.

## Constitution Check

| Principle | Revision-2 design |
| --- | --- |
| I Compatibility/security | Node floor is explicit post-1.0.10 compatibility decision; old tools not removed in 002. |
| II Evidence | Opus findings are incorporated; invalid graph microbenchmark excluded from claims. |
| III Bounds/failure | Capture gaps, busy timeout, store quotas and partial query results are first-class; numeric policy remains a pre-enable task. |
| IV Windows/Linux | Both required; node/FTS feasibility already probed, product acceptance still pending. |
| V Independent review | Opus round 1 = external review evidence; next review will use same M365 conversation. |
| VI Canonical behavior | ContextService shared by CLI/MCP; live observer waits for 001 handoff. |
| VII Device/repo scope | Owner/repo stores + explicit unscoped metadata lane; old namespaces sealed after re-pair. |
| VIII Evidence first | Redaction before persistence; reported checkpoint separate; FTS/relations derived. |
| IX Cooperative enrichment | No per-tool/idle sync; explicit local_index/CLI only. |
| X Admin/wiki/skill | Destructive admin removed from agent MCP; wiki implementation split 003; skill stays guidance. |

**Gate state**:
- G-DB: design-resolved to Node >=22.13 + node:sqlite/FTS5; implementation tests/release note still required.
- G-110: only blocks live capture/process/gateway integration.
- G-POLICY: revision 2 proposes numeric defaults in `contracts/context-policy.md`; implementation may start with them, but acceptance must verify behavior under the stated bounds before enabling real capture.
- G-SCHEMA: must freeze six-tool manifest/annotations.
- G-ACCEPT: runtime acceptance/release only.

## Project Structure

### Documentation

```text
.specify/memory/constitution.md
specs/002-device-local-context/
  spec.md research.md plan.md data-model.md integration-110.md quickstart.md tasks.md
  contracts/context-api.md contracts/skill-contract.md
  checklists/requirements.md checklists/implementation-gates.md
  analysis.md run-report.md
```

`contracts/wiki-contract.md` is retained only as review history/deferred input for feature 003; it is not an implementation contract of 002 after revision 2.

### Proposed Source Boundaries

| Path | Responsibility |
| --- | --- |
| `src/context/redact.ts` | Redact/exclude before persistence; no raw-secret hidden store. |
| `src/context/store.ts`, `src/context/migrations/` | node:sqlite schema, transactions, refs/cursors, generations, manifests. |
| `src/context/repositories.ts` | Owner/repo/worktree resolve, active namespace, unscoped classification. |
| `src/context/service.ts` | Domain operations/status/index job ownership; no execution loop. |
| `src/context/capture.ts` | Adapter to canonical 1.0.10 observer; pre-intent/post-outcome only after handoff. |
| `src/context/indexer.ts` | Event normalization + FTS + activity relation materialization. No Tree-sitter in first increment. |
| `src/context/search.ts`, `src/context/graph.ts` | Read-only retrieval and bounded activity traversal. |
| `src/context/cli.ts` | Local CLI adapter calling ContextService. |
| `skills/mcp-device-context/` | Portable skill source; packaging/install automation deferred. |
| Device/gateway adapters | Six public tool schemas/routing only after G-110/G-SCHEMA. Gateway never imports store/search implementation. |

New production files require implementation-time check that no equivalent module exists.

## Design

### A. Capture lifecycle and durability

For each supported public invocation:
1. authorize execution as 1.0.10 defines;
2. resolve owner/repo/worktree as far as possible;
3. redact/sanitize retained request fields;
4. **attempt durable intent commit before dispatch** within a bounded capture timeout;
5. dispatch tool exactly once;
6. redact/sanitize retained result/error;
7. update the same event with execution outcome;
8. return actual tool result independent of context-recording success.

If step 4 fails/timeout: do not retry/duplicate tool because of recorder; execute according to existing tool semantics and expose `capture_gap` through safe metadata/health counters where the handoff permits. Exact-once success criterion applies to healthy-store fixtures, while injected failure must be visible.

If intent committed and process crashes before outcome, restart marks/reads it `unknown_after_restart`; never infer success from intent. Transport delivery is not an execution outcome. Device cannot know final client consumption; only handed-to-adapter/gateway vs unknown if exposed.

Power-loss persistence depends on selected SQLite synchronous policy and is reported separately from process-crash guarantee.

### B. Redaction before persistence

`redact.ts` receives public tool/args/result metadata and returns the only persistable representation. Policy includes secret patterns, sensitive path exclusions, binary/oversized handling and explicit payload state. FTS/blobs/export consume redacted representation only. Errors/logs must not include removed values.

### C. Scope/store resolution

Registry maps active owner namespace + local repo UUID/worktree paths to opaque store key. Same-origin clones remain separate.

When no single repo resolves:
- write minimal owner-unscoped metadata (event id/time/tool/status/scope reason/request correlation);
- do not retain/index request/result body;
- repo search never queries unscoped store.

Re-pair switches active owner namespace. Previous namespace remains sealed from MCP/skill/default CLI. Owner-admin migration/purge is separate manual workflow.

### D. SQLite/concurrency/generations

Use `node:sqlite DatabaseSync` behind Store abstraction. Transactions contain only DB work; no parsing/network/source scan. WAL; bounded busy timeout decided in G-POLICY; capture gets priority and maintenance yields.

Ordinary sync updates derived rows incrementally and advances generation watermark/indexed-through-event. Rebuild writes a shadow derived generation and atomically moves active pointer after validation. Evidence rows/blobs are not duplicated per generation.

Cursor is HMAC-authenticated (or equivalent server-side opaque state) over owner/repo/generation/query hash/position/expiry. Ref lookup always starts with scope authorization.

### E. Retrieval and activity relations

Search:
1. exact path/identifier;
2. FTS5 lexical candidate set;
3. bounded expansion from candidate activity nodes;
4. deterministic ranking/dedup;
5. bounded snippets/refs + coverage/freshness.

Graph actions for 002: `neighbors`, `path`, `timeline`, `related` over activity entities only. Traversal caps frontier, visited nodes, examined edges, wall time and output bytes internally. `LIMIT` after recursion is not a budget.

Activity nodes: repository/worktree/event/file/process/command/test-run/error/checkpoint. Edges require evidence and evidence_class. No generic `caused_by`/`fixes`.

### F. Local CLI and skill

CLI:
```text
mcp-device context status
mcp-device context search
mcp-device context read
mcp-device context graph
mcp-device context sync
mcp-device context checkpoint
mcp-device context rebuild
mcp-device context cancel
```

Search/read/status can run with daemon/gateway offline. If state root unavailable due sandbox/permissions, return typed failure and do not instruct remote fallback around denial.

Skill performs search-first, read refs, verify current source with native tools, sync only when needed, checkpoint at meaningful boundaries. It never reads SQL/transcripts or claims native tool capture.

### G. Public MCP tools

Freeze six names in one rollout:
- `local_status`: read-only, no hidden work.
- `local_search`: read-only.
- `local_read`: read-only.
- `local_graph`: read-only.
- `local_index`: writes derived/checkpoint state; actions sync/checkpoint/rebuild/cancel; no network/destructive owner admin.
- `local_wiki`: reserved/open-world write category but 002 returns feature-disabled/status semantics only; actual generation in 003.

This separation fixes mixed read/destructive annotations. Purge/relink/namespace adoption are not MCP actions in 002.

### H. Wiki split

Feature 002 must prove zero provider calls and no dependency on wiki library. Existing wiki research/contract is archived/deferred to 003. Reserving `local_wiki` name is intentional because the user wants one catalog registration; no 002 code may claim wiki generation exists.

## 1.0.10 Handoff Matrix

### Independent before handoff
- Node/sqlite adapter tests and schema/migrations.
- redaction.
- repo/worktree/owner resolver.
- legacy importer fixture.
- FTS/search/read on synthetic/imported corpus.
- CLI domain adapter.
- checkpoint model.
- activity relation/index/query fixtures.
- skill content.

### Wait for G-110
- pre-intent/post-outcome observer wiring.
- process execution/output correlation.
- shared resource/budget integration.
- CLI entrypoint changes if entrypoint is modified by 001.
- device capability/gateway routing.
- combined benchmark/compat.

### Revalidate after final 1.0.10
- observer event fields/exclusion hook.
- process correlation fields.
- shared busy/resource policy.
- capture latency/concurrency.
- adapter parity and public schema.

Handoff record adds two explicit fields from Opus review: `context_observer_exclusion_hook` and `context_pre_intent_outcome_hook_points`.

## Dependency-Ordered Delivery

1. Freeze revision-2 spec/contracts, including `contracts/context-policy.md` numeric defaults and six-tool schema.
2. Implement/test redaction + repository resolver + Store schema/manifest/ref/cursor.
3. Import/synthetic corpus → sync FTS/activity relations → search/read/status.
4. CLI + checkpoint + portable skill source.
5. After G-110: live capture wiring and process correlation.
6. Freeze six-tool manifest; device/gateway adapter; old-device unsupported tests.
7. Windows/Linux crash/concurrency/privacy/retrieval/perf/parity + independent review.
8. Eligibility stop before merge/release.
9. Feature 003 may later enable local_wiki without changing tool name.

## Risks / Stop Rules

| Risk | Stop/mitigation |
| --- | --- |
| 1.0.10 changes observer/process | stop live wiring; refresh handoff; independent store/search lane unaffected unless shared contract changes. |
| node:sqlite/FTS issue on target | fail platform gate; do not add a second DB backend silently. |
| DatabaseSync stalls event loop | capture benchmark gate; if unacceptable, move Store calls behind bounded worker adapter without changing DB/domain schema. |
| recorder unavailable | bounded gap/degraded status; never replay side effect; policy defaults are in `contracts/context-policy.md`. |
| secret persistence | redaction test before Store/capture tasks; no hidden raw blob. |
| sandbox state denial | typed local failure; no security-weak remote fallback. |
| store explosion | registry/repo quota; transient/ambiguous use unscoped minimal metadata, no empty repo stores. |
| high-degree graph | internal traversal budgets and examined counts. |
| tool schema bloat | measure total schema; compress/scope if >10k estimate before rollout. |

## Complexity Tracking

First increment intentionally excludes Tree-sitter code graph, wiki engine, installer automation, long-lived offline worker, backup/export/relink convenience. Activity relations are indexed tables, not a graph DB framework. A second implementation backend is not allowed without evidence that built-in node:sqlite fails an acceptance target.
