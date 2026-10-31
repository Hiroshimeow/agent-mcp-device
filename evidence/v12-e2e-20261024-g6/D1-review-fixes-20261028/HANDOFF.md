# Terminal handoff — D1 read/init source milestone, 2026-10-28

## State and authority

Current-user-authorized autonomous continuation; sole source/test writer session `del_mvrbs779_bgcp`. D2/D3 worker `del_mvrbsizz_zwsr` owns only its isolated draft; advisory worker `del_mvrbsvru_mnme` is read-only. This milestone is finished; the larger D1/feature work is **not** finished. No commit, candidate rebuild, packaging, M365 submission, live 8101–8104/G8 contact, production reload, identity mutation, stash/reset/clean/push/tag/publish or frozen-artifact overwrite was performed by this writer.

Actual checkout `E:/git-project/agent-mcp-device-v12`, branch `feat/v12-platform-20261022`, HEAD **18407ec562c4f2cc11ca3e8c1f69f362ee3f86c0**. Substantial inherited dirty/untracked/ignored WIP was preserved. `logs/git-before.txt`, `logs/git-ignored-before.txt`, `logs/wip-before.patch`, `logs/process-before.json`, and `logs/process-cwd.json` preserve pre-edit verification. Process/CWD inspection recorded runtime PID2088 at `C:/Users/admin/.mcp-device/runtime/`, and repo-local PIDs46016/44948/50480/50508. No claim those PIDs remain live. Reverify actual processes and ownership before new changes. Git HEAD diff includes prior writers' work and must not be represented as this writer's patch.

## Implemented, test-first

1. **N1:** observational runtime-root inspection uses PID liveness + namespace, not Windows PowerShell processBirth. CLI shares that inspection. Reports `leaseVerification: 'pid-namespace'`; unreadable/malformed/foreign owner remains indeterminate; reused PID may conservatively appear active. Mutation/takeover paths still require their own stronger owner checks. Regression creates a child owner and hooks every child_process spawn/exec/fork API to throw; CLI status succeeds with active=true and writePath=null.
2. **N2:** startup can resume an interrupted initial WAL database with an empty non-internal catalog, instead of permanent PALACE_SCHEMA_UNSUPPORTED. Foreign schema/version refusal remains. Follow-up local reviewer exposed SQL LIKE underscore wildcard: now use literal-prefix `NOT GLOB 'sqlite_*'`, with `sqliteXforeign` rejection and main-byte preservation regression.
3. **N3:** explicit archive data root no longer triggers unrelated ambiguous home runtime discovery. Known managed-path lifecycle checks remain. Test builds two ambiguous home registries and verifies archive status succeeds.

Exactly four source/test files changed by this writer; final bytes/hashes are in `changed-files.json`. `writer-source-operations.json` preserves all six actual write/edit operations, distinguishing incremental changes from inherited WIP. Source hashes:

| Path | SHA-256 |
| --- | --- |
| `src/platform/runtime-root.ts` | `92f816aff464174a9718af7a7cbf99ab07fcdc01a9f3c2bb802f210c1497abe8` |
| `src/plugins/palace/cli.ts` | `d16f99897596de1846ca2b93f736bcfa88bf136fc8157cdc9c57ff9f580d08e6` |
| `src/plugins/palace/store.ts` | `2eb29b42afbf222c7b478e9636f74cf31cb9bf4eede3916ff3d786a571860945` |
| `test/v12/d1-read-init-regressions.test.mjs` | `b5d0a2967cb4109987737095dd9dc935723fcde5ad167ed8bca9a602ac893782` |

## Red/green evidence and exact commands

Working directory for commands below: repository root. `$d='.tmp/d1-review-fixes-20261028'`. Isolated package.json/skills/test fixtures copied there, TS compiled to `$d/dist`; **root dist not mutated**. Retained logs copied to this directory's `logs/`. `verification-commands.json` preserves the exact original shell invocations, including setup.

