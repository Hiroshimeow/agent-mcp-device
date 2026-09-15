# HCU Device

`@hcu/device` is the execution-plane agent for an HCU MCP Gateway. It keeps an authenticated outbound WebSocket connection to the gateway and executes the bounded filesystem, edit, shell, and process tool calls routed to this machine.

## Product boundary

- `agent-mcp-gateway`: OAuth/accounts, shared HCU/Superpowers skills, MCP tool contracts, device routing, usage/audit.
- `agent-mcp-device`: Ed25519 device identity, pairing, reconnect/heartbeat, local tool execution, service lifecycle, local status/logging.
- Desktop Commander remains the upstream execution engine and source of selected runtime fixes; its legal attribution and license are preserved.

## Development checkout

```powershell
npm ci
npm run build
$env:MCP_GATEWAY_URL='https://your-gateway.example'
node dist/hcu-device.js login
node dist/hcu-device.js install
node dist/hcu-device.js status --json
```

The future published UX is intentionally the same surface without the local path:

```powershell
npx @hcu/device
npx @hcu/device status
npx @hcu/device login
npx @hcu/device install
```

Publishing is not part of the current development phase.

## Runtime identity

New identities are stored under `~/.hcu-device/` and use an immutable `<hostname>-<random8>` `device_id` plus an Ed25519 keypair. The friendly device name is independent from the immutable ID.

Direct Gateway mode is YOLO by default. `MCP_GATEWAY_ALLOWED_ROOTS` is optional and only narrows execution when explicitly configured.

On Windows, `install` uses a Scheduled Task when available and falls back to the current-user Run key. The HCU service name is `HCU-Device-<device_id>`.
