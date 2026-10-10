# MCP Device

The gateway owns accounts, OAuth, device ownership, MCP tool contracts, routing, and usage aggregation. MCP Device owns local device identity, pairing, reconnect lifecycle, bounded execution, background registration, and local status.

## Install

```powershell
npm install -g @hcu-lab.me/mcp-device@1.0.10
mcp-device login
mcp-device install
mcp-device status
```

## 1.0.11 source compatibility

Device source v1.0.11 is available on GitHub `main`, and requires Node **>=22.13.0**, including built-in `node:sqlite` with FTS5. Upgrade Node before using this source; no external SQLite npm driver is required. The 1.0.10 npm installation example above is historical: source delivery alone does **not** establish that 1.0.11 was published on npm or deployed.

## Device-local context

```text
mcp-device context status --cwd . --json
mcp-device context search --cwd . --query "gateway reconnect" --json
mcp-device context read --cwd . --ref <evidence-ref> --json
mcp-device context sync --cwd . --json
```

Search/read/status never run indexing automatically. Run sync selectively when freshness matters; verify current source separately. The CLI operates on the local state host without a gateway. Permission denial never triggers a remote fallback.

The six gated MCP schemas are `local_status`, `local_search`, `local_read`, `local_graph`, `local_index` and `local_wiki`; public registration/live capture require valid runtime approval. Wiki is disabled. Source schemas: [`src/context/tool-contract.ts`](src/context/tool-contract.ts). Portable skill: [`skills/mcp-device-context/SKILL.md`](skills/mcp-device-context/SKILL.md); explicit client loading is supported, universal automatic discovery is not claimed.

See [context commands, migration and limitations](docs/context.md) and [privacy](PRIVACY.md). Phase 9 acceptance evidence is under `evidence/context/`. GitHub source delivery does **not** authorize npm publication, tagging, SOC approval or production Context enablement.

## Current status

[**Device/Gateway status and active tasks**](docs/STATUS.md) · [Historical DONE/outdated material](docs/ARCHIVE.md). Source commit, published package and live Gateway tool catalog must be verified separately.

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
