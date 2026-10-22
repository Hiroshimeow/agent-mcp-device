# Generic plugin dependency services and JSON-lines protocol

Status: v12 implementation contract. Acceptance receipts must refer to the built files tested; see `device-parity.json` for native/Context/P1 parity and `test/v12/plugin-services.test.js` for this contract.

## Runtime boundary

The transport-neutral Device Core remains independent of Palace and of the plugin host. The default distribution composes the Core with a generic PluginHost. Remote Device and embedded Server route native execution to that same Core. A plugin process is a capability provider, not another Device runtime.

A plugin's manifest describes its identity, private data schema, execution mode, capabilities and required capabilities. Plugin identity is not an account identity and does not own pairing credentials. Host callback authorization comes from the installed manifest and the driver instance that owns the pipe; the child cannot supply another caller identity.

`isolation: "process"` uses an independent process and bounded JSON-lines requests. `isolation: "in-process"` additionally requires `trusted: true` and cooperative, nonblocking code. Process isolation contains hangs/crashes; it is not an operating-system filesystem permission sandbox.

## Manifest and version negotiation

Relevant manifest fields:

| Field | Meaning |
| --- | --- |
| `id`, `version` | Stable plugin identity and plugin package version. |
| `dataSchemaVersion` | Positive integer for the plugin's private durable data. |
| `capabilities` | Name, exact capability version, role and optional priority. |
| `requires` | Unique capability names and compatible version ranges. |
| `entry` | Installed module/sidecar entry path. |
| `isolation`, `trusted` | Process execution, or explicitly trusted cooperative execution. |
| `executable`, `args` | Optional non-Node executable implementing the same protocol. |
| `timeoutMs` | Request deadline, clamped to 50–120,000 ms; default 15,000 ms. |

Capability names are generic. Core has no Palace-specific capability requirement. Capability versions are exact numeric `major.minor.patch`; dependency ranges support `*`, exact versions, major/minor forms, `x`/`*` components, and numeric caret ranges.

For positive major versions, `^1.2.3` accepts compatible versions at or above 1.2.3 within major 1. For zero-major versions, `^0.2.3` remains within minor 2, and `^0.0.3` remains exactly 0.0.3. Prerelease capability versions and more complex npm range expressions are not accepted.

Providers are ordered by descending priority and lexical plugin id for ties. Ordinary public invocation tries compatible provider roles before fallback roles, then applies augmenters and observers. A dependency requirement resolves to an enabled compatible provider/fallback during activation. An absent provider or cyclic dependency faults only the affected plugin/dependents.

## Plugin services API

Each invocation receives a fresh scope:

```ts
interface InvocationContext {
  signal: AbortSignal;
  services: {
    invoke(name: string, input: unknown,
      options?: { signal?: AbortSignal }): Promise<unknown>;
  };
}
```

`createPlugin(context)` also receives initialization-scoped `context.services`. Optional `start(context)` and `stop(context)` can receive their own lifecycle invocation context. A service reference retained after its parent scope ends returns `CANCELLED`; it is not a background global service locator. Process initialization uses one parent protocol request for module construction and startup.

The caller cannot choose a wider dependency version range. The host binds the range from `manifest.requires`. Calling an undeclared name fails with `CAPABILITY_DEPENDENCY_UNDECLARED` before provider dispatch. A caller-supplied signal is combined with the parent scope; parent cancellation and deadlines propagate to the selected provider.

The host pins the exact provider driver instance and required version at activation. It validates the complete pinned graph for cycles, including already running providers. Dependency calls invoke that provider directly and do not run augmenters/observers. This permits an augmenter to use its underlying provider without invoking itself recursively.

Losing or replacing a pinned driver invalidates dependent advertisements immediately and faults affected dependents. It does not silently select a new graph edge during an in-flight call. Explicit re-enable resolves a fresh compatible acyclic graph. Ordinary public provider fallback remains available independently of these dependency bindings.

### Example: a consumer that actually uses another provider

