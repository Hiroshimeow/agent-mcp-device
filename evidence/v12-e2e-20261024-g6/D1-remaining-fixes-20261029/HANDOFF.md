# D1 remaining N5–N9 fixes + isolated A5 — 2026-10-29

## Authority / checkout / preservation

- This milestone implements the user's bounded N5,N6,N7,N8,N9 request plus feasible A5. One source/test/doc writer; one read-only final reviewer. It does **not** authorize a release, rebuild, rollout or premature GitHub push.
- Actual checkout: `E:/git-project/agent-mcp-device-v12`, HEAD `18407ec562c4f2cc11ca3e8c1f69f362ee3f86c0`, branch `feat/v12-platform-20261022`, account `desktop-b5e4iue\\admin` on `DESKTOP-B5E4IUE`.
- Before edits: 23 tracked modified + 249 untracked entries + 339 ignored entries in short-status grouping. Inherited lifecycle stable-source manifest SHA256 `5b9ed04d0e5efc9ac5865c7a1f9fcbe097ea663eadd4fef2cef35b3308e556b5`; **zero inherited manifest drift**. See `identity-inheritance.json`.
- Read AGENTS, STATUS, original external handoff, D1 review-fixes handoff/disposition/extracted review and lifecycle handoff; inspected actual source rather than directly applying reports. N4/N10 remain prior-owner work, not newly claimed here.
- Fresh process CWD checks before/after: production PID2088 remains the global installed service at `C:/Users/admin/.mcp-device/runtime/`; coordinator46016 and writer31152 are in this checkout. No production process was stopped or reloaded. See `process-cwd-before.json` / `process-cwd-after.json`.
- `source-before.json` hashes 419 source/test/script/Skill/doc/config files. Final manifest hashes420: **8 existing files changed + 1 new regression file, 411 inherited files unchanged, none removed**. See `changed-files.json` and `stable-source-manifest.json`. Final short status grouping is23 tracked modified +251 untracked entries (new regression + evidence milestone directory).
- No reset/clean/stash/commit/push/tag/publish, packaging/candidate rebuild, root `dist` build, M365, benchmarks/performance suite, production/live8101–8104 or G8-device operations. Identity/SQLite writes occurred only in disposable test fixtures; live identity was not changed. Coordinator sequencing/review bridge remains with the coordinator.

## Implemented

| Item | Actual change | Evidence |
|---|---|---|
| N5 | `src/plugins/palace/store.ts`: private fallback snapshots now record version, exact directory basename, PID and namespace before copying. Subsequent store open reclaims only well-formed owned snapshots with provably dead same-namespace PID and expected contents. Active/reused PIDs, unowned paths, symlinks, malformed/foreign ownership and unexpected contents are preserved. | Child exits during real snapshot copy; next observer deletes crashed snapshot, retains active peer/unowned path, rejects unsupported schema, hashes durable main/WAL unchanged. Existing WAL recovery/fallback functional cases remain green. |
| N6 | `src/plugins/palace/cli.ts`: inspect registered absolute entry with filesystem `statSync`, not error-text regex. Missing distribution entry recommends bundled upgrade; missing manual entry recommends restoring/reviewing its manifest, never substituting bundled distribution. An existing entry with unrelated ENOENT recommends inspecting inputs then enable. Following stat semantics preserves a valid entry alias. | New distribution/manual/existing-entry tests; old tests updated to delete actual entry and preserve declared manual provenance. |
| N7 | Shared operator-only stop warning also accompanies `bundleUpgradeRequired`. Skill wording distinguishes no knowledge/durable main/WAL mutation from permissible SQLite SHM read marks; no zero-filesystem-write promise. | Explicit upgrade warning and Skill wording tests. Skill SHA256 `e8fadc2ac80b686039119a73ae4dd1dfd71030161fe09d2ea316c9323a605952`. |
| N8 | `src/plugins/palace/skill-manager.ts`: quick probe resolves package realpath and canonicalizes home through existing ancestors, matching full context. It remains bounded ledger-only, observational: no recursive target hash, owner scan, write, or process-birth subprocess. | Package/home alias agreement plus existing metadata-probe functional test. |
| N9 | `reconcilePalaceSkill` now applies the same Windows SYSTEM/LOCAL SERVICE/NETWORK SERVICE automatic skip as postinstall **before context/ownership writes**. Explicit `force` and `MCP_DEVICE_INSTALL_SKILLS_FORCE=1` remain available. | All three profiles leave absent test home absent; explicit/forced cases pass; existing postinstall/service coverage passes. |
| A5 | Extended `test/v12/device-cold-local.test.mjs`: real isolated MCPDevice/Core/PluginHost and `shell_execute` adapter, disposable home/config, local command shims pointing only to isolated compile. Ingest fixture, then `palace status`, search/read, **`mcp-device plugins disable palace` with no runtime-dir/data-root flags**, then `palace status` => `PALACE_DISABLED`. Also verifies knowledge capabilities disappear and old provider child exits; native capabilities/fixture identity retained. | Final enabled/disabled/faulted3/3, enabled repeat1/1; command/transport receipts in TAP logs. Gateway transport is inert; no TCP listener or live Gateway acceptance claimed. |

## Test-first sequence and commands

All commands from repository root unless receipt says otherwise. The initial isolated compile was before fixes. Only positive anchored **functional allowlists** were executed; no negative exclusion pattern or whole-suite run.

