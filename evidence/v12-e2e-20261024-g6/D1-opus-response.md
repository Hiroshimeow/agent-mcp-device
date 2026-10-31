1s 間の推論
D1 code-level review: MCP Device v12 + Palace

D1 verdict: AMEND, not PASS. I found no data-loss path. The architecture holds, and most of last round's must-fix items are genuinely fixed in the source. Six defects still have to be fixed before D1 can pass. Five are product behavior and one is about tests that can't fail. They are listed as MF-1 to MF-6 in §2.

Three of them come from positions I took earlier that were wrong. I correct those first.

I reviewed the byte-exact pack. Labels:[S] = shown in source,[I] = my inference (including SQLite, npm or Windows behavior),[U] = needs a file or receipt I don't have.

0. Corrections to my own earlier positions
Earlier position	Correction
D0 R4:	Wrong. Cancelling a request should not make its deadline stricter than if it hadn't been cancelled. The implementation followed my advice, and that produced MF-2.
D1 R1 P1-3: a wrong-	Over-specified. -shm is a WAL index SQLite can rebuild; it is not durable state. Demanding that it stay unchanged pushed the implementation into copying the whole database (MF-3). The correct invariant is: no change to the main file or the WAL frames, no checkpoint, and no pragma or DDL.
D0 R4 B3:	Incomplete. I only considered server mode and ignored the Device-only runtime (MF-1).
1. Resolved since last round

These are fixed in the source:

Cancel acknowledgement no longer ends supervision of the request.
There is now one shared coordination-lock + process-identity module, reused by the registry, the Skill ledger and the upgrade intent. This is the right reuse.
A non-Palace SQLite file is rejected.
install palace --bundled revives a tombstone and keeps its data.
The privileged-install guard is in place.
The docs now match the probe design.
Owner hold-vs-exclude is implemented correctly, including expiry after 3 runs and 30 minutes.
--forget-owner refuses an owner that is still installed.
--abandon-pending now retains the stage and aside directories.
Ledger validation is in place.
Cross-device publishing is checked with an actual rename probe.
Publish failure now rolls back.
Parity is reconciled. Windows: 6 FAIL = 3 files × 2 targets. Linux: 2 = 1 file × 2. That is consistent, and I accept it as D1 evidence.
The default catalog is unchanged. createPlatformTools is still added only with --legacy-knowledge-mcp [S].
2. Must fix before D1 PASS
MF-1 (P1): Device-only hosts point palace at the wrong runtime by default

Where: palace/cli.ts, where selectedRuntime is chosen, and platform/cli.ts stateRoot(args,true) for plugins and knowledge.

Failure: mcp-device start (device.ts) calls createDeviceCore with no stateRoot and takes its lease on CONFIG_DIR (~/.mcp-device) [S]. Unless device-runtime.ts overrides this, Palace data lives under ~/.mcp-device/plugins/palace/data [I/U].

palace status defaults to ~/.mcp-device/server. There it finds no registry (unregistered) and then no database, and reports PALACE_NOT_INSTALLED on a host where Palace is running.
A remote agent following SKILL.md through the Device shell tool gets the same wrong answer, because device.ts never exports MCP_DEVICE_CONFIG_DIR to child processes.
mcp-device plugins disable palace and mcp-device knowledge learn act on a different root than the Device's. That gives a split knowledge store and a disable command that has no effect.

Fix (reuse existing files, no new infrastructure): add one resolveRuntimeRoot() shared by the palace, plugins and knowledge commands. Order:

An explicit --runtime-dir.
MCP_DEVICE_CONFIG_DIR.
Discovery over the two documented roots (server, then device): prefer the root with an active lease, then the root whose registry contains Palace.
If both qualify, fail with a typed RUNTIME_AMBIGUOUS error that lists both roots.

Also have the Device process set MCP_DEVICE_CONFIG_DIR for the shell processes it spawns.

Tests:

A cold Device-only install with mcp-device start (fixture gateway), then plain palace status: expect ok and the device root.
The same through the Device shell tool.
Both roots populated: expect RUNTIME_AMBIGUOUS.
plugins disable palace with no flags affects the running Device.

Please send: src/platform/device-runtime.ts, so I can confirm the default root.

