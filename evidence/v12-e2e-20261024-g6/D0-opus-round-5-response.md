1s 間の推論
D0 Independent Technical Review, Round 5: Final Architecture Condition

D0 verdict: PASS on architecture. I accept your corrections on account isolation and live mutation. The round-4 condition is withdrawn: a Device has one owner account, and the broker enforces it before any call reaches Core. The release remains RELEASE_BLOCKED_WITH_EVIDENCE.

Before D1 can start, the work list now has 12 implementation blockers and one item that needs evidence:

New blocker: the palace bin is declared by both packages.
New blocker: SKILL.md wording.
Needs evidence: proof that the production server actually turns the owner check on (see A1).

Sources: the round-5 evidence pack and the v3 byte-exact pack.
sharepoint

Labels: [S] = shown in source, [I] = my inference, [U] = unknown.

A. Response to corrections 1–7

1. One owner account per Device: accepted, with one condition.

callDevice rejects a call when ACCOUNT_ID_REQUIRED applies or when stored.ownerAccountId !== owner, and it does this before dispatch [S]. The embedded-claim test confirms invoked === 0 for ownerless and cross-account calls [S]. My round-4 scenario of two accounts sharing one Palace was wrong, and I withdraw it.
Condition: the check only runs when durableAuth && requireAccountOwnership [S]. The test is built from a fixture. I have not seen proof that serverCli → startServerRuntime sets both flags in production [U]. This needs evidence, not a design change: a test that starts the real server path and attempts a cross-account call.
Legacy mode only, not D0:
The extension context builds listDevices: () => deviceBroker.listDevices() with no accountId. The list_devices tool, by contrast, passes {accountId} [S].
Under --legacy-knowledge-mcp, capability.list and the router's devices() may therefore enumerate other accounts' Devices and their capability metadata [I].
Dispatch is still protected by callDevice. The test excerpts show listDevices() with empty arguments, which may be a transcription loss [U].
I classify this as a D1 legacy-mode negative test.

2. Relink and persisted account-visible cards: classified as a D1 security test plus a design note, not a D0 blocker. My reasoning is in B.

3. Live mutation overstated: accepted.

createPlatformTools is only passed when --legacy-knowledge-mcp is set [S].
capability.call rejects knowledge.* with CAPABILITY_PRIVATE [S].
In the default routeToolCall, no branch dispatches platform.invoke [S].
So platform.invoke shows that a single owner-side writer exists. It is not a public write API, and "live writes go through platform.invoke" is withdrawn. The corrected policy is in C.

4. Listing knowledge.* in platform.capabilities: withdrawn.

The default must keep knowledge.* absent. The current split (hidden contracts, internal platform.invoke path) is therefore intended, not inconsistent.
One thing must still be proven, by a negative test rather than a design change. Every tool reachable in the default catalog (context tools, shell_execute, process tools, filesystem tools, custom tools, external tools) must be enumerated, and the test must assert that none can cause callDevice(tool:'platform.invoke', name:'knowledge.*').

5. SKILL.md: confirmed. The exact wording changes are in D3.

6. Packaging: addressed in D.

7. Device-local storage vs. account-scoped federation: accepted as the governing distinction.

Plugin data lives under the runtime state root, and the knowledge CLI works before pairing. Both are consistent only if the Palace store is Device-local state with no account dimension.
Account scope applies to federation references and dispatch, and the source matches: KnowledgeRouter takes accountId, and the card schema has none [S].
B. Account isolation and the relink test

Interpretation:

Cards that originate on this Device are Device-local data. A deliberate ownership transfer hands over the Device and its filesystem, so the new owner seeing them is inherent and acceptable. Nothing in the documents you cited requires partitioning them.
Cards imported from the old owner's other Devices are a different class. knowledge.read lazily imports them into the requesting Device. They are stored with kind='imported' and evidence type:'remote' [S], and they carry no account binding.
After a logout and relink to Bob, the local palace CLI serves Alice's imported cards to Bob. That is data that was account-scoped in federation and is now readable locally by another account [I].
Whether this breaks "federation references are account-scoped" depends on whether ACCEPTANCE.md treats persisted imports as references or as Device-local copies. I don't have that text, so it is ambiguous, and the decision belongs at D1. It is not a frozen-architecture violation that would block D0.
If D1 decides that imports must not survive a transfer, a cheap fix exists: imported cards are already identifiable through cards.kind='imported' and evidence.type='remote'. On an owner change, quarantine or purge them. No change to the SQLite schema is needed.

