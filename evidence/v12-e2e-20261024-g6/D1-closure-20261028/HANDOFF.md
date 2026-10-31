# D1 closure handoff — 2026-10-28, G6

## Verdict and authorization

**RELEASE_BLOCKED_WITH_EVIDENCE. D1 remains AMEND; MF-6 performance is FAIL, not accepted.** This is a coherent tested source milestone, not a candidate release or independent signoff.

The operator authorized continuation as sole source/test writer, preserving all WIP, with test-first fixes and unique compilation outputs. The resumed run specifically required retention of the final **30.1605 ms > 20 ms** failure, diagnostic localization before optimization, enforced Defender preconditions, and an honest blocker if no justified fix emerged. No M365 submission, candidate rebuild, A/B execution, commit, reset, clean, stash, push, tag, publication, production identity/SQLite mutation, or live G6/G8 change was performed. The other worker's `.tmp/ab-v2-consolidated-20261027` directory was not edited.

## Exact checkout and stable snapshot

- Repository: `E:/git-project/agent-mcp-device-v12`
- HEAD: `18407ec562c4f2cc11ca3e8c1f69f362ee3f86c0`
- Branch: `feat/v12-platform-20261022`
- Environment: Windows G6, Node `v22.22.2`.
- Working tree remains intentionally dirty: final pre-handoff inventory recorded **23 tracked dirty files and 1,112 untracked entries**. This includes inherited WIP and evidence, not 1,135 changes made by this task. Ignored state is separately retained.
- Exact current source: `source-manifest.json`, 263 files covering `src/`, `scripts/`, `skills/`, `test/v12/`, package/lock/TypeScript configuration, repository contract and relevant status/guide docs. SHA-256: `4ecfc0343e767ac34651de7d06fb68e09a16e3720e854348febdfce8429701b2`.
- Private source-only archive: `E:/git-project/agent-mcp-device-v12/.tmp/d1-resume-20261028-0040/source-snapshot.zip`, SHA-256 `dbd5579efe6d427e87cf2087763ceb9d09e01ad078c2f07aedcdf92aa72c044a`. This is a source backup, **not an npm package or rebuilt candidate**.
- Current-source compiled output: `.tmp/d1-resume-20261028-0040/dist/`. Tests ran from this isolated root, using mirrored assets/tests and ancestor dependencies. Root `dist/` and frozen candidates were not overwritten.
- Full git/ignored/diff/process inventories are private under `.tmp/d1-resume-20261028-0040/`: `git-before.txt`, `git-final.txt`, `git-ignored-before.txt`, `git-ignored-final.txt`, `wip-before.patch`, `wip-final.patch`, `source-before.json`, `process-before.json`, `process-final.json`, `process-cwd.json`, `listeners-before.json`, `listeners-final.json`. Do not submit raw process inventories as review attachments without checking for private arguments.
- Read-only actual process CWD observation: global Device PID 2088 was in `C:/Users/admin/.mcp-device/runtime/`; active Pi PID 46016 and children were in this checkout. No listener on 8101–8104 appeared in the local start/end observations; this is not a claim about remote G8 or a reason to start/reload anything.

## Changes owned by this task

The first interrupted run's tracked-diff comparison is copied as `prior/wip-preservation-comparison.json`. It identifies changes to the four tracked files below, not all inherited dirty source. New test files are hashed in `source-manifest.json`.

