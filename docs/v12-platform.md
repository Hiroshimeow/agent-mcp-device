# MCP Device 1.0.12 platform guide

This source extends the existing MCP Device package. `start` remains the Device-only runtime; `device` is an alias for the existing Device command family. `server` starts the account/OAuth control plane and one mandatory local Device runtime using the same transport-neutral Device Core as remote Devices.

The acceptance record is [Spec 008](../specs/008-v12-platform/ACCEPTANCE.md). A built source tree, a locally tested tarball, npm publication and a production deployment are separate states. This increment does not publish or deploy the package.

## Runtime and state

Node 22.13 or newer is required, including built-in SQLite/FTS5. Acceptance uses the exact Node versions recorded in Spec 008. Native Device handlers retain their SDK v1 dependency; the retained control-plane surface uses SDK v2. The dependency lock is part of the candidate.

```text
mcp-device start
mcp-device start  # Core-only by default; no Palace provisioning
mcp-device device start
mcp-device device status
mcp-device server --runtime-dir <server-state> --host 127.0.0.1 --port 8104
# Trusted-LAN HTTP example with one shared server Skill root:
mcp-device server --runtime-dir <server-state> --host 0.0.0.0 --port 8101 --public-url http://abc:8101 --allow-http-lan --skill-root ~/.mcp-device/skills
mcp-device --help
```

Server state defaults to `~/.mcp-device/server`; legacy Device state defaults remain `~/.mcp-device`. An explicit `--runtime-dir` selects platform command state. `MCP_DEVICE_CONFIG_DIR` is also accepted by platform commands and the native execution configuration; it must be set before native modules load. Legacy Device identity and service configuration retain their existing path rules. Server starts the native modules only after selecting its state root. `--skill-root DIR` selects the single server-global Skill catalog shared by authenticated accounts; when omitted, an existing `~/.mcp-device/skills` directory is preferred for legacy/shared-team compatibility, otherwise the bundled distribution Skills are used. `MCP_SKILL_ROOT` is the service-friendly equivalent.

The public Device artifact is Core-only regardless of CLI, environment, service registration or server config. Legacy `--plugin-policy bundled|core-first`, `MCP_DEVICE_PLUGIN_POLICY` and server `pluginPolicy` inputs are validated compatibility no-ops: neither value changes provisioning. Selection/validation precedence is Device CLI over environment, and server CLI over config over environment; an invalid selected value fails, but overridden lower-priority values are not validated. No transient flag needs propagation to services or self-update. Existing automatic distribution-enabled Palace records stay retained and inert until explicit enable; manual enabled installations and recorded explicit enable intent survive restart. Core never repins Palace to its own package tree.

`--allow-http-lan` is an explicit trusted-LAN opt-in. It requires an explicit `--public-url http://...` and permits that non-loopback HTTP URL to be used as the OAuth issuer/resource base. Without the flag, non-loopback OAuth issuers remain HTTPS-only. This changes transport policy only; account authentication, Device ownership, pairing and cross-account isolation remain unchanged.

TODO: external MCP upstreams are currently server-global. Before relying on upstreams in multi-account deployments, add per-upstream ownership (`owner_account_id`) with private-by-default visibility and explicit sharing. Shared server Skills remain intentionally cross-account.

Server is a foreground process. Stop it with Ctrl-C or the supervising process manager. A Node parent using a private IPC channel may send `{ "type": "mcp-device:shutdown" }` for graceful shutdown on Windows. This is a parent/child process channel, not a network endpoint.

The state root contains identity, pairing/account state, the Gateway SQLite database, plugin registry/private data, a persisted knowledge-reference signing key and bounded activity records. Concurrent server, Device and maintenance processes cannot take the same state lease. Existing Device RuntimeOwner IPC is also checked. An unresponsive legacy control file requires inspection; maintenance does not silently stop another runtime or discard the control state.

The local execution owner does not connect to its own WebSocket or spawn another Device MCP server. A Palace worker process is plugin isolation, not a second Device runtime. Remote Devices continue using their authenticated GatewayDeviceChannel and reconnect/session-epoch contracts.

