1s 間の推論
D0 Independent Technical Review, Round 4: Convergence

D0 verdict: CONDITIONAL PASS. The architecture is agreed. Ten source-grounded implementation defects must be fixed before D1, and one design question must be answered before sign-off: whether Palace is scoped per account when several accounts share one server runtime. The release stays RELEASE_BLOCKED_WITH_EVIDENCE. Every statement below is grounded in the byte-exact v3 pack.

Labels: [S] = shown in source, [I] = my inference, [U] = unknown.

0. Corrections to round 3
Round-3 claim	Correction
knowledge.* is advertised by default	Wrong. serverCli passes exposeKnowledgeMcp: legacyKnowledgeMcp, which is false unless --legacy-knowledge-mcp is given, so knowledge.* is hidden by default [S]. It is still reachable through platform.invoke (see §3).
Device may not hold the lease for its whole life	Resolved. serverCli acquires acquireServerLease(root) before core creation and releases it only in finally [S]. knowledgeCli and plugins upgrade/purge are therefore refused while the server runs.
Skill state should live under stateRoot/plugins/palace and follow plugin state	Withdrawn. It is wrong for multiple runtimes (see §1).
Standalone Palace needs its own version cadence	Withdrawn (see §2).
upgrade, backup and restart are "reported only"	Now shown. upgrade() stops the driver, copies data to upgrade-backup-<uuid>, activates the new driver to run the migration, and on failure restores data and the registry record [S]. There is still no restart-with-backoff: a fault stays faulted until a lifecycle action [S].
1. Skill ownership with multiple runtimes

I concede the main point. postinstall runs once per package and per user home, and it has no runtime identity. The Skill is a user-level artifact; registry.json is a per-runtime artifact [S]. Removing the global Skill because one runtime disabled Palace would break every other runtime on the machine. That design is wrong.

Correct ownership boundary:

