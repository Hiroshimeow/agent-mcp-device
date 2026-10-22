# MCP Device v12 task 1–3: runtime and Palace CLI

## Task 1: retire NeuralMemory from MCP, not from disk

Production config `/home/ayumi/.mcp-gateway-8102/runtime/mcp-v12-no-nmem.toml` disables the external MCP manager and deletes the `nmem` upstream/always-on memory instructions. The old config, NeuralMemory service, and its data are retained to avoid breaking unrelated consumers. The server must no longer expose `nmem_*` tools. The Palace plugin is independent of NeuralMemory.

## Task 2: one authenticated backend, two local ports

Run `mcp-device server ... --port 8102 --loopback-port 8101 --public-url https://device.hcu-lab.me`.

- Public Cloudflare ingress stays `https://device.hcu-lab.me/mcp` -> `127.0.0.1:8102/mcp`.
- G8 local agent uses `http://127.0.0.1:8101/mcp`; the port is loopback-bound, rejects proxied/foreign Host requests and **requires the same account auth**.
- Both listeners share one Express application, database, Device broker, embedded Core, and plugin process; there is no second server state or device identity.
- Stop old `mcp-v11-8101` to free the local port. Cloudflare's old `mcp.hcu-lab.me` hostname is not an approved alternative to the new public origin and should be denied by the loopback Host guard.
- Existing remote Device identities remain untouched. Cutover must be rollback-capable with stopped-state snapshot.

## Task 3: CLI-first Palace as an installable plugin

Palace is an optional removable process-isolated plugin, delivered enabled by default. It does not require a Palace MCP server.

```bash
palace --runtime-dir /path/to/server/runtime status
palace --runtime-dir /path/to/server/runtime search "a specific failure" --limit 3
palace --runtime-dir /path/to/server/runtime read CARD_ID
palace --runtime-dir /path/to/server/runtime skills
```

The CLI uses a **read-only SQLite connection** so it can query the active Palace WAL without trying to own the server state lease or become another writer. Snapshot reads report `evidenceVerifiedNow: false`, not a false provenance guarantee. Write-side ingest/validation/correction remains owned by the running plugin.

The reusable Skill is at `skills/palace-cli/SKILL.md`; agents must load it only when relevant. The default CLI server does **not** advertise Palace `knowledge.*` MCP tools. `--legacy-knowledge-mcp` exists solely for compatibility/older regression fixtures. Generic MCP Device tools and the installable plugin lifecycle remain independent.

Current CLI binary is shipped with the MCP Device distribution under `dist/plugins/palace/cli.js`, with a `palace` command alias. Separating the plugin into a separately versioned, standalone npm package is follow-up packaging work; do not claim it is completed yet.

## Quality and token-economics release gate

A large indexed card count is only an indexing metric. Claim real improvement **only** after held-out end-to-end tasks under a fixed model/tool budget compare:

- no-Palace baseline vs Skill+Palace CLI;
- task correctness verified by independent postconditions;
- repeated-error rate and abstention/stale recommendation rate;
- actual model input/output/cached tokens and tool-result bytes;
- first-task/validation overhead amortized over repeated tasks;
- p50/p95 latency, task elapsed time and total cost.

Retained fixture replay reduced retries but increased agent-visible bytes; that does **not** prove token savings in production.
