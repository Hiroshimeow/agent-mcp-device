1s 間の推論
D0 Independent Technical Review: MCP Device v12 + Palace, Round 1

Scope: This review is based only on the engineer's summaries. I have not seen any source code, tarball contents, test logs or diffs, so every finding below is provisional. I mark statements as [F] (fact you reported, or established upstream behavior), [I] (my inference) or [U] (unknown that needs evidence).

1. Independent verdict
Topic	D0 verdict	Why
A. Skill install lifecycle	BLOCK	There is no ownership manifest, uninstall strands links, an old-version copy cannot be proven pristine, and nothing recovers an interrupted write. The narrow byte-for-byte fix is safe for current-version copies only. It leaves upgrades permanently stuck in "preserve" (copy mode) or broken (link mode).
B. Standalone packaging / default-enabled plugin	AMEND (publish BLOCKED until LICENSE is fixed)	Independence is plausible: a cold install without Device passes. Still undefined: how Device picks between bundled and standalone Palace when both exist, how the database schema moves across versions on rollback, and what Device does when the plugin fails.
C. SQLite authority / live mutation	BLOCK (against the stated acceptance)	The contract requires Palace to work while Device is active and the agent to learn validated procedures. Learning means writing. Today's design writes only through an offline exclusive lease, and no write has been shown while the runtime is active. Read-only use works; the learning path does not exist while Device is running.
v11 parity	BLOCK (as a claim)	6 FAIL and 2 no-op are explained as "the same three suites fail on baseline and candidate." That shows the candidate did not regress against that baseline. It does not show parity with native v11.
Token savings	BLOCK (as a claim) / not a release blocker if the claim is removed	There is no provider A/B data.
Stress	PASS for what it measures (concurrent readers plus one writer, writer exclusion)	It is not a crash test, soak test or contention-at-scale test. 111 appends is too small to exercise WAL checkpoint behavior.
2. Critical findings, ranked by user and data risk

P0-1: The learning path is impossible while Device is active. [F + I]

The agent has to persist validated procedures while Gateway/Device runs.
The offline lease means the agent can either never learn during normal use, or someone has to stop Device to learn.
The second option breaks OAuth/pairing sessions and violates "Palace works while Device remains active".
This is a blocker on the core function, not a nice-to-have.

P0-2: The Skill installer can destroy or strand user data. [F + I]

The marker-only legacy logic could overwrite user-modified files. The narrow fix stops that for current-version copies only.
Link mode: after the package moves, is uninstalled, or the Node version switches (nvm/fnm/volta change the global prefix), the agent home holds a dangling or wrong-version link. Agents may silently stop discovering the Skill. [U] Does Pi/Codex fail loudly or silently?
Copy mode: a v12.0 copy compared against v12.1 package bytes never matches. Every upgrade then falls into "preserve", so the Skill freezes on stale procedures with no signal. That is a correctness failure: the agent runs outdated procedures.
**Install hooks are unreliable **
npm v7+ does not run preuninstall/uninstall scripts, so cleanup on uninstall cannot be hook-driven.
--ignore-scripts and pnpm's default build-script blocking (pnpm 10) skip postinstall.
If "default install creates Skill" depends on postinstall [U], it fails silently in those environments.

P0-3: SQLite schema across upgrade/rollback is unspecified. [I]

Rollback is a stated requirement. If v12.x runs a forward migration and the user rolls back the package, the older code opens a newer schema.
There is no evidence of a schema version gate, backup-before-migrate, or a compatibility window.
Rollback can therefore corrupt or brick the Palace store, and through PluginHost possibly Device startup too (see P1-2).

P1-1: The v11 parity evidence is insufficient.

35 PASS + 2 no-op + 6 FAIL across 3 suites.
"Same failures on baseline" is acceptable only if the baseline is the native v11 release artifact, not the v12 branch with Palace disabled [U].
The 2 no-ops need a justification for each: is the feature removed, or untestable?

P1-2: Plugin failure isolation is unproven. [U]

Untested cases: the Palace child crashes at startup, hangs, crash-loops, or hits a corrupt database while Device starts.
Needed: bounded restart with backoff, a circuit-breaker state, and Device Core reporting healthy with Palace degraded.

P1-3: Packaging and licensing. [F]

The Palace tarball declares MIT but ships no LICENSE file. The fix is easy, but it blocks publishing.
Also check third-party notices for bundled or native dependencies (for example the SQLite binding).

