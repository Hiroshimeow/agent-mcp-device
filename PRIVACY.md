# MCP Device Privacy

MCP Device runs local file, process, and editing operations on a user-owned computer and connects outbound to the configured MCP gateway.

The runtime does not send product analytics, telemetry, survey events, or remote feature-flag requests. Local execution data is transferred to the configured gateway only as required to execute authenticated tool calls and report bounded device status/usage metadata.

Device state is stored under `~/.mcp-device/`. Package updates may contact the package registry when an authenticated owner requests a supported self-update.

## Device-local context (1.0.11 development)

Context is stored under the device state root in `context/`, with an owner registry, repository SQLite databases (including WAL/SHM), and minimal unscoped metadata. Retained payloads, search documents, and derived activity relations are local; there is no context provider or analytics upload. Authenticated remote search/read necessarily returns the selected bounded evidence through the gateway to the requesting client. The context gateway forwarding seam does not persist or cache evidence; deployment-wide logging policy remains the operator's responsibility.

The canonical observer covers supported public device calls when explicitly approved. It does not read agent transcripts or observe every native editor/shell action. Checkpoint summaries and test claims are reported, not observed traces. Missing capture and unknown-after-restart outcomes are surfaced as coverage gaps; side effects are never replayed to fill a gap.

Before persistence, payloads pass through bounded UTF-8 redaction. Patterns cover private keys, bearer tokens, common credential assignments and known token prefixes; selected credential paths, binary and oversized payloads are excluded/truncated. **This is best-effort pattern matching, not exhaustive secret detection.** Arbitrary unlabeled secrets, sensitive prose and new credential formats may remain. Do not submit credentials or assume local evidence is safe to publish. Protect the state directory with OS permissions; SQLite files are not encrypted by this feature.

Re-pairing seals the former owner namespace from default CLI, skill and MCP access; it does not delete old data. No silent old-event eviction or per-turn maintenance is performed. Destructive administration is not available through the agent MCP catalog. Stop the runtime before an operator backup/removal of local state; do not copy only the main SQLite file while WAL is active. Legacy import preserves its source files.

See [context documentation](docs/context.md) for scope, migration, source attribution and limitations.

For the hosted service, server-side operational and security logs are governed by the deployment operator. Self-hosted deployments control their own gateway and logging policy.
