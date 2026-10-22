# Independent platform integration review

Date: 2026-10-22. Worktree: E:/git-project/agent-mcp-device-v12 on G6 desktop-b5e4iue-87cea2af. Base commit: 1df22e6bca3e4f5fa7bfd94f814c1b7409fd7848. This review used current source, isolated local fixtures and the coordinated Node 22 build. It did not read or modify production/backup runtime state on G8.

Status: all nine confirmed findings are implemented and verified on Windows Node 22.22.2 and Linux Node 22.21.0. The final runtime platform suites pass 77/77 on each OS, and the extended Device startup/shutdown/update/signal fixture passes on both. Exact final receipts are recorded below. Earlier failing runs and the passing intermediate 75-case build remain preserved as history. The final licensed package also passes cold install/server/restore acceptance on both OS. The exact artifact, final source end-to-end rerun and provenance receipts are recorded below. Production observations and deployment retain their NOT_RUN/unobserved classifications.

## Review scope and evidence

Reviewed src/platform/knowledge-router.ts, knowledge-mcp.ts, device-runtime.ts, cli.ts, activity-journal.ts and runtime-lease.ts, plus the relevant PluginHost, Device RuntimeOwner, state-backup, P1 adapter and Palace paths. The command-line entry under review is src/platform/cli.ts, not src/cli.ts.

The pre-fix executable reproduction is E:/test/mcp-device-v12-20261022/platform-review-probes.mjs, with captured results in platform-review-probes.json. It reproduced two federation failures and demonstrated simultaneous ownership through the previous independent Device IPC and server lease systems. Its RuntimeOwner fixture used a fresh evidence-root directory and released its own IPC endpoint and files before exit.

## Confirmed findings

### R1 — P1: known correction or revocation fell back to the old imported card

Original KnowledgeRouter.read caught both stat failure and refresh-read failure in one broad catch. When B reported revision 2 and A still held revision 1, an ACCESS_DENIED result from reading B's now-local-only card was converted into stale success. A read-budget failure for a withdrawn revision had the same result. In both recorded reproductions the response returned observed revision 1, labeled it stale, then invoked knowledge.import with revision 1 again. The origin had already provided evidence that the old version was no longer current.

Fix in src/platform/knowledge-router.ts:

- Only a transient failure to obtain origin metadata permits ordinary stale fallback.
- Explicit origin ACCESS_DENIED, KNOWLEDGE_NOT_FOUND and Palace's KNOWLEDGE_SCOPE_MISMATCH fail closed.
- Once newer origin metadata is known, failure to fetch that revision propagates instead of returning/importing the old body.
- A signed preview's version is a minimum, and fetched bytes must agree with an already known version/hash/status. A racing newer revision is accepted; a downgrade or same-version conflict is rejected.
- Bounded session revision guards retain the correction/denial across a subsequent offline request, and invalidate an obsolete cached body.
- servingDeviceId is normalized from the authenticated transport endpoint rather than trusted from provider-supplied card metadata.

Regression file: test/v12/knowledge-correction-guards.test.js. It covers scope revocation, correction read budget failure, subsequent offline reads, explicit origin denials, signed-reference downgrades, metadata/read races and forged serving identity. Existing test/v12/knowledge-router.test.js continues to cover same-account routing, no-Palace session cache, search/list with zero imports, selected lazy import, correction propagation, explicit offline freshness, wrong-account/tampered refs, project boundaries and response budgets.

The guards are bounded by the existing session cache lifetime and a 256-entry cap. They are not an account-wide persistent revocation service. Cached offline knowledge must still be displayed with its explicit freshness and knowledge status; the platform does not claim that unavailable origin evidence is current truth.

### R2 — P1: a server lease did not exclude a live Device-only owner

The original platform CLI acquired server-runtime.lock for knowledge, upgrade and purge operations, while Device.start owned RuntimeOwner IPC without acquiring the same state lease. The isolated probe acquired a RuntimeOwner and then successfully acquired a server lease for the same root. That allowed a second plugin host or migration to touch a Device-only provider's data.

Root owns this fix in src/platform/runtime-lease.ts, src/platform/cli.ts and src/device/device.ts. The reviewed replacement makes Device startup acquire leases for its identity root and its possibly different configured Core state root; it permits its own already-held Device IPC owner explicitly. CLI operations must fail if another owner is live or cannot be proved stopped. The parent acceptance suite owns the final bidirectional ownership/CLI checks.

### R3 — P1: origin stat did not revalidate source evidence

Palace knowledge.read checked exact source bytes, but knowledge.stat originally returned stored SQLite metadata without the same check. Federation prefers A's imported card and then checks B with stat. Consequently a source on B could be rewritten or deleted while this selected read still reported the old revision as current until background ingest reached it.

