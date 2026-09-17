# MCP Device

`@hcu-lab.me/mcp-device` securely connects a user-owned computer to an authenticated Model Context Protocol gateway. The device makes the outbound connection; no inbound device port is required.

The gateway owns accounts, OAuth, device ownership, MCP tool contracts, routing, and usage aggregation. MCP Device owns local device identity, pairing, reconnect lifecycle, bounded execution, background registration, and local status.

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

On Windows, `install` uses the current-user background registration. On Linux, every `install` asks whether to use `systemd --user` or an already configured PM2 installation. MCP Device does not install PM2, run `pm2 startup`, or use `sudo` automatically.

## First run and trust

The official gateway is `https://mcp-v2.hcu-lab.me/mcp`. The official package is designed to pin an independently distributed application CA and require protocol v2 before the first network connection. If that CA is absent, MCP Device fails closed rather than learning trust from the gateway it is about to contact or falling back to protocol v1.

For a custom gateway, configure the gateway URL and provision its application CA through an independent trusted channel before enabling protocol v2. Proxy selection is captured during interactive provisioning and reused by the background runtime; proxy credentials are protected with Windows DPAPI on Windows.

## Local state and migration

Canonical state is stored under `~/.mcp-device/`. Existing `~/.hcu-device/` identity/config/status state is migrated non-destructively under serialized runtime ownership. A conflicting canonical and legacy identity fails closed rather than creating a second device identity.

The device identity is Ed25519. On Windows, the private key is protected with DPAPI for the current user. The gateway stores the public identity and account ownership.

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