| Stage / expected | Exact substantive command | Actual |
| --- | --- | --- |
| Initial compile | `node node_modules/typescript/bin/tsc -p tsconfig.json --outDir "$d/dist" --listEmittedFiles false` | exit0, `tsc-red.log` |
| RED before N1/N2/N3 | `node --test "$d/test/v12/d1-read-init-regressions.test.mjs"` | exit1, 0 pass/3 fail, `red.log` |
| GREEN after fixes, compile again | same compile then same test | exits0/0, 3 pass/0 fail, `tsc-green.log`, `green.log` |
| Follow-up RED foreign prefix edge | same test after extending fixture, before GLOB correction | exit1, 2 pass/1 fail, `red-foreign-prefix.log` |
| Final compile | same compile command | exit0, `tsc-final.log` |
| Final focused GREEN | `node --test "$d/test/v12/d1-read-init-regressions.test.mjs" "$d/test/v12/palace-wal-recovery.test.mjs" "$d/test/v12/d1-closure-regressions.test.mjs"` | exit0, 13 pass/0 fail, `focused-final.log` |
| Additional read contracts | `node --test --test-name-pattern='^(?!actual Palace CLI process probe)' "$d/test/v12/d1-opus-round2-regressions.test.mjs" "$d/test/v12/palace-cli-contract.test.mjs" "$d/test/v12/palace-managed-data-root.test.mjs" "$d/test/v12/palace-process-identity.test.mjs"` | exit0, 22 pass/0 fail/1 skip, `read-functional-final.log`; **unexpectedly included legacy performance sampling, see below** |
| Whitespace verification | `git diff --check` | exit0, retained `diff-check-final.log` |

Initial RED errors: PALACE_SCHEMA_UNSUPPORTED for interrupted first init; active owner null !== true with spawn forbidden; archive RUNTIME_AMBIGUOUS. Edge RED is missing expected exception for `sqliteXforeign`. These are real observed failures, not inferred counterfactuals.

**Measurement mistake:** the negative-lookahead selection above did not exclude the legacy measurement test. It unintentionally ran 200 normal/skip pairs and reported a 6.0450ms difference of arm p95 (254.9079−248.8629). The complete log including samples and Defender observation is retained. This is an **unplanned / not preregistered / ineligible acceptance observation**, not a pass, not active-runtime or candidate evidence, and not a replacement for the authoritative **30.1605ms >20ms FAIL**. No measurement was repeated to chase green. Future execution must positively allowlist test names or separate functional files; do not reuse the failed exclusion.

## Complete reviewer response and dispositions

`review-response-extracted.md` preserves the complete decoded 150-line device-read response from prior bridge JSONL, not a summary. Local bytes13882, SHA256 `5043be6f052e26f46448152d3b836b2a819e0173863c4e4019f188999febb794`; remote report bytes13883 / SHA256 `e901a780bb44e8f345c81a78edaee3fe37af712bb38178d9b971defceb2eafd8`. **Not byte-equivalent proven**; extraction metadata records the distinction. Do not replace this with a reconstructed remote hash claim.

`REVIEW-DISPOSITION.md` assesses **all A1–A6 and N3–N10** against actual source, separating fixed, confirmed-open, and protocol proposals. It also records list recovery side effects, legacy lock remediation, unsafe-parent and warning issues. Do not blindly implement suggestions.

## Remaining blockers / next coherent milestone

- D1 remains **AMEND**, fresh turn `183b8083-m365-worker-20261028-012828-16970c16`; MF6 still **30.1605ms >20ms**. Preserve superseded18.56, diagnostic9.6, all failed/invalid receipts and new ineligible accidental observation. No performance PASS.
- No new experiment is registered. Reviewer proposed p95 of paired deltas, unlike the existing difference of arm p95. Threshold remains20ms. Reconcile estimand, runtime arms, validity/pre-exclusion rules, sample count, quantile, rerun budget and candidate sequencing first. User prohibits candidate rebuild until D1 PASS; reviewer wants candidate before PASS: unresolved ordering, not implicit authorization.
- A5 real isolated Device shell tool and no-flags plugins-disable removal are still unverified; fake child lease proves only the narrowly tested read behavior. No production contact authorized.
- A6 full current-source cross-OS/WSL/cold/packed/consumer tsc/root-container/EEXIST/upgrade/rollback gates remain outstanding. Do not run tests that silently rebuild candidate or mutate root dist.
- Next source group recommended: N4 fault-persistence failure/reload/revision race and N10 delayed cancelled PLUGIN_* fault tests, then bounded fixes. N5 killed schema snapshot cleanup requires ownership-safe design first. N6/N7 remediation/provenance, N8 realpath quick probe parity, N9 service-profile startup guard also remain open as individually described in dispositions.
- D2/D3 draft is not source acceptance, does not clear D1; downstream synthetic regressions do not prove savings or independent procedure success.

## Stable-source binding and terminal evidence

`stable-source-manifest.json` binds264 files: the prior263-file source/test/docs/package/skill manifest path set plus the new regression. SHA256 **ad560cb878bf4a86803ac8b841f44800fddffcddddaab35903f7f7a87e5e0b2e**. This is a file-set binding, not the entire dirty worktree, not HEAD-only source, not a release artifact and not a candidate digest. Logs and new evidence are separately bound by `evidence-manifest.json`. `receipt.json` records stages and exclusions. Verify the manifest against actual files before claiming this exact snapshot; any subsequent source write invalidates freshness. No integration or production work is authorized by this handoff.
