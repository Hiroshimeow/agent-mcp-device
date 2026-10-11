# CURRENT STATUS — MCP Device / Memory Palace

**Updated:** 2026-10-11 JST. Verify actual git HEAD/status and runtime on the target host. This file describes the development checkout, not the installed binary or production gateway.

## Source of truth

- **G6 Device source:** E:\git-project\agent-mcp-device on main. Baseline P0 report eaa5192; P1 log-first CLI under src/log-palace/ is a later source-only increment. No npm publish, no rollout.
- **G8 Device:** separate checkout. No automatic synchronization or live Device upgrade is claimed by work on G6.
- **Gateway integration:** G8 /home/ayumi/Workspace/git_project/agent-mcp-gateway-develop on develop is canonical. The G6 Gateway checkout was aligned with G8 develop during prior work but is not production itself.
- Legacy Context v1.0.11 (six local_* tools, optional capture hooks) remains intact for compatibility. This new feature neither enables nor depends on that capture path.

## What actually works in G6 P1 source

The local command family **mcp-device logs** now provides:
1. Register/discover existing MCP tool history, Pi and Codex session logs or any user-selected log.
2. Incrementally index actual complete log lines into SQLite FTS5; no observer/extra capture gate.
3. Keyword search returning compact references, then bounded read of the exact original source bytes.
4. On-demand graph of **recorded** call IDs, session/turn IDs, and file identity verified by logged cwd.
5. Detect append, partial tail, replay, truncation/replacement, missing source and false same-file joins.

Only the derived index is written. Original logs are unchanged. This is a local CLI only, not a new MCP catalog tool.

**Source locations:** src/log-palace/{formats,store,cli}.ts and the CLI branch in src/mcp-device.ts. Test: test/log-palace/log-palace.test.js. See [CLI guide](log-palace.md) and [the takeover handoff](../specs/006-agent-memory-palace/HANDOFF.md).

### Verification

- Initial TS compiler/type-check PASS; after later graph fairness fixes build and **11/11 targeted regression tests PASS**.
- Isolated **real logs G6**: 3 sources (Pi, Codex, MCP history), 6,270,444 bytes, 1,652 indexed records, ~483 ms initial indexing, ~3.48 ms one FTS query, repeat index 0 new records. Exact call/result graph link and selected source read verified. Raw log hashes unchanged. This is one measured smoke, **not** search p95 or token economy proof.
- Evidence/output outside Git: E:\git-project\_mcp-consolidation-20261011\palace-real-smoke-result.json, log-palace-tests.out.txt and log-palace-build.out.txt.
- Existing P0 historic audit is [P0-BASELINE-AUDIT.md](../specs/006-agent-memory-palace/P0-BASELINE-AUDIT.md). Its legacy capture observer bugs are NOT prerequisites to log-first P1.
- Full Device suite and Linux parity have not been rerun in this increment; do not call the product fully certified.

## What is still NOT implemented

- LLM Wiki / ReMe/OpenViking backend, cross-device portable Palace and automatic no-guide new-repo recall.
- Agent-owned skill learning, lazy publication, scheduled merge and rollback.
- Handling a giant single log line that exceeds the per-file scan budget, exhaustive >10,000-file directory discovery, indexing p95 benchmarks.
- Additional authorization/secret gates are **not** intended for already-authorized local reads. If Wiki is later exported to another account/service, that separate transfer requires only the existing applicable access controls.

## Next agent

**Start at [Spec 006 HANDOFF.md](../specs/006-agent-memory-palace/HANDOFF.md)**, check Git and run the bounded tests. Do not reinstate observer/capture plan, resurrect code AST graph tasks, create a worktree or start Pi without being asked.

## Historical maintenance

- Spec 002 Device Local Context is DONE but retained as required regression fixture; old 001/003/004/005 retired and reachable in Git history. See [ARCHIVE.md](ARCHIVE.md).
- G8 production Gateway release and runtime are not changed by this work. No automatic release/merge from G6 to Gateway.
- User explicitly prefers reducing agent token cost and eliminating repeated guidance; do not preload logs/Wiki/skill bodies into prompt when a two-step locator suffices.