1. `src/platform/plugin-host.ts`: a deferred registry save which conflicts with a newer disk revision now reloads/reconciles newer external intent instead of returning forever. External disable/uninstall withdraws capabilities and stops the old child. Faulted providers are excluded from dependency candidates, activation refuses faulted records, and refresh also stops an externally faulted record. Explicit enable remains the recovery policy.
2. `src/plugins/palace/cli.ts`: missing-entry upgrade remediation requires stopping the runtime and explicitly says the agent must not stop it. Read-only metadata observation honors the skip-install setting even on lifecycle errors; no ledger mutation is introduced.
3. `docs/v12-platform.md`: documents sticky startup/refresh/dependency faults, explicit provider/dependent enable, and stopped-state upgrade prerequisites.
4. `test/v12/plugin-services.test.js`: adapts the old cycle regression to the deliberately sticky dependency policy. It now expects `CAPABILITY_DEPENDENCY_MISSING` when the only fallback is faulted, asserts that it remains faulted, and proves explicit provider/middle/leaf recovery restores capabilities. It does not auto-enable a faulted dependency to reach the previous cycle error.
5. `test/v12/d1-closure-regressions.test.mjs`: four new focused regressions for external disable/uninstall after pending persistence, sticky dependencies, and stopped-runtime remediation.
6. `test/v12/d1-opus-round2-regressions.test.mjs`: actual installed-layout current-source fixture under `node_modules/@hcu-lab.me/mcp-device`, no source directory and no forced development probe; 200 fresh CLI processes per arm, alternating order, normal `present-recorded` vs skip `disabled`, ledger-only observational metadata and byte-identical ledger assertions. Fixed threshold remains **20 ms**. This is installed-layout behavioral evidence, not tarball closure acceptance.
7. `test/v12/palace-wal-recovery.test.mjs`: killed-writer, schema rejection, main/WAL durable invariants, concurrent readers, private recovery fallback/space and bounded compatible startup coverage. SHM is not treated as durable data. Some fallback/error conditions use test injection and are not a substitute for cross-platform filesystem evidence.
8. `test/v12/device-cold-local.test.mjs`: real compiled MCPDevice/Core/PluginHost under disposable homes, enabled/disabled/faulted states, plain CLI plus actual Device shell execution, external disable/child exit and disposable identity-byte preservation. Only GatewayChannel is inert; TCP listeners are explicitly rejected by the fixture. It is **not** a full cold tarball `mcp-device start` against a real fixture gateway.
9. Resume-only changes: `test/v12/helpers/defender-context.mjs`, `test/v12/defender-context.test.mjs`, and helper wiring in the installed benchmark. Windows now fails closed **before timed samples** unless Defender AV and real-time protection are observable `true` and `DisableRealtimeMonitoring` is `false`. Unknown exclusions remain unknown. The query is outside timed samples. No production code was optimized in the resumed attempt.

The resume comparison confirms all eight previously recorded session files are unchanged except `test/v12/d1-opus-round2-regressions.test.mjs` for the Defender guard wiring (`resume/prior-session-files-comparison.json`). The two new helper/test files are separately in the manifest.

## Test-first evidence and final validation

Commands are recorded in `prior/verification-commands.ps1` and `resume/verification-commands.ps1`; logs below are copied into this durable evidence directory. Expected results are distinguished from actual outcomes; earlier failures remain retained.