P1-4: Read-only CLI on WAL has edge cases. [I]

A read-only connection on a WAL database still needs -shm access, and the -wal/-shm files may be missing when the writer is down.
Opening with immutable=1 while a writer is live returns stale or corrupt reads.
Need to confirm which open flags the CLI uses, and behavior on a read-only filesystem or with a missing -shm.

P2: evidenceVerifiedNow=false on reads is correct and honest. The UX question is whether agents treat unverified cards as authoritative. That needs agent-behavior evidence, not code.

3. Task A: Skill install lifecycle
3.1 Mature reference techniques and where each fails
Reference	Technique	What to reuse	Where it fails here
dpkg conffiles / ucf	Records the shipped hash per file. On upgrade: unmodified means replace, modified means keep the user's file and write .dpkg-dist.	Hash recorded at install time, not compared to the current package. A 3-way decision: installed hash, current hash, new hash.	Can prompt interactively, and there is no TTY here. Replace prompts with a deterministic "keep + write sidecar + report" rule.
rpm .rpmnew / .rpmsave	Same idea, with save-on-remove.	Save-on-uninstall of modified files.	Same as above.
Homebrew Cellar + opt link	Versioned keg dirs plus a stable link.	A versioned store with a stable indirection.	Links into the package prefix dangle when the prefix moves.
Nix profiles / Capistrano current	Generations plus an atomic symlink swap via rename(2).	Atomic swap and rollback-by-generation on POSIX.	On Windows, rename over an existing directory or junction is not atomic [F]. Needs rename-aside plus a journal.
npm bin-links / cmd-shim	npm owns the link lifecycle.	Not applicable: agent skill dirs are outside npm's ownership.	npm never cleans files it didn't create, and has no uninstall hooks (v7+).
GNU Stow	Ownership is inferred from where the link points.	"Link target realpath inside our store" as the ownership proof for links.	No copy mode. Ownership is ambiguous after a relocation.

**Conclusion ** Port the dpkg conffile 3-way hash model plus Nix/Capistrano-style generations in a Palace-owned store. Write the reconciler yourself, but keep it small and deterministic. No ready-made library covers agent skill directories on Windows and Linux.

3.2 Required invariants
I1 Ownership: Palace touches a path only if a manifest entry records it. A link is owned only if its realpath equals the recorded target inside the Palace store. A copy is owned only if the manifest lists the dir with per-file hashes.
I2 Never destroy user bytes: any file whose hash ≠ recorded installed hash is preserved, by keeping it or moving it to *.palace-saved-<ts>. It is never deleted or overwritten.
I3 No foreign takeover: a path that exists without a manifest entry is FOREIGN. This includes a user-created same-name skill, and a legacy marker whose bytes match no known release. Report it and do not touch it.
I4 Crash consistency: every mutation is journaled (intent record, then fsync, then act, then commit). The next run rolls the journal forward or back. No half-written skill dir is ever visible at the final path.
I5 Determinism / idempotence: reconcile() run twice gives the same state, and its result is a pure function of (filesystem, manifest, package).
I6 No silent staleness: if the installed skill version ≠ the active Palace version, palace doctor and the Skill's own preamble report it. The agent-visible version is checkable.
I7 Removal independence: uninstalling the package without running Palace leaves at most a detectable state that palace skill repair or the next Palace run resolves. Because npm has no uninstall hooks, this has to be accepted and mitigated rather than prevented.
3.3 State machine (per agent home × skill name)

States:

ABSENT
LINK_OK, LINK_DANGLING, LINK_FOREIGN (owned name, but the target is outside our store)
COPY_PRISTINE, COPY_MODIFIED
LEGACY_KNOWN (marker present and the tree hash matches a released version table), LEGACY_UNKNOWN
FOREIGN
DISABLED (manifest says disabled, path absent or parked)
INTERRUPTED (journal present)

Transitions (all go through reconcile):

