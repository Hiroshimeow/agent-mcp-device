1s 間の推論
D1 Review (fresh packet): MCP Device v12 + Palace

D1 verdict: AMEND. I found no data-loss path, and the architecture still holds. MF-1 through MF-5 are fixed in the source and have passing Windows receipts. MF-6(c) stays FAIL, as the source owner recorded. I also found two new P1 defects in the source:

On Windows, every palace read starts PowerShell while a runtime is active.
A database left behind by an interrupted first start puts Palace into a permanent fault.

The release stays blocked, and nothing below is release acceptance.

Labels:[S] shown in the packet source,[I] my inference,[U] needs a file or receipt not in the packet.

0. What this review is bound to
Packet: D1-current-source-tests-evidence.txt, 919,832 bytes, SHA-256 f05d541839ecc8570b697b6ee42117e432af216fb694d54c7cceb5f0a689e656, writer del_mvqum8pa_1jat.
The bytes and hash are as you supplied them. The connector gives me text, so I cannot recompute the file hash myself.
Internal consistency checks I did:
The handoff hash 2ea9a017… matches the evidence manifest.
The source-manifest hash 4ecfc034… matches receipt.json.
Spot checks match their per-file headers: plugin-host.ts (dac54258…), skill-manager.ts (ae87e5d1…), palace/cli.ts (86c04cf5…), store.ts (7cfe00b2…).
Provenance question: the packet header says HEAD is 18407ec5…. Every earlier round said HEAD stayed at 1e454c1… with no commit. Please explain who created that commit and what it contains.
Logs listed but not included: many logs appear in the manifest with hashes but their content is not in the packet. Examples: lock-cancel-final.log, red-lifecycle.log, wal-green.log, tsc-final.log, and the earlier installed-probe-receipt.json. I treat those as claimed, not inspected.
1. One correction I owe on MF-6(c)

I defined the MF-6(c) metric myself: the difference between the two arms' p95 values, each computed separately, at ≤20 ms. That estimator is defective as an acceptance instrument, and the receipts show why:

Two runs of the same code gave 18.56 ms and 30.16 ms. The run-to-run spread (11.6 ms) is more than half the threshold.
In the failing receipt, both arms show a contiguous stretch of about 20 slow samples (above ~260 ms) at the same pair positions late in the run. Even the skip arm, which does strictly less work, has p95 = 332 ms against a median of about 160 ms.
Each arm's p95 therefore lands inside a host-wide disturbance, not in the product's own cost.

This does not turn either run into a pass.

The 30.16 ms result remains the authoritative FAIL.
The earlier 18.56 ms result stays superseded.
MF-6(c) can close only with a fresh run under a protocol registered before that run (A3 below). The 20 ms threshold stays the same.
The diagnostic (in-process probe p95 9.6 ms) is not evidence in either direction.
2. MF-1 to MF-6
Item	Source	Executed receipt (Windows, this snapshot)	Status
MF-1 runtime	One shared resolveRuntimeRoot, used by palace, plugins and knowledge. Order: explicit root → env → active lease → single registry → typed RUNTIME_AMBIGUOUS. device.ts exports MCP_DEVICE_CONFIG_DIR [S]	Two runtime-discovery tests pass, using a fabricated lease	Source resolved. Evidence missing: device-cold-local.test.mjs does not run palace or any shell command, even though the handoff says it does. There is also no "plugins disable with no flags affects the running Device" test. New P1 N1 below.
MF-2 cancel deadline	Grace period = the request's original remaining deadline, no cap. An acknowledged cancel does not end supervision [S]	Serial-queue isolation test passes; ignoring-child test passes	Resolved (Linux missing)
MF-3 wrong-schema	Empty WAL: checked through immutable. Non-empty WAL: checked on a read-only connection, with main/WAL fingerprints compared before and after. Fallback: a private snapshot inside the data root, after a free-space check [S]	6 tests pass (killed writer, stale/missing SHM, concurrent readers, fallback, low disk space)	Resolved, with a new P1 N2 and P2 N5
MF-4	Lock, then fsync of the temp file, then renameWithRetry. A failed save after driver.start() sets a pending retry and does not fault the plugin [S]	Share-contention test passes; injected-failure tests pass	Resolved (P2 N4)
MF-4+ pending save vs	refresh() drops a stale pending save on PLUGIN_REGISTRY_CHANGED, reloads, and stops the old child process [S]	2 tests pass; child PID confirmed gone (ESRCH)	Resolved
MF-5 sticky faults, remediation	Faulted plugins and dependents are excluded from candidates. activate refuses a faulted record and recovery is only by explicit enable. The last 4 KiB of child stderr is kept. Remediation gives exact commands, including "stop the runtime first; the agent must not stop it" [S]	Sticky-dependency, remediation and stderr tests pass	Resolved. The sticky policy is now documented and tested, which is an acceptable D2 decision. P2 N6/N7
MF-6(a) check while owner	The test checks the state right after the absent-owner run (other 1.0.13 and owner-unavailable) [S]	Passes	Resolved
MF-6(b) 200 iterations, no retry	d0-architecture-regressions.test.mjs and lock-cancel-final.log are not in the packet	Claimed only	Evidence missing
MF-6(c) CLI	Installed-layout fixture, 200 per arm, alternating order [S]	30.16 ms > 20 ms	FAIL (authoritative). The instrument is also defective (§1), and it doesn't cover the active-runtime path (N1)
3. New findings
Must fix before D1 PASS