Provider capability: `text.normalize@1.2.0`.

Consumer manifest:

```json
{
  "id": "document-summary",
  "version": "1.0.0",
  "dataSchemaVersion": 1,
  "isolation": "process",
  "entry": "/installed/plugins/document-summary/plugin.mjs",
  "capabilities": [
    { "name": "document.summary", "version": "1.0.0", "role": "provider" }
  ],
  "requires": [
    { "name": "text.normalize", "version": "^1.2.0" }
  ]
}
```

Consumer module:

```js
export function createPlugin() {
  return {
    async invoke(name, input, context) {
      const normalized = await context.services.invoke(
        'text.normalize', { text: input.text }
      );
      return { title: input.title, normalized };
    }
  };
}
```

The provider's returned value is used in the consumer result. Declaring a requirement alone does not construct or copy knowledge, and the host does not infer any Palace-specific behavior.

## Language-independent JSON-lines messages

All frames are UTF-8 JSON followed by newline. Ordinary host-to-plugin requests retain the existing shape:

```json
{"id":"request-1","method":"invoke","params":{"capability":"document.summary","input":{"text":"hello"}}}
```

The child replies with the same id and exactly the relevant result or error:

```json
{"id":"request-1","result":{"normalized":"HELLO"}}
{"id":"request-1","error":{"code":"INVALID_ARGUMENT","message":"text is required"}}
```

Other ordinary methods are `init`, `cancel` and `stop`. Initialization carries `entry`, serializable `context`, target `schemaVersion` and declared `requires`. A function-bearing services object is never serialized. The Node child adapter creates the local services facade; a Python/other sidecar can use callback frames directly.

A dependency callback is a separately discriminated frame:

```json
{"type":"host_call","id":"callback-1","parent_id":"request-1","method":"capability.invoke","params":{"name":"text.normalize","input":{"text":"hello"}}}
```

The host sends:

```json
{"type":"host_result","id":"callback-1","result":{"text":"HELLO"}}
{"type":"host_result","id":"callback-1","error":{"code":"CAPABILITY_DEPENDENCY_UNAVAILABLE","message":"Bound dependency provider is unavailable"}}
```

A child can cancel an outstanding callback:

```json
{"type":"host_cancel","id":"callback-1","parent_id":"request-1"}
```

The callback parent must be a still-pending request on that same driver pipe. Unknown/expired parents return `CAPABILITY_PARENT_EXPIRED`. The host derives caller identity, requirements and allowed version from its driver/manifest, not from callback parameters. Extra caller/version claims in a child frame do not grant authority.

Ordinary requests and host callbacks have distinct pending maps. A callback id equal to an ordinary request id cannot settle the ordinary request. Duplicate active callback ids or malformed callback methods are protocol faults. Unknown callback result ids cannot resolve an unrelated request.

## Bounds, cancellation and faults

- Maximum JSON frame / buffered protocol data: 2 MiB.
- Maximum concurrent host callbacks per plugin: 64.
- Callback ids must be nonempty strings at most 128 characters.
- Callbacks inherit the parent request deadline and abort scope.
- Parent completion, cancellation, disable, crash and shutdown abort outstanding dependency work and clear correlation state. A pending ordinary request stopped by disable reports `PLUGIN_STOPPED`; the host settles those calls before aborting callback scopes, then waits for a separately bounded graceful stop. Caller cancellation reports `CANCELLED`.
- Unserializable/oversized dependency results return `CAPABILITY_OUTPUT_LIMIT`.
- An isolated process exceeding its deadline is terminated with its process tree and its provider is faulted. Explicit cancellation of an isolated request also terminates that driver to enforce the boundary; cooperative providers receive AbortSignal without requiring process termination.
- Cooperative providers must honor AbortSignal and avoid blocking the event loop. Their asynchronous stop failures propagate; the host retains the same instance for a real retry, and concurrent stop callers share the pending outcome. Cancellation does not roll back already completed provider side effects.
- Ordinary domain errors preserve a healthy provider; protocol, crash and `PLUGIN_*` failures fault the affected plugin. Its dependents lose availability, while unrelated capabilities and Core tools remain usable.
- Stdout is protocol-only. The Node adapter redirects `console.log` to stderr; the parent drains diagnostics without accumulating unbounded user-visible output.

