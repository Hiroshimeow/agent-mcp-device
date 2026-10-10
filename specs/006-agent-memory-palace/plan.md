# Implementation plan — 006 Agent Memory Palace

**State:** OPEN / unimplemented. **Docs only in this change.**
**Build/merge starting point:** Device `main`, which already owns `src/context/` and MCP execution/capture; **NOT** Gateway `feat/personal-context`. Gateway integration, if needed, is an **optional last lane** from G8 canonical `develop`.
**Principle:** The memory system is built around **tool/session evidence**, not AST source-code graph. LLM Wiki is the sole long-term Palace. Skills are automatically learned, lazy-loaded and merged on schedule **without human approval**.

## Verified source boundaries (do not rediscover blindly)

- Device v1.0.11: `src/context/{capture,store,search,graph,indexer,service,cli}.ts`, `src/tool-dispatcher.ts`; six public `local_*` schemas; protected `002-device-local-context` and `scripts/check-context-acceptance.mjs` remain regression fixtures.
- Existing observer has invocation ID, tool args/result and outcome, but does **not** provide authoritative full chat/session/turn lineage. Need adapters; never infer IDs from accidental timestamp proximity.
- Gateway G8 `develop` already has `skill_catalog`/`load_skill`, usage/session metadata, and separate WSS broker/auth. It has **not** integrated the old six-tool Gateway Context patch.
- Existing Git common-dir identity links worktrees, **not distinct clones**. Cross-repo/global memory needs a **separate scoped knowledge identity**, not a hidden change to local Context permissions.

## Decision architecture

```text
Agent / Pi / ChatGPT / Codex
  | existing tool execution + optional session hook
  v
Event adapters (Device tool evidence + client session/turn evidence)
  | secure owner/device/repo IDs, redacted refs, bounded batches
  v
Immutable evidence log + SQLite FTS5 + activity graph
  | LOCATE: compact cards/refs       READ: chosen spans only
  +-----> CLI for graph/timeline/node exploration (lazy skill)
  |
  v  end-of-task / bounded idle queue
Selected LLM Wiki backend (ReMe OR OpenViking, not both writable)
  | linked pages, contradictions, provenance, stale states
  +-----> tiny startup locator across authorized repos/devices
  |
  v
Agent-owned skill generator -> sandbox checks -> atomic skill registry
  | scheduled bounded dedupe/merge/archive + rollback snapshots
  v
Future agents lazy-load selected skill body; never whole library
```

All references to `graph` below mean **activity/provenance graph of tool/session logs**. Any source-code AST/impact-graph design is deferred outside scope.

## Workstreams, dependency order

### Phase P0 — Instrument baseline and freeze evaluation (mandatory)
- Verify G6 Device Git SHA, build/test baseline; separately record G8 Gateway actual `develop` SHA/runtime **read-only** when authorized.
- Inventory concrete event source schemas, redaction/permissions, coverage gaps and session APIs for selected clients. Record measurable missing IDs, output retention and access to original evidence.
- Freeze fixture corpus: solved and failed sessions, G6→G8 new-repo transfer, repeated issue across distinct repos, exact/no-memory case, stale/counterexample, unauthorized owner, offline/reconnect.
- Freeze costs: model prompt/response, extraction/wiki consolidation, skill merges, storage, calls and p50/p95 end-to-end time. Control uses **same native tools/client/model** with Palace off.
- **Gate P0:** data source and ground-truth outcomes pinned; no “3x cheaper” claim before A/B.

### Phase P1 — Capture and normalize tool/session logs
- Extend via a **versioned adapter**; retain 1.0.11 observer semantics. Event IDs, session/turn/task IDs and parent-child links are explicit or marked missing.
- Add tool-call/result join, failure/attempt and next task outcome where supported. Record successful test only with actual test result refs/revision.
- Ingest via local durable bounded queue (cursor + idempotent ACK), selective redaction and retention; no hidden replay of executable actions.
- **Gate P1:** exactly-once *logical indexing* of duplicate input, explicit capture gaps, authenticated refs, restart/reconnect tests, no prod overhead regression.

### Phase P2 — Log search and activity graph
- Reuse FTS5 and bounded graph; add only fields/edges from actual event schemas.
- Search result **locator** schema: `ref, title, kind, scope, freshness, time, 1-line preview, evidence refs`. Read selected refs only; timeline/path/neighbor CLI optional.
- Provide a two-step locate→read path. Graph node details via CLI/skill to keep MCP schema small; no AST code-graph dependency.
- **Gate P2:** hard correctness/security; error-signature, tool, file, task and session fixture retrieval. No phantom graph edges. p95 latency/token budgets from spec.