Owner	Owns	Does not own
npm package (Device	Skill files in agent homes, the palace bin	Whether Palace is callable in any given runtime
Runtime root	enabled / disabled / uninstalled / faulted / upgrade-required state, and the data	Agent-home files
Skill text	The procedure: run palace status first and obey the result	Any unconditional claim that Palace is callable
palace CLI	Translating runtime state into an actionable limitation	Lifecycle changes

This satisfies the spec wording if three conditions hold:

The Skill never says Palace is callable. It says "check status first". I have not received SKILL.md [U]. It must be reviewed.
The CLI is runtime-aware. Today palace-cli checks only that the file exists and that schema = 1. It never reads registry.json, so a disabled or uninstalled runtime still serves cards [S]. Every response must carry {runtimeDir, pluginState, runtimeActive, writePath}. States other than enabled must return a coded limitation with remediation, for example PALACE_DISABLED → mcp-device plugins enable palace --runtime-dir X.
The MCP path is actionable too. When Palace is disabled, platform.invoke('knowledge.search') returns a generic CAPABILITY_UNAVAILABLE: No healthy compatible provider [S]. For S3, PluginHost.invoke must report PLUGIN_DISABLED, PLUGIN_UPGRADE_REQUIRED or PLUGIN_FAULTED (with the recorded error) when the only registered provider is in that state.

What remains package-level, and is therefore not withdrawn:

An ownership record per user, not per runtime. For example <skill-home>/.mcp-device/skill-owners.json, holding the owning package root and the file hashes recorded at install.
Needed so that old-version copies can be upgraded. unchangedCopy still compares against the current package [S].
Needed to detect that the owner was removed: the recorded package root has disappeared, and npm has no uninstall hook.
Reconcile runs on every palace / mcp-device invocation and on palace skill repair.
Device and standalone collide. Both packages declare bin.palace [S], and both install the same palace-cli target. Global installs of both hit an npm bin conflict [I, npm EEXIST behavior]. The Skill target is also contested. The ownership record must allow two owners: content comes from the highest-version owner, and the Skill is removed only when no owner remains.
Link vs copy is narrower than I said. A link into the package disappears automatically on npm uninstall, which is good for removal. It is wrong on relocation (a dead link, with the marker unreadable, gives preserved-existing forever) [S]. Copy plus the ownership record is still my recommendation. The test in §D settles it.
2. Required independence

Agreed: the spec does not require a separate version cadence.

Requirement	Status
No implementation fork	Met. Byte copy of dist/plugins/palace, dist/log-palace, config.js [S]
Artifact install/remove without Device, and without breaking Device	Install passes [reported]. Bin/Skill collision unresolved (§1)
Dependency closure	Unproven. Only 5 files are checked to exist [S]. sources.js and log-palace/* imports are not verified. Needs a build-time resolve-all-imports test
PluginHost registration	Broken. New finding (§8)
CLI/Skill lifecycle	Standalone has no install script and no Skill reconcile [S]
Data preserved across disable/uninstall/reinstall	Met by design. Uninstall keeps a tombstone plus data; purge is explicit, lease-guarded and refused while enabled [S]
LICENSE	Missing. Easy to fix
3. Live mutation

Source path: serverCli → createPlatformDeviceCore → invoke('platform.invoke', {name, input}) → plugins.invoke(name). This path has no knowledge.* filter. The direct-name branch (plugins.capabilities().includes(tool)) also has none [S]. The exposeKnowledgeMcp flag only filters capabilities, capabilityContracts and platform.capabilities output.

Decisions:

Does it satisfy "CLI or existing generic plugin host"? Yes. It is one writer (the PluginHost child), it is the generic host, and it sits behind Device's existing OAuth and pairing. No new transport is needed.

Does it violate the catalog rule? No, as long as the rule concerns the MCP tool catalog: only platform.invoke is listed, not nine knowledge.* tools. But the current behavior is inconsistent: platform.capabilities hides contracts that platform.invoke will execute [S]. Pick one:

Recommended: list knowledge.* in platform.capabilities. The catalog stays unchanged and the generic path becomes discoverable.
Alternative: declare it an intentional escape hatch, documented in the Skill.

Not a blocker either way. One more thing to check: the direct-name branch must not let a hidden tool name bypass the catalog, which depends on whether the wrapper rejects unlisted tool names [U].

Is a CLI write route required for D0? No. While the server runs, mcp-device knowledge learn fails with RUNTIME_ALREADY_RUNNING because the server holds the lease [S]. That is a sound policy. A CLI write route becomes required only if S2's acceptance agent is a Skill-only agent with no MCP session to Device. That condition is decided at D1/S2, not now.

New design question for D0 (the account-isolation condition on sign-off):

One server has admin account|invite [S], but it has one Palace database per runtime root.
Card scope has visibility and projectId and no account dimension. The query filters have no account either [S].
If two accounts pair to one server, both can read and learn into the same Palace through platform.invoke [I].
Either show that a server runtime serves exactly one account, or design account scoping. This is the one open D0 condition.

Confirmed from round 3:

With no validationRunner, learn returns VALIDATION_POLICY_NOT_CONFIGURED and the card stays hypothesis. skills list reports candidate_only [S].
So by default, no procedure ever becomes validated. The acceptance configuration must specify the trusted validation module.

New risk:

When an observation has two or more pieces of evidence, ingest automatically calls learn on a fix: line extracted from log text, without autoActivate:false [S].
If a validation runner is configured, text from logs is therefore sent to the runner automatically.
If the runner executes steps, that is injection from log content into execution [I]. The runner contract must be reviewed, or automatic learns should be forced to autoActivate:false.
4. Cancellation

The child protocol already supports cancel. The handler aborts the request's controller [S]. In Palace, cancellation is cooperative at job start (abort(context.signal) on the tail queue) and inside the ingest and learn loops [S]. A queued job is therefore skipped without harm.

Yes, the minimal mature fix is the one you describe. It is standard deadline-propagation-then-hard-kill, as with gRPC cancellation or a SIGTERM grace period followed by SIGKILL. In ProcessDriver.request, on outer abort:

Reject the caller immediately with CANCELLED, and remove it from pending. Dependency callbacks then get CAPABILITY_PARENT_EXPIRED automatically [S].
Move the entry to a cancelling map and send {method:'cancel', params:{id}}.
If the late response or the CANCELLED error arrives, discard it. CANCELLED does not start with PLUGIN_, so it does not fault [S].
If the cancel grace expires (min(remaining deadline, ~5 s)), or the cancelling map exceeds a cap, call fail(PLUGIN_TIMEOUT), which kills the process tree.

Safety compared with today:

A child stuck in a synchronous call (for example a long node:sqlite query) cannot read the cancel frame. It is still killed, after the grace period instead of at once.
The existing per-request timer remains, so the worst-case bound is unchanged.
Data safety is unchanged: BEGIN IMMEDIATE plus WAL with synchronous=FULL [S].

Remaining semantic issue (both before and after the fix): a cancel that arrives after commit leaves the outcome ambiguous. learn is not idempotent on retry. The same key gives nextVersion and a new hypothesis version unless the card is already validated [S]. A retry creates a version bump, not a duplicate card. That is acceptable for D0, and should be documented.

5. Registry stale-lock race

It is real, and it causes lost updates and stolen-lock removal [S]:

A and B both read a lock with dead PID P.
A unlinks it, open('wx') succeeds, and A writes its PID.
B then unlinks A's live lock and opens its own. Both are now inside the critical section.
Both read revision r, both pass the check, both rename. One update is lost.

Two more problems:

The finally block runs fs.rm(lockPath) unconditionally, so it can delete a third process's lock.
The lock body has no token.

Smallest fix, reusing the runtime-lease technique exactly:

Lock body {pid, token}.
Break a stale lock only while holding registry.lock.recovery, opened with wx, and only if the current body still equals the stale {pid, token} that was observed.
Release only if the token matches.

No new subsystem is needed. It keeps the residual risk runtime-lease already has: a crash while holding .recovery blocks recovery until manual cleanup. That fails closed and is acceptable. Map it to PLUGIN_REGISTRY_RECOVERY_REQUIRED.

6. Wrong-schema handling

This is a current acceptance defect, not a future one.

The spec requires wrong-schema handling, and that can be tested today with a fixture. Schema 2 does not need to exist.
The constructor opens read-write, sets journal_mode=WAL (which rewrites the header of a non-WAL file), runs every CREATE … IF NOT EXISTS, and only then checks meta.schema [S].

Fix:

Open the database.
If meta exists in sqlite_master, read schema. If it is non-empty and ≠ '1', close and throw. No pragma or DDL runs first.
Then set the pragmas, and run DDL plus setMeta('schema','1') in one BEGIN IMMEDIATE transaction.

The CLI should also map a missing meta table to PALACE_SCHEMA_UNSUPPORTED, not a raw SQLite error.

Test:

Fixture meta.schema='2', with one v1 table dropped and the database in rollback-journal mode.
Open with the store, the CLI, and the plugin through knowledgeCli.
Expected: PALACE_SCHEMA_UNSUPPORTED in each case, the main database sha256 identical before and after, no -wal created, and Device Core still healthy.
7. CLI retrieval

Confirmed [S]:

	CLI	Plugin knowledge.search
Candidate SQL order	order by c.id	status priority, then bm25(card_fts), then id
Candidate count	max(limit,300)	min(200, max(40, limit*8))
Rerank	rankCandidates(cards, query, limit)	rankCandidates(rows, query, limit+1)
Defaults	limit 10, 16 KiB	limit 8, 8 KiB
Over budget	Throws BUDGET_TOO_SMALL	Drops items, sets truncated

When there are more than 300 matches, relevance-ranked cards with high ids are never seen. Even with fewer matches, the reranker inputs differ. This invalidates the S5 A/B test if the CLI arm and the MCP arm are compared.

Canonical fix (no new ranking):

Extract PalaceStore.query's SQL builder and Provider.search's pipeline into one pure function, searchCards(db: DatabaseSync, input).
The store uses it on its read-write handle; the CLI uses it on its read-only handle.
The CLI keeps only its own envelope (mode, evidenceVerifiedNow:false, runtime state).
8. Standalone package
Ability	Finding
Import closure	Unverified [S]. Needs an import-resolution test on the packed tarball
Install its Skill	No; it has no scripts [S]. Needs the shared reconciler and two-owner record (§1)
Register in Device PluginHost	Broken. New finding. upgrade() replaces manifest but keeps installationSource:'distribution' [S]. At the next server start, ensureBundled sees a distribution record. If the version or contract differs, Palace is faulted with PLUGIN_UPGRADE_REQUIRED on every start. If only the entry differs, the entry is silently reset to the bundled path. Uninstall then install does work: the tombstone is skipped and a manual record is created [S]. Fix: an upgrade or install whose entry is outside the Device package sets installationSource:'manual', and ensureBundled already never reclaims manual records. Also missing: the standalone tarball ships no manifest JSON for plugins install
Operate without a Device runtime	It can read an existing Palace database read-only. With no Device-created database it returns PALACE_NOT_INSTALLED [S]. It cannot create or write data, because PluginHost and the plugin child are not in the tarball. Per the "optional plugin, no Palace service" architecture, this is correct. I do not require a daemon. The CLI message must say how to get write capability

A related defect in Device's own upgrade (still open):

bundleContract includes version, so every Device version bump faults the bundled Palace [S].
plugins upgrade only accepts a manifest file. There is no bundled form [S].
So after npm update, Palace stays down until the user writes a manifest file by hand.
Fix, minimum: mcp-device plugins upgrade palace --bundled, with the fault message naming it.
Fix, preferred: automatic backup-and-upgrade at server start, which already runs under the lease, when dataSchemaVersion is unchanged.
9. Default paths

This is a real defect with a direct acceptance impact.

Command	Default root [S]
server	~/.mcp-device/server
palace CLI	~/.mcp-device/server
admin	~/.mcp-device/server
plugins	~/.mcp-device (stateRoot(args))
knowledge	~/.mcp-device

knowledgeCli is not the only one affected; pluginCli has the same problem. Consequences:

mcp-device plugins disable palace with no --runtime-dir writes a registry the server never reads. The server keeps Palace enabled, and the CLI keeps serving. The S3 disable test passes only when --runtime-dir is given explicitly.
mcp-device knowledge learn with defaults calls GatewayDeviceIdentity.loadOrCreate() in ~/.mcp-device and creates a separate Palace database. If no identity exists there, it is a new device id. The result is a second knowledge store with different originDeviceId provenance [S/I].
Its lease probe targets ~/.mcp-device, not the active server root, so it may succeed while the server is running [I].

Fix: stateRoot(args, true) for both plugins and knowledge, matching the usage text "Server state defaults to ~/.mcp-device/server". Add a test: run every command with no flags and assert they all resolve to the same root. No data migration is needed because v12 is unpublished [reported].

A. D0 architecture consensus
Device 1.0.12 is the product. Palace is a PluginHost plugin in an isolated process with one writer. There is no Palace MCP server and no Palace daemon.