Required relink test (D1, security):

Alice pairs D1 and D2, both with Palace. D1 has an account-visible card, and Alice reads it through D2 in legacy mode so it is imported into D2.
Log out D2 (ownerAccountId becomes null) [S]. Relink D2 to Bob.
Assert all of the following:
(a) Alice can no longer call D2.
(b) Bob cannot reach D1 through any default or legacy tool, including a replayed Alice reference minted with the persisted knowledge-reference.key. That key survives the relink [S]; the replay must fail with DEVICE_ACCESS_DENIED at callDevice.
(c) A recorded outcome for Bob's local palace search on D2: either imported cards are visible (documented as Device-local by policy) or they are quarantined.
(d) D2's own cards and data are intact.
(e) An ownerless D2 (after logout, before relink) dispatches nothing.
C. Corrected mutation policy
Path	Status
palace CLI	Read-only, always
Runtime stopped	mcp-device knowledge learn/correct/ingest under the server lease. This is the spec's explicit alternative.
Runtime active, automatic	autoIndex ingest runs inside the owner process [S]. Observations, and procedure candidates from fix: lines, are produced live without any public write API.
Runtime active, agent-initiated	Not available by default. Internal platform.invoke only proves there is a single writer.
Remote agent	Existing shell_execute → palace (read-only). mcp-device knowledge on the remote host is refused with RUNTIME_ALREADY_RUNNING while the server holds the lease [S].

Is this enough for D0? Yes. The spec allows stopped-runtime mutation if it suffices for the acceptance workflow, and that can only be decided by the S2 end-to-end run. D0 accepts the policy with a trigger registered in advance:

If S2 requires the Skill agent to persist a validated procedure while the runtime stays active, then extend an existing owner-safe channel.
The first candidate is runtime-owner, with a nonce-authenticated, allowlisted invoke action that has its own deadline and a request_id for idempotency.
Trust argument [I]: the stopped-runtime path already gives the local filesystem principal full write access to the store. A channel authenticated by a 0600 nonce file in the same state root gives the same principal the same power, so it is not an escalation.
Open fact [U]: serverCli does not visibly create a RuntimeOwner listener. The lease probes for one [S]. Before selecting this channel, verify that server mode listens on it.

Two defects in this path that are independent of the policy (part of B12):

The Skill tells the agent to "request correction through the authorized validation workflow". In default mode that workflow is not defined.
With no validationRunner, every learn produces only candidates [S]. The acceptance configuration must name the runner, or S2 cannot produce a validated procedure on any path.
D. Final packaging and lifecycle architecture

D1. palace bin ownership

Today both @hcu-lab.me/mcp-device and @hcu-lab.me/palace declare bin.palace [S]. Global installs of both collide: npm refuses to link a bin that another package owns unless --force is used [I, npm behavior]. That is brittle.
Decision:
The standalone package owns the palace bin.
Device removes bin.palace and exposes the same CLI as mcp-device palace …, following the git/kubectl subcommand pattern.
The Skill invokes palace, and falls back to mcp-device palace if palace is not found.
Check that v11 parity never included a palace bin [U].
Alternative rejected: keep both bins and document --force. That gives non-deterministic last-writer-wins behavior and breaks on uninstall order.

D2. Skill ownership when both packages are installed

Use the update-alternatives model. It is the mature reference for multiple providers of one path.
A per-user ownership record lists the owners (the package roots) and the installed file hashes.
Content comes from the highest-version owner. An owner whose package root no longer exists is dropped at reconcile, which also covers the missing npm uninstall hook. The Skill is removed only when no owner remains.
Copy is the default. The three-way hash check, staged rename and recovery from round 4 (B1) are unchanged.

D3. Manual vs. bundled provenance

Provenance is set by the command, not inferred from the path:
plugins install <manifest> or plugins upgrade <manifest> → installationSource:'manual'.
Only an explicit plugins upgrade palace --bundled → 'distribution'.
upgrade() currently keeps the old source [S], which this fixes (B8).
ensureBundled already never reclaims manual records [S], so a standalone registration then sticks.
The standalone tarball must ship a palace.plugin.json manifest (id:'palace', isolation:'process', relative entry).
Moving from bundled to standalone uses upgrade <manifest>, so the existing backup/rollback protects the data.

