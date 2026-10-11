# 006 — Agent Memory Palace (log-first)

**ACTIVE.** P0 audit done; **P1 local log search/index/graph CLI implemented in source and under test**. LLM Wiki, cross-device Palace, skills and automatic learning are not implemented yet.

Goal: agent reads earlier Pi/Codex/MCP sessions and tool logs with minimal context, then later reuses long-term experience in new repos without new user guides.

### Read only what you need

| File | Purpose |
| --- | --- |
| [HANDOFF.md](HANDOFF.md) | **Start here after takeover**: verified Git/tests, actual implementation, open bugs, next task |
| [spec.md](spec.md) | Binding user intent and exclusions: NO capture/observer/new gate |
| [plan.md](plan.md) | P0-P5 roadmap, smallest useful increments |
| [tasks.md](tasks.md) | DONE vs OPEN tasks with clear stop line |
| [contracts.md](contracts.md) | Real Pi/Codex/MCP parser and CLI/search/graph guarantees |
| [evaluation.md](evaluation.md) | Evidence and end-to-end measurement criteria |
| [research.md](research.md) | Open-source Wiki candidates (ReMe, OpenViking, Hermes) |
| [P0-BASELINE-AUDIT.md](P0-BASELINE-AUDIT.md) | Historic audit of legacy Context; not the new ingest architecture |

**Source:** G6 E:\git-project\agent-mcp-device on main. Repo's old Context v1.0.11 remains intact solely for backwards compatibility. Do not merge historical Gateway Context or create capture observers.

**One-call summary of P1:** Explicitly add/discover source paths, index existing files, search compact locators, then read selected source or graph the observed IDs/paths. No LLM required during any of these operations.

**Future:** One LLM Wiki backend for Mind Palace, then cross-repo recall and lazy automatically merged agent-owned skills without manual per-skill approvals.

If handing to another agent, begin with [HANDOFF.md](HANDOFF.md); do not read all old worktrees/logs/agent sessions into model context.