The narrow fix in src/plugins/palace/index.ts refreshes the selected card's evidence before returning stat metadata. This uses the same bounded exact-source verification as read and does not run a whole index pass. A changed or missing source produces the corrected stale revision and withdraws dependent local procedures after import.

Actual-provider regression file: test/v12/palace-platform-integration.test.js. Separate rewrite and deletion cases compose two real Palace providers with KnowledgeRouter, perform the first lazy import, change the origin file without ingest, then require the next selected read to import the stale revision and withdraw its dependent procedure. They assert that the read path did not invoke knowledge.ingest.

In these responses freshness.current means the origin's latest revision metadata was checked. A card whose source is no longer valid still has status stale and unavailable evidence; current revision metadata is not validation of the card's claim.

### R4 — P2: retained activity archives were invisible to P1

The original ActivityJournal used device-activity.jsonl.1/.2/.3. P1 directory discovery accepts final extensions .jsonl/.log/.txt/.ndjson (src/log-palace/store.ts, extensionAllowed and scanPage), so those archives were retained on disk but not discovered. Renaming the current file also changed the path behind previously indexed exact-source references.

Root's replacement in src/platform/activity-journal.ts uses immutable device-activity-<timestamp>-<uuid>.jsonl segments and retains four segments. No retained segment is renamed. The new integration fixture ingests the selected first segment, creates three further segments, re-ingests, then checks the original bytes, evidence identity/path, card version/hash and exact evidence read. It also requires all four retained observations to be discoverable and confirms that completion receipts do not activate Skills.

Intentional retention pruning remains a source-availability boundary: when a segment is eventually removed, dependent evidence must become unavailable. This is bounded capture, not unlimited raw-log retention. Journal output contains execution status and selected path metadata; it is not an assertion that a procedure or answer passed validation.

The offline knowledge CLI also originally omitted root/logs when no --source-root was provided. Root updated its default to match the platform runtime's journal root, so an explicit stopped-runtime knowledge ingest can see that runtime's captured observations.

### R5 — P2: absolute plugin entries did not survive package relocation

Plugin registry records store an absolute manifest.entry. ensureBundled originally skipped every existing id, while activate required that old entry path to exist. Restoring into a state root associated with a different package path therefore retained the plugin and data but faulted the provider. A same-package-path restore did not prove moved-package portability.

A related future-upgrade risk existed when a package replaced code at the same path: an old registry manifest could keep old version/schema/contracts while the entry loaded new bytes. The first v11-to-v12 Palace installation does not have an old Palace registry, but future package upgrades must reconcile this explicitly.

The generic PluginHost fix has six reconciliation regressions, all passing in the build11 WSL 74-case suite and in the earlier Windows build10 run. The enforced boundary is narrow: explicit bundled provenance plus identical version/schema/contracts permits entry-only rebinding to the current trusted packaged path while retaining enabled/disabled/uninstalled state and data. User-replaced manifests are not silently converted into bundled ones. A bundle version/schema/contract change must require an explicit upgrade rather than silently starting different code under old metadata.

State backup continues to preserve registry bytes and managed evidence generically. It does not rewrite arbitrary external plugin or trusted validation-module paths. Those modules remain deployment inputs and must be available through an explicit matching installation/configuration.

### R6 — P1: an ancestor backup did not prove nested runtimes stopped

state-backup acquired and checked the explicitly selected root but recursively copied descendants. For example, backing up a legacy Device root that contains a newer server subdirectory could encounter an active nested server lease. A nonempty WAL often rejected this incidentally, but a zero/checkpointed WAL is not proof that the nested writer is stopped.

The source inventory now rejects nested server-runtime.lock, runtime-control.json and plugins/registry.lock with NESTED_RUNTIME_REQUIRES_SEPARATE_STOPPED_BACKUP. It does not trust a claimed stale PID or print the control-file contents. Fully stopped nested state without coordination markers is still retained as ordinary state. Existing source rehashing, WAL rejection, symlink/traversal rejection and atomic publication into absent destinations remain unchanged.

The seventh test in test/v12/state-backup.test.js checks read-only planning and actual backup rejection for all three nested markers, verifies no destination/lease remains after failure, then verifies that fully stopped nested state is included.

### R7 — P1: plugin upgrade CLI released ownership before cleanup

The final focused shutdown review found that pluginCli acquired a lease around host.upgrade but released it in an inner finally before the outer host.close. PluginHost.upgrade correctly retains owned drivers when termination cannot be proved; stopOwnedDrivers can throw before data rollback. In that failure path the CLI nevertheless released the lease before attempting the final cleanup, allowing a competing state owner while the plugin might remain alive.

