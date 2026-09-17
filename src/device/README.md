# MCP Device runtime

This directory contains the MCP Device execution-plane runtime used by `@hcu-lab.me/mcp-device`. It maintains an authenticated outbound connection to the gateway and exposes bounded filesystem, edit, shell, process, image-preview, and project-inspection capabilities routed to the user's machine.

## Runtime lifecycle

Public commands are `start`, `login`, `logout`, `status`, `install`, `stop`, and `uninstall`. No subcommand is equivalent to foreground `start`. Background manager runners use the internal `--service` mode.

Canonical per-user state lives under `~/.mcp-device/`. Legacy `~/.hcu-device/` state is read only for non-destructive migration compatibility; identity conflicts fail closed.

On Windows, background lifecycle uses the current-user Scheduled Task with HKCU Run fallback. New resources use the `MCP-Device-<device_id>` name. Verified legacy `HCU-Device-<device_id>` registrations are migration-only compatibility resources.

On Linux, `install` asks on every invocation between `systemd --user` and an already-configured PM2 installation. MCP Device does not install PM2, configure privileged startup, use `sudo`, or modify linger automatically.

## Trust and transport

The public MCP endpoint is `https://mcp-v2.hcu-lab.me/mcp`; device WebSocket traffic uses the same origin at `/device`. Protocol v2 uses TLS 1.3 inside the WebSocket with independent application-CA verification and exporter-bound Ed25519 proof. The official package must contain the independently distributed public application CA before packing; otherwise the production prepack check fails closed.

Compatibility crypto/state identifiers containing the historical `hcu` prefix remain intentionally unchanged when renaming would break persisted state or the wire protocol.

## Upstream engine

The local execution engine is derived from Desktop Commander MCP. Its MIT license and upstream attribution are preserved in the repository `LICENSE` and root `README.md`.
