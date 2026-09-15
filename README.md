# HCU Device

`@hcu/device` is the execution-plane agent for the HCU MCP Gateway. It keeps an outbound WebSocket connection to the gateway and executes the bounded filesystem, edit, shell, process, image-preview, and project-inspection capabilities routed to this machine.

The central gateway owns accounts, OAuth, device ownership, skills/workflows, MCP tool contracts, routing, and usage aggregation. This package owns the machine identity, pairing, reconnect lifecycle, local execution, and local status.

## Development setup

```powershell
git clone https://github.com/Hiroshimeow/agent-mcp-device.git
cd agent-mcp-device
git checkout feat/direct-agent-gateway-device
npm ci
npm run build

$env:MCP_GATEWAY_URL="https://<gateway-host>"
node dist/hcu-device.js login
node dist/hcu-device.js install
node dist/hcu-device.js status
```

`install` runs the device agent in the background on Windows. The terminal does not need to stay open after installation.

Useful commands:

```text
hcu-device              run in the foreground
hcu-device login        pair/link this device through the browser flow
hcu-device logout       unlink the account from this device
hcu-device status       show gateway, connection, usage, and schema status
hcu-device install      install and start the background device service
hcu-device start        start the installed service
hcu-device stop         stop the installed service
hcu-device uninstall    remove the installed service
hcu-device --help       show command help without starting the runtime
```

## Identity and routing

A device keeps an Ed25519 private identity locally under `~/.hcu-device/`. The gateway stores the public key and account ownership. New device IDs use `<hostname>-<random8>`; the friendly device name can change without changing the immutable identity.

No inbound device port is required. The agent connects outbound to the gateway, and every account-scoped tool dispatch is routed by `device_id`.

## Package status

The target npm package name is `@hcu/device`, but npm publication is intentionally deferred. The repository build and tarball are used for local validation until publication is explicitly approved.

## Upstream execution engine

The local execution engine is derived from [Desktop Commander MCP](https://github.com/wonderwhy-er/DesktopCommanderMCP). Its MIT copyright and license are preserved in `LICENSE`; use the upstream repository for the original Desktop Commander documentation.
