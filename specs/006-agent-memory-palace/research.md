# Research and ADR — 006 Agent Memory Palace

**Status:** RESEARCH INPUT ONLY, 2026-10-11. Public repository capabilities are upstream claims, not tested deployment behavior. Pin exact upstream commit/tag and license before installation; no provider is selected or installed in this documentation task.

## 1. Why earlier specifications were wrong for the current goal

| Previous source | Useful part to preserve | Superseded assumption |
| --- | --- | --- |
| `003-context-nextgen` | Locate→read progressive retrieval, bounded graph queries, explicit freshness, nonregression | Major implementation around **source-code AST/impact graph** and a manually generated wiki. Wrong priority. |
| `004-context-v112` | Precise acceptance history of Device v1.0.11 and correction of stale 003 P5 blockers; B0 measurement discipline | Old worktree/Git identities (G6 main once 1.0.10), old GOAL requiring code graph and **wiki DEFER**; not the current future architecture. |
| `005-experience-memory` | Evidence/candidate distinction, lifecycle, invalidation, A/B cost, privacy | Prohibits cross-repo/clone sharing, autonomous skill promotion and agent-triggered knowledge work; these conflict with explicit user decisions. |
| `002-device-local-context` | Actual accepted Device 1.0.11 capture, FTS5, graph, CLI, owner authorization and test fixtures | **Not superseded as code/contract**. Remains unmodified; some disabled v1.0.11 Wiki and local scope behaviors are true until 006 is actually implemented. |

**New authority:** This `006` is the **only active forward feature** for tool/session search, graph, shared LLM Wiki Palace and auto skill curation. Old documents stay recoverable by Git SHA `8f3794a552627850a7e74876d376f8f6ec379ee9`, not as competing open plans.

## 2. Current repository truth (read from G6 source)

- `agent-mcp-device/main` contains Device v1.0.11 `src/context/capture.ts`, `store.ts`, `search.ts`, `graph.ts`, `service.ts`, `cli.ts`. Capture has invocation intent/outcome IDs. It does **not** natively capture complete chat session/turn identities for every agent client.
- Activity graph relates observed entities/refs, but this is **not** an AST code graph or a general causal inference engine.
- `src/context/tool-contract.ts` exposes six legacy `local_*` schemas; `local_wiki` remains `WIKI_DISABLED`. Spec 006 does not change live behavior.
- Raw Context is device/owner/repo scoped; separate clones do not automatically share a corpus. A shared knowledge layer must not weaken this scope.
- G8 Gateway `develop` has skill discovery and loading, but this does not imply it can already automatically create, merge or publish skills.
- G6 Gateway `develop@89f7123` is stale relative to G8 canonical develop and has a local Letta upstream config modification. It must **never be used as the merge base** for Gateway integration.

## 3. Mature upstreams to reuse and verify

### ReMe — candidate Wiki Palace backend
- Source: https://github.com/agentscope-ai/ReMe
- Upstream advertises Markdown files, frontmatter/wikilinks, BM25 and optional embeddings, daily knowledge and Auto Dream, shared workspaces through CLI/HTTP/MCP.
- **Fits:** long-term linked Wiki, evolution, source-readable pages, token-efficient line-level recall.
- **Gap:** Device raw tool/session events and access rules need a strict adapter; upstream's default conversation summarization is not proof of complete tool-result capture.
- **Test:** exact source ref persistence, conflicting revisions, no double writer, local Windows/Linux operation, hosting/secret leakage, total background token cost.

### OpenViking — primary A/B alternative
- Source: https://github.com/volcengine/OpenViking
- Upstream advertises `viking://` scopes, session-derived memory, skills and L0/L1/L2 directory loading.
- **Fits:** cross-repo organization and selective navigation; potentially less context by abstract-first reads.
- **Gap:** operational/LLM/indexing footprint and integration complexity must be measured. L0/L1/L2 should be optional retrieval optimizations, not an imposed architecture for every log event.
- **Test:** same corpus/tasks as ReMe; cold new-repo transfer, storage and repeated summarization costs.