### Linux and WSL runtime path limitations

Legacy Device ownership uses a pathname Unix socket under `HOME/.mcp-device`, independently of `MCP_DEVICE_CONFIG_DIR`. A long HOME can exceed the operating system's socket pathname limit and fail startup with `EINVAL`; there is currently no shorter-path fallback or dedicated length diagnostic. In the measured WSL2 Linux environment, a 107-byte socket pathname bound successfully and a 108-byte pathname did not. These are environment measurements, not a portable path-length guarantee.

WSL DrvFS (`/mnt/c`, `/mnt/e`) pathname sockets also failed with `ENOTSUP` in that environment, even below the measured length limit. For new isolated WSL installations, use a short HOME on the native Linux filesystem. Changing only `--runtime-dir` or `MCP_DEVICE_CONFIG_DIR` does not relocate legacy Device ownership. Do not move an existing identity or delete ownership state as a workaround; plan any existing-state relocation separately with a verified backup.

## Account, OAuth and pairing

Localhost follows the ordinary account, OAuth and Device pairing flows. Anonymous MCP calls are rejected. Create an initial administrator using the existing administrative command, supplying the password through `HCU_ADMIN_PASSWORD` rather than command-line arguments:

```text
mcp-device admin --runtime-dir <server-state> account create-admin <email>
mcp-device admin --runtime-dir <server-state> invite create 1
mcp-device server --runtime-dir <server-state> --host 127.0.0.1 --port 8104
```

The administrator manages invitations and the operator interface. Use an invitation to create an ordinary account at `/signup`; Device pairing and OAuth consent use that ordinary account, preserving the existing role separation.

The server prints one JSON event per line for `device_pairing_required` and `server_ready`. The pairing event contains the public user code and verification URL; it excludes the private device code and PKCE verifier. Open the verification URL, sign in with the ordinary account and claim the local Device. MCP clients then use the standard registration/authorization/consent/token flow. A restored identity and matching server state retain enrollment, accounts and refresh-token continuity.

The operator UI is under `/operator` on the same listener and requires administrator authentication. `/operator/state` uses the same policy. There is no automatic second operator port.

For remote Devices, provide the existing Gateway application TLS configuration through a server JSON config. `--config` accepts an object with an optional `env` object and an optional `configPath` for upstream configuration. `configPath` resolves relative to that JSON file. Configuration names and certificate requirements remain the retained Gateway contracts; incomplete TLS configuration fails startup and closes acquired resources. The isolated localhost test configuration does not provision production trust or bypass remote Device TLS requirements.

```text
mcp-device server --runtime-dir <server-state> --config <server-config.json> --host 127.0.0.1 --port 8104
```

Upstream configuration is selected consistently for both workspace and external MCP manager startup. Explicit options take precedence over the runtime-root configuration and bundled fallback. Existing upstream tools/resources/prompts, cache/reconciliation and collision rules remain in the control-plane adapter.

## Plugin lifecycle

Palace is optional and separately packaged. Install its reviewed `palace.plugin.json` explicitly with `--enable` to opt in. Core has no Palace dependency or installer. A disabled, uninstalled, crashed or incompatible provider loses its advertised capabilities while native file/process tools remain available. Uninstall leaves a tombstone, so later starts do not silently reinstall the plugin. Disable and uninstall preserve private data; purge is a separate explicit command for a disabled plugin.

```text
mcp-device plugins --runtime-dir <state> list
mcp-device plugins --runtime-dir <state> disable palace
mcp-device plugins --runtime-dir <state> enable palace
mcp-device plugins --runtime-dir <state> uninstall palace
mcp-device plugins --runtime-dir <state> install <manifest.json> --enable
mcp-device plugins --runtime-dir <state> configure <plugin-id> <settings.json>
mcp-device plugins --runtime-dir <state> upgrade <manifest.json>
mcp-device plugins --runtime-dir <state> upgrade /path/to/palace.plugin.json
mcp-device plugins --runtime-dir <state> purge <plugin-id>
```

