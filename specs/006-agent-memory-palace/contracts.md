# 006 — Existing log index: implemented contracts and future seams

This document describes the local CLI under development on G6, NOT a new public MCP schema or Wiki installation. Historical P0 observer/capture contracts were rejected as implementation scope by the user.

## Source registration

Commands:
- mcp-device logs discover
- mcp-device logs add <file-or-dir> [--format auto|pi|codex|mcp|text]
- mcp-device logs sources
- mcp-device logs index [--max-files N] [--max-bytes N]
- mcp-device logs search --query "terms" [--limit N]
- mcp-device logs read --ref <48-hex-ref> [--max-bytes N] [--from-byte N]
- mcp-device logs graph --ref <48-hex-ref> [--limit N]

Returns compact one-line JSON with ok/result on success and ok/error on failure. The client provides no LLM call, no implicit watcher, no capture observer and no extra authorization/redaction prompts. The existing logged-on OS user's file access controls apply.

A file source can have any extension when explicitly added. A directory recursively discovers .jsonl, .ndjson, .log and .txt files, without following symlinks. The discover command registers the user's default Pi, Codex and MCP history paths on explicit invocation only; index must also be run explicitly. The index is derived local data under MCP_DEVICE_CONFIG_DIR/log-palace/index.sqlite (override for isolated testing: MCP_DEVICE_LOG_PALACE_DIR).

## Record model

Source locator fields: ref, file, byte_offset, line_bytes, part_index, line_sha256, log format. Search metadata: kind, tool, session, turn, call_id, timestamp, file_path, preview (bounded). SQLite FTS5 uses a contentless-delete index and stores search terms, not a second full-length copy of every raw log line.

- **Pi:** session id/cwd from session record; assistant toolCall.id/name/arguments; toolResult toolCallId, text and isError.
- **Codex:** session_meta.id/cwd, task_started and turn_context.turn_id, function_call.call_id, function_call_output.call_id. Ignore token counters/reasoning/compaction as primary search hits.
- **MCP legacy:** toolName, arguments, output, optional known session/call identifiers. Do not manufacture a missing agent session.
- **Other JSONL/text:** keyword searchable. Unsupported structure is not used as an inferred graph edge.

Exact file relationship uses absolute path, or an explicit logged cwd + relative file argument. Two README.md basenames in different repositories are not the same identity. Exact call IDs are joined only inside the same explicitly logged session, otherwise within the same source file. Session and turn edges are observations, not causality.

## Consistency and limits

- Index cursor is the last complete newline, so an unfinished append is deferred. Index reuses byte offsets and FTS rows without re-ingesting the same records.
- Device/inode, indexed-prefix and indexed-tail hashes detect replacement/truncate/in-place changes; detected replacement invalidates derived records/FTS before replay.
- Read reopens original file at the indexed byte range, verifies source SHA-256 and fails if changed/missing. Valid UTF-8 is required for model-visible text; invalid UTF-8 fails explicitly with `SOURCE_ENCODING_UNSUPPORTED` rather than emitting replacement characters or exceeding the requested text-byte budget.
- A large single line without newline may be reported stalled; the index must NOT invent a complete record. Handling lines beyond scan budget is P1 hardening.
- Search uses tokenized FTS5 and returns locator metadata; raw content is read via ref, default 8 KiB, max 64 KiB. A mapped `hit_offset` is source-record-relative and, for a Pi content part, is only emitted when the matching raw byte is proven inside the actual syntactic byte span of `message.content[part]` in the original JSON; metadata mirrors or reserialized-equivalent objects are not accepted as provenance. If that span cannot be proven, the anchor is `unmapped`. Legacy `selected_part` reads are bounded but non-resumable (`next_offset=null`, `resumable=false`); resumable cursors belong to `raw_source` reads.
- Graph is an on-demand bounded SQL relation query, not an extra graph database/daemon. Supported relations: same exact call, same logged session, same turn, same normalized absolute file. No timestamp-derived caused_by edges.
- A raw log may change between search and read; return explicit changed/missing error, not an unrelated byte window.

## Not implemented

No shared Wiki, learned-skill scheduler, cross-device replication, semantic/vector search, hidden live capture, or automatic bootstrapping of a new repo. The old context status/search/read/graph commands still exist and work independently.

## Known limitations to evaluate next

Real logs may have incomplete session coverage, files too large for one slice, giant lines, non-UTF8 encodings, source rotations while scanning and >10,000 matching directory files. No confidence claim is made without concrete test evidence. max-files/max-bytes cap one indexing call and calls can be repeated; partial and more_files expose bounded progress without claiming complete coverage.