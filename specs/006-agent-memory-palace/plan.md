# 006 — Implementation plan, log-first

**Source baseline:** G6 Device main at eaa5192 (P0 audit). **P1 source milestone accepted:** G6 `main@e1f7471` on 2026-10-13; not released/deployed. **Next bounded decision:** P2 Wiki backend evaluation, not implementation. No PI, worktrees, or changes to production G8.

## Flow

1. **Register** existing Pi/Codex/MCP log file/directory (or user path). Never turn on a live observer.
2. **Index** appended complete lines with a byte cursor. Recognize format locally. Keep raw file intact.
3. **Search** local SQLite FTS5; return compact source refs.
4. **Read** exact selected source record, optionally expand graph neighbors from explicitly logged call/session/turn/file evidence.
5. **Later** use the evidence to build one LLM Wiki Palace and portable, lazy-loading skills.

## P0 — DONE: current-state audit

- Evidence: [P0-BASELINE-AUDIT.md](P0-BASELINE-AUDIT.md), commit eaa5192.
- Legacy capture and graph bugs apply to the **optional old Context pipeline**. They are **not P1 blockers** because P1 reads existing external logs.

## P1 — CLI vertical slice, current implementation

**Changes:** new src/log-palace/{formats,store,cli}.ts; only one dispatch branch in src/mcp-device.ts; regression tests test/log-palace/log-palace.test.js. Source API remains unchanged.

- Local SQLite under CONFIG_DIR/log-palace (can override via MCP_DEVICE_LOG_PALACE_DIR), uses FTS5 contentless index and metadata/record offsets. Does not retain whole raw lines as another corpus.
- Sources are explicitly added or discovered by CLI. Directory scan bounded; no auto indexing on daemon startup.
- Handles Pi JSONL, Codex JSONL, MCP legacy history and arbitrary plaintext/unknown JSONL.
- Incremental append, pending final line, source replacement/truncate, dedupe and source hash verification.
- Graph uses exact call ID plus session/file scope and absolute file identity resolved against logged cwd. No file-name-only cross-repo join or inferred causality.
- CLI search body-free locator; read/graph bounded with explicit limits.

**Final P1 gate (passed):** Node 22.x, independent G6 Windows Log Palace 39/39, full Device build/test 66/66, independent provenance 10/10 on Windows and WSL, clean source REVIEW on `e1f7471`. Prior benchmarks and unresolved stress regimes are labeled historical/NOT_MEASURED in [HANDOFF.md](HANDOFF.md).

### P1 hardening — historical checklist, accepted in source at e1f7471

- Giant lines advance a durable partial index cursor under the per-call byte budget; incomplete final lines are never published as complete, and complete records above 128 MiB fail explicitly.
- Directory/file rotation with overlapping registered sources and long-lived Windows file handles; validate Windows/Linux.
- Real-log throughput, disk/FTS growth, search p95 and compact response sizes on repeat runs. No conjectured token-savings percentage.
- Large-directory discovery (>10,000 matching files) and fair resumable paging; must not silently claim full coverage.
- Source format auto-detection from rotated/new files, stale/missing source read, exact session/call relations and negative cases.
- Optional output pagination/filtering for very large lists; add only when baseline shows need.
- Documentation and test gap review with independent M365 if available, only through prescribed Worker; no raw private log attachments.

Do **not** expand P1 by adding an observer, broker, capture lifecycle, LLM summarization queue or permissions wrapper already handled by OS/MCP.

## P1 LOCATE→READ acceptance (completed 2026-10-13)

The old source checkpoint `716f011` covered indexing/fairness but not late-hit retrieval or UTF-8 boundaries. The accepted source `e1f7471` adds a proven source-byte anchor and optional `--from-byte` raw READ, preserves unanchored legacy reads, enforces UTF-8-safe text-byte budgets, and refuses ambiguous Pi part provenance. Independent TEST and REVIEW passed at that SHA (see HANDOFF section 10); unmappable synthetic/normalized matches never fabricate byte offsets.

## P2 — Wiki Palace (NOT STARTED)

Use real P1 retrieval fixtures to evaluate ReMe vs OpenViking with *one* selected backend. Wiki is organized long-term memory; raw logs remain authoritative. Measure LLM digest cost, stale-claim handling, evidence refs, offline usability and source-provenance retention. Do not write our own wiki engine.

## P3 — Repo-new recall (NOT STARTED)

Introduce owner-scoped portable knowledge (not blanket sharing raw session log files). Fresh agent on different repo/G6/G8 should search the same Palace and load only a relevant locator/page, without being guided manually. Use existing authenticated transport; no new Gate.

## P4 — Autonomous skills (NOT STARTED)

Create agent-owned versions from repeated evidence; lazy-load compact catalog. Automatically merge/dedupe/archive on a **bounded changed-input schedule**, with automatic validation and rollback; no human per-skill approvals. No automatic merging into product Git branches.

## P5 — Gateway integration / release (NOT STARTED)

Use canonical G8 Gateway develop, not stale older Context branch. Existing shell access can execute CLI; only add a tiny MCP facade if cold-agent testing proves CLI insufficient. Protect current UI/account pairing and Device v1.0.11 public tool contracts. Release/reload requires separate authorization.

## Stop rules

If a stage reads the wrong bytes, links two unrelated sessions/files, loses newly appended records, consumes unbounded model tokens or changes production outside its scope: mark INCOMPLETE, test and fix the exact issue. Commit coherent increments and keep [HANDOFF.md](HANDOFF.md) truthful so an unrelated successor agent can resume without conversation context.