Configure requires a disabled plugin. Upgrade and purge require stopped runtime ownership so that migration/deletion cannot race a live provider. Upgrade works on a private copy and restores the previous manifest/data if validation or migration fails. An external manifest becomes a user-managed (`manual`) registration. Core has no bundled Palace manifest; the generic host retains bundled-contract handling for other distributions and fixtures. Registry writes use revision checks, a tokenized exclusive lock and a stale-lock recovery lock; another runtime sees enabled-capability changes through refresh notifications.

The host is capability-oriented: providers, ordered augmenters, observers and fallback providers compose through versioned contracts. Dependencies resolve to healthy compatible providers and are pinned during an activation. A plugin can invoke its declared dependencies through scoped host services. Dependency loss invalidates dependent providers. Faults are sticky across startup, refresh and dependency activation: none of these automatically restarts a faulted provider. After inspecting the recorded error, explicitly run `mcp-device plugins --runtime-dir <state> enable <plugin-id>` to retry; faulted dependents also require explicit enable after their provider recovers. Missing-entry/bundled upgrades require a stopped runtime; an agent reports that prerequisite and must not stop the runtime itself. Process isolation supports Node workers and external JSONL executables; explicitly trusted cooperative plugins may use the in-process path. See the [plugin contract](../specs/008-v12-platform/plugin-contract.md) for the API, cancellation, frame limits and examples.

Public MCP `capability.list` reports an owned Device's available capabilities and versions. `capability.call` invokes an advertised non-knowledge plugin contract through the normal authenticated Device dispatcher. It does not expose private knowledge import; knowledge exchange uses the three public contracts below.

### Migrating an old bundled Palace installation

On replacement of the old Device package with Core, the old bundled entry disappears (`dist/plugins/palace/plugin.js`). Registry, private data and identity retention is not executable continuity. Automatic distribution records remain suppressed without creating a missing-entry fault; an old explicitly enabled record is eligible to start but faults if its entry is gone. Enabling the old path alone cannot repair that missing code.

Continuing Palace is optional. Separately install a reviewed compatible `@hcu-lab.me/palace` package in a location independent of the replaced Core package (for example an approved local tarball, or a pinned published version when available). This source candidate does not imply that version is published. Core does not download, silently repin, or automatically migrate it. Existing Skill files/ownership ledgers are retained; any standalone package lifecycle-script Skill integration belongs to that optional installation.

Have the operator stop the Device/server through its existing supervisor; agents must not stop it as a side effect of migration. Preserve a verified stopped-state backup of the same runtime root, including identity, registry and plugin data. With the runtime stopped, replace the existing registration using the separate package's actual manifest, not `install` or `--bundled`:

```text
mcp-device plugins --runtime-dir <state> list
mcp-device plugins --runtime-dir <state> upgrade <separate-package>/palace.plugin.json
mcp-device plugins --runtime-dir <state> enable palace
```

Upgrade validates the real separate entry on a private data copy and records a manual registration; explicit enable records retry/activation intent, including for previously faulted installations. It does not replace the Device identity. Restart under operator control, then check `palace status --runtime-dir <state>` and the expected knowledge capabilities. If Palace is not wanted, leave automatic records inert or explicitly disable the old registration; do not purge data. Disabled records stay disabled unless explicitly enabled, and uninstalled tombstones are not reinstalled by this procedure. Stop and inspect any failed upgrade rather than deleting state or changing identity.

## Knowledge federation

Knowledge exchange is a platform service. A requesting Device can use it without Palace or any local knowledge database.

| Public tool | Inputs | Effect |
| --- | --- | --- |
| `knowledge.search` | `device_id`, `query`; optional `project_id`, `limit`, `max_bytes`, `provider_device_id` | Select relevant available providers and return compact signed references. No import. |
| `knowledge.list` | `device_id`; optional scope/provider/budget fields | Return compact scoped references. No import. |
| `knowledge.read` | `device_id`, `ref`; optional `project_id`, `evidence`, `max_bytes` | Read one selected card. Lazily import only when the requesting Device supplies the compatible storage capability. |