N1 (P1): Windows read path starts PowerShell for every palace call while a runtime is active.

Location [S]:
runtime-root.ts activeLease() calls processBirth(pid) for every live lease.
palace/cli.ts runtimeIsActive() calls it again.
On win32, processBirth runs powershell.exe with a 3 s timeout.
With Device running and no environment variable set, a single palace status starts two PowerShell processes.
That contradicts the design we agreed in D1-R3 (no birth-identity queries on read paths). It is also the normal deployed condition, and the MF-6 benchmark (--data-root archive, no lease) never measures it.
Fix: read paths decide liveness from PID plus namespace only, and report leaseVerification:'pid-namespace'. Birth identity stays reserved for lock recovery and takeover.
A reused PID can then at worst make a stale lease look active. If the other root is truly active, that gives RUNTIME_AMBIGUOUS, which fails closed.
Remove the duplicate liveness logic in the CLI by reusing inspectRuntimeRoot.
Tests:
With a live lease held by a spawned process, count child processes spawned during palace status with a child_process hook. Expect 0.
Add an MF-6 benchmark arm with an active lease.

N2 (P1): an interrupted first initialization leaves a permanent fault.

Location: the PalaceStore constructor rejects any file with size > 0 and no meta table [S].
On first start, PRAGMA journal_mode=WAL writes page 1 before BEGIN IMMEDIATE … COMMIT. A crash, kill or ENOSPC in that window leaves a schemaless file.
Every later start then throws PALACE_SCHEMA_UNSUPPORTED. The fault is sticky, and the only recovery is deleting the file by hand [I].
Fix: treat a file with zero non-internal sqlite_master objects as fresh. Keep rejecting any file that has foreign objects.
Test: create the file, set WAL mode, create no tables, close, then construct the store. Expect it to open and reach schema 1. The existing foreign-table rejection test must still pass.
Should fix, or explicitly accept, before D1 closes (P2)
#	Location	Issue
N3	palace/cli.ts main	An explicit --data-root still runs resolveRuntimeRoot first. On a host with both registries present, archive reads fail with RUNTIME_AMBIGUOUS. Skip discovery for explicit data roots.
N4	PluginHost.markFault	save().catch(()=>{}). If persisting the fault fails, the next load() overwrites the in-memory fault, and a later revision change re-activates the plugin, so the fault is no longer sticky. Set registrySavePending there too. Registry save() also lacks a POSIX directory fsync (the skill manager has one).
N5	store fallback	A crash during the fallback snapshot leaves .schema-probe-*, containing a full copy of the database plus a non-empty -wal. It is never cleaned up, and state backup then fails with SQLITE_CHECKPOINT_REQUIRED. Remove stale owned probe directories when the store starts.
N6	CLI lifecycle() faulted branch	It detects a missing entry with a regex over the error text, not by checking whether the entry file exists. It also recommends upgrade palace --bundled for manual (standalone) registrations, which switches provenance. Branch on installationSource.
N7	remediation / SKILL.md	The PALACE_UPGRADE_REQUIRED text omits "the agent must not stop the runtime". SKILL.md still says "read-only while the runtime is active" and doesn't mention that a standalone-only install has no write path. The SKILL hash is now 4e8642d4…, so the real-agent receipt (3910c44e…) is stale either way.
N8	palaceSkillQuickProbe	Looks up path.resolve keys while the ledger stores realpath / canonical-home keys. On aliased homes or prefixes this can loop on false update-available/missing [I]. Use the same canonicalization.
N9	mcp-device.ts startup reconcile	The service-profile guard exists only in the postinstall script. Starting a Windows LocalSystem service still writes the Skill into the service profile. Move the guard into reconcilePalaceSkill.
N10	ProcessDriver response for a cancelled request	A PLUGIN_* fault error that comes back from cancelled work is silently discarded. It should be treated as a fault.
—	plugins list	It now runs upgrade-intent recovery, which can roll back, even though list reads as a read-only command. Document this or move it to repair.
—	legacy lock bodies	Locks without a namespace fail closed forever, and the message gives no manual step. Add a remediation (check the PID, then delete the file).
4. Earlier P2 items

