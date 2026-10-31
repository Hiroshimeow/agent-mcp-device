1s 間の推論
D0 Independent Technical Review, Round 2: MCP Device v12 + Palace

This round uses the new source facts you reported. I still have not seen any source code, so every verdict is provisional. Labels: [F] = fact you reported, [I] = my inference, [U] = unknown that needs evidence.

Net result: the release stays BLOCKED. Two round-1 positions were wrong and I'm withdrawing them: the SQLite owner policy is no longer a categorical BLOCK, and the token gate is mandatory. Two more were too strong and are downgraded: schema rollback and fault isolation. Skill lifecycle stays BLOCK, but the design needed to fix it is smaller than the one I proposed in round 1.

A. Corrections to round 1
#	Round-1 claim	Correction	Reason
A1	C = BLOCK because "learning means writing, and writing is impossible while Device runs."	Wrong as stated. The spec allows writes after stopping the runtime, under the lease. Live mutation is a blocker only if a required workflow fails on that path (see D1).	[F] spec text
A2	"Stopping Device breaks OAuth/pairing sessions."	Asserted without evidence. Whether Gateway tokens and pairing survive a controlled stop/restart is unknown. It is now the deciding question.	[U]
A3	Token savings: "not a release blocker if the claim is removed."	Wrong. S5 makes provider-measured A/B a mandatory release gate. It is a release BLOCK today regardless of wording.	[F]
A4	P0-3: schema upgrade/rollback "unspecified," could brick Device.	Too strong. PluginHost already does backup, rollback and migration hooks in the child, and Core survives a Palace startup failure. What remains is evidence about Palace's own data, not a missing mechanism. Downgraded to P1.	[F]
A5	P1-2: plugin fault isolation "unproven / undesigned."	Partly wrong. The faulted state and Core-continues-on-startup-failure exist. Still open: runtime crashes after startup, hangs, and crash loops.	[F]/[U]
A6	B2 (explicit plugin registry) proposed as a new design.	Largely exists already. PluginHost persists the install source and state. The remaining question is only which engine binary reads which data version.	[F]
A7	P1-4: possible immutable=1 stale reads.	Resolved. The CLI opens read-only, without immutable mode, and checks schema=1. Remaining point: a read-only connection on WAL still needs -shm write access or an existing -wal, so a read-only filesystem or missing -shm is still worth one test.	[F]
A8	Parity: "does not show parity with native v11."	Partly too harsh. The frozen original-v11 comparator (14 output + 4 side-effect families) is real evidence of no regression for those families. The 6 shared legacy failures and 2 no-op rows still leave full parity undetermined.	[F]
A9	Generations plus a fsync'd journal as required.	Over-specified. Some of it is hardening, not correctness. See C.	[I]
B. Revised D0 verdicts
Topic	Verdict	What closes it
Skill lifecycle	BLOCK	The minimal correct design in C, plus the lifecycle test matrix passing on Windows, Linux and WSL.
Standalone packaging	AMEND	Same compiled implementation, so there is no fork [F]. Still needed: (a) a test where a standalone schema=1 reader meets a newer-schema database and refuses cleanly; (b) a documented and tested rule for which install source PluginHost loads when both exist.
Plugin lifecycle / fault	AMEND	Mechanisms exist [F]. Evidence still needed for: child crash after ready, hang (no handshake / no response), crash loop (restart budget then faulted state), and corrupt Palace database. In each case Device OAuth/pairing must keep working, including a new pairing during the fault.
Palace data schema / rollback	AMEND (evidence BLOCK for release)	Generic hooks ≠ proven Palace migration. Need: upgrade migrates, then rollback restores the backup, then the older reader opens the database; also an interrupted migration recovers.
SQLite owner / mutation policy	AMEND (conditional BLOCK)	It becomes BLOCK if D1 shows a required workflow fails on the stopped-runtime path. Either way, lease/runtime mutual exclusion must be tested, not only implemented: a race test, and a crash while holding the lease.
Parity evidence	AMEND	Disposition each of the 6 FAIL and 2 no-op rows: pre-existing defect, out of scope, or fixed. Bind the frozen v11 baseline to its artifact hash.
Licensing	BLOCK (trivial)	Add LICENSE to the Palace tarball, add a tarball-inventory test, and check third-party notices for native dependencies.
Token A/B (	BLOCK	No provider-measured A/B exists yet [F].
Release status	RELEASE_BLOCKED_WITH_EVIDENCE: confirmed	Blockers: Skill lifecycle, token A/B, LICENSE, Palace schema-rollback evidence, the parity disposition, and any D1 outcome that turns mutation into a blocker.
C. Skill lifecycle: minimal correct design vs. my round-1 design

**The deciding fact ** the Skill is how the agent learns that Palace exists. A dangling or partial Skill is not a cosmetic leftover. It makes Palace silently undiscoverable, and repair-on-next-run doesn't help because nothing triggers the next run. That one point decides which mechanisms are strictly necessary.

Strictly necessary for correctness
Ownership manifest. Outside the agent home, writable by Palace. Per entry: path, mode, link target realpath, version, and the per-file hashes recorded at install time.
This is what makes upgrading an old-version copy decidable: compare the files against the hashes recorded when they were installed, not against the current package.
Without it, a v12.0 copy can never be proven pristine under v12.1.
Three-way decision on each file (the dpkg conffile rule):
Installed hash = file hash: safe to replace.
They differ: keep the user's file and write the new one alongside (.palace-new).
Extra user files: always kept.
No manifest entry: treat the path as foreign and don't touch it.
No link into the package directory. Moving or reinstalling the package, or switching Node versions, leaves a dangling link [F]. Use copy by default, or link only to a Palace-owned stable store. Link-to-package fails the silent-loss rule, so it cannot be the default.
Stage, then rename into place. Write the full tree to a sibling .<name>.palace-staging-<id>, then rename it.
The agent must never see a partial tree.
Without staging, an interrupted copy produces a tree with no manifest entry. That tree is classified as foreign and is stuck forever.
On Windows, use rename-aside, then rename-in. Seeing the path briefly absent is acceptable; seeing a partial tree is not.
Intent recorded before acting, plus prefix-based recovery. The manifest records a pending intent with the staging id before the rename. On the next run, reconcile finishes or discards owned staging and .old leftovers by matching that id. This is the minimal journal. It needs an ordered write followed by an atomic manifest rename; no fsync is required for correctness on a local filesystem.
Serialize reconcile across processes. Two agent sessions running first-run install at once is realistic.
Reuse PluginHost's lifecycle serialization if the CLI can take it [U]; otherwise use a lock file.
A known-release hash table for legacy marker-only installs.
It can be empty if the Skill never shipped in a published version [U]. In that case legacy migration shrinks to: treat as foreign and require explicit --adopt.
Explicit palace skill uninstall|disable|repair and doctor that reports staleness. npm v7+ runs no uninstall hooks [F-upstream], so cleanup cannot be automatic. It has to be explicit and detectable.
Optional hardening (not required for D0)
Versioned generations store. Rollback can re-copy from the rolled-back package version, which ships its own Skill.
fsync on every journal step. Only needed on power loss; I'm demoting it.
Symlink/junction modes. Opt-in only, and only after agent-discovery evidence for each mode.
Hot-reload support.
Comparison
Criterion	Minimal (1–8)	Round-1 heavy (generations + fsync journal)
Preserves user bytes	Yes	Yes
No silent loss of discovery	Yes (copy)	Yes
Crash recovery	Yes (pending intent + owned prefixes)	Yes, plus survives power loss
Rollback	Re-copy from the package	Instant retarget
Code / test surface	Smaller	About twice as large

Preference: minimal. I'd move to the heavy design if any of these appear:

Evidence that agents need link mode to pick up changes.
A requirement for rollback without the old package present.
A report of a power-loss incident.
D. Live mutation: reuse vs. a new channel
D1. Is live mutation a blocker? It hinges on two unknowns.

Required workflow [F, from the contract]:

The agent uses Device and the Skill.
It validates a procedure by independent postconditions.
It persists the procedure.
A later session reuses it.

The stopped-runtime path makes step 3 work like this: stop Device, write under the lease, then restart Device.

Condition	Result
(a) The validating agent depends on live Device MCP tools in the same session, so a stop severs that session and the write can't be issued by that agent without a handoff	Blocker
(b) A controlled stop/restart drops Gateway OAuth tokens or pairing, or requires user re-auth	Blocker
(c) The acceptance test requires persistence without user intervention, and only the runtime may be stopped by a user action	Blocker
None of (a)–(c) hold	Stopped path suffices. Mutation is AMEND, not BLOCK.

**My position ** (a) is likely true for an agent that runs procedures through Device. I won't call it a blocker until the S-spec acceptance workflow text, and a check of (b), confirm it.

Note: deferring the write with a spool (validate now, write at the next stop) is my round-1 option C2. It is acceptable only if acceptance does not require the next session to retrieve the procedure before Device stops.

D2. If live mutation is required: reuse first
	Reuse: runtime-owner control channel → PluginHost → Palace child writer	New Palace-specific local channel
Single writer	Yes. The child is the existing writer [F].	Yes, if it goes to the same child, otherwise a risk.
Trust boundary	Already authenticated local OS channel [F]. Note: whoever can reach it can already shut down Device, so adding a mutation does not widen access to the channel itself.	New ACL, token and discovery to design and audit.
Needs adding	A command allowlist; request/response with correlation id and deadline [U whether present]; payload size limit; forwarding through the PluginHost router to the child.	All of that, plus transport, auth and discovery.
Failure surface	Coupled to runtime-owner availability, which is acceptable: if the owner is down, use the lease path.	Two control planes that can disagree on ownership.

Recommendation: reuse. A new channel is justified only if the runtime-owner channel turns out to be lifecycle-only and cannot carry correlated, deadline-bound payloads without breaking its shutdown semantics. Even then, extend that channel rather than adding another one.

Correctness items that are mandatory either way:

Idempotency: a client request_id, stored in the Palace database in the same transaction as the write.
Optimistic version check on card updates.
Cancel only before BEGIN IMMEDIATE.
Typed BUSY/backpressure from a bounded queue.
CLI routing rule: if the lease shows the runtime is active, route through the owner; otherwise take the lease. The decision itself must be race-tested.
Server-side re-verification: the owner re-verifies evidence. A verified flag claimed by the client is never trusted.

Not proposed: a Palace MCP service.

E. Needed before D0 can be agreed

Source, at HEAD 1e454c1 plus the WIP diff, full files:

The Skill installer: marker handling, the byte-compare fix, link/copy fallback, the install trigger (postinstall vs. first run), and package.json scripts/files for both packages.
src/platform/plugin-host.ts: the registry write/revision logic, upgrade/backup/rollback, the migration hook contract, restart and faulted logic, and install-source resolution.
src/device/runtime-owner.ts: the channel transport, auth, message framing, and whether request/response correlation and deadlines exist.
src/platform/runtime-lease.ts: the lock primitive, epoch, and release after a crash.
The Palace schema/migration code and the CLI open path, including how schema=1 is checked (exact match or minimum).
The standalone assembly script.

Evidence:

Tarball inventories for both packages.
The names and causes of the 6 FAIL and 2 no-op parity rows, plus the hash of the frozen v11 artifact.
Gateway token/pairing behavior across a controlled stop/restart (decides D1(b)).
The S-spec text of the acceptance learning workflow (decides D1(a) and D1(c)).
Whether the Skill was ever shipped in a published version (scopes C7).
An agent-discovery transcript for Pi and Codex in copy mode.
The S5 A/B protocol, plus any pilot data.
F. Remaining disagreements
With the implementer: the byte-for-byte compare against the current package is not a sufficient ownership model. It freezes every copy upgrade into "preserve" with no signal. The installed-hash manifest is required, not optional.
With the implementer: linking to package files cannot be the default. A dangling link is silent loss of discovery, and nothing can repair it automatically.
Open, with the spec owner: whether the stopped-runtime path satisfies the learning workflow. I lean towards no, because of (a), but I'm holding that pending the evidence in D1. I won't call it a blocker without it.
Withdrawn by me: the generations store and fsync journal as D0 requirements, the token-gate exemption, and the claim that schema rollback was missing.
Held by me: the mechanisms in PluginHost and the lease are not acceptance evidence. Each needs its fault and race tests before it can PASS.