Root fixed both upgrade and purge to retain their lease through host.close, release only after successful cleanup, and print success only afterward. One regression contains four injected child cases that check lease presence during close, retention on failure and release on success. It passes in the final 77-case Windows and Linux suites. The knowledge and server CLI paths already await cleanup before releasing ownership. The new driver/host and PlatformDeviceCore/server wrappers retain failed cleanup as observable state; capability removal or a stop acknowledgement alone is not proof of resource release.

### R8 — P1: cooperative stop suppressed cleanup rejection

CooperativeDriver.stop originally cleared its instance before awaiting stop, then caught and discarded a stop rejection or deadline. PluginHost could consequently drop ownership even when the trusted plugin reported that cleanup failed. Cooperative trust does not make an explicit cleanup failure successful. The implemented fix preserves the same instance until cleanup succeeds, shares concurrent cleanup results, and permits a real retry after failure. Its regression proves that cleanup rejection remains observable and ownership is retained; it passes in the final 77-case Windows and Linux suites.

### R9 — P1: Device-only shutdown could arm update after failed cleanup

Device.shutdown originally caught a rejected Core close and returned success; subsequent calls returned immediately because isShuttingDown was already true. The preserved remote-update afterReply path awaited shutdown, then signaled the update helper and exited successfully. Thus unproven plugin cleanup could still allow package replacement. Signal handlers likewise treated the swallowed rejection as successful shutdown.

Device.shutdown now propagates a shared pending cleanup result, retains ownership on failure and permits a real subsequent retry. Update handoff stays unarmed until cleanup succeeds. Failed signal shutdown sets exitCode=1 without forcing process exit; a later signal can retry. RuntimeOwner contains its async onStop rejection: its early response means an authenticated request was accepted, while acquireRuntimeOwner separately polls for actual release. Cleanup failure is logged and retains the endpoint. The real-IPC maintenance case proves failed stop retains ownership and takeover waits then rejects. The final Windows/Linux 77-case suites and extended startup/no-child fixtures verify these paths.

## Invariants confirmed by source review

The platform knowledge boundary does not import Palace. TrustedToolContext comes from the authenticated wrapper, and AsyncLocalStorage retains the actual account/session during asynchronous routing. Device listing and every call still pass through the wrapper's owned-device broker and caller policy. Public arguments cannot override the trusted account. Knowledge read references use the persisted runtime HMAC key and an account-bound payload.

The public tools expose knowledge.search/list/read. Generic capability.call rejects knowledge.* so it cannot expose knowledge.import as an arbitrary client operation. Search and list use compact previews, perform no import, apply project/local visibility before returning items, and route to a bounded relevant subset. Selected read checks identity, scope and the full response byte budget before invoking internal import. A requester without a knowledge plugin still reads shared knowledge through the bounded session cache and never receives an import call.

Device Core remains independent of Palace and account enrollment. The platform wrapper supplies plugin/distribution policy while native dispatch remains in the existing shared Core. Core invokeNative enforces its own closed-state guard. Plugin faults preserve native availability; generic host lifecycle and dependency-service behavior are covered by the Device agent's acceptance suite.

Backup preserves unknown plugin files and managed evidence together with identity, gateway.sqlite, account/OAuth/pairing state and the reference key. External secrets/configuration outside explicitly selected roots are not implicitly copied. Its SHA-256 manifest provides integrity checking, not a claim of cryptographic publisher authentication. Restore remains restricted to a new absent root, leaving source and prior backup copies available for rollback.

## Acceptance receipts