INTERRUPTED → journal recovery → re-evaluate. This is always the first step.
ABSENT + enabled → stage in a sibling .<name>.staging-<id> → fsync → rename into place → manifest commit → LINK_OK or COPY_PRISTINE.
COPY_PRISTINE + upgrade → same staged swap. Old dir is renamed aside to .old-<id>, then deleted after commit.
COPY_MODIFIED + upgrade → keep the user tree, write <name>.palace-new/, report. The user command palace skill accept-new|keep resolves it.
LINK_DANGLING / LINK_OK on an old generation + upgrade → retarget (POSIX: create a temp link, then rename; Windows: remove the junction, create the new one, protected by the journal).
LINK_FOREIGN, FOREIGN, LEGACY_UNKNOWN → no-op plus a warning. Takeover only with an explicit --adopt.
LEGACY_KNOWN → adopt into the manifest (record hashes), then treat as COPY_PRISTINE.
Disable → move the owned tree to the store's parking area, or unlink → DISABLED. Re-enable reverses this.
Uninstall (explicit command) → owned and pristine: remove. Owned and modified: move to saved. Then drop the manifest entries.
Rollback → select the previous generation in the store, then the same swap path.

**Windows specifics **

Symlinks need Developer Mode or SeCreateSymbolicLinkPrivilege. Junctions do not, but they must be absolute and local-volume.
Directory rename fails with EPERM/EBUSY while an AV scanner or an agent holds handles. Use bounded retry with backoff (the graceful-fs pattern), and fall back to an INTERRUPTED state rather than partial writes.
3.4 Two options for the default mode
Criterion (policy order)	Opt 1: Link agent home → versioned Palace-owned store (~/.palace/skills/<ver>/), never → package dir	Opt 2: Copy plus hash manifest (dpkg model), store kept for rollback
Correctness	Survives package moves and uninstall (the store is independent). Ownership proof by realpath.	Correct with 3-way hashes. User edits handled by rule.
Agent discovery	[U] Depends on whether Pi/Codex follow symlinks or junctions, and whether file watchers resolve them.	Universal: plain files.
Windows	Junction OK. Symlink may be unavailable. Swap is not atomic.	Plain files. Rename-aside swap.
User edits	They land in the shared store, which would edit every agent's view and the rollback generation. Worse.	Isolated per agent home.
Upgrade/rollback	Cheap retarget.	Re-copy, which is cheap (a skill tree is small).
Failure modes	Store GC removes a generation that is still linked. Junction edge cases on network or other volumes.	Disk churn (negligible). Divergence across agent homes if one fails.

Recommendation Option 2 as the default, with the store as the rollback source. Option 1 is acceptable only as an opt-in.

What would change this:

Agent evidence shows hot-reload works only via links.
Skill trees become large (MB+).
3.5 Test matrix (minimum, per OS: Windows NTFS, Linux ext4, WSL on ext4 and on /mnt/c)

Dimensions:

Mode: symlink, junction, copy.
Prior state: each of the 11 states above.
Operation: install, upgrade, downgrade/rollback, relocate package (move the global prefix, switch the nvm version), disable, re-enable, explicit uninstall, npm uninstall without a hook followed by the next run, reinstall.
Fault injection: kill at each journal step (≥4 points), EBUSY on rename (an open handle held), disk full during staging, read-only agent home.
Collisions: user-created same-name dir, user symlink to a foreign target, a symlink target replaced by a regular dir, a modified file plus an added file plus a deleted file, a stale .staging or .old dir from another install id.
Legacy: a marker-only install for each released version (known hash) plus one with unknown edits.

Oracles (independent postconditions):

The bytes of every user file are preserved, with sha256 recorded before and after.
Manifest ⇔ filesystem consistency.
reconcile is idempotent (a second run makes no changes).
An agent-discovery probe works: the agent actually lists or loads the skill.

Running the full cartesian product is unnecessary. Use pairwise coverage, plus exhaustive coverage of (prior state × operation), plus every fault point.

4. Task B: Packaging and default-enabled policy

Questions to answer, with a recommended design:

