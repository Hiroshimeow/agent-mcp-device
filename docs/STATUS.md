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

- Final P1 correctness source SHA `716f011464286a3610a64f19becafb27850feae7`; docs may be later. Build PASS.
- Log Palace regression suite **30/30 PASS**; independent acceptance script **7/7 PASS on Windows and 7/7 PASS on WSL Linux**. Final REVIEW-R1 fix also preserves discovery visibility when byte budget is exhausted before every discovered file is indexed.
- Existing Context compatibility tests **10/10 PASS** and Context consistency checker PASS.
- Clean full Device suite **66/66 PASS**; no source/build race during the final run.
- Latest isolated real-log benchmark: 3 authorized sources, 6,690,674 input bytes, 1,759 records; index p50/p95 ~902/1054 ms, search p50/p95 ~1.52/2.22 ms, raw hashes unchanged. See Spec 006 HANDOFF for RSS/storage/response-byte receipts and 10,020-file benchmark.
- Existing P0 historic audit is [P0-BASELINE-AUDIT.md](../specs/006-agent-memory-palace/P0-BASELINE-AUDIT.md). Its legacy capture observer bugs are NOT prerequisites to log-first P1.
- Previous P1 checkpoint `716f011` required additional correctness fixes on 2026-10-12: late SEARCH matches lacked a selected READ anchor; UTF-8 reads could split/expand; legacy selected-part cursors mixed coordinate systems; and Pi multi-part duplicate terms could map to the wrong part. Current development uses source-verified syntactic part-scoped byte anchors, optional raw-range reads, explicit invalid-UTF-8 rejection and non-resumable truncated selected-part compatibility views. Independent TEST/REVIEW of the new final SHA is still required. Do not call this released or deployed.

## What is still NOT implemented

- LLM Wiki / ReMe/OpenViking backend, cross-device portable Palace and automatic no-guide new-repo recall.
- Agent-owned skill learning, lazy publication, scheduled merge and rollback.
- Unlimited single-record support is not implemented: complete records above 128 MiB fail explicitly with `RECORD_TOO_LARGE`. Compressed rotated logs are not indexed. Bounded >10,000-file discovery and p50/p95 benchmarks are implemented and measured.
- Additional authorization/secret gates are **not** intended for already-authorized local reads. If Wiki is later exported to another account/service, that separate transfer requires only the existing applicable access controls.

## Next agent

**Start at [Spec 006 HANDOFF.md](../specs/006-agent-memory-palace/HANDOFF.md)**, check Git and run the bounded tests. Do not reinstate observer/capture plan, resurrect code AST graph tasks, create a worktree or start Pi without being asked.

## Historical maintenance

- Spec 002 Device Local Context is DONE but retained as required regression fixture; old 001/003/004/005 retired and reachable in Git history. See [ARCHIVE.md](ARCHIVE.md).
- G8 production Gateway release and runtime are not changed by this work. No automatic release/merge from G6 to Gateway.
- User explicitly prefers reducing agent token cost and eliminating repeated guidance; do not preload logs/Wiki/skill bodies into prompt when a two-step locator suffices.