### Phase P3 — Wiki Palace backend PoC, one backend chosen
- Evaluate **ReMe** (Markdown, BM25/wikilinks, daily digest/auto-dream) and **OpenViking** (URI/abstract/overview/detail, session files) using the **same sanitized corpus**.
- Audit OSS license, exact pinned commit, Windows+Linux deploy, auth/deletion, CLI/API adapter, offline recovery, incremental update, LLM token cost and idempotency.
- Include an adversarial contradiction and code-change stale challenge. Never send unsanitized raw payloads to a provider.
- Select ONE backend by end-to-end correctness and amortized tokens; documented fallback if both fail. **Do not build our own wiki engine or run two writers concurrently.**
- Agent writes Wiki in bounded task-end or idle batches; failed update preserves previous generation and marks stale.
- **Gate P3:** knowledge pages grounded in exact refs, no unsupported verified “success” claim, correct owner scoping, demonstrably better repeated-task efficiency.

### Phase P4 — Cross-repo / cross-device recall and bootstrap
- Introduce stable owner-scoped shared knowledge keys (person/tenant, source repo lineage, topic); keep raw evidence separately authorized and repo-specific.
- New agent environment receives a **tiny Palace locator** (target <=250 estimated tokens). If task is related, call search; else native work proceeds with zero Palace fetch.
- When moving from G6 to a distinct repo/clone on G8: locate relevant skill/wiki/error history and verify current toolchain/revision before applying.
- **Gate P4:** cold agent needs no user handoff; both directions G6↔G8, missing/denied state, stale revision and unrelated project negative controls pass.

### Phase P5 — Autonomous skills and bounded scheduled merging
- Candidate extractor summarizes repeatable solution from verified sessions/wiki. Each agent-owned skill includes applicability, evidence refs, tests, negative examples and version.
- Keep short catalog metadata cheap; lazy load body/resources only when selected. Use existing Gateway skill catalog contract when applicable.
- Schedule curator **at most the frozen cadence** (candidate daily/idle if dirty), batch only changes, dedupe/merge agent-owned skills, snapshot before changes, atomic publish and auto rollback on failing tests.
- **Zero human approval prompts for agent-owned skills**, but all ordinary filesystem/process/security permissions remain mandatory; no auto edits to bundled/user-pinned skills.
- **Gate P5:** skill candidate acquired→reused, merged without duplicate skill exposure, known bad procedure invalidated, time/token ceiling and rollback proven.

### Phase P6 — Minimal transport integration and independent E2E
- Only if P2–P5 demonstrate a gap not solvable by CLI/current tools: expose one small scoped MCP search facade; graph/wiki/curator remain CLI via lazy skill.
- Gateway work must start from **G8 `develop`** and be conflict-reconciled file-by-file; old `feat/personal-context` is historical evidence, **not a merge target**.
- Preserve full Device v1.0.11 catalog for old clients and the Gateway UI/auth/pairing/remote session flows.
- Independently validate token budget including background costs, correctness, owner isolation, model hallucination/error propagation, restart/restore, load and cross-platform compatibility.
- **Gate P6:** no safety/correctness regression; maintainability and fewer model tokens are **measured**, not assumed; no deploy until separately authorized.

## Interfaces and storage decision guards

- Device event store is **authoritative only for its owner/repo raw history**; do not implicitly put all user transcript contents inside it.
- Wiki is authoritative for **organized long-term experience**, but individual page claims remain subordinate to current code/test and original evidence.
- Shared wiki workspace is **per owner** with explicit repo/project provenance and allowlisted sharing; do not create a global anonymous index.
- Skills live in versioned agent-owned space; registry may be read through Gateway. Curator cannot directly merge product Git branches.
- CLI and minimal MCP facade must use the same authorization/ref lookup rules, not shell bypass for denied scopes.
- Drop or defer each optional component unless it adds measurable value; keep independent adapters so a failed upstream PoC can be replaced without losing raw evidence.

## Delivery artifacts by phase

| Phase | Required output / review evidence |
| --- | --- |
| P0 | Frozen corpus manifest, source-truth map, gap report, baseline token/latency |
| P1 | Event schema and adapter fixtures, crash/dedup/auth tests |
| P2 | Locator/read/graph contract, deterministic traversal and query/latency tests |
| P3 | Side-by-side ReMe/OpenViking PoC report; backend choice and evidence-linked wiki |
| P4 | Cold-start cross-repo G6/G8 fixture and denied/negative controls |
| P5 | Skill acquisition/promotion/merge/rollback receipts and scheduled cost ledger |
| P6 | Minimum integration diff, compatibility suite, regression + A/B report |

## Stop / rollback criteria

Stop a phase on: leaked cross-owner knowledge, synthesized/phantom evidence, task-success misclassification, unauthorized skill execution, unbounded background spending, or measurable correctness regression. Partial success is **INCOMPLETE**; document the fix rather than broadening architecture.

**Implementation not authorized by this doc cleanup.** Do not create a task scheduler or write to Gateway production until an explicit implementation task is assigned.