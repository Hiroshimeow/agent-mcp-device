# 006 — Evaluation and acceptance (log-first)

**Never infer token savings from bytes alone.** P1 is a local index, not the complete Wiki Palace. P0 observer activation and legacy capture-watermark problems are outside the selected ingest path.

## Sources and fixtures

The minimum tests must include:
1. Real Pi JSONL session containing assistant toolCall and toolResult with an actual matching toolCallId.
2. Codex session_meta, function_call and function_call_output with shared call_id and an explicit turn.
3. Legacy MCP history.jsonl with toolName/arguments/output but no agent session identity.
4. Unknown/plaintext log provided explicitly by an agent.
5. Incomplete final JSONL line that becomes a complete outcome after append.
6. Truncate, rewrite, replacement/rotation, deletion and stale read-ref invalidation.
7. Same filename (README.md) from distinct logged repo cwd, reused call IDs across distinct sessions; graph must not join them accidentally.
8. Repeated bounded directory scans, no starvation of new sources, no duplicate records or FTS rows.
9. Search → selected read ≤2 calls after index, graph optional; bounded metadata and read bytes.
10. Known source file never modified by add/index/search/read.

## Required output per stage

- Git SHA, OS, Node/SQLite version, fixture inputs (sanitized), commands, expected/observed results, failures, duration and output sizes.
- Real-log probe must use isolated local index state, and never show private raw transcript, secrets, or index contents in a review attachment.
- Report total source files selected, bytes indexed, record count, completed/partial, search/ref/read correctness and measured query latency. Do not invent benchmark outcomes or extrapolate from one successful fixture.
- Existing Context v1.0.11 product API, Gateway runtime and code paths remain untouched.

## LLM Wiki / skills (later)

Compare no Palace vs Palace across the same agent/model/tools and repeated cold-start tasks. Measure:
- model prompt+response and memory retrieval tokens;
- offline log index/storage cost and FTS latency;
- LLM Wiki extraction/digest/update tokens;
- skill generation, curator/merge LLM tokens;
- task correctness and failure rate, user-guidance repetitions, calls and p50/p95 time.

A Wiki with lower read tokens but expensive repeated background dream is not necessarily an improvement. Idle with no changed inputs should have 0 LLM summarization/curator calls.

Cross-device test: agent on G6 creates a real solved-session log; fresh agent on G8 in different repo finds correct prior evidence/Wiki without a user handoff, validates applicability and completes task. False file/session links, unauthorized information or stale advice asserted as current knowledge are FAIL.

## Stop conditions

Do not declare P1 PASS when compiler/tests fail or real logs aren't checked; do not claim Wiki or memory transfer is implemented until independently reproduced. If read lookup fails because a source log rotated, show stale/missing explicitly. Do not solve the issue by adding observer/capture or another permission gate.