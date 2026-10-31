1s 間の推論
D0 Independent Technical Review, Round 3: MCP Device v12 + Palace

This review now works from source, but the source pack is incomplete. Several files were cut off:

plugin-host.ts stops in the middle of activate(). upgrade, uninstall, disable, markFault and any restart policy are missing.
The RuntimeOwner class body is empty in the pack.
acquireRuntimeOwner and CooperativeDriver are cut off.
The first part of createPlugin is garbled.

There are also copy-paste artifacts that would not compile as shown, such as x.toLowerCase()='node_modules', !'1', and {} option objects that went missing. I assume these came from transcription, not from the real files.
sharepoint

Labels:[S] = shown in the source pack,[R] = reported by the engineer but not in the pack,[I] = my inference,[U] = unknown.

Net result: the release is still blocked. The source shows that Device already has a live, single-writer mutation path, which makes my round-2 analysis of live mutation mostly unnecessary. It also shows the Skill installer is worse than the summaries said. I found four new defects from the code: Palace's store changes a newer-schema database before refusing to open it, the CLI search drops relevant matches, the Skill's state is not tied to the plugin's state, and cancelling any one request kills the Palace writer process.

1. Rechecking round-2 statements against the code
Round-2 statement	What the code shows	Status
"Mutation while Device runs needs a new owner-routed path. Reuse runtime-owner."	bundledPluginManifests() exposes knowledge.learn, knowledge.correct, knowledge.ingest and knowledge.import. createPlatformDeviceCore.invoke sends them, and platform.invoke, through PluginHost to the single isolated child process. They are advertised unless exposeKnowledgeMcp === false [S]. Live single-writer mutation therefore already exists through Device's own capability surface. That is Device's existing MCP surface, not a Palace-specific MCP server. Only the CLI is read-only.	Corrected. Most of the gap is closed. What remains is whether agents that use only the CLI need to write.
"The runtime-owner channel can be reused for mutation."	One newline-JSON request per connection over a named pipe or Unix socket. The client waits for end, with an 800 ms default timeout. stop requires a nonce read from runtime-control.json; status requires nothing [S]. Adding an invoke action would be straightforward, but it would need its own deadline. 800 ms is far too short for a 30 s Palace timeout.	Narrowed. Reuse is possible, but only needed if CLI writes are needed.
"The lease prevents stopped-runtime races."	Uses an O_EXCL lock file, a PID liveness probe and a .recovery lock for stale recovery. It refuses when the owner answers the probe, and fails closed with DEVICE_RUNTIME_STOP_NOT_PROVEN when runtime-control.json exists but the owner does not respond [S]. Good. Not shown: that the Device runtime holds this lease for its whole lifetime, as opposed to only during start-up [U].	Mostly confirmed. One evidence item remains.
"PluginHost has backup/rollback, restart, fault isolation."	Shown: revisioned registry with temp file plus rename, a lock with stale-PID break, distribution never re-claiming a tombstone or user-managed install, a contract change setting faulted + bundleUpgradeRequired, entry-only relocation without migration, and Core staying up if plugins fail [S]. Not shown: upgrade(), backup, rollback, restart or backoff [R only].	Downgraded from fact to reported claim.
"Fault isolation exists."	Driver timeout or exit → fail() → kills the process tree (Windows taskkill /T /F, POSIX kill(-pgid)) and waits up to 5 s for close. Frames are capped at 2 MiB. New: onAbort calls fail(CANCELLED), so cancelling any single request kills the whole Palace process and marks it faulted [S].	Narrowed. See P1-C.
"Standalone Palace is the same implementation, not a fork."	The builder copies dist/plugins/palace, dist/log-palace, skills/palace-cli and dist/config.js byte for byte [S].	Confirmed, but with gaps in closure and lifecycle (§6).
"Stage the new version as a sibling .palace-new."	Both targets are agent skill roots (~/.agents/skills, ~/.pi/agent/skills) [S]. A sibling folder containing SKILL.md can be picked up as a duplicate skill [I].	My error. The new version must be placed outside the skill roots.
"Schema rollback needs evidence."	migrate() only accepts going to version 1 from version ≤1. Both store and CLI refuse a schema other than '1' [S]. With only one schema version, there is no migration to roll back today.	Narrowed. Rollback is untestable now, so it moves to the first schema change. One real defect remains (P1-A).
2. Source-grounded findings, ranked by user and data risk

