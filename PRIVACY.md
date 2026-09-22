# MCP Device Privacy

MCP Device runs local file, process, and editing operations on a user-owned computer and connects outbound to the configured MCP gateway.

The runtime does not send product analytics, telemetry, survey events, or remote feature-flag requests. Local execution data is transferred to the configured gateway only as required to execute authenticated tool calls and report bounded device status/usage metadata.

Device state is stored under `~/.mcp-device/`. Package updates may contact the package registry when an authenticated owner requests a supported self-update.

For the hosted service, server-side operational and security logs are governed by the deployment operator. Self-hosted deployments control their own gateway and logging policy.