D4. Device version bump

bundleContract includes version [S], so every Device bump faults Palace.
Decision: a bump where only the version changes (contract minus version and entry unchanged, same dataSchemaVersion) re-pins automatically, the same way the existing entry-only relocation branch works.
A change to dataSchemaVersion or capabilities remains an explicit upgrade, via plugins upgrade palace --bundled under the lease, and the fault message names that command.
If the spec mandates an explicit upgrade for every version, keep the explicit path but still add --bundled and test that the message tells the user how to recover.

D5. Standalone independence: same bytes, no daemon, shared version cadence allowed, import-closure test, LICENSE. Unchanged from round 4.

D6. SKILL.md wording changes (minimal; the Skill does not become a lifecycle manager):

"Palace is an optional, separately installed plugin" → "Palace is an optional plugin, enabled by default with MCP Device or installed as @hcu-lab.me/palace." The current wording is wrong for the default install.
Make the first step mandatory and conditional: "Always run palace status (or mcp-device palace status) first. If it does not report Palace as available, report the returned limitation to the user and do not use Palace."
Delete the source-checkout fallback (node /path/to/agent-mcp-device-v12/dist/...). It goes stale after the package moves and can run an unverified build. Replace it with: "if neither command exists, report that Palace is not installed."
Replace "request correction through the authorized validation workflow" with "Corrections and new procedures are written by the operator with mcp-device knowledge correct|learn --runtime-dir DIR while the runtime is stopped. Do not stop the runtime unless the user explicitly asks."
Add: "If palace skills reports activationPolicy: candidate_only, no procedure is validated. Say so; do not present candidates as procedures."
Note that --data-root bypasses runtime state. Under B2, the CLI must then report the plugin state as unknown.
E. D0 gate

D0 VERDICT: PASS (architecture). All design questions are closed. No D0 condition remains.

Implementation blockers before D1:

#	Item
B1	Skill installer: per-user ownership record with multiple owners (alternatives model), copy default, three-way hash check, staged rename, recovery
B2	Runtime-aware palace CLI and state-coded PluginHost.invoke errors
B3	plugins/knowledge default to ~/.mcp-device/server
B4	Schema check before WAL pragma and DDL
B5	One shared searchCards for CLI and plugin
B6	Cancel frame → grace period → kill
B7	Registry lock with token and recovery lock (runtime-lease technique)
B8	Provenance set by command (manual vs --bundled)
B9	Version-only re-pin, plus plugins upgrade palace --bundled
B10	Standalone: LICENSE, import-closure test, palace.plugin.json
B11	Remove bin.palace from Device and add mcp-device palace
B12	SKILL.md wording changes D6.1–6
E-0	Evidence: the production server path enforces durableAuth && requireAccountOwnership (cross-account call through the real serverCli)

D1:

The S2 agent end-to-end run, which decides the live-mutation trigger.
Validation runner configuration and contract, including automatic learn from log-derived fix: lines.
The relink test in B.
A default-catalog negative test proving there is no path to platform.invoke/knowledge.*.
Legacy-mode listDevices() account filtering.
Pi/Codex discovery of the Skill.
Whether server mode has a RuntimeOwner listener.

D2: fault matrix, upgrade/rollback with real data (including a crash between rm(data) and cp(backup)), lease races, disposition of the 6 FAIL and 2 no-op parity rows.

D3 / release: the S5 provider A/B test (after B5), a 24-hour soak, publish.

F. Remaining disagreement

No material architecture disagreement remains. Three points are qualifications, not disputes:

Ownership enforcement: I accept it as designed. I accept it as deployed only with E-0, because the check depends on two flags.
Relink: I accept "transfer gives the new owner the Device" for the Device's own cards. For imported cards from the old owner's other Devices, I hold that D1 must record an explicit decision, either visible by policy or quarantined. Defaulting silently is not acceptable.
Version bump: auto re-pin for version-only bumps is my recommendation. If the spec requires an explicit upgrade for every version, I will drop it, provided --bundled and the recovery message are tested.

Not release-ready.

ソース