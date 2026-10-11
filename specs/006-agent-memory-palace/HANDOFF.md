# HANDOFF — MCP Device P1 log-first search (2026-10-11 JST)

**Start here after agent takeover. This file, not a past chat/PI session, is the durable continuation contract.**

## 1. Verified identity and version

- **G6 Device repo:** E:\git-project\agent-mcp-device, branch main. Confirm current HEAD and git status before changing source.
- **Original P0 baseline:** eaa51927a491bebe8b5f2760659a65e09ddb9e57.
- **P1 tested product-code commit:** d5d28f5c191ee8087b30f6e96b366ee3134706b6.
- Docs/spec/handoff may be a later commit; check git log, no assumption about the remote.
- G8 Device/Gateway production was not changed. No release, Git push, npm publication, server reload or Gateway Context merge happened in P1.
- No PI, subagent or Work automation was launched for this code increment. Previous unrelated PI processes were not touched.

## 2. What the owner ACTUALLY wants

CORE: search and graph across ALREADY EXISTING tool/session logs from MCP, Pi, Codex and extra user-provided log paths. Index incrementally; return small locator records, read exactly selected source records. Graph only relationships actually in log. Minimal model tokens, no new observer, capture gate, redaction layer or event broker.

FUTURE: one self-updating LLM Wiki is the Mind Palace, knowledge portable to new repos/devices, autonomous agent-owned skills with lazy loading and scheduled merging (NO human per-skill approvals). No mandatory code-AST graph.

P0-BASELINE-AUDIT.md investigated legacy v1.0.11 Context capture. Its observer activation/mismatched fields/late-outcome bugs are NOT prerequisites for log-first P1. Keep legacy implementation unchanged for backward compatibility; do not reintroduce it as a gate.

## 3. Implemented code

Product commit d5d28f5:
- src/log-palace/formats.ts — real Pi/Codex/MCP log adapters, fallback plain-text/JSONL.
- src/log-palace/store.ts — registered local paths, SQLite FTS5 contentless-delete index, offset/fingerprint, bounded incremental append/reindex, source byte verification and on-demand graph.
- src/log-palace/cli.ts — compact local CLI add/discover/sources/index/search/read/graph and budgets.
- src/mcp-device.ts — one isolated logs dispatch path, before remote startup.
- test/log-palace/log-palace.test.js — 11 isolated regression fixtures.
- docs/log-palace.md and README.md — user commands/limits.

Dataflow: explicit existing log location → parse COMPLETE newline record → local FTS5 tokens+offset and metadata → compact SEARCH locator → READ original bytes by ref (checks line SHA). GRAPH optionally matches exact call ID scoped to observed session/source, observed session/turn or file absolute path using logged cwd.

No original log file was modified. No LLM/watcher/capture/observer/scheduler/new MCP schema was added. SQLite state normally under MCP_DEVICE_CONFIG_DIR/log-palace, override MCP_DEVICE_LOG_PALACE_DIR for isolated testing.

## 4. Completed verification on G6

- OS: Windows; Node **22.22.2**, built-in SQLite **3.51.2**.
- npm run build — **PASS**, exit 0; receipt E:\git-project\_mcp-consolidation-20261011\log-palace-npm-build.out.txt and corresponding .exit.txt.
- node --test test/log-palace/log-palace.test.js — **11/11 PASS**; receipt E:\git-project\_mcp-consolidation-20261011\log-palace-tests-final.out.txt.
- node scripts/check-context-acceptance.mjs — **PASS** (32 FR, 8 SC, 62 task inventory); this is a consistency check, not independent approval.
- node --test test/context/access.test.js test/context/graph-query.test.js test/context/mcp-contract.test.js — **10/10 PASS**; receipt E:\git-project\_mcp-consolidation-20261011\log-palace-legacy-context-tests.txt.
- node dist/mcp-device.js logs --help / add / index / search / read / graph — **PASS** through actual CLI entrypoint on synthetic local log with isolated index: one marker found, exact selected read, no invented graph neighbor.
- **REAL G6 LOG SMOKE PASS:** one Pi session, one Codex session, MCP tool history; 3 sources, **6,270,444 input bytes**, 1,644 complete lines, **1,652 indexed search records**. First indexing approximately **483 ms**; repeated indexing **0** new records; one FTS search **3.477 ms** and 5 result locator cards **2,545 JSON bytes**. Selected Pi/Codex call-result link and source read verified. **Original three source files SHA-256 unchanged**. Receipt E:\git-project\_mcp-consolidation-20261011\palace-real-smoke-result.json.
- This is only ONE timing sample: **p95/p99 and LLM token savings NOT MEASURED**. Full Device 66-module test suite NOT rerun in this P1 increment.

**Optional M365 review:** owner provided Worker-only guide. Read M365 skill on md fjp and attempted m365.cmd doctor; call timed out without ready:true. No Worker submit/review result occurred and no browser was accessed. If needed later, follow the official Worker, attach only nonsecret source/spec and verify M365 assertions against actual code.

## 5. Known gaps, NOT DONE

1. Giant lines beyond 8 MiB per-file scan may stall. Search text per record is capped at the leading 250,000 characters (original raw source remains intact), so later terms can be missed without a coverage flag.
2. Directory walk scans up to max(10,000, maxFiles × 10) matching files; beyond that it is not proven exhaustive and could fail to report hidden older files.
3. Rotation/file replacement happy paths tested; Windows live file handles, Linux parity, log compression and concurrent writers need more coverage.
4. No semantic/Wiki search, no backend ReMe/OpenViking, no cross-device Palace sync, no automatic no-guide bootstrapping, no skill curator.
5. Index is explicitly invoked. The existing source file remains authoritative; a missing/replaced source can invalidate refs.
6. Local same-user search works across registered paths. Ownership across other devices/accounts remains the existing filesystem/MCP boundary, not a magical shared repo scope.
7. Large corpus performance, p95 search latency, amortized extraction/token economy remain NOT MEASURED.

## 6. Next small task

Stay inside P1, NOT Wiki implementation. Prioritize one short, demonstrated correctness/coverage improvement: expose and handle giant-line and directory discovery truncation in bounded index status, then test that search never silently claims completeness. No new capture/observer/permission gate. Use a regression fixture first, run TypeScript build + P1 tests + existing Context targeted tests, commit, update this handoff, STOP before P2 unless asked.

Read only this handoff, spec.md, tasks.md and relevant src/log-palace file for that task. Do not ingest entire private Pi/Codex transcripts into a model prompt or attach them to external review.

## 7. Operational non-goals

Do not switch/create worktrees, force-delete branches, deploy, reload production, merge old Gateway Context, install unrelated frameworks or rewrite legacy v1.0.11 Context schemas. Keep Spec 002 regression fixture and external private backups. Favor source evidence over stale observations; exact Git SHA and test outputs are the basis for DONE.