Requests use authenticated account context supplied by the control plane. The caller cannot select another account through tool arguments. A Device has one current owner account, and the broker rejects ownerless or cross-account dispatch before invoking its Core. References bind the account, selected provider, origin, card version and project scope. Local-only cards do not cross Device boundaries. Provider results carry the authenticated serving Device identity rather than trusting a self-reported identity field. Palace SQLite is Device-local private state and may exist before pairing; a deliberate signed ownership transfer transfers that local state with the Device, while the old account immediately loses dispatch and federation access.

The router prefers local/project-relevant providers and uses a bounded provider count. It does not broadcast to every Device, replicate whole knowledge stores or start background pairwise synchronization. Search/list return previews. Read returns a complete card within the response budget or an explicit budget error; it never truncates a card while keeping a hash for the full content.

For a Device with a storage provider, repeated reads preserve origin, evidence, provenance, version and deduplication identity. For a Device without one, the platform uses a bounded session cache (256 entries, 8 MiB, five-minute TTL). It creates no Palace database on that Device.

Read performs an on-demand origin metadata check when available. An unavailable origin can leave an unchanged cached card explicitly stale. A known correction, withdrawal, scope revocation or version inconsistency must not silently fall back to an older usable card. Correction guards are bounded to the session; this is not a globally synchronized revocation database. Persisted card revisions and later online origin checks remain authoritative.

## Palace CLI, package and Skill lifecycle

Only the separate `@hcu-lab.me/palace` package owns the `palace` command. Core excludes optional Palace implementation, executable, Skill assets and installer. `npm run build:palace` builds the standalone package from the same canonical source, including `LICENSE`, `palace.plugin.json`, its Skill installer and a closed import graph. Register the installed manifest explicitly: `mcp-device plugins install /absolute/path/to/palace.plugin.json --enable`. This records a manual PluginHost source; Core package updates do not upgrade that separate package.

Palace Skill files belong to the optional package, not Core or per-runtime plugin state. A per-user ownership ledger records package owners and baseline hashes. The standalone installer preserves modified or foreign Skills. Ordinary `palace` reads are metadata-only. If lifecycle scripts were skipped, use `palace skill install`; Core installation/start/service/update never reconciles those files. Explicit inspection and repair remain available through `palace skill status|install|repair|remove|adopt|prune`. Existing Skill files and ownership ledgers are not purged by Core.

Every agent workflow starts with `palace status`. The response identifies the package, version, install path, runtime root, plugin state and write policy. Without an explicit root, the CLI and `mcp-device plugins|knowledge` use the same resolver: explicit argument, then `MCP_DEVICE_CONFIG_DIR`, then active lease, then a single Palace registry; ambiguous roots fail typed instead of guessing. Disabled, uninstalled, faulted, upgrade-in-progress or upgrade-required runtimes return typed actionable limitations. Lifecycle status is emitted as structured JSON on stdout even when the exit code is 1; malformed arguments, unsafe paths and SQLite/open failures are structured JSON on stderr. Palace knowledge operations are read-only. `palace skill install|repair|remove|adopt|prune` mutate only the user-home Skill ownership state. When a Device runtime is stopped, knowledge mutation uses `mcp-device knowledge --runtime-dir <state> ...` under the exclusive server lease; a standalone Palace installation without `mcp-device` has no mutation path. The Skill never stops the runtime by itself.

## Palace construction and learning

Palace builds durable knowledge cards and procedural candidates from local source evidence. It is not a replacement chat-history table. Its bounded offline discovery includes recognized Pi, Claude, Codex and MCP/Palace locations plus explicitly configured projects, logs, Skills and Git evidence. Source discovery/indexing requires no model and no cloud connection. Original sources are read, not rewritten. Missing or changed sources are detected when exact evidence is read.