Lifecycle shutdown waits for isolated process resource release. Windows tree termination uses the system taskkill executable and falls back to direct termination when that command fails; a close event is still required as release evidence. Drivers removed from capability advertisements remain owned until cleanup succeeds. Unproven termination rejects host closure and blocks replacement or data rollback, so the enclosing Device/server must retain its state lease. Upgrade stops the old driver, backs up the private data, runs explicit schema migration when needed and restores the previous data/manifest on failure. Disable/uninstall preserve private data; explicit purge is separate.

Remote Device shutdown shares a pending cleanup result and retries failed cleanup on a later request. It retains its Core reference, shared state lease and authenticated RuntimeOwner until cleanup succeeds. A failed update shutdown cannot write the helper handoff marker. A failed or slow signal shutdown sets a nonzero exit status and keeps the owner alive; it does not force the parent to exit while a provider may still hold state. A later successful signal may exit normally. RuntimeOwner acknowledges receipt of a stop request, while contenders must still observe actual ownership release.

## Bundled installation provenance and relocation

The registry marks records created by `ensureBundled` with `installationSource: "distribution"`. Ordinary installs use `"manual"`; existing unmarked records are treated as user-managed. A matching plugin id alone never transfers ownership to the distribution.

A new distribution installs its absent bundled records enabled by default. An uninstall tombstone is preserved without changing the registry, and a manually installed or unmarked record is never replaced. Reinstalling explicitly after an uninstall is a manual installation.

When a package moves, a distribution-owned installed record may rebind its `manifest.entry` to the current package path only when the complete non-entry manifest contract is identical and the stored data schema matches. Object property order is ignored; array order and every other field are retained in the comparison. Enabled/disabled choice, settings and private data survive. No migration runs for relocation. A prior missing-entry fault can recover after the path is corrected; unrelated faults remain explicit.

A changed version, schema, capability contract, execution policy, timeout, arguments or other non-entry manifest field creates a durable `bundleUpgradeRequired` gate. This applies even when the absolute entry path is unchanged and package replacement has already changed the bytes there. The old manifest and data remain intact, and activation, enablement and lifecycle refresh cannot execute the replaced bundle under stale metadata. Enabled records become faulted; disabled records remain disabled. Dependent advertisements disappear when their pinned provider becomes unavailable.

Only explicit `upgrade(manifest)` clears this gate and performs the corresponding migration. If migration fails, both private data and the previous registry record, including its gate, are restored. Normal startup cannot clear it. These checks reconcile distribution manifests; they are not a code-signature or byte-integrity mechanism. Installing different bytes with an unchanged manifest remains the package distributor's responsibility.

## Transport publication

The original Device wire advertises capability names. The existing authenticated `capability_sync` frame refreshes those names when providers disable/fault/recover; it does not bypass owner, pairing or connection-epoch guards.

Generic version descriptors and explicit versioned invocation may be exposed by the distribution's `platform.capabilities` and `platform.invoke` capabilities. Public forwarding must use the ordinary authenticated owned-Device route. Descriptors must not expose module entry paths, private data roots, account secrets or callback implementation details.

## Executable acceptance

`test/v12/plugin-services.test.js` verifies:

- Declared-range binding, undeclared denial before dispatch and parent-scope expiry.
- Actual provider invocation from trusted cooperative and isolated Node plugins, including initialization.
- Direct provider calls from an augmenter without recursion.
- A real Python JSON-lines sidecar, including callback/ordinary-id collision and expired-parent denial.
- Abort/deadline/disable propagation to an in-flight provider.
- Provider loss cannot transform an acyclic pinned graph into fallback recursion.