1. Red compile (exit0):
   ```powershell
   node node_modules/typescript/bin/tsc -p tsconfig.json --outDir .tmp/d1-remaining-20261029/dist --declaration false --sourceMap false
   ```
   `logs/tsc-red.log`.
2. Stage fixtures/tests, then new regressions against inherited compiled source (exit1; **1 pass, 10 fail**, 11 total):
   ```powershell
   node .tmp/d1-remaining-20261029/stage-tests.cjs
   node --test --test-concurrency=1 --test-name-pattern='^(fault remediation|unrelated ENOENT|upgrade-required remediation|Skill guidance|quick probe canonicalizes|automatic Skill reconcile|explicit Skill install|crashed owned schema)' .tmp/d1-remaining-20261029/test/v12/d1-remaining-regressions.test.mjs .tmp/d1-remaining-20261029/test/v12/palace-wal-recovery.test.mjs
   ```
   `logs/red.log` records actual assertion failures for cleanup, remediation, Skill wording, aliases and service guards. Existing explicit/forced case is the passing control.
3. Apply minimal fixes, isolated recompile (same tsc command), restage and repeat same positive command: exit0, **11/11** (`logs/tsc-green.log`, `logs/green-first.log`).
4. Fresh final source after simplify/static correction:
   ```powershell
   node evidence/v12-e2e-20261024-g6/D1-remaining-fixes-20261029/verify.cjs
   git diff --check
   ```
   All exits0. `verification-commands.json` records exact executable/arguments/CWD/start/timeout/status for final tsc, staging, functional58/58, A5 modes3/3 and enabled repeat1/1. `verify.cjs` is the exact positive allowlist runner; the final compiler outDir is `.tmp/d1-remaining-20261029/dist` only. `logs/diff-check.log` empty, exit0.

To reconstruct ignored staging helper, copy this evidence directory's `stage-tests.cjs` to `.tmp/d1-remaining-20261029/stage-tests.cjs` (create its directory first), then run `verify.cjs` from repository root. Parent `node_modules` supplies dependencies; no install or package build is required. `stage-tests.cjs` copies package metadata, Skills, tests/helpers and the existing postinstall script only into the disposable stage. Root `dist` is not the test import target.

### Preserved failed / diagnostic attempts (not acceptance)

- First A5 enabled attempt (`logs/a5-first.log`) hit its40s child watchdog during startup after `Connecting directly ... http://127.0.0.1:1/`; no success asserted. Stage diagnostics were added, not the bound widened. The next diagnostic run and both final A5 executions passed. Cause of the isolated first delay was not established; retained as a transient limitation rather than hidden.
- Initial broad **functional allowlist**, not a perf suite, had58 selected tests with two postinstall fixture failures because the stage omitted `scripts/v12/install-palace-skill.cjs`. `logs/functional-stage-missing-script.log` and `verification-stage-missing-script.json` retain that failed attempt. Copying the existing script into isolated staging fixed the harness omission; final58/58 passed.
- `logs/entry-alias-red.log` is a discarded diagnostic test: Windows file-symlink privilege unavailable, **0 pass / 1 skip**. It is not red/green acceptance. That experimental test was removed; production entry inspection uses stat's normal target-following semantics. Directory junction aliases are exercised by N8 and passed without a skip.

## Final static review / boundaries

- Read-only reviewer `del_mvtni5qj_b0jj`, exit0: **no concrete correctness/safety blockers** in bounded delta. Full result in `review-final.md`; reviewer did not edit or rerun tests. Writer independently read final source and simplified nested remediation selection without changing behavior, then reran final verification.
- N5 cleanup is deliberately conservative: abandoned unknown/foreign/live-PID snapshots may remain; no prefix-only arbitrary deletion, no claim to reclaim pre-marker or legacy unowned directories. Native ACL/mount fallback failure is simulated at the SQLite boundary; snapshot I/O, killed child and active-peer preservation are real.
- N9 service-account tests simulate platform/account values, not a native service-token installation.
- N8 is ledger-only, not an installed-byte integrity claim. New Skill bytes are hashed here, not installed into any live agent home.
- A5 is **isolated local Device shell acceptance**, not Gateway authentication, packaged install, Linux parity, live rollout or package-artifact acceptance. Disposable enrollment fixture creation is not live identity mutation.
- **Authoritative MF6 remains30.1605ms, FAIL**. No fresh performance measurement was run. Prior artifact/review/acceptance receipts are not magically revalidated for changed source/Skill bytes. No new candidate was built; release remains blocked/pending coordinator-owned next gates.

## Files / evidence

Milestone delta: `src/plugins/palace/{store,cli,skill-manager}.ts`, `skills/palace-cli/SKILL.md`, `test/v12/{d1-remaining-regressions,d1-closure-regressions,d1-opus-round2-regressions,device-cold-local,palace-wal-recovery}.test.mjs`. Exact before/after SHA256 values are in `changed-files.json`; complete final tracked/untracked source hashes in `stable-source-manifest.json`. `evidence-manifest.json` hashes milestone evidence (excluding itself).

**Next owner:** consume this source manifest and handoff; coordinator manages sequencing/review bridge and any later release authorization. Do not rerun perf, rebuild candidate, touch live devices or publish as a side effect of this completed bounded milestone.