**Resolution ** if Device bundles Palace sources and standalone @hcu-lab.me/palace is also installed, which one runs? Two copies of the same engine at different versions against one database is a duplicate-engine and schema-skew risk.
Option B1: Device ships a pinned Palace build. The standalone package is for non-Device users only. Both refuse to open a database whose schema/owner-epoch belongs to the other unless the versions are compatible.
Option B2: Device declares no dependency and discovers Palace through an explicit plugin registry entry (path + version + integrity hash) written by palace enable --device. No optionalDependencies: npm silently skips them when installs fail [F], which makes the result non-deterministic.
Preference: B2 [I]. It gives one engine instance, true independent upgrade and removal, and an auditable state.
B1 wins if the requirement is "works with zero extra install step". "Default-enabled" may imply that [U], so confirm the intended meaning.
Schema versioning:
Store PRAGMA user_version plus a minimum-reader version.
Back up before every migration using the SQLite online backup API or VACUUM INTO (mature, built in).
Older code refuses newer schemas with a clear error, and Device Core stays up.
Rollback means restoring the paired backup, or a forward-compatible window of N-1.
Child isolation: startup timeout, health handshake, restart budget (for example exponential backoff, then a circuit-open state), resource limits, and a Device status endpoint that reports Palace as degraded. Test with Palace killed, hung, crash-looping, and on a corrupt database.
Environment differences: WSL with the database on /mnt/c (DrvFs), where SQLite locking is unreliable. Recommend refusing, or warning loudly. Network or OneDrive-synced home dirs: same issue. Native binding ABI vs Node version after an nvm switch.
Licensing: add LICENSE to files, generate third-party notices, and add a tarball-inventory test that fails if they are missing.
5. Task C: SQLite authority and live mutation

Is live mutation required? Yes, by the stated contract [I from F]. "Works while Device is active" combined with "agent must learn validated procedures" means writes during runtime. Deferring it is possible only if acceptance is explicitly re-scoped to read-only Palace while Device is active, and that needs your sign-off.

**Distinction ** SQLite safely serializes multiple writers. The single-writer rule here is a product invariant (provenance ordering, index coherence, corrections semantics), not a SQLite limitation. So the fix has to be routing, not locking.

Options
	C1: Owner-routed IPC via existing PluginHost/router	C2: Spool/outbox ingested by owner	C3: Lease handoff (stop writer, CLI writes, resume)
Single writer	Yes	Yes	Yes, but temporal
Synchronous postcondition check by agent	Yes (commit ack + read-your-write)	No (eventual), which breaks "validate by postconditions" unless the agent polls	Yes
Device stays active	Yes	Yes	No for the Palace writer, and handoff races
Complexity	Medium	Medium (dedup, poison records)	Low code, high operational risk
Failure modes	Owner down, timeouts, duplicate on retry	Spool corruption, unbounded lag, ordering	Lease not released after a crash, starvation

Recommend C1, with the existing offline lease kept as the fallback when the runtime is not running. Both paths call the same write library, so there is still one engine.

C1 specification:

Transport: local IPC only (Unix socket 0700 dir / named pipe with an ACL restricted to the current user SID). Do not reuse the Gateway OAuth surface. Not MCP. These are CLI commands routed through PluginHost's existing router.
Authorization: per-user socket ACL plus a capability token in a 0600 file rotated per runtime epoch. Commands are scoped to the Palace namespace. Account isolation: the token is bound to the device account/profile.
Idempotency: the client generates a UUID request_id. The owner writes (request_id, result_hash) into a dedup table in the same transaction as the mutation. A retry returns the stored result.
Ordering and version: the request carries expected_card_version (optimistic concurrency) and the owner rejects stale updates. Corrections append; they never overwrite provenance.
Timeouts and cancellation: the client deadline is propagated. Cancellation is honored only before BEGIN IMMEDIATE. After commit, the result is durable and the retry returns it.
Backpressure: a bounded queue. When full, return a typed BUSY with a retry-after. The CLI retries with jitter up to the deadline.
Crash semantics: WAL + synchronous=FULL (or NORMAL plus a documented loss window) for mutation commits. If the owner crashes mid-request, the client sees EOF and retries with the same id; dedup makes this exactly-once in effect.
Owner absent: the CLI tries to acquire the offline lease. Runtime start must block or fail while the lease is held. That mutual exclusion (an OS file lock plus an epoch in the database) has to be proven by a test.
Revalidation: a "validated procedure" write must carry evidence references. The owner re-runs the source-verification path, or records verified=false with a reason. Never trust a client-claimed verification.

Deferrable: batch APIs, streaming, remote access, fine-grained per-command authorization beyond the namespace. Hard blockers: routed mutation, idempotency, lease/runtime mutual exclusion, crash/retry tests.

6. Evidence gaps (what I need for a code-level review next round)

Source (exact files, full content, at the cited HEAD plus the WIP diff):

The Skill installer module(s): marker logic, the new byte-compare, link/junction/copy fallback, any postinstall script, and the package.json scripts/files for both packages.
PluginHost: child spawn, handshake, restart policy, router/IPC dispatch, shutdown.
src/plugins/palace writer entry, schema/migrations, user_version handling, lease implementation (lock primitive, epoch, release-on-crash).