Resolved:

Recovery of an upgrade intent across namespaces.
Win32 EPERM handled as a busy lock.
PALACE_UPGRADE_IN_PROGRESS.
busy_timeout → PALACE_BUSY.
Truncation of Skill output.
--include-candidates filtering.
Equivalent sourceRoots defaults.
Refusing a symlinked database file.
Namespace check in runtimeIsActive, though N1 now replaces it.
fsync of managed evidence.
Deferred first ingest.
Retrieval ordering by bm25, then status. This settles the pre-S5 ranking decision.

Accepted as documented: the stdout/stderr split for structured CLI errors.

Still open:

Service-account handling at runtime start (N9).
The repair-required state for a permanently unsafe parent.
SKILL.md wording (N7).
ExperimentalWarning on stderr.
5. §4 evidence obligations
Obligation	Status
Linux root container: privileged install	Not executed (skipped on Windows)
Consumer tsc --noEmit against the tarball	Missing
Packed validationModule behavior	Test exists (palace-packed-validation) but was not run on a packed artifact
Same-prefix EEXIST, prefix left byte-identical	Missing
Process-isolated upgrade and rollback	D2. plugin-bundles was not run on this snapshot
Real-agent receipt, root resolution method, current Skill hash	Missing
Linux / WSL ext4 / /mnt/c	Missing for every MF
6. Evidence categories
Source correctness (reviewed): MF-1 through MF-5 and MF-6(a), plus the items listed in §3.
Executed receipts, Windows only:
Functional batch: 82 passed, 1 skipped.
Non-performance batch: 22 passed, 1 skipped.
Benchmark: FAIL.
tsc exit 0 (log not inspected).
Present in source but not run on this snapshot:
plugin-bundles (directly affected by the plugin-host changes), the Skill lifecycle, recovery and preservation suites, palace-distribution, -package-types, -packed-validation, -process-identity, state-backup, knowledge-router, the server suites, and the full d0-architecture-regressions file.
The full v12 suite must be rerun.
Historical, not re-validated: the 160/160 platform runs, 42/42 server runs, cold tarball installs, the 1,000-read stress test, the S7 24-hour soak, and the Pi/Codex Skill discovery runs. The frozen 2026-10-26 tarballs predate this source.
Later gates:
D2: fault matrix, rollback with real data, lease races.
S4: procedure validation.
S5: still FAIL (+27.75%).
D3/S6–S9.
7. Requested amendments
A1 (N1): read paths decide liveness from PID plus namespace with no PowerShell, and the CLI reuses inspectRuntimeRoot. Add the spawn-count test and an active-lease benchmark arm.
A2 (N2): a database with no user objects is treated as fresh. Add the interrupted-initialization test.
A3 (MF-6c): register the protocol before running it, keep the threshold at 20 ms, and keep both earlier runs in the record. The protocol:
At least 400 alternating pairs, analysed as paired differences. The primary statistic is the 95th percentile of the per-pair deltas, ≤ 20 ms.
A validity gate decided in advance. Example: the run is invalid, not failed and not passed, if the skip arm's p95/p50 ratio exceeds 1.5. Invalid runs are retained. At most 2 reruns are allowed, and 3 invalid runs in a row count as FAIL.
Arms for both no-runtime and active-runtime.
Run on the rebuilt candidate, with the Defender check in place.
Please confirm this protocol before running it.
A4: provide d0-architecture-regressions.test.mjs and lock-cancel-final.log (MF-6b).
A5 (MF-1 evidence): a test that runs palace status through the real Device shell tool, and a test where plugins disable palace with no flags removes the capability from the running Device. Also provide runtime-owner.ts and the shell-tool environment handling (terminal-manager.ts / improved-process-tools.ts).
A6: rerun the full v12 suite on this snapshot, then on Linux/WSL, then on the rebuilt candidate (cold installs, EEXIST, consumer tsc, packed validation, root container).
P2s N3–N10: fix each one, or accept it explicitly in writing.

D1 can reach PASS once A1–A6 are closed and each P2 has a written disposition. This is not release acceptance.

ソース