`test/v12/plugin-host.test.js` preserves existing lifecycle, migration rollback, provider composition, crash/hang containment and external lifecycle refresh assertions. These tests create only private temporary state and pipes. They require no account enrollment, network listener or production access.

`test/v12/plugin-bundles.test.js` verifies retained data/settings across package relocation, disabled state, unchanged uninstall tombstones, manual/unmarked provenance, same-path replaced code blocked across restarts, explicit migration recovery and rollback, other contract mismatches and selective missing-entry recovery.

The port-free runner executes all three plugin suites with `--only plugins --target candidate`. The complete platform gate executes with `node scripts/v12/run-platform-tests.mjs`.

Final frozen-code receipts on G6 are:

| Gate | Result | Evidence under `E:/test/mcp-device-v12-20261022/` |
| --- | --- | --- |
| Windows Node 22.22.2 complete platform suite | 77/77 passed; zero failed, cancelled or skipped; 34.042 s | `platform-final-win-04.log` |
| Linux WSL Ubuntu 22.04, Node 22.21.0 complete platform suite | 77/77 passed; zero failed, cancelled or skipped; 20.780 s | `wsl-build13/platform-all.log`, `wsl-build13/summary.json` |
| Final Linux Core comparator and extended no-child lifecycle fixture | Both passed | `wsl-build13/core/device-parity-receipt.json`, `wsl-build13/nochild/device-parity-receipt.json` |
| Final Windows extended no-child lifecycle fixture | Passed | `startup-final-win.log` |
| Windows dependency services repeat gate | Three sequential runs, 10/10 each; zero timeout or skip; 5.412/5.427/5.033 s | `services-stress13/receipt.json` |

The 77-case platform suite includes the real Python callback sidecar, bundled relocation/upgrade gates, retained process cleanup ownership and trusted cooperative cleanup failure/retry. The separate no-child fixture injects only account, process-exit and helper boundaries while executing compiled Device lifecycle control flow. The Linux run rejects TCP and allows only its own temporary IPC endpoints; baseline parity uses isolated configuration and copied fixtures.

Earlier assertion mismatches, the Windows orphan/EBUSY shutdown failure, invalid zero-assertion baseline attempts and intermediate passes remain in the evidence directory. They are not substituted for the final receipts. Final compiled fingerprints are recorded in `wsl-build13/build-snapshot.json` and the Windows repeat receipt. Installed-package cold acceptance and license-complete artifact identity are recorded separately from these runtime-code gates.

## Installed package on Linux

The final license-complete tarball is `E:/test/mcp-device-v12-20261022/package-final03/hcu-lab.me-mcp-device-1.0.12.tgz`, SHA-256 `134e46e6487fc6900c2c4fd94b4184a034784936ba7d2626630c69ca82a043a0`. A fresh private Ubuntu 22.04 installation used normal `npm install --omit=dev` with lifecycle scripts enabled and no global install. It passed on Node 22.21.0 in 46.902 s; the exact command and production dependency tree are retained in `cold-linux03/install-receipt.json` and `cold-linux03/production-dependency-tree.json`.

The installed-package cold fixture passed 1/1 with zero failures, cancellations or skips: 11.570 s for the case, 11.789 s TAP total. It starts the installed CLI server with production dependencies, uses ordinary account/OAuth/pairing flow, verifies default Palace, and proves paired identity, OAuth refresh and exact evidence survive stopped backup/restore. Receipts are `cold-linux03/server-package-cold.log` and `cold-linux03/server-package-cold-receipt.json`; the executed fixture hash is `294fa76a4bfec087d4f4a81d03a7c9c3c968744eb6fc05038ee5a90cfe1c5069`.

Only G6 loopback 8104 was leased for this fixture. After successful process completion, read-only Windows and Linux listener tables both showed no 8104 listener; the release observation is retained in `cold-linux03/listener-release.json`. This is isolated package acceptance, with no production deployment or G8 access.