P0-1: The Skill installer gets permanently stuck or silently lost after normal operations. All of the following are shown in the source.

Link is the default on both operating systems. The installer tries symlink(source, target, win32 ? 'junction' : 'dir') first. Copy is only a fallback.
Package relocation leaves a dead link forever. After the package moves, realpath(target) throws (the error is swallowed). The marker is then read through the dead link and fails, so owned=false and the result is preserved-existing. The link is never retargeted.
A link to another installed copy is also stuck. If the link points to a still-existing install (another nvm prefix or an older global), the realpaths differ. The package folder never contains the marker, so it is preserved and never replaced.
User edits made through the link change files inside node_modules. The next npm install or update overwrites those edits silently. Rule I2 ("never destroy user bytes") is broken by design in link mode.
An interrupted copy leaves a broken but visible Skill. The copy happens first and the marker is written last. A crash during the copy leaves a partial tree with no marker. A crash after the copy but before the marker leaves a full tree with no marker. Both count as foreign forever, so that home never gets upgrades again.
Replacement deletes first. It runs rm and then link-or-copy. That is not atomic: a crash leaves the target either missing or partial.
Old-version copies never match. unchangedCopy compares against the current package, so any old-version copy fails the check and is preserved forever.
There is no disable, uninstall or reinstall logic anywhere.

P0-2: The Skill's state is not tied to the plugin's state. The Skill is installed by postinstall, which does not read plugins/registry.json. The CLI also never reads the registry [S]. So:

After Palace is disabled or uninstalled (a tombstone), the agent still finds the Skill, and the CLI still serves the old database.
After a Device upgrade that bumps the manifest, Palace is faulted with bundleUpgradeRequired, and the agent is not told.

This breaks "support disable/removal" as the user sees it [I].

P1-A: The Palace store changes a newer-schema database before refusing it. In PalaceStore, the constructor runs, in this order: journal_mode=WAL, then all CREATE TABLE/INDEX/VIRTUAL TABLE IF NOT EXISTS, then the schema check [S].

If a rolled-back v1 binary meets a v2 database, it adds back tables or indexes that v2 may have dropped or renamed, and only then throws.
This contradicts "older code refuses cleanly."
Fix: read meta.schema first, inside a read transaction, and do no DDL if the value is present and not 1. Today this can't happen because only schema 1 exists, but it must be fixed before any schema 2 ships. It is cheap, so it should be fixed in D0.

P1-B: The CLI drops relevant search results, and diverges from the plugin's search. Search runs ... card_fts MATCH ? ... order by c.id limit max(limit,300), then rankCandidates [S].

When more than 300 cards match, it keeps the first 300 by id, not by relevance. Relevant cards with higher ids are never ranked.
PalaceStore.query orders by bm25(card_fts) instead [S].
So CLI and plugin retrieval differ, and this directly distorts the mandatory S5 token/correctness A/B test.
Fix: order the candidate set by bm25 (the same ordering as store.query), or reuse the store's query function read-only.

P1-C: Cancelling a request kills the writer, and the restart policy has not been shown. In ProcessDriver.request, cancellation calls fail(CANCELLED), which kills the process tree and faults the plugin [S].

