# CURRENT STATUS — MCP Device / Memory Palace

**Updated:** 2026-10-13 JST. P1 local source acceptance is complete at `e1f74715b60a008171d3e0a9c27c8f4f2964ce2c`; this is NOT a published, installed or deployed Device release. Verify actual git HEAD/status and runtime on the target host. This file describes the development checkout, not the installed binary or production gateway.

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

- **Accepted P1 implementation SHA:** `e1f74715b60a008171d3e0a9c27c8f4f2964ce2c`; prior indexing/fairness checkpoint `716f011` is historical. Independent Windows TEST at final SHA: Log Palace **39/39 PASS**, full Device (including build) **66/66 PASS**, targeted corrections **9/9 PASS**, own synthetic Pi provenance probe **10/10 PASS**. The same independent provenance probe on WSL Ubuntu 22.04/Node 22.21.0 **10/10 PASS**. Independent REVIEW turn 4 examined the final code and reran targeted **9/9** and Windows/WSL **10/10**, finding no actionable in-scope defect.
- Existing Context compatibility **10/10 PASS** in final DEV verification; Context consistency checker `passed=true` in independent TEST (not an independent product approval). SEARCH anchors are exact source-record-relative bytes when provable, including selected Pi part; otherwise `unmapped`. READ bounds **text bytes** (128–65,536), not the complete serialized JSON response.
- Latest isolated real-log benchmark: 3 authorized sources, 6,690,674 input bytes, 1,759 records; index p50/p95 ~902/1054 ms, search p50/p95 ~1.52/2.22 ms, raw hashes unchanged. See Spec 006 HANDOFF for RSS/storage/response-byte receipts and 10,020-file benchmark.
- Existing P0 historic audit is [P0-BASELINE-AUDIT.md](../specs/006-agent-memory-palace/P0-BASELINE-AUDIT.md). Its legacy capture observer bugs are NOT prerequisites to log-first P1.
- **P1 LOCATE→READ correction accepted in source** after DEV red/green, independent TEST and clean REVIEW on `e1f7471`: a 132,023-byte source with late hit is retrieved using one bounded selected READ; UTF-8 boundaries and cursors are valid; Pi part provenance is strict (mirror, ambiguous duplicate `message`/`content` keys and unmappable normalized terms do not invent anchors). Invalid source text fails explicitly rather than producing replacement characters. Concurrent-writer snapshot stress and fresh 64 MiB / 10,020-file performance reruns were **NOT_MEASURED on this final SHA**; earlier benchmarks remain historical. P1 is not published, deployed or synonymous with the future Wiki Palace.

## What is still NOT implemented

- LLM Wiki / ReMe/OpenViking backend, cross-device portable Palace and automatic no-guide new-repo recall.
- Agent-owned skill learning, lazy publication, scheduled merge and rollback.
- Unlimited single-record support is not implemented: complete records above 128 MiB fail explicitly with `RECORD_TOO_LARGE`. Compressed rotated logs are not indexed. Bounded >10,000-file discovery and p50/p95 benchmarks are implemented and measured.
- Additional authorization/secret gates are **not** intended for already-authorized local reads. If Wiki is later exported to another account/service, that separate transfer requires only the existing applicable access controls.

## Next agent

**P1 milestone closed in G6 source.** For the next separately authorized increment, start at [Spec 006 HANDOFF.md](../specs/006-agent-memory-palace/HANDOFF.md) and evaluate ONE Wiki backend (ReMe vs OpenViking) on a sanitized indexed corpus, with grounded citations and bounded LLM cost. Do not restart P1, reinstate capture/observer or start Pi/LLM background loops.

## Historical maintenance

- Spec 002 Device Local Context is DONE but retained as required regression fixture; old 001/003/004/005 retired and reachable in Git history. See [ARCHIVE.md](ARCHIVE.md).
- G8 production Gateway release and runtime are not changed by this work. No automatic release/merge from G6 to Gateway.
- User explicitly prefers reducing agent token cost and eliminating repeated guidance; do not preload logs/Wiki/skill bodies into prompt when a two-step locator suffices.