| Check | Expected | Actual / log |
|---|---|---|
| Four lifecycle regressions before source fix | Observable failure | exit 1, 0 pass / 4 fail; `prior/red-lifecycle.log` |
| Same tests after host/CLI fix + isolated tsc | 4 pass | exit 0, 4 pass; `prior/green-lifecycle.log` |
| Installed benchmark assertion-first | Reject development-checkout early return | exit 1; `prior/red-installed-probe.log` |
| First installed-layout benchmark | 200/arm; marginal p95 <=20 ms | earlier 18.5645 ms; `prior/green-installed-probe.log`, `prior/installed-probe-receipt.json`; **not the final acceptance result** |
| Final original reviewer matrix | All mandatory tests pass | exit 1, 16 pass / 1 performance fail / 1 symlink privilege skip; `prior/final-reviewer-matrix.log` |
| Killed-writer/recovery tests | 6 pass | 6 pass; `prior/wal-green.log`; initial test setup failure retained in `prior/wal-first.log` |
| Cold local Device tests | 3 pass, each startup <=15 s | 3 pass; `prior/cold-final.log`; earlier fixture and teardown failures retained in `prior/cold-first.log`, `prior/cold-second.log`, `prior/cold-green.log` |
| Earlier broad functional selection | All pass | initial failures preserved in `prior/final-focused.log`; scoped corrected run 79 pass / 1 skip in `prior/final-focused-green.log` |
| Defender guard before implementation | Reject bad observations | exit 1, 2 pass / 1 fail (`Missing expected exception.`); `resume/defender-red.log` |
| Same Defender tests after implementation | 3 pass | exit 0, 3 pass; `resume/defender-green.log` |
| Actual live Defender precondition | Observable active protection | exit 0; `resume/defender-live-precondition.json` |
| Final current-source compile | tsc exit 0 | exit 0; `resume/tsc-final.log` |
| Final functional batch, 14 named files | No functional failures | exit 0, **82 pass / 1 skip**, 83 total; `resume/functional-final.log` |
| Final non-performance matrix + probe protections | No failures; do not rerun benchmark | exit 0, **22 pass / 1 skip**; `resume/nonperformance-final.log`; performance case deliberately deselected, not counted as passing |
| Registry 200 no-retry iterations, absent-owner intermediate state, original cancellation deadline | Three assertion-bearing matches pass | exit 0; `resume/lock-cancel-final.log`: 3 matching tests pass plus one empty filtered-file subtest reported by Node (4 total is **not** four assertion-bearing tests) |
| Diff whitespace / benchmark JS syntax | exit 0 | both exit 0; `resume/diff-check.log` contains line-ending warnings only |

Final functional skip: privileged Unix/root installation test is skipped on Windows. Final non-performance skip: Windows file-symlink privilege unavailable. These are **not 0-skipped or cross-platform acceptance claims**. Batch counts overlap and must not be added as a distinct-test total.

The old broad run failed the v11 precondition with `Set DEVICE_PARITY_BASELINE_REPO to the verified original checkout (never silently substitute candidate)`. It also exposed the now-documented sticky policy expectation mismatch (`CAPABILITY_DEPENDENCY_MISSING` vs prior `CAPABILITY_CYCLE`). The original log remains intact; the scoped functional pass does not close v11 parity. No fake baseline or candidate-as-baseline substitution was used.

## Performance: retained failure and labelled diagnostic

**Authoritative final installed 200/arm result remains FAIL:**

- normal p95: **362.1103 ms**
- skip p95: **331.9498 ms**
- marginal difference: **30.1605 ms**, required **<=20 ms**
- exact failure: `actual CLI probe p95 incremental overhead 30.16 ms exceeded 20 ms`
- raw samples and unchanged-ledger evidence: `prior/final-installed-probe-receipt.json`.

The earlier 18.5645 ms run is preserved, not selected over the final failing result. The resumed attempt did **not** rerun the unchanged acceptance benchmark for another chance at green, alter the threshold, change arm work, add a shared baseline/cache shortcut, or weaken ledger protections.

Following the completed investigator's recommendation, `resume/diagnose-probe.mjs` instrumented **only a temporary installed copy** of the current compiled CLI/skill-manager. It ran 200 fresh processes/arm with per-stage timing and installed/ledger assertions. `resume/diagnostic-receipt.json` is explicitly **INSTRUMENTED DIAGNOSTIC ONLY; NOT ACCEPTANCE** and includes all raw stage samples.

Diagnostic normal-arm p95 spans: whole process 282.9010 ms; package identity 2.6560 ms; total quick probe 9.5583 ms (ledger stat 1.9240, read 2.6125, parse 0.1709, validate 4.0367 ms); runtime-root discovery 8.1259 ms; remaining CLI 9.3708 ms. Skip total quick probe p95 was 0.9677 ms and whole process 280.8742 ms. Stage percentiles **cannot be added/subtracted as causal components** of the independent whole-process p95. Most observed wall time is outside instrumented body spans; the diagnostic does not isolate a stable 10.1605 ms avoidable regression or establish a safe production optimization. The prior failed run was not internally instrumented, so its tail cannot be causally attributed after the fact. That is the exact technical blocker, not a passing latency claim.

