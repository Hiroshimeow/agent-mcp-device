# MCP Device

`@hcu-lab.me/mcp-device` connects a user-owned computer to the authenticated MCP Gateway. The device opens the outbound connection; no inbound device port is required.

The gateway owns accounts, OAuth, device ownership, MCP tool contracts, routing, and usage aggregation. MCP Device owns local device identity, pairing, reconnect lifecycle, bounded execution, background registration, and local status.

## Quick start

Canonical production gateway: https://device.hcu-lab.me

- Dashboard: https://device.hcu-lab.me/dashboard
- Pair device: https://device.hcu-lab.me/pair
- Live setup/help: https://device.hcu-lab.me/help

Install the current release:

```powershell
npm install -g @hcu-lab.me/mcp-device
mcp-device login
mcp-device install
mcp-device status
```

The hosted Pair/Help pages render their gateway URL and navigation from the deployment that served the page, so staging or custom deployments do not need a production-host rewrite. For the canonical package, `https://device.hcu-lab.me` is the default gateway; `MCP_GATEWAY_URL` is only needed when intentionally using another gateway.

## Commands

```text
mcp-device              start in the foreground
mcp-device start        start in the foreground
mcp-device login        explicitly link or switch the gateway account
mcp-device logout       unlink the gateway account from this device
mcp-device status       show runtime, manager, connection, security, proxy, usage, and schema state
mcp-device install      pair if needed, then install and start a background runtime
mcp-device stop         stop the current runtime without deleting identity/account state
mcp-device uninstall    remove background registration while preserving identity/account state
mcp-device --help       show command help
```

`md` is an alias of `mcp-device` on POSIX shells. On Windows, use `mcp-device`; bare `md` has a shell collision with built-in directory-creation commands/aliases and is not the supported invocation.

On Windows, `install` uses current-user background registration. On Linux, every `install` asks whether to use `systemd --user` or an already configured PM2 installation. MCP Device does not install PM2, run `pm2 startup`, or use `sudo` automatically.

## First run and trust

The official gateway base URL is `https://device.hcu-lab.me`. The official package pins the independently distributed application CA and requires protocol v2 before the first network connection. If that CA is absent or invalid, MCP Device fails closed instead of learning trust from the gateway it is about to contact or falling back to protocol v1.

For a custom gateway, set `MCP_GATEWAY_URL` and provision its application CA through an independent trusted channel before enabling protocol v2. Proxy selection is captured during interactive provisioning and reused by the background runtime.

## Local state and 1.0.2 migration

Canonical state is stored under `~/.mcp-device/`. Existing `~/.hcu-device/` identity/config/status state is migrated non-destructively under serialized runtime ownership. A conflicting canonical and legacy identity fails closed rather than creating a second device identity.

The device identity is Ed25519. MCP Device 1.0.2 does not use Windows DPAPI for the device private key or proxy configuration. A legacy protected 1.0.1 identity is archived without decrypting it, a fresh local identity is generated, and the device must be paired once again. A legacy protected proxy configuration must be supplied again during `mcp-device login`. The gateway stores only the public device identity and account ownership.

## Development

```powershell
git clone https://github.com/Hiroshimeow/agent-mcp-device.git
cd agent-mcp-device
npm ci
npm run build
node dist/mcp-device.js --help
```

For a custom development gateway, set `MCP_GATEWAY_URL`. Supply `MCP_GATEWAY_APP_CA_PATH` from an independent trusted source when using protocol v2. Non-loopback plaintext gateway URLs are rejected.

## Upstream execution engine

The local execution engine is derived from [Desktop Commander MCP](https://github.com/wonderwhy-er/DesktopCommanderMCP). Desktop Commander is MIT licensed; its copyright and MIT license are preserved in this repository's `LICENSE`. The MCP Device product identity, gateway protocol, account/device lifecycle, security layer, and packaging are maintained separately in this repository.