Default background indexing is bounded; settings can disable it with `autoIndex: false` or adjust `indexBudget` (`maxRecords`, `maxFiles`, `maxBytes`, `intervalMs`). The interval is clamped between one second and one hour, with a 30-second default. `--project-root` and `--source-root` add explicit roots. Existing P1 `logs` and gated Context commands keep their own behavior.

The platform activity journal records bounded execution metadata and real exit/status information. It does not store full commands, file contents or raw stdout and does not treat an activity row as proof of successful task completion. Rotated or missing source evidence is not fabricated.

Recurring explicit fixes from independent sources can produce an inactive procedure candidate automatically. Activating a learned Skill requires trusted local validation: actual execution receipts plus an independent postcondition. Caller-supplied `success` fields or an invented validation result are insufficient. Automatic activation is opt-in (`autoActivateSkills`) and needs a trusted local `validationModule` exporting the expected runner factory. No automated edit to `AGENTS.md` is performed.

The local knowledge CLI is useful with a stopped runtime, including before account pairing:

```text
mcp-device knowledge --runtime-dir <state> search "{\"query\":\"reconnect timeout\"}"
mcp-device knowledge --runtime-dir <state> list
mcp-device knowledge --runtime-dir <state> read @<request.json>
mcp-device knowledge --runtime-dir <state> ingest @<request.json>
mcp-device knowledge --runtime-dir <state> learn @<request.json>
mcp-device knowledge --runtime-dir <state> correct @<request.json>
mcp-device knowledge --runtime-dir <state> skills
```

Use a JSON request file when shell quoting is inconvenient. For an active runtime, use its authenticated MCP surface. See [Palace design and measured limitations](../specs/008-v12-platform/palace-design.md) for card/evidence contracts and benchmark interpretation. The initial retriever is lexical; semantic/vector/graph expansion is not enabled without evidence that it helps.

## Backup, migration and rollback

Operate on actual runtime state directories, not source checkouts. Stop the runtime before copying SQLite state. A nonempty WAL/journal is rejected until shutdown/checkpoint has completed. Backup does not reset identity, passwords, accounts, invitations or plugin data.

```text
mcp-device state backup --source <stopped-state> --backup <new-backup-dir>
mcp-device state verify --backup <backup-dir>
mcp-device state restore --backup <backup-dir> --target <new-state-dir>
mcp-device state migrate --device-root <old-device-state> --gateway-root <old-gateway-state> --target <new-state-dir> --backup <new-backup-dir>
mcp-device state migrate --device-root <old-device-state> --gateway-root <old-gateway-state> --target <new-state-dir> --backup <new-backup-dir> --apply
```

Migration defaults to a dry-run plan. Apply first creates and verifies separate backups, then copies into a new target and validates its file hashes. Existing targets, overlapping roots, symlinks/junctions, unsafe paths and collisions are rejected. The original roots remain available for rollback; restore publishes only a new verified target. Plugin private files and managed evidence are included. Externally referenced original source files remain external; a backup cannot manufacture missing source evidence.

See [state migration contract](../specs/008-v12-platform/state-migration.md) for the manifest, collision policy and recovery sequence. Package relocation and plugin upgrade are tested separately from byte-exact state restoration; preserve user-managed plugin code or supply its current manifest when moving hosts.

## Reproducing source acceptance

Use an isolated checkout and explicit test state. The repository provides executable inventories and independent baseline/candidate parity runners.

```text
npm ci
npm run build
npm run test:v12
npm run test:parity -- --list --group port-free
npm run test:parity -- --group port-free --output <isolated-evidence-dir>
npm run test:v12:server
```

Server acceptance owns port 8104 for its duration. The cold-package test additionally requires `MCP_V12_COLD_PACKAGE_ROOT` pointing at the package inside an isolated production-dependency npm installation. Core package inventory and startup checks are separate from optional Palace fixtures and historical bundled-product receipts; neither substitutes for fresh normal pairing/OAuth, backup/restore and identity-continuity acceptance.

On the current G6 test machine, port 8103 belongs to an existing audit process and is preserved. G8 ports 8102 (production) and 8101 (backup) are outside these tests. No production rollout is authorized by source acceptance.