Data safety is acceptable. The store uses WAL with synchronous=FULL and wraps writes in BEGIN IMMEDIATE, so killing it mid-transaction rolls back [S].
Availability is the problem. One cancelled knowledge.search from the agent takes all of Palace down until something restarts it, and the restart logic is not in the pack.
A second risk: init covers migration plus createPlugin plus instance.start() within one 30 s deadline. If provider.start() runs autoIndex synchronously, large corpora will fault Palace at every start-up [I, need index.js].

P1-D: By default, procedures may never become "validated." autoActivateSkills requires a trusted absolute validationModule, otherwise validationRunner is undefined [S, partly garbled]. The CLI's skills command shows only status='validated' unless --include-candidates is passed [S]. If knowledge.learn without a runner produces only candidates [U, need index.js], the learning workflow fails by default, whether writes happen live or with the runtime stopped. That issue is separate from the live-mutation question.

P1-E: The registry lock's stale-break has a race. Two processes can both see a dead PID. One unlinks the other's freshly created lock, and both continue. Each then reads the same revision and renames over the other, so one update is lost. The revision check does not protect against this because both pass it inside the "lock" [S/I].

The probability is low (it needs a crashed holder plus concurrent lifecycle operations).
Fix: break the stale lock by renaming it to a unique name, then retry the wx open. Or re-check the revision after the rename.
This is P1 and not P0 because it requires a prior crash.

P2:

The runtime lease fails closed on a reused PID (common on Windows), so it needs manual recovery.
Child stderr.resume() throws diagnostics away.
postinstall writes to os.homedir(), which under sudo npm -g is root's home.
The two skill targets may be loaded twice if an agent scans both roots [U].
node:sqlite can print an ExperimentalWarning on stderr, which the CLI also uses for JSON errors [I, test it].
3. Reuse vs. duplicate (goal 2)
Mechanism	Decision	Reason
PluginHost registry, lifecycle serialization, tombstones, relocation handling	Reuse, and use it for the Skill as well	It already handles package relocation correctly for the plugin entry, which is exactly what the Skill installer gets wrong. The Skill's ownership state should live next to it (plugins/palace/skill-state.json), written with the same temp-file-plus-rename pattern.
ProcessDriver isolation	Reuse and fix P1-C	Its tree-kill, bounded frames and Core-survives behavior are mature. Duplicating it would add risk.
Device knowledge.* capabilities through platform.invoke	Reuse as the live mutation path	One writer, already routed and already isolated.
runtime-owner channel	Reuse only if CLI writes are needed. Extend with an invoke action (nonce auth, explicit long deadline, allowlist of knowledge.learn and knowledge.correct).	No new channel or second control plane.
runtime-lease	Reuse for stopped-runtime mutation	Already fails closed. Only one fact still needs proof: that Device holds the lease for its lifetime.
Skill installer	Rewrite, but it should use the registry and its locking primitives	The current logic cannot be patched to correctness (§4).
4. Skill lifecycle: the smallest fully correct design

Core principle: a link holds no user bytes, so replacing a link we created is always safe. Copies are where user bytes live. Links into the package are where silent loss comes from.

