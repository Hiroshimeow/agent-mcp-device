# Local log search (P1; source build)

This is a **CLI feature in the G6 Device source**. It does not require a live Context observer, authentication setup beyond existing OS filesystem rights, a Gateway MCP tool, or an LLM. This source change has **not** been published to npm or deployed.

## Commands

After building from the Device source:

~~~powershell
# Register standard existing logs (Pi, Codex, MCP tool history)
node dist/mcp-device.js logs discover

# Or add any file/folder explicitly
node dist/mcp-device.js logs add C:\path\to\session.jsonl --format auto
node dist/mcp-device.js logs add C:\path\to\custom.log --format text

# Index only when needed; append indexing is incremental
node dist/mcp-device.js logs index --max-files 200 --max-bytes 33554432

# Find compact refs (no raw log body), then read only the relevant record
node dist/mcp-device.js logs search --query "reconnect timeout" --limit 5
node dist/mcp-device.js logs read --ref <48-hex-ref> --max-bytes 8192
# When SEARCH returns anchor_status=raw_match, fetch the exact late hit in ONE read:
node dist/mcp-device.js logs read --ref <48-hex-ref> --from-byte <hit_offset> --max-bytes 8192

# Optional associations from IDs/file paths actually present in source logs
node dist/mcp-device.js logs graph --ref <48-hex-ref> --limit 12
node dist/mcp-device.js logs sources
~~~

When the package containing this feature is later installed, replace "node dist/mcp-device.js" with "mcp-device".

**Derived database:** by default under the same user's MCP_DEVICE_CONFIG_DIR/log-palace/index.sqlite. For safe smoke testing set MCP_DEVICE_LOG_PALACE_DIR to a dedicated empty directory before running the commands; the original source logs are never modified.

## What gets indexed?

- Pi session header, assistant toolCall IDs and corresponding toolResult events.
- Codex session metadata, function call/output and turn identities.
- MCP legacy history toolName/arguments/output.
- Unknown .jsonl/.log/.txt lines as **searchable text only**, not guessed graph edges.

The source record is referenced by file path, original byte offset, part index and SHA-256. Search returns a small locator; read reopens the source and verifies its hash. Graph edges represent observed matching call/session/turn or normalized full file identity, **never causal correctness**.

## Limits/important caveats

- Directory source discovery is bounded; repeatedly invoke index if more_files is true.
- An incomplete trailing JSONL record is deferred until a newline appears. A huge single line can report stalled; increase budget or handle it in follow-up P1 hardening.
- Search is Unicode FTS5 keyword/BM25, **not semantic cross-repo retrieval yet**.
- Raw files remain authoritative. File rotation/deletion may invalidate previous refs; a later index clears/rebuilds the derived entries.
- No new background tasks, extra redaction/capture gate, Wiki extraction or automatic skill processing occur. Cross-device sharing and Wiki are later phases.
- Source files and index DB contain potentially private information and remain on the owner's local machine. Do not attach private raw sessions to an external review service.

Tests: node --test test/log-palace/log-palace.test.js (after compiling TypeScript). For source status and known gaps see [Spec 006 handoff](../specs/006-agent-memory-palace/HANDOFF.md).