### claude-mem — inspiration for capture and progressive search
- Source: https://github.com/thedotmack/claude-mem
- Upstream exposes hook-based observations and `search → timeline → get_observations`, returning IDs before selected detail.
- **Fits:** session+tool outcome ingestion, temporal replay, compact observation cards.
- **Gap:** specialized client hook integration; not chosen as the main cross-agent Wiki Palace. Prefer adapter reuse rather than copying its full runtime.

### Hermes Agent — inspiration for skill curator, NOT agent replacement
- Source: https://github.com/NousResearch/hermes-agent
- Curator docs: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/curator.md
- Upstream supports agent-created skills, stale/archive lifecycle, usage tracking, versioned backup/rollback and optional LLM consolidation.
- **Fits:** lazy skill discovery and scheduled merge/patch/archive.
- **Gap:** consolidation can be expensive; upstream's LLM curator may be disabled by default. For our requirement set an **explicit bounded schedule**, machine checks, idempotency and budget. **Do not require per-skill human approval**.

### Letta / other frameworks
- Letta Code: https://github.com/letta-ai/letta-code — memory and agent runtime architecture reference, **not** a replacement for current MCP Gateway/Device.
- Hindsight: https://github.com/vectorize-io/hindsight — temporal/semantic knowledge and evolving pages as comparison; check LLM/provider cost.
- Avoid adding all upstreams as concurrently active services; only one Wiki writer after A/B selection.

## 4. Integration decision register

| ID | Decision | Status |
| --- | --- | --- |
| ADR-01 | Keep MCP Device current raw event history/FTS5/graph as reusable baseline | DECIDED |
| ADR-02 | Tool/session activity graph is primary; separate code AST graph not a mandatory lane | DECIDED |
| ADR-03 | One established Wiki backend supplies evolving Mind Palace, not a custom knowledge engine | DECIDED; backend TBD |
| ADR-04 | ReMe vs OpenViking based on frozen local PoC and full amortized token accounting | OPEN |
| ADR-05 | Cross-repo memory within same authenticated owner, raw ref authorization stays source-specific | DECIDED intent; namespace implementation TBD |
| ADR-06 | Agent-owned skill creation/merge automatic, lazy loaded, scheduled, no human per-skill approval | DECIDED |
| ADR-07 | Automated safety/test/rollback of skill merge, pinned/user skills protected | DECIDED |
| ADR-08 | No new bulk public graph/wiki MCP catalog by default; CLI+skill first | DECIDED |
| ADR-09 | Client hooks/import coverage, shared Wiki sync, cancellation, deletion/backup behavior | OPEN, P0–P3 |
| ADR-10 | Old Gateway Context branch is not merged wholesale; gateway extension only if necessary after P2–P5 | DECIDED |

## 5. Anti-overengineering / reuse policy

- Ship a **locate → selected read** experience before introducing embedding, graph DB, symbol index, event bus, another scheduler framework or multiple MCP public tools.
- Keep **one canonical source of truth per layer**: raw observed event, rebuilt index/graph, Wiki pages, skill versions. Preserve hashes/refs for audit; don't copy entire logs into wiki or full wiki into skills.
- Do not optimize coding time/token generation effort over correctness. Prefer mature upstream behavior when it actually meets the required evidence/permissions/cost tests.
- Search can return nothing. Wrong/stale advice must be represented as such, not filled using an LLM guess.
- If the wiki backend fails, the agent still has native tools and Device local search.

## 6. Concrete next handoff

Execute **P0 only** from `tasks.md`: inspect real event/agent session APIs on G6, establish fixed cross-repo fixtures and freeze benchmark. **Do not start adding a new AST graph or writing a Wiki engine.** When P0 is evidenced, run matched ReMe/OpenViking PoC and choose the reusable backend.