MUST-have (each one closes a failure shown in the code)
Copy is the default. Never link into the package. This closes dead links after relocation, edits that npm silently destroys, and links stuck on another version.
Linking to a Palace-owned stable copy is only allowed as an opt-in, and only after a discovery test for each agent.
An ownership record per target, stored under stateRoot/plugins/palace/. For each target it holds: the target path, the per-file sha256 recorded at install time, the version and a pending intent. It is written by temp file plus rename under a Palace lifecycle lock.
This replaces both the marker and the comparison against the current package.
Three-way per-file decision (the dpkg conffile rule):
The whole tree is replaced only if every owned file still matches its recorded hash.
Otherwise the user's tree is kept, the new version is written outside the skill roots (to stateRoot/.../pending/<ver>/), and doctor reports it.
Extra files the user added are always kept.
Stage on the same volume, write SKILL.md last, then rename into place. Replacement uses rename-aside, then rename-in, then deleting the old copy, all recorded in the pending intent.
Writing SKILL.md last means a partial staging tree is not a valid skill. The temporary sibling therefore can't be discovered as a skill, even if the agent scans hidden folders.
Recovery runs first in every reconcile. It finishes or discards staging and aside folders by the intent id.
No fsync is needed for correctness. It only adds power-loss resilience.
The Skill follows the plugin's state.
enabled → install.
disabled or tombstoned → remove pristine owned files; keep modified ones and report them.
faulted/bundleUpgradeRequired → keep the Skill, but the CLI and doctor must report the plugin state.
The CLI must read the registry and return the plugin state in every response.
Triggers. Reconcile runs at Device start (next to ensureBundled), on any registry lifecycle change, and through explicit commands (palace skill install|remove|repair|doctor). postinstall is best-effort only.
npm v7+ runs no uninstall hooks, and --ignore-scripts or pnpm can skip postinstall.
Migrating installs made by the current code:
Links, including dead ones: read the stored path with readlink, which works even when the link is dead. If it ends in @hcu-lab.me/mcp-device/skills/palace-cli (or the standalone equivalent), adopt and replace it. This is safe because a link holds no user bytes.
Marker copies: adopt only if the tree hash equals a known released palace-cli tree hash shipped as a table in the package. Otherwise preserve and report.
Unmarked trees and anything else: foreign, never touched.
Optional resilience (not needed for D0)
Versioned generations (rollback can re-copy from the rolled-back package).
fsync on each step.
Link mode.
Hot reload.
Copies saved on uninstall (keeping modified files in place already satisfies I2).
Compared with my round-2 design

Round 2 needed its own manifest and lock. This version reuses PluginHost state and locking, drops the sibling .palace-new, and adds items 6 and 8, which only the source revealed. Generations remain optional.

5. Live mutation: does D0 require it? (goal 4)

D0 does not require a new live-mutation design. The spec explicitly allows the stopped-runtime path as an alternative, and the source shows a live single-writer path already exists through Device's knowledge.* capabilities [S].

D0 can accept this policy:

Live writes go through Device's knowledge.learn and knowledge.correct (PluginHost owner).
Stopped writes go through the existing lease.
The CLI stays read-only.

This acceptance carries a pre-registered falsification condition for D1/S2:

