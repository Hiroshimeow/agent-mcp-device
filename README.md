# MCP Device

The gateway owns accounts, OAuth, device ownership, MCP tool contracts, routing, and usage aggregation. MCP Device owns local device identity, pairing, reconnect lifecycle, bounded execution, background registration, and local status.

## Install

```powershell
npm install -g @hcu-lab.me/mcp-device@1.0.7
mcp-device login
mcp-device install
mcp-device status
```

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
