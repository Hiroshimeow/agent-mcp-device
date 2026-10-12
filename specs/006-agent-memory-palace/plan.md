# 006 — Implementation plan, log-first

**Source baseline:** G6 Device main at eaa5192 (P0 audit). **Scope currently active:** P1 existing-log CLI/index. Later phases stay pending. No PI, no worktrees or code on production G8 in this task.

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

**P1 test gate:** Node 22.13+, TypeScript build, 11 targeted regression tests, legacy Context targeted tests, and isolated real-log smoke. Record actual successes/limits in [HANDOFF.md](HANDOFF.md).

### P1 hardening still open

- Robust handling for individual lines larger than per-file indexing budget. Current index reports stalled, does **not** silently mark a partial JSON record complete.
- Directory/file rotation with overlapping registered sources and long-lived Windows file handles; validate Windows/Linux.
- Real-log throughput, disk/FTS growth, search p95 and compact response sizes on repeat runs. No conjectured token-savings percentage.
- Large-directory discovery (>10,000 matching files) and fair resumable paging; must not silently claim full coverage.
- Source format auto-detection from rotated/new files, stale/missing source read, exact session/call relations and negative cases.
- Optional output pagination/filtering for very large lists; add only when baseline shows need.
- Documentation and test gap review with independent M365 if available, only through prescribed Worker; no raw private log attachments.

Do **not** expand P1 by adding an observer, broker, capture lifecycle, LLM summarization queue or permissions wrapper already handled by OS/MCP.

## P1 next acceptance (2026-10-12)

The old source checkpoint 716f011 covers indexing/fairness but not the newly observed late-hit retrieval or UTF-8 boundary failures. Bounded source fix adds a raw-source byte anchor for an exact matching term and an optional `--from-byte` raw-source read, retaining the no-offset legacy selection path. Independent TEST and REVIEW on final SHA remain required; unanchored normalized/synthetic FTS matches are not fabricated as original byte offsets.

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