If the S2 acceptance agent cannot call Device capabilities (for example a Pi-style agent without MCP support, which I believe is true of Pi but haven't verified), and S2 requires that agent to persist a validated procedure while Device is active, then CLI write routing becomes a blocker.
In that case the only allowed design is the runtime-owner invoke extension. Its requirements:
Nonce auth.
An allowlist of capabilities.
Its own deadline at least as long as the plugin timeout.
A client request_id stored in the same transaction as the write, for idempotency.
Retry only on BUSY or a lost connection.

Items that stay D0 requirements regardless: P1-C (a cancel must not kill the writer), and P1-D (the default validated path must be shown or explicitly configured).

6. Standalone package (goal 6)

Confirmed: the standalone package ships the same compiled bytes. There is also no duplicate engine on one host: the registry allows one record per id, install() rejects a second install, and ensureBundled never claims a manual install [S].

**Missing pieces in the builder **

No import-closure check. Only 5 files are checked to exist. index.js and log-palace/* may import dist/platform/*, dist/device/* or other modules that aren't copied. The cold-install pass only covered the paths that were actually exercised [R].
Need a build-time test that resolves every static and dynamic import inside the tarball.
No LICENSE, README or notices are copied, while license: 'MIT' is declared.
No install script, so no Skill. The standalone package installs no Skill and has no reconcile command.
No PluginHost manifest, and no host of its own. The standalone writer can only run when a user installs it manually into Device's PluginHost, and the registration command isn't shown [U].
Standalone alone = read-only CLI over a database that Device created. It is "independently installable", but not independently usable for learning.
The spec owner must confirm this is the intended meaning.
Its version equals Device's version (pkg.version), so release cadences can't be independent. The bundled manifest hardcodes 1.0.12, and the contract check means every Device version bump faults Palace until an explicit upgrade [S]. That needs either an automatic upgrade when dataSchemaVersion is unchanged, or an acceptance test proving the user is told and recovery works.
7. D0 convergence table
Topic	AGREED DESIGN	OPEN EVIDENCE	BLOCKER	DEFER
Skill lifecycle	§4 items 1–8	Discovery transcripts (Pi, Codex) in copy mode; is either root scanned twice?	Current installer (P0-1, P0-2)	Link mode, generations, fsync
PluginHost reuse	Reuse for lifecycle, isolation, and Skill state/locking	upgrade/uninstall/disable/markFault and restart source; backup/rollback test logs	P1-E stale-lock race (cheap fix)	—
Fault isolation	ProcessDriver tree-kill model	Crash after ready, hang, crash loop, corrupt database; OAuth/pairing unaffected	P1-C cancel kills writer; restart policy unproven	Backoff tuning
Mutation policy	Live = Device knowledge.*; stopped = lease; CLI read-only	Device holds the lease for its lifetime; lease ↔ start race test	—	CLI write via runtime-owner, conditional on S2 (§5)
Learning path	—	index.js learn/validation path; default status of procedures	P1-D until shown	—
Palace schema	Schema 1 frozen; refuse others in both store and CLI	—	P1-A check before DDL	Migrate/rollback test at first schema 2
CLI retrieval	Read-only, no immutable mode, byte budget	—	P1-B relevance-dropping truncation	—
Standalone	Same bytes, single registry id	Closure test; intended meaning of "standalone"	LICENSE	Independent version cadence
Default-enabled upgrade	Contract change → faulted until upgrade	Who triggers the upgrade after npm update?	Silent post-upgrade outage, if there is no trigger	—
Parity	Frozen v11 comparator	Disposition of the 6 FAIL / 2 no-op rows; artifact hash	—	—
Token A/B (S5)	—	Protocol, run after the P1-B fix	Release gate	—
Release	—	—	RELEASE_BLOCKED_WITH_EVIDENCE	—
8. Disagreements with the implementer, and the test that settles each
Link to the package as the default. Source: the symlink/junction branch, together with the realpath-throws and marker-through-link paths. Test: install, move or reinstall the package under a different prefix, then run reconcile. Required result: the Skill is present and current in both homes, and an agent can discover it. The current code fails this.
Byte comparison against the current package as the ownership test. Source: unchangedCopy(source, target). Test: copy install at version N, then upgrade to N+1 without edits. Required result: replaced. The current code gives preserved-existing.
Delete-then-copy and marker-last. Test: kill the process at each step of replacement (about 4 points), then reconcile. Required result: the target is either the complete old tree or the complete new tree, never partial, never foreign.
Skill not tied to plugin state. Test: disable, then uninstall, then reinstall Palace. Required result: the Skill is removed or restored to match, and the CLI reports disabled/uninstalled.
DDL before the schema check. Test: a database with meta.schema='2' and a table dropped. Opening it with the v1 store must refuse, and .schema must be byte-identical before and after.
CLI truncation. Test: 400 matching cards, with the most relevant card at the highest id. Required result: it is returned at the top, the same as knowledge.search.
Cancel = kill. Test: cancel one search while a learn is running. Required result: the learn commits, Palace stays enabled, and the next call succeeds.

Needed for the next round (full files, not excerpts):

All of plugin-host.ts.
RuntimeOwner (server side).
The rest of acquireRuntimeOwner.
plugins/palace/index.js (learn, validation, autoIndex in start).
All of palace-plugin.ts.
The offline mutation command that takes the lease, and the Device start path showing where the lease is held.
The package.json of both packages and the tarball inventories.

I'm keeping all seven positions above until code or test output disproves them. Nothing here means the release is ready.

ソース