- Baseline reproduction: E:/test/mcp-device-v12-20261022/platform-review-probes.json.
- Build08 router run: knowledge-review-win.log, 12/12 passed on Windows Node 22.22.2; knowledge-review-wsl.log, 12/12 passed on Ubuntu Node 22.21.0. The additional explicit KNOWLEDGE_SCOPE_MISMATCH case was added afterward and passed in the build10 combined runs below.
- Prior provider/process/backup acceptance remains in palace-all-win.log (23/23) and palace-final-wsl.log (21/21). Those receipts predate this review's additional cases and are not presented as validation of the new source changes.
- Build10 final owned scope: all 38 cases passed in the Windows aggregate receipt platform-final-win-build10.log (overall 73/74; the sole failure was generic process dependency cancellation, outside these 38). The preserved exit receipt is platform-final-win-build10.exit. The Device agent repaired that ordering race before the final package build.
- The same 38 cases passed under Ubuntu Node 22.21.0 in 5.098 seconds, with zero skipped/failing tests: E:/test/mcp-device-v12-20261022/palace-review-final-wsl.log. They ran against an immutable dist/test copy at palace-review-snapshot-build10; source-state.json records ten source/compiled SHA-256 values and the copy time 2026-10-22T04:30:34.264Z. The six files executed were palace-provider, palace-process, palace-platform-integration, knowledge-router, knowledge-correction-guards and state-backup test files under test/v12.
- Final build11 WSL platform suite: 74/74 PASS, zero failures/skips, 22.575 seconds. Receipt: E:/test/mcp-device-v12-20261022/wsl-build11/platform-all.log, with build-snapshot.json in the same directory. This includes all six generic bundle-reconciliation cases and the four-request dependency shutdown regression. The Windows build11 aggregate rerun in platform-final-win-02.log failed its process dependency cancellation cleanup hook with EBUSY while removing the waiter plugin data directory. That failed receipt is retained. Subsequent driver/host/wrapper cleanup fixes passed platform-final-win-03.log: 75/75, zero failures/skips/cancellations, 24.566 seconds. R7-R9 were found after that build and are covered by the final receipts below. The failed and intermediate runs remain historical evidence; no production deployment is implied.

## Final runtime checkpoint

- Windows Node 22.22.2: E:/test/mcp-device-v12-20261022/platform-final-win-04.log and platform-final-win-04.exit. All 77 cases pass; zero failures, cancellations or skips; exit 0; 34.042 seconds.
- Windows extended Device startup/cleanup fixture: E:/test/mcp-device-v12-20261022/startup-final-win.log and startup-final-win.exit, exit 0. It verifies distinct runtime IDs, zero legacy child spawns, repeated uninitialized shutdown, and ownership across update/signal cleanup failures. The word extended describes the fixture; it is not part of the filename.
- Linux Node 22.21.0: E:/test/mcp-device-v12-20261022/wsl-build13/platform-all.log. All 77 cases pass; zero failures, cancellations or skips; 20.780 seconds for the platform suite. build-snapshot.json records the immutable snapshot and compiled fingerprints, copied at 2026-10-22T04:57:13.000Z.
- Linux Core comparator and extended startup/no-child checks also pass: wsl-build13/core-runner.log and wsl-build13/nochild-runner.log. The full Linux snapshot/test orchestration took 55.54 seconds; this is distinct from the platform suite duration.
- Final source server end-to-end rerun: E:/test/mcp-device-v12-20261022/server-e2e-final02-win.log and server-e2e-final02-win.exit, 18/18 PASS, zero failures/cancellations/skips, exit 0, 57.958 seconds.
- Final imported-source provenance verification: specs/008-v12-platform/server-provenance-test.log, PASS for all 457 imported files, including matching candidate and source raw captures. This was rerun after final end-to-end execution and license copy.


## Final isolated distribution acceptance

Validated runtime commit: 532f0f1369105b01354507a98e45a8c652f9e75b. Final artifact: E:/test/mcp-device-v12-20261022/package-final03/hcu-lab.me-mcp-device-1.0.12.tgz. SHA-256: 134e46e6487fc6900c2c4fd94b4184a034784936ba7d2626630c69ca82a043a0. Size: 2,121,956 bytes; 738 files.

E:/test/mcp-device-v12-20261022/license-repack.json records PASS: all 737 pre-existing archive entries retain identical bytes and modes; the only added entry is package/control-plane/scripts/GATEWAY-LICENSE.txt. No entry was removed or changed, so the final licensed archive preserves the tested runtime payload.

| Gate | Result | Receipt |
| --- | --- | --- |
| Windows cold installed package | 1/1 PASS, zero failures/cancellations/skips, exit 0, 10.449 seconds | E:/test/mcp-device-v12-20261022/cold-server-final-win.log and cold-server-final-win.exit |
| Linux cold installed package | 1/1 PASS, zero failures/cancellations/skips, exit 0, 11.789 seconds | E:/test/mcp-device-v12-20261022/cold-linux03/server-package-cold.log and server-package-cold-receipt.json |

Both runs use the exact licensed SHA above and install production dependencies from the tarball. They execute the CLI server, preserve paired identity and OAuth refresh through backup/restore, load Palace by default, and verify exact evidence after restoration. Linux install-receipt.json independently records that artifact SHA and Node 22.21.0.

The final acceptance records no remaining 8104 listener on Windows or WSL after the isolated fixtures. No G8 production/backup runtime was exercised or deployed. The production-unobserved and NOT_RUN entries in ACCEPTANCE.md and the parity matrices remain unchanged; these passing distribution gates do not relabel those environments as tested.