MF-2 (P1): Cancelling one request can kill other requests that are still running
Where: ProcessDriver.request, the onAbort handler: graceMs = min(5000, deadlineAt - now) [S].
Failure: Palace runs jobs one at a time on its tail queue, and ingest runs synchronously [S].
Request A (an ingest, or the autoIndex tick) runs for 7 s.
Request B is cancelled at 1 s and stays queued behind A.
The grace period expires at about 6 s. fail() kills the process tree.
A was never cancelled, yet it fails with PLUGIN_TIMEOUT and its transaction rolls back. Palace is then faulted, and the fault persists (MF-5).
Fix: grace = the remaining original deadline, with no 5 s cap. The worst-case bound is then the same as for an uncancelled request. Keep the 64-entry cancelling cap.
Test: a process plugin with a serial queue. Start a 7 s job A, then cancel a queued job B at 1 s. Expect:
B rejects with CANCELLED in under 200 ms.
A completes successfully.
The plugin stays enabled.
The existing synchronous-hang test still faults at the original deadline.
MF-3 (P1): After an unclean shutdown, the schema check copies the whole database to a temp folder
Where: the PalaceStore constructor, in the branch where the WAL is non-empty: copyFileSync of the main file plus -wal and -shm into os.tmpdir() [S]. This happens on every start after a crash, power loss or kill -9.
Failures:
Disk space. A multi-GB database copied to /tmp, which is often a RAM-backed tmpfs, fails with ENOSPC. Palace is then faulted, and the fault persists.
Time. The copy counts against the 30 s init deadline.
Privacy. The full private knowledge store is written to shared temp space. If the process dies during the copy, the copy is left behind.
Race. The fingerprint check includes -shm mtime. Concurrent palace readers update read-marks in -shm [I], which triggers PALACE_SCHEMA_BUSY and faults startup exactly when agents are polling.
Fix:
Empty WAL: keep the existing immutable=1 check.
Non-empty WAL: do the check on a plain readOnly:true connection. A read-only connection does not checkpoint or write the main file or the WAL [I, SQLite WAL documentation].
Fallback: only if that connection returns SQLITE_READONLY_RECOVERY or CANTOPEN, take a snapshot inside the plugin's data directory, after checking free space, and report a typed error if there isn't enough.
Tests:
A writer killed with frames that were never checkpointed (stale -shm), plus a v2 schema.
Concurrent CLI readers during the check.
Expect: the main file and -wal hashes are unchanged, the WAL size is unchanged, nothing is created in tmp, and a v1 database starts within its deadline.
Change the existing WAL test so it no longer asserts that -shm is byte-identical.
MF-4 (P1): A registry write failure on Windows can fault a healthy Palace
Where: PluginHost.save() uses plain fs.writeFile + fs.rename, with no Windows retry and no fsync [S]. Elsewhere, the same file uses renameWithRetry for exactly this reason.
Failure: every palace invocation reads registry.json [S]. An AV scanner or a concurrent reader can make MoveFileEx fail with EPERM or EACCES [I]. A failed save() inside activate() ends up in catch, then markFault, which kills a driver that had already started successfully. The fault persists (MF-5).
Fix:
Use the existing renameWithRetry, and fsync the temp file, in save().
In activate(), a save failure after driver.start() succeeded should be retried or reported. It must not kill the healthy child.
Test (Windows): keep registry.json open without share-delete for 300 ms (a child process calling [IO.File]::Open) while the server starts. Expect Palace to reach enabled with no fault.
MF-5 (P1): A fault survives restarts, and the remediation text isn't a command
Where:
PluginHost.start() skips records in state==='faulted' [S], so one transient fault persists across Device restarts.
The CLI's PALACE_FAULTED remediation says "Inspect … list and repair the recorded Palace fault" [S]. That is not a command.
child.stderr.resume() discards the child's diagnostic output [S].
Required now:
The remediation gives the exact command, mcp-device plugins --runtime-dir "<root>" enable palace, together with the recorded error.
A manual record whose entry file is missing should point to upgrade palace --bundled.
PALACE_UPGRADE_REQUIRED must say that the runtime has to be stopped first. The upgrade takes the lease; SKILL.md tells the agent to report this rather than stop the runtime.
Keep a bounded tail of the child's stderr (for example the last 4 KiB) in the fault record.
Decide before D2: whether to restart automatically with a budget, as systemd does with Restart=on-failure + StartLimitBurst, or to keep faults sticky by explicit policy. Either is acceptable if it is written down and tested.
MF-6 (P1, evidence): three tests cannot fail on the behavior they are named for
Test	Why it proves nothing	Required change
D1 M1 temporarily absent package…	Asserts only the final state. A downgrade during the run with the owner absent would be re-upgraded by the final run, so the test still passes [S]	Assert other 1.0.13 and the owner-unavailable state immediately after the run where the owner is parked
registry stale-lock recovery never… loses a retried update	Reinstalls any missing entry before asserting [S]. This is unchanged from last round	No retries. Every install that reported success must be present. Run 200 iterations
metadata probes … 20 ms p95	palaceSkillProbe caches results for 250 ms, keyed by the environment variable that the loop toggles, so nearly all 400 samples are cache hits [S]. A real CLI process never hits the cache	Spawn the actual CLI 200 times with and without MCP_DEVICE_SKIP_SKILL_INSTALL, on Windows with Defender on, and compare the p95 difference
3. P2: fix or explicitly accept before D1 closes
Where	Issue
recoverUpgradeIntent	If process birth identity is missing (PowerShell failed), the intent is treated as legacy, and processAppearsDead is checked without a namespace check. A WSL process could then wrongly treat a live Windows upgrade as abandoned. Use coordinationOwnerAbandoned whenever namespace is present
createCoordinationLock (win32)	Creating the lock while the old file is pending deletion returns EPERM, which surfaces as a raw error. Treat EPERM/EACCES as "busy, retry" on win32
Palace CLI vs. an upgrade in progress	upgrade-intent.json is still ignored. Report PALACE_UPGRADE_IN_PROGRESS
CLI SQLite handling	No busy_timeout, and no mapping to PALACE_BUSY. node:sqlite ExperimentalWarning lands on stderr. status failures go to stdout while other failures go to stderr
palace skill * output	Results are subject to the 16 KiB retrieval budget, so a remove or adopt that succeeded can be reported as BUDGET_TOO_SMALL
skills --include-candidates (CLI and provider)	Also lists withdrawn and superseded procedures
knowledgeCli	Its default sourceRoots differs from the server's. A maintenance run may add a source root to the persistent source index [I]
managedRuntime	A symlink to the database file itself (as opposed to the directory) bypasses the disabled-runtime check
runtimeIsActive	Checks the PID only and ignores the namespace
managedEvidence	The evidence file is not fsynced before the synchronous=FULL database commit. After a power loss, a validated procedure can go stale
Palace start()	The first ingest runs inside the init deadline
Startup reconcile	A Device running as a LocalSystem or root service writes the Skill into the service profile. Choose skip or documentation explicitly (still open from the last round)
Probe	A permanently unsafe parent (for example ~/.pi managed by stow) is reported as repair-required forever
SKILL.md	Says the CLI is "read-only while the runtime is active"; the docs say "always read-only". It also doesn't say that a standalone install has no write path. If changed, the agent end-to-end check must be rerun on the new file hash
Retrieval	Candidates are ranked by status first, then capped. Decide on this before the S5 freeze; it is not a D1 blocker
4. Evidence quality

