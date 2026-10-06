# MCP Device

The gateway owns accounts, OAuth, device ownership, MCP tool contracts, routing, and usage aggregation. MCP Device owns local device identity, pairing, reconnect lifecycle, bounded execution, background registration, and local status.

## Install

```powershell
npm install -g @hcu-lab.me/mcp-device@1.0.10
mcp-device login
mcp-device install
mcp-device status
```

## 1.0.11 integration compatibility

The post-1.0.10 context integration targets **1.0.11 (unreleased)** and requires Node **>=22.13.0**, including built-in `node:sqlite` with FTS5. Upgrade Node before installing this unreleased version; no external SQLite npm driver is required. The published 1.0.10 installation example above remains historical and is not a 1.0.11 release announcement.

## Device-local context

```text
mcp-device context status --cwd . --json
mcp-device context search --cwd . --query "gateway reconnect" --json
mcp-device context read --cwd . --ref <evidence-ref> --json
mcp-device context sync --cwd . --json
```

Search/read/status never run indexing automatically. Run sync selectively when freshness matters; verify current source separately. The CLI operates on the local state host without a gateway. Permission denial never triggers a remote fallback.

The six gated MCP schemas are `local_status`, `local_search`, `local_read`, `local_graph`, `local_index` and `local_wiki`; public registration/live capture require valid runtime approval. Wiki is disabled. Source schemas: [`src/context/tool-contract.ts`](src/context/tool-contract.ts). Portable skill: [`skills/mcp-device-context/SKILL.md`](skills/mcp-device-context/SKILL.md); explicit client loading is supported, universal automatic discovery is not claimed.

See [context commands, migration and limitations](docs/context.md) and [privacy](PRIVACY.md). Phase 9 evidence is under `evidence/context/`; this branch is not authorized for merge, publication or tagging.

## Commands

```text
mcp-device              start in the foreground
mcp-device start        start in the foreground
mcp-device login        link or switch the gateway account
mcp-device logout       unlink the gateway account from this device
mcp-device status       show device and runtime status
mcp-device install      pair if needed, then install and start the background runtime
mcp-device stop         stop the current runtime
mcp-device uninstall    remove background registration while preserving device identity
mcp-device --help       show command help
```