Defender observations: AntivirusEnabled=true, RealTimeProtectionEnabled=true, DisableRealtimeMonitoring=false; product `4.18.26090.9`, signatures `1.461.224.0`. Exclusions returned `N/A: Must be an administrator to view exclusions`; **exclusions are UNKNOWN**, not absent. The new guard is a pre-sampling observation, not continuous attestation. Guard failure tests include unavailable query, malformed JSON, disabled and indeterminate values. Read-only focused reviewer `del_mvquw3ao_7b8p` found no actionable guard defect; `resume/defender-focused-review.md` is static review only, **not M365 D1**. Completed investigator/recovery reports were consumed rather than repeating broad exploration.

## Remaining gates and evidence limitations

| Gate | Current disposition |
|---|---|
| D0 | Historical PASS; no new review |
| D1 | **AMEND; MF-6 performance FAIL; no new Opus submission/signoff** |
| D2 / D3 | Pending |
| S0 | BLOCKED: complete production/baseline evidence not established here |
| S1 | BLOCKED: current dirty source is not rebuilt final package; D1 pending |
| S2 | BLOCKED: local functional progress only; prior 1,000-read evidence is historical |
| S3 | BLOCKED: local cold shell checks are not fresh real-agent/Skill-hash acceptance |
| S4 | BLOCKED: independent validation still pending |
| S5 | Historical FAIL (+27.75% treatment tokens); no new A/B run authorized |
| S6 | BLOCKED: verified v11 parity precondition and cross-platform/package evidence remain |
| S7 | Historical 24h PASS (81,395 checks); **not rerun on this source snapshot** |
| S8 / S9 | BLOCKED; no production rollout/release |

MF-1–MF-5 have additional local behavioral coverage and focused fixes, but they are not independently accepted across Windows NTFS, Linux and WSL ext4 + /mnt/c. MF-6's absent-owner and 200 no-retry checks pass locally; its installed CLI performance requirement remains failed. New WAL/cold tests extend coverage of existing source behavior and do not invent historical red-before-fix receipts for source written before this session.

Still required by the original Opus contract: final-platform red/green evidence on the required OS/filesystems; root Linux privileged-install receipt; consumer `tsc --noEmit` against the actual tarball; behavioral validationModule trust boundary against packed plugin.js; same-prefix standalone EEXIST/byte-identical receipt; process-isolated upgrade/fault/rollback coverage; real-agent receipt with explicit runtime-resolution method and updated Skill hash where applicable; disposition of remaining P2 findings. Existing related evidence is not automatically acceptance for this snapshot. Preserve Device/Gateway separation and do not merge unrelated Gateway Context work.

## Smallest safe continuation

1. Verify actual root/HEAD/branch/process CWD and current hashes against `source-manifest.json`; preserve intervening WIP. Read `docs/STATUS.md` and this handoff first. No second source writer.
2. Keep MF-6 failed. Before another acceptance run, establish a reproducible owner-specific latency mechanism (for example process-launch/module-startup versus ledger validation) with a separately labelled diagnostic on equivalent host conditions. Do not tune by repeatedly rerunning the holdout benchmark, infer a fix from independent stage p95s, remove safety validation, or charge common work asymmetrically to the skip arm.
3. If an actual product defect is isolated, write its smallest failing regression before modifying source; verify red/green and existing lifecycle/ledger/WAL/cold regressions. Then run exactly the unchanged installed 200/arm 20 ms benchmark with the enforced Defender gate and retain every outcome. Unknown exclusions need explicit receipt/limitation, not an invented claim.
4. If no justified fix emerges, submit the stable failed milestone and diagnostic through the **exclusive M365 bridge owner later**, requesting disposition rather than pretending D1 PASS. This session has not sent anything.
5. No candidate rebuild or new A/B execution until independent D1 PASS and the applicable authorizations. Historical frozen artifacts remain unchanged and are not the source snapshot archive.