These problems are in addition to MF-6:

Inconsistent "0 skipped" claim. The privileged-install test has skip: win32 || euid!==0 [S]. That conflicts with "160/160, 0 skipped" on Windows and on non-root WSL. Either the file isn't in the suite, or the count is wrong. Send the per-file test list, and run the test as root in a Linux container.
Types test only resolves imports. palace-package-types checks that imports resolve; it doesn't compile anything. A consumer tsc --noEmit against the tarball is still missing.
The validationModule trust boundary is still checked only by regex. It needs a behavioral test on the packed plugin.js (send plugin.ts).
Upgrade tests use trusted in-process fixtures, not the process-isolated Palace manifest. That gap belongs to D2.
No same-prefix EEXIST receipt yet: install the standalone package into a prefix that already has Device, and show the prefix is byte-identical afterward. This was a D0 obligation.
Real-agent receipt. State how the runtime root was resolved in that fixture (environment variable or flag). If it was explicit, the run did not exercise MF-1.
5. Summary
Area	D1 status
Skill lifecycle, ledger, recovery, opt-out, adoption	PASS on code, apart from P2 items; the M1 test fix is in MF-6
Coordination lock and process birth identity	PASS, apart from P2 items
PluginHost lifecycle, tombstones, provenance, version-only re-pin	AMEND (MF-4, MF-5)
Cancellation	AMEND (MF-2)
Store schema rejection	AMEND (MF-3)
CLI runtime binding	AMEND (MF-1)
Standalone closure, LICENSE, manifest, no Device dependency	PASS on code; evidence items open (§4)
Default catalog, single writer, no Palace MCP	PASS

D1: AMEND. To reach PASS:

MF-1 to MF-6, each with a test that fails before the fix and passes after, on Windows NTFS, Linux, and WSL (ext4 and /mnt/c).
The §4 receipts.
The device-runtime.ts and plugin.ts files.

The release is still not ready. Later gates remain: D2 (fault matrix and restart policy, real-data upgrade/rollback with process-isolated Palace, lease races), S4 and S5 (once retrieval is frozen), the 24-hour soak, rollback, and deployment.

ソース