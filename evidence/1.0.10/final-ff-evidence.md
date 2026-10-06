# 1.0.10 final fast-forward verification

Verified test commit (FINAL_SHA): `3607dc89fddcbaae345c91db609db3f1accfac30`.

The subsequent evidence-only commit will have a different SHA; use that branch tip when including this evidence in delivery. No merge or push is executed here.

Literal quoting assertions exercise the private production quoteSystemdArg through pure SystemdUserDeviceService.unitText serialization, with no duplicate quoting helper. An initial install-based fixture failed because its systemctl mock returned no enabled/active status; the final test uses pure serialization and avoids filesystem/service side effects.

## `git rev-parse HEAD`

Exit code: 0

```text
3607dc89fddcbaae345c91db609db3f1accfac30

```

## `node test/test-linux-device-service.js`

Exit code: 0

```text
Linux MCP Device service tests passed

```

## `git diff --exit-code 25718d3 HEAD -- src package.json package-lock.json`

Exit code: 0

```text

```

## `git diff --stat f2a5eeb HEAD -- . ':!test' ':!.gitignore' ':!evidence' ':!specs'`

Exit code: 0

```text
 .../mcp110-execution-01a1040a/.gitignore           |     3 +
 .../mcp110-execution-01a1040a/build-helper.txt     |    37 +
 .../mcp110-execution-01a1040a/build-resume.mjs     |     3 +
 .../mcp110-execution-01a1040a/builds.mjs           |     4 +
 .../bundles/BASE_ORIGINAL.tar                      |   Bin 0 -> 4290560 bytes
 .../bundles/BENCH_ORIGINAL.tar                     |   Bin 0 -> 132823040 bytes
 .../bundles/COMPAT_ORIGINAL.tar                    |   Bin 0 -> 4290560 bytes
 .../bundles/FILE_ORIGINAL.tar                      |   Bin 0 -> 4311040 bytes
 .../bundles/PROCESS_ORIGINAL.tar                   |   Bin 0 -> 4290560 bytes
 .../mcp110-execution-01a1040a/calibrate.mjs        |    16 +
 .../child-artifact.test.mjs                        |    41 +
 .../controlled-env-v2.json                         |    10 +
 .../derive-checkpoint-04d.mjs                      |    24 +
 .../derive-checkpoint-04e.mjs                      |    23 +
 .../derive-checkpoint-04f.mjs                      |    16 +
 .../mcp110-execution-01a1040a/discovery.mjs        |    40 +
 .../evidence/110/architecture/acceptance.json      |    13 +
 .../evidence/110/architecture/accepted-parent.json |    14 +
 .../evidence/110/architecture/bootstrap.json       |    13 +
 .../evidence/110/architecture/context.json         |    13 +
 .../evidence/110/architecture/direct-gateway.json  |    25 +
 .../evidence/110/architecture/dispatch-trial.json  |    24 +
 .../evidence/110/architecture/extraction-gate.json |    14 +
 .../evidence/110/architecture/removal.json         |    12 +
 .../evidence/110/architecture/security-config.json |    13 +
 .../evidence/110/auth/architecture.json            |    14 +
 .../evidence/110/auth/discovery.json               |    50 +
 .../evidence/110/auth/execution-authorization.md   |    42 +
 .../evidence/110/builds/BASE_BUILD-identity.json   |    34 +
 .../evidence/110/builds/BENCH_BUILD-identity.json  |    34 +
 .../evidence/110/builds/FILE_BUILD-identity.json   |    34 +
 .../110/builds/PROCESS_BUILD-identity.json         |    34 +
 .../evidence/110/builds/originals.json             |   143 +
 .../BASE_BUILD-test-read-completed-process.js.json |    16 +
 ...ILE_BUILD-test-file-search-edit-compact.js.json |    16 +
 .../PROCESS_BUILD-test-process-runtime-110.js.json |    16 +
 ...OCESS_BUILD-test-read-completed-process.js.json |    16 +
 .../110/candidates/compat-contract-v1.0.9.json     |    59 +
 .../110/candidates/original-reconciliation.json    |   148 +
 .../evidence/110/candidates/originals.json         |   121 +
 .../test/test-process-runtime-110.js               |   246 +
 .../evidence/110/candidates/process.patch          |   635 +
 .../evidence/110/combined/all-route-v1.json        |     8 +
 .../evidence/110/combined/composition-v1.json      |    18 +
 .../evidence/110/combined/final-scope.json         |     9 +
 .../evidence/110/combined/inherited-gates-v1.json  |    13 +
 .../evidence/110/core/accepted-parent.json         |    12 +
 .../evidence/110/core/build-tests.json             |    13 +
 .../evidence/110/core/gate.json                    |    12 +
 .../evidence/110/core/trial.json                   |    13 +
 .../evidence/110/discovery/BASELINE.md             |    41 +
 .../110/discovery/calibration-win/raw.jsonl        |    12 +
 .../discovery/calibration-win/raw.standard.jsonl   |    12 +
 .../110/discovery/calibration-win/summary.json     |    83 +
 .../evidence/110/discovery/mvp-gate.json           |   390 +
 .../evidence/110/discovery/profile-proposal.json   |    39 +
 .../evidence/110/discovery/task-status.json        |    34 +
 .../evidence/110/eligibility-stop.md               |    44 +
 .../evidence/110/file/accepted.json                |     9 +
 .../evidence/110/file/composition.json             |    12 +
 .../evidence/110/file/oracles.json                 |    11 +
 .../evidence/110/file/read-gate.json               |    12 +
 .../evidence/110/file/search-gate.json             |    12 +
 .../evidence/110/final-validation.json             |    15 +
 .../evidence/110/harness/build-identity.json       |     8 +
 .../bench/results/v1.0.9/BASELINE.md.gz            |   Bin 0 -> 4220 bytes
 .../bench/results/v1.0.9/g6-win32/raw.jsonl.gz     |   Bin 0 -> 619344 bytes
 .../results/v1.0.9/g6-win32/raw.standard.jsonl.gz  |   Bin 0 -> 566116 bytes
 .../results/v1.0.9/g6-win32/raw.stress.jsonl.gz    |   Bin 0 -> 53742 bytes
 .../bench/results/v1.0.9/g6-win32/summary.json.gz  |   Bin 0 -> 5288 bytes
 .../evidence/110/independent/final-gate.json       |    15 +
 .../evidence/110/independent/final-target.json     |    12 +
 .../evidence/110/independent/gate-oracles.json     |    11 +
 .../evidence/110/inventory/baseline/README.md      |    26 +
 .../evidence/110/inventory/baseline/package.json   |   134 +
 .../110/inventory/baseline/src/bootstrap.ts        |    22 +
 .../110/inventory/baseline/src/config-manager.ts   |   377 +
 .../110/inventory/baseline/src/custom-stdio.ts     |   409 +
 .../110/inventory/baseline/src/device/device.ts    |   286 +
 .../baseline/src/device/execution-engine.ts        |   152 +
 .../baseline/src/device/gateway-channel.ts         |   574 +
 .../baseline/src/device/gateway-tool-adapter.ts    |   286 +
 .../baseline/src/device/project-inspection.ts      |   180 +
 .../110/inventory/baseline/src/error-handlers.ts   |    17 +
 .../baseline/src/handlers/filesystem-handlers.ts   |   501 +
 .../baseline/src/handlers/search-handlers.ts       |   256 +
 .../evidence/110/inventory/baseline/src/index.ts   |   170 +
 .../110/inventory/baseline/src/mcp-device.ts       |     6 +
 .../inventory/baseline/src/npm-scripts/remote.ts   |   364 +
 .../110/inventory/baseline/src/search-manager.ts   |  1022 +
 .../evidence/110/inventory/baseline/src/server.ts  |  1612 +
 .../110/inventory/baseline/src/terminal-manager.ts |   795 +
 .../110/inventory/baseline/src/tools/config.ts     |   279 +
 .../110/inventory/baseline/src/tools/edit.ts       |   509 +
 .../110/inventory/baseline/src/tools/filesystem.ts |  1115 +
 .../baseline/src/tools/improved-process-tools.ts   |   730 +
 .../inventory/baseline/src/tools/pdf/markdown.ts   |   318 +
 .../110/inventory/baseline/src/tools/schemas.ts    |   268 +
 .../evidence/110/inventory/baseline/src/types.ts   |    99 +
 .../110/inventory/baseline/src/utils/capture.ts    |    39 +
 .../inventory/baseline/src/utils/feature-flags.ts  |    27 +
 .../110/inventory/baseline/src/utils/logger.ts     |    82 +
 .../inventory/baseline/src/utils/toolHistory.ts    |   316 +
 .../110/inventory/baseline/src/utils/trackTools.ts |    82 +
 .../inventory/baseline/src/utils/usageTracker.ts   |   570 +
 .../gateway/scripts/authenticated-mcp-wrapper.mjs  |  1210 +
 .../gateway/scripts/device-access-policy.mjs       |   205 +
 .../evidence/110/inventory/runtime-seams.json      |  2075 +
 .../evidence/110/inventory/surfaces.json           |    45 +
 .../evidence/110/media/accepted.json               |     9 +
 .../evidence/110/media/hardened.json               |    12 +
 .../evidence/110/media/trial.json                  |    13 +
 .../evidence/110/optional/disposition.json         |     8 +
 .../evidence/110/optional/scope-oracle.json        |     8 +
 .../evidence/110/oracle/baseline-samples.json      |  1748 +
 .../evidence/110/oracle/sensitivity.json           |    23 +
 .../evidence/110/oracles/build-guard.json          |    17 +
 .../evidence/110/oracles/candidate-overlays.json   |  1382 +
 .../evidence/110/oracles/compat-freeze.json        |    12 +
 .../evidence/110/process/accepted.json             |    12 +
 .../evidence/110/process/composition.json          |    13 +
 .../evidence/110/process/domain-gate.json          |    13 +
 .../evidence/110/process/hardened.json             |    12 +
 .../evidence/110/process/oracles.json              |    12 +
 .../attestation-inventory-fresh.json               |   369 +
 .../conditional-issuance-recipe-fresh.mjs          |    97 +
 .../110/repairs/dependency-delta-review/report.md  |   109 +
 .../verification-evidence.json                     |   128 +
 .../110/repairs/fresh-builds-aggregate.json        |    51 +
 .../fullserver-inspection-final/base-server.json   |  1463 +
 .../fullserver-inspection-final/bench-harness.json |  1624 +
 .../fullserver-inspection-final/finalize.mjs       |    89 +
 .../inspection-batch-02.json                       |    59 +
 .../inspection-batch-03.json                       |    22 +
 .../inspection-ledger.json                         |  1814 +
 .../inspection-progress.json                       |    22 +
 .../preflight-test-results.json                    |     9 +
 .../fullserver-inspection-final/preflight.test.mjs |    16 +
 .../repairs/fullserver-inspection-final/report.md  |    49 +
 .../reviewer-handoff.json                          |   324 +
 .../fullserver-inspection-final/test-native.mjs    |     8 +
 .../validate-readonly.mjs                          |    15 +
 .../validation-results.json                        |   129 +
 .../fullserver-preparation-v3/gen-v3-template.mjs  |   244 +
 .../repairs/fullserver-preparation-v3/report.md    |   153 +
 .../reviewer-handoff.json                          |    57 +
 .../fullserver-preparation-v3/validate-v3.mjs      |   207 +
 .../validation-results.json                        |    30 +
 .../base-server-v4-draft.json                      |   159 +
 .../bench-harness-v4-draft.json                    |   274 +
 .../repairs/fullserver-preparation-v4/generate.mjs |    41 +
 .../repairs/fullserver-preparation-v4/report.md    |    58 +
 .../reviewer-handoff.json                          |   389 +
 .../validate-readonly.mjs                          |    31 +
 .../validation-results.json                        |    18 +
 .../base-server-v5-draft.json                      |   159 +
 .../bench-harness-v5-draft.json                    |   274 +
 .../fullserver-preparation-v5/generate-blocked.mjs |    48 +
 .../preflight-test-results.json                    |     7 +
 .../fullserver-preparation-v5/preflight.test.mjs   |    62 +
 .../repairs/fullserver-preparation-v5/report.md    |    25 +
 .../reviewer-handoff.json                          |  1207 +
 .../fullserver-preparation-v5/schema-stage.mjs     |   112 +
 .../validate-readonly.mjs                          |    32 +
 .../validation-results.json                        |    14 +
 .../110/repairs/fullserver-review/closure-0.txt    |   527 +
 .../110/repairs/fullserver-review/closure-1.txt    |  1481 +
 .../110/repairs/fullserver-review/closure-10.txt   |   960 +
 .../110/repairs/fullserver-review/closure-11.txt   |   629 +
 .../110/repairs/fullserver-review/closure-12.txt   |   829 +
 .../110/repairs/fullserver-review/closure-13.txt   |   966 +
 .../110/repairs/fullserver-review/closure-14.txt   |   433 +
 .../110/repairs/fullserver-review/closure-15.txt   |   975 +
 .../110/repairs/fullserver-review/closure-16.txt   |   797 +
 .../110/repairs/fullserver-review/closure-17.txt   |   795 +
 .../110/repairs/fullserver-review/closure-18.txt   |  1020 +
 .../110/repairs/fullserver-review/closure-19.txt   |   868 +
 .../110/repairs/fullserver-review/closure-2.txt    |  1016 +
 .../110/repairs/fullserver-review/closure-20.txt   |   478 +
 .../110/repairs/fullserver-review/closure-3.txt    |   695 +
 .../110/repairs/fullserver-review/closure-4.txt    |   850 +
 .../110/repairs/fullserver-review/closure-5.txt    |   807 +
 .../110/repairs/fullserver-review/closure-6.txt    |   445 +
 .../110/repairs/fullserver-review/closure-7.txt    |   949 +
 .../110/repairs/fullserver-review/closure-8.txt    |   807 +
 .../110/repairs/fullserver-review/closure-9.txt    |  1080 +
 .../110/repairs/fullserver-review/inventory.json   |   861 +
 .../110/repairs/fullserver-review/inventory.mjs    |     5 +
 .../110/repairs/fullserver-review/report.md        |   148 +
 .../fullserver-review/validate-template.mjs        |   174 +
 .../interfaces-20261004T030204Z.md                 |    43 +
 .../repair-h2-h3-h4-20261004T030204Z.json          |    32 +
 .../integration-preflight-1791083850916-usage.json |    10 +
 .../integration-preflight-1791083850916.json       |   129 +
 .../repairs/provenance-v4-dev/adjudication-note.md |    22 +
 .../provenance-v4-dev/artifact-inventory-v4.json   |   188 +
 .../conditional-issuance-recipe-v4.md              |    23 +
 .../fresh-builds-aggregate-v4.json                 |  1134 +
 .../110/repairs/provenance-v4-dev/generate.mjs     |    55 +
 .../110/repairs/provenance-v4-dev/handoff.md       |    36 +
 .../provenance-v4-dev/validate-readonly.mjs        |    78 +
 .../validation-first-attempt.json                  |     8 +
 .../provenance-v4-dev/validation-results-v4.json   |   299 +
 .../validation-run-reconciliation-01.json          |   299 +
 .../validation-second-attempt.json                 |     6 +
 .../validation-third-attempt.json                  |     7 +
 .../usage/BASE_BUILD-before-restore.json           |    32 +
 .../builds/BASE_BUILD-identity.json                |   145 +
 .../builds/originals.json                          |   152 +
 .../usage/BASE_BUILD-before-restore.json           |    32 +
 .../usage/BASE_BUILD-built.json                    |    32 +
 .../builds/BENCH_BUILD-identity.json               |   145 +
 .../bench-proof-main08/builds/originals.json       |   152 +
 .../usage/BENCH_BUILD-before-restore.json          |    32 +
 .../usage/BENCH_BUILD-built.json                   |    32 +
 .../usage/FILE_BUILD-before-restore.json           |    32 +
 .../usage/FILE_BUILD-before-restore.json           |    32 +
 .../builds/FILE_BUILD-identity.json                |   145 +
 .../reruns/file-proof-main09/builds/originals.json |   152 +
 .../usage/FILE_BUILD-before-restore.json           |    32 +
 .../file-proof-main09/usage/FILE_BUILD-built.json  |    32 +
 .../builds/FILE_BUILD-identity.json                |   145 +
 .../builds/originals.json                          |   152 +
 .../usage/FILE_BUILD-before-restore.json           |    32 +
 .../usage/FILE_BUILD-built.json                    |    32 +
 .../builds/PROCESS_BUILD-identity.json             |   145 +
 .../process-proof-main07/builds/originals.json     |   152 +
 .../usage/PROCESS_BUILD-before-restore.json        |    32 +
 .../usage/PROCESS_BUILD-built.json                 |    32 +
 .../110/repairs/reruns/reconciliation-04f.test.mjs |    23 +
 .../before.json                                    |    16 +
 ...ILE_BUILD-test-file-search-edit-compact.js.json |   176 +
 .../oracles/candidate-overlays.json                |  1382 +
 .../161aa19e-ab1a-498-actual-final.txt             |    13 +
 .../704a198f-32c6-453-actual-final.txt             |    16 +
 .../FILE.raw.stderr                                |     2 +
 .../FILE.raw.stdout                                |     9 +
 .../actual-command.json                            |     9 +
 .../actual-final-report.json                       |   189 +
 .../actual.stderr                                  |    13 +
 .../actual.stdout                                  |     0
 .../admission-after.json                           |   189 +
 .../admission-before.json                          |   189 +
 .../approval.json                                  |   124 +
 .../manifest.json                                  |    48 +
 .../verify-only.json                               |     9 +
 .../verify-only.stderr                             |     0
 .../verify-only.stdout                             |     1 +
 .../4784e678-532e-435-actual-final.txt             |    20 +
 .../797a4ba9-e5be-430-actual-final.txt             |    16 +
 .../admission.json                                 |    16 +
 .../approval.json                                  |   135 +
 .../invocation.json                                |     4 +
 .../verify-only.json                               |     1 +
 .../verify-only.stderr                             |     0
 .../verify-only.stdout                             |     1 +
 .../wrapper-result.json                            |    11 +
 .../wrapper.raw.stderr                             |     0
 .../wrapper.raw.stdout                             |     0
 .../actual-final-report.json                       |   127 +
 .../before.json                                    |    16 +
 .../PROCESS_BUILD-test-process-runtime-110.js.json |   167 +
 .../execution.json                                 |   882 +
 .../oracles/candidate-overlays.json                |  1382 +
 .../stage.raw.stderr                               |    11 +
 .../stage.raw.stdout                               |     1 +
 .../reconciliation-authorized-05/after-checks.json |    85 +
 .../reconciliation-authorized-05/approval.json     |    47 +
 .../before-issuance.json                           |   915 +
 .../checkpoint-files.json                          |    36 +
 .../reconciliation-authorized-05/checkpoint.mjs    |     8 +
 .../d6a1b348-ce25-4a6-actual-final.txt             |    35 +
 .../d6a1b348-ce25-4a6-report-record.json           |    13 +
 .../reconciliation-authorized-05/execute.mjs       |    55 +
 .../execution-report.json                          |    24 +
 .../fa6be2ae-d946-47d-actual-final.txt             |    45 +
 .../fa6be2ae-d946-47d-report-record.json           |    13 +
 .../reconciliation-authorized-05/finalize.mjs      |     4 +
 .../issuance-budget-before.json                    |    11 +
 .../issuance-native.json                           |    44 +
 .../issuance-verification.json                     |   915 +
 .../reconciliation-authorized-05/issuance.stderr   |     0
 .../reconciliation-authorized-05/issuance.stdout   |     1 +
 .../issued-four-fresh-v4.json                      |  2651 ++
 .../main-adjudication.json                         |    44 +
 .../pure-tests-result.json                         |     5 +
 .../reconciliation-authorized-05/pure-tests.stderr |     0
 .../reconciliation-authorized-05/pure-tests.stdout |    52 +
 .../reconcile-budget-before.json                   |    11 +
 .../reconcile-native.json                          |    44 +
 .../reconciliation-authorized-05/reconcile.stderr  |    11 +
 .../reconciliation-authorized-05/reconcile.stdout  |     1 +
 .../right-before-reconcile.json                    |   915 +
 .../verified-outcomes.json                         |   333 +
 .../7a85a39d-7ac7-4fa-actual-final.txt             |    12 +
 .../7a85a39d-7ac7-4fa-report-record.json           |    13 +
 .../9f646ab0-bb3c-4cc-actual-final.txt             |    11 +
 .../9f646ab0-bb3c-4cc-report-record.json           |    13 +
 .../reconciliation-authorized-06/amendment.json    |    44 +
 .../reconciliation-authorized-06/api-proposal.txt  |     2 +
 .../reconciliation-authorized-06/approval.json     |    82 +
 .../coverage-correction.json                       |     5 +
 .../main-adjudication.json                         |    63 +
 .../preparation-result.json                        |    20 +
 .../preparation-verification.json                  |    13 +
 .../reruns/reconciliation-config-effects.test.mjs  |    63 +
 .../repairs/reruns/reconciliation-fixed-inputs.mjs |   116 +
 .../reruns/reconciliation-fixed-inputs.test.mjs    |    14 +
 .../repairs/reruns/reconciliation-launch-04.mjs    |    10 +
 .../repairs/reruns/reconciliation-postrun.test.mjs |    67 +
 .../repairs/reruns/reconciliation-preflight-01.mjs |    49 +
 .../repairs/reruns/reconciliation-preflight-04.mjs |    27 +
 .../reconciliation-preflight-01.json               |   313 +
 .../reconciliation-preflight.stdout.json           |     1 +
 .../reconciliation-supervised-02-stage-result.json |     1 +
 .../reconciliation-supervised-03-stage-result.json |     1 +
 .../reconciliation-execution-report.json           |    53 +
 .../reconciliation-preflight-01.json               |   313 +
 .../reconciliation-supervised-04-stage-result.json |    48 +
 .../reconciliation-supervised-04-stage.stderr      |     8 +
 .../reconciliation-supervised-04-stage.stdout      |     0
 ...reconciliation-supervised-04b-stage-result.json |    48 +
 .../reconciliation-supervised-04b-stage.stderr     |     8 +
 .../reconciliation-supervised-04b-stage.stdout     |     0
 ...reconciliation-supervised-04c-stage-result.json |    48 +
 .../reconciliation-supervised-04c-stage.stderr     |     0
 .../reconciliation-supervised-04c-stage.stdout     |     5 +
 .../oracles/candidate-overlays.json                |  1382 +
 .../reconciliation-execution-report.json           |   138 +
 .../reconciliation-preflight-04.json               |  2147 +
 .../reconciliation-preflight-04.json               |  2170 +
 .../reconciliation-preflight-04.json               |  2170 +
 .../reconciliation-preflight-04.json               |  2180 +
 .../review-manifest.json                           |    22 +
 .../reconciliation-supervised-04f/validation.json  |    17 +
 .../validation.stderr                              |     0
 .../reconciliation-supervised-04f/validation.tap   |   430 +
 .../reruns/reconciliation-tool-revision.test.mjs   |    52 +
 .../cache/_update-notifier-last-checked            |     0
 .../restore-diagnostic-20261004-01/comparison.json |   134 +
 .../restore-diagnostic-20261004-01/diagnose.mjs    |    27 +
 .../failed-build-preservation.json                 |    28 +
 .../outer-result.json                              |    24 +
 .../parallel-inherit.result.json                   |    43 +
 .../parallel-inherit/holder.cjs                    |     1 +
 .../parallel-inherit/probe-0.marker.json           |     1 +
 .../parallel-inherit/probe-1.marker.json           |     1 +
 .../parallel-inherit/probe-2.marker.json           |     1 +
 .../parallel1.result.json                          |    44 +
 .../parallel1/holder.cjs                           |     1 +
 .../parallel1/package.json                         |     1 +
 .../parallel1/probe-0.marker.json                  |     1 +
 .../parallel1/probe-1.marker.json                  |     1 +
 .../parallel1/probe-2.marker.json                  |     1 +
 .../parallel2.result.json                          |    38 +
 .../parallel2/holder.cjs                           |     1 +
 .../parallel2/package.json                         |     1 +
 .../parallel2/probe-0.marker.json                  |     1 +
 .../parallel2/probe-1.marker.json                  |     1 +
 .../restore-diagnostic-20261004-01/preflight.json  |    11 +
 .../preservation-copy-result.json                  |     7 +
 .../preserved-failed-base-node_modules/.bin/acorn  |    16 +
 .../.bin/acorn.cmd                                 |    17 +
 .../.bin/acorn.ps1                                 |    28 +
 .../.bin/browsers                                  |    16 +
 .../.bin/browsers.cmd                              |    17 +
 .../.bin/browsers.ps1                              |    28 +
 .../preserved-failed-base-node_modules/.bin/crc32  |    16 +
 .../.bin/crc32.cmd                                 |    17 +
 .../.bin/crc32.ps1                                 |    28 +
 .../.bin/esbuild                                   |    16 +
 .../.bin/esbuild.cmd                               |    17 +
 .../.bin/esbuild.ps1                               |    28 +
 .../.bin/escodegen                                 |    16 +
 .../.bin/escodegen.cmd                             |    17 +
 .../.bin/escodegen.ps1                             |    28 +
 .../.bin/esgenerate                                |    16 +
 .../.bin/esgenerate.cmd                            |    17 +
 .../.bin/esgenerate.ps1                            |    28 +
 .../.bin/esparse                                   |    16 +
 .../.bin/esparse.cmd                               |    17 +
 .../.bin/esparse.ps1                               |    28 +
 .../.bin/esvalidate                                |    16 +
 .../.bin/esvalidate.cmd                            |    17 +
 .../.bin/esvalidate.ps1                            |    28 +
 .../.bin/is-docker                                 |    16 +
 .../.bin/is-docker.cmd                             |    17 +
 .../.bin/is-docker.ps1                             |    28 +
 .../.bin/is-inside-container                       |    16 +
 .../.bin/is-inside-container.cmd                   |    17 +
 .../.bin/is-inside-container.ps1                   |    28 +
 .../.bin/js-yaml                                   |    16 +
 .../.bin/js-yaml.cmd                               |    17 +
 .../.bin/js-yaml.ps1                               |    28 +
 .../.bin/markdown-it                               |    16 +
 .../.bin/markdown-it.cmd                           |    17 +
 .../.bin/markdown-it.ps1                           |    28 +
 .../preserved-failed-base-node_modules/.bin/marked |    16 +
 .../.bin/marked.cmd                                |    17 +
 .../.bin/marked.ps1                                |    28 +
 .../.bin/md-to-pdf                                 |    16 +
 .../.bin/md-to-pdf.cmd                             |    17 +
 .../.bin/md-to-pdf.ps1                             |    28 +
 .../preserved-failed-base-node_modules/.bin/md2pdf |    16 +
 .../.bin/md2pdf.cmd                                |    17 +
 .../.bin/md2pdf.ps1                                |    28 +
 .../.bin/node-pre-gyp                              |    16 +
 .../.bin/node-pre-gyp.cmd                          |    17 +
 .../.bin/node-pre-gyp.ps1                          |    28 +
 .../.bin/node-which                                |    16 +
 .../.bin/node-which.cmd                            |    17 +
 .../.bin/node-which.ps1                            |    28 +
 .../.bin/nodemon                                   |    16 +
 .../.bin/nodemon.cmd                               |    17 +
 .../.bin/nodemon.ps1                               |    28 +
 .../.bin/nodetouch                                 |    16 +
 .../.bin/nodetouch.cmd                             |    17 +
 .../.bin/nodetouch.ps1                             |    28 +
 .../preserved-failed-base-node_modules/.bin/nopt   |    16 +
 .../.bin/nopt.cmd                                  |    17 +
 .../.bin/nopt.ps1                                  |    28 +
 .../preserved-failed-base-node_modules/.bin/pdf2md |    16 +
 .../.bin/pdf2md.cmd                                |    17 +
 .../.bin/pdf2md.ps1                                |    28 +
 .../.bin/puppeteer                                 |    16 +
 .../.bin/puppeteer.cmd                             |    17 +
 .../.bin/puppeteer.ps1                             |    28 +
 .../.bin/qrcode-terminal                           |    16 +
 .../.bin/qrcode-terminal.cmd                       |    17 +
 .../.bin/qrcode-terminal.ps1                       |    28 +
 .../.bin/resolve                                   |    16 +
 .../.bin/resolve.cmd                               |    17 +
 .../.bin/resolve.ps1                               |    28 +
 .../preserved-failed-base-node_modules/.bin/semver |    16 +
 .../.bin/semver.cmd                                |    17 +
 .../.bin/semver.ps1                                |    28 +
 .../preserved-failed-base-node_modules/.bin/shjs   |    16 +
 .../.bin/shjs.cmd                                  |    17 +
 .../.bin/shjs.ps1                                  |    28 +
 .../preserved-failed-base-node_modules/.bin/shx    |    16 +
 .../.bin/shx.cmd                                   |    17 +
 .../.bin/shx.ps1                                   |    28 +
 .../.bin/ts-node                                   |    16 +
 .../.bin/ts-node-cwd                               |    16 +
 .../.bin/ts-node-cwd.cmd                           |    17 +
 .../.bin/ts-node-cwd.ps1                           |    28 +
 .../.bin/ts-node-esm                               |    16 +
 .../.bin/ts-node-esm.cmd                           |    17 +
 .../.bin/ts-node-esm.ps1                           |    28 +
 .../.bin/ts-node-script                            |    16 +
 .../.bin/ts-node-script.cmd                        |    17 +
 .../.bin/ts-node-script.ps1                        |    28 +
 .../.bin/ts-node-transpile-only                    |    16 +
 .../.bin/ts-node-transpile-only.cmd                |    17 +
 .../.bin/ts-node-transpile-only.ps1                |    28 +
 .../.bin/ts-node.cmd                               |    17 +
 .../.bin/ts-node.ps1                               |    28 +
 .../.bin/ts-script                                 |    16 +
 .../.bin/ts-script.cmd                             |    17 +
 .../.bin/ts-script.ps1                             |    28 +
 .../preserved-failed-base-node_modules/.bin/tsc    |    16 +
 .../.bin/tsc.cmd                                   |    17 +
 .../.bin/tsc.ps1                                   |    28 +
 .../.bin/tsserver                                  |    16 +
 .../.bin/tsserver.cmd                              |    17 +
 .../.bin/tsserver.ps1                              |    28 +
 .../preserved-failed-base-node_modules/.bin/tsx    |    16 +
 .../.bin/tsx.cmd                                   |    17 +
 .../.bin/tsx.ps1                                   |    28 +
 .../preserved-failed-base-node_modules/.bin/uuid   |    16 +
 .../.bin/uuid.cmd                                  |    17 +
 .../.bin/uuid.ps1                                  |    28 +
 .../esbuild/LICENSE.md                             |    21 +
 .../esbuild/README.md                              |     3 +
 .../esbuild/bin/esbuild                            |   223 +
 .../esbuild/install.js                             |   289 +
 .../esbuild/lib/main.d.ts                          |   716 +
 .../esbuild/lib/main.js                            |  2242 +
 .../esbuild/package.json                           |    49 +
 .../restore-diagnostic-20261004-01/rerun-base.mjs  |    17 +
 .../restore-diagnostic-20261004-01/root-cause.md   |    60 +
 .../serial-pipe.result.json                        |    49 +
 .../serial-pipe/holder.cjs                         |     1 +
 .../serial-pipe/probe-0.marker.json                |     1 +
 .../serial-pipe/probe-1.marker.json                |     1 +
 .../serial-pipe/probe-2.marker.json                |     1 +
 .../serial-pipe/probe-3.marker.json                |     1 +
 .../serialized.result.json                         |    50 +
 .../serialized/holder.cjs                          |     1 +
 .../serialized/package.json                        |     1 +
 .../serialized/probe-0.marker.json                 |     1 +
 .../serialized/probe-1.marker.json                 |     1 +
 .../serialized/probe-2.marker.json                 |     1 +
 .../serialized/probe-3.marker.json                 |     1 +
 .../stdio-comparison.json                          |    94 +
 .../stdio-control.mjs                              |    15 +
 .../stdio-outer-result.json                        |    24 +
 .../stdio-preflight.json                           |    11 +
 .../attestation-inventory.json                     |   326 +
 .../conditional-issuance.mjs                       |    24 +
 .../fullserver-scope-evidence.mjs                  |     7 +
 .../fullserver-scoped-blockers.json                |    62 +
 .../runner-independent-review/inspect-bytes.mjs    |    10 +
 .../materialize-attestations.mjs                   |    39 +
 .../repairs/runner-independent-review/report.md    |    81 +
 .../static-verification.json                       |    57 +
 .../verify-attestations.mjs                        |    17 +
 .../schema-accounting-revision08/accounting.mjs    |    24 +
 .../accounting.test.mjs                            |    39 +
 .../boundary-proof.json                            |   316 +
 .../preflight-report.mjs                           |    33 +
 .../repairs/schema-accounting-revision08/report.md |    50 +
 .../schema-admission-final/admission.test.mjs      |    10 +
 .../schema-admission-final/authorization.json      |    86 +
 .../schema-admission-final/budget-before.json      |    11 +
 .../repairs/schema-admission-final/coordinator.mjs |    92 +
 .../schema-admission-final/exact-guard.json        |     5 +
 .../110/repairs/schema-admission-final/execute.mjs |    38 +
 .../host-preflight-budget.json                     |    11 +
 .../host-preflight-native.json                     |    35 +
 .../repairs/schema-admission-final/launch-env.mjs  |    15 +
 .../schema-admission-final/launch-env.test.mjs     |    18 +
 .../schema-admission-final/launch-preflight.mjs    |    19 +
 .../repairs/schema-admission-final/outcome.json    |    29 +
 .../schema-admission-final/record-retry04.mjs      |    14 +
 .../retry02-budget-before.json                     |    11 +
 .../retry02-exact-guard.json                       |     5 +
 .../retry02-tests-budget.json                      |    11 +
 .../retry03-admission-boundary.json                |    16 +
 .../retry03-budget-before.json                     |    11 +
 .../retry03-exact-guard.json                       |     5 +
 .../retry03-execute.stderr.txt                     |     9 +
 .../retry03-execute.stdout.txt                     |     2 +
 .../retry03-host-preflight-budget.json             |    11 +
 .../retry03-host-preflight-native.json             |    35 +
 .../retry03-host-preflight.json                    |   290 +
 .../schema-admission-final/retry03-outcome.json    |   277 +
 .../retry03-tests-budget.json                      |    11 +
 .../retry03-tests-native.json                      |    35 +
 .../retry04-actual-resolution.json                 |    15 +
 .../retry04-admission-boundary.json                |    15 +
 .../retry04-before-authorization.json              |    86 +
 .../retry04-before-execute.mjs                     |    29 +
 .../retry04-budget-before.json                     |    11 +
 .../retry04-environment-diff.json                  |   486 +
 .../retry04-exact-guard.json                       |     5 +
 .../retry04-execute.stderr.txt                     |     9 +
 .../retry04-execute.stdout.txt                     |     2 +
 .../retry04-host-preflight-budget.json             |    11 +
 .../retry04-host-preflight-native.json             |    35 +
 .../retry04-launcher-authorization.json            |    27 +
 .../schema-admission-final/retry04-launcher.diff   |    40 +
 .../schema-admission-final/retry04-outcome.json    |   259 +
 .../retry04-tests-budget.json                      |    11 +
 .../retry04-tests-native.json                      |    35 +
 .../retry04b-actual-resolution.json                |    70 +
 .../retry04b-actual-schema-budget.json             |    11 +
 .../retry04b-actual-schema-native.json             |    31 +
 .../retry04b-admission-boundary.json               |    15 +
 .../retry04b-budget-before.json                    |    11 +
 .../retry04b-environment-diff.json                 |   486 +
 .../retry04b-exact-guard.json                      |     5 +
 .../retry04b-execute.stderr.txt                    |     9 +
 .../retry04b-execute.stdout.txt                    |     3 +
 .../retry04b-host-preflight-budget.json            |    11 +
 .../retry04b-host-preflight-native.json            |    35 +
 .../retry04b-host-preflight.json                   |   400 +
 .../retry04b-launcher-authorization.json           |    27 +
 .../retry04b-tests-budget.json                     |    11 +
 .../retry04b-tests-native.json                     |    35 +
 .../schema-admission-final/tests-budget.json       |    11 +
 .../schema-admission-final/tests-native.json       |    35 +
 .../110/repairs/schema-deadline-retry05/0001.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0002.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0003.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0004.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0005.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0006.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0007.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0008.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0009.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0010.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0011.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0012.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0013.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0014.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0015.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0016.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0017.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0018.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0019.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0020.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0021.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0022.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0023.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0024.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0025.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0026.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0027.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0028.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0029.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0030.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0031.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0032.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0033.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0034.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0035.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0036.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0037.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0038.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0039.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0040.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0041.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0042.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0043.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0044.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0045.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0046.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0047.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0048.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0049.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0050.json  |     1 +
 .../110/repairs/schema-deadline-retry05/0051.json  |     1 +
 .../schema-deadline-retry05/authorization.json     |   524 +
 .../schema-deadline-retry05/budget-before.json     |    11 +
 .../schema-deadline-retry05/coordinator.mjs        |   101 +
 .../repairs/schema-deadline-retry05/diagnose.mjs   |    67 +
 .../repairs/schema-deadline-retry05/findings.json  |    45 +
 .../repairs/schema-deadline-retry05/native.json    |    31 +
 .../repairs/schema-deadline-retry05/syntax.json    |     4 +
 .../actual-budget-before.json                      |    11 +
 .../schema-partition-retry06/authorization.json    |   376 +
 .../schema-partition-retry06/budget-before.json    |    11 +
 .../candidate-profile-test.json                    |     8 +
 .../schema-partition-retry06/coordinator.mjs       |    90 +
 .../environment-after-powershell.json              |    16 +
 .../environment-candidate-fixed.json               |    16 +
 .../schema-partition-retry06/environment-diff.json |   486 +
 .../schema-partition-retry06/environment-probe.mjs |     4 +
 .../environment-root-cause.json                    |    14 +
 .../repairs/schema-partition-retry06/execute.mjs   |    41 +
 .../repairs/schema-partition-retry06/final.json    |    43 +
 .../repairs/schema-partition-retry06/findings.json |    84 +
 .../schema-partition-retry06/freeze-held.json      |     1 +
 .../repairs/schema-partition-retry06/freeze.ps1    |    16 +
 .../schema-partition-retry06/outer-native.json     |    24 +
 .../schema-partition-retry06/partition.test.mjs    |    16 +
 .../110/repairs/schema-partition-retry06/plan.json | 44896 ++++++++++++++++++
 .../powershell-profile-fix.ps1                     |    10 +
 .../repairs/schema-partition-retry06/receipts.mjs  |    11 +
 .../schema-partition-retry06/tests-native.json     |    24 +
 .../actual-budget-before.json                      |    11 +
 .../schema-partition-retry07/admission-budget.json |    12 +
 .../schema-partition-retry07/admission-native.json |    23 +
 .../admission-receipt.json                         |   318 +
 .../schema-partition-retry07/admission-result.json |   139 +
 .../schema-partition-retry07/authorization.json    |   397 +
 .../schema-partition-retry07/budget-before.json    |    11 +
 .../schema-partition-retry07/close-begin.json      |     3 +
 .../schema-partition-retry07/close-complete.json   |     4 +
 .../schema-partition-retry07/coordinator.mjs       |    92 +
 .../schema-partition-retry07/environment-diff.json |   486 +
 .../repairs/schema-partition-retry07/execute.mjs   |    44 +
 .../repairs/schema-partition-retry07/final.json    |    43 +
 .../repairs/schema-partition-retry07/findings.json |   242 +
 .../schema-partition-retry07/freeze-held.json      |     1 +
 .../repairs/schema-partition-retry07/freeze.ps1    |    17 +
 .../schema-partition-retry07/handshake.json        |     7 +
 .../schema-partition-retry07/host-preflight.json   |   141 +
 .../schema-partition-retry07/launch-env.mjs        |    16 +
 .../repairs/schema-partition-retry07/launch.json   |     4 +
 .../observation-0-resources-list.json              |    24 +
 .../observation-0-tools-list.json                  |   877 +
 .../observation-1-resources-list.json              |    24 +
 .../observation-1-tools-list.json                  |   877 +
 .../observation-2-resources-list.json              |    24 +
 .../observation-2-tools-list.json                  |   877 +
 .../schema-partition-retry07/observations.json     |  2741 ++
 .../schema-partition-retry07/outer-native.json     |    24 +
 .../schema-partition-retry07/partition.test.mjs    |    16 +
 .../110/repairs/schema-partition-retry07/plan.json | 44906 +++++++++++++++++++
 .../postvalidation-budget.json                     |    12 +
 .../schema-partition-retry07/profile-red.json      |     1 +
 .../schema-partition-retry07/profile.test.mjs      |     7 +
 .../prospective-budget-note.json                   |     5 +
 .../repairs/schema-partition-retry07/receipts.mjs  |    11 +
 .../retry06-preserved.json                         |    86 +
 .../schema-partition-retry07/session-failure.json  |     5 +
 .../schema-partition-retry07/tests-native.json     |    24 +
 .../schema-partition-retry07/workload-budget.json  |    12 +
 .../schema-partition-retry07/workload-native.json  |    23 +
 .../schema-partition-retry07/workload-receipt.json |  2920 ++
 .../sensitivity-main10/mismatch-report.json        |   113 +
 .../sequential-main03/FILE_BUILD-after.json        |    80 +
 .../sequential-main03/FILE_BUILD-before.json       |  2340 +
 .../FILE_BUILD-capture-supervision.json            |    24 +
 .../FILE_BUILD-ledger-preflight.json               |    16 +
 .../110/repairs/sequential-main03/report.mjs       |    44 +
 ...32820-f7dd919b-5b5a-427a-88a4-1d6fb255c26a.json |  4925 ++
 ...97451-0b1a4433-720a-4383-84f3-6777e8a7aafe.json |  4995 +++
 ...10999-410be93b-6310-4c59-8e22-43b106d22cb1.json |  4965 ++
 ...5481ba1-d58e-4721-bb21-06ba05a46d0d.result.json |     1 +
 ...55b30-9a28-4901-8ba4-f6ad58be1078.evidence.json |    64 +
 ...ea55b30-9a28-4901-8ba4-f6ad58be1078.result.json |     1 +
 ...66773-af6c-4c0e-b601-a70a27879e12.evidence.json |    64 +
 ...fd66773-af6c-4c0e-b601-a70a27879e12.result.json |     1 +
 ...f1f46-b397-43c4-b264-156c9b73ae73.evidence.json |    68 +
 ...63f1f46-b397-43c4-b264-156c9b73ae73.result.json |     1 +
 ...d0b42-9c1c-49fc-914e-5f7d467529be.evidence.json |    65 +
 ...4ad0b42-9c1c-49fc-914e-5f7d467529be.result.json |     1 +
 ...a756b-3eb6-4c09-b221-208de8deeade.evidence.json |    58 +
 ...0ca756b-3eb6-4c09-b221-208de8deeade.result.json |     1 +
 ...b4a56-1e5e-4b06-843f-759d634c19e5.evidence.json |    64 +
 ...33b4a56-1e5e-4b06-843f-759d634c19e5.result.json |     1 +
 ...afcfd-a0ae-4eac-872e-1640db15394e.evidence.json |    64 +
 ...e2afcfd-a0ae-4eac-872e-1640db15394e.result.json |     1 +
 ...7e79ed-47c1-4d03-af19-bd936f9e72b6.request.json |     1 +
 ...5a15e-f2f8-4d46-b8c3-d5d3de442ffb.evidence.json |    64 +
 ...da5a15e-f2f8-4d46-b8c3-d5d3de442ffb.result.json |     1 +
 ...2021a-61c5-4c1d-b5ad-ab0eae9fd3bc.evidence.json |    68 +
 ...ad2021a-61c5-4c1d-b5ad-ab0eae9fd3bc.result.json |     1 +
 ...66dd9-aea0-45ba-92d8-5a130168c665.evidence.json |    65 +
 ...6f66dd9-aea0-45ba-92d8-5a130168c665.result.json |     1 +
 ...22c2e-ea3a-492d-90c4-a3b35e8e87c2.evidence.json |    64 +
 ...ae22c2e-ea3a-492d-90c4-a3b35e8e87c2.result.json |     1 +
 ...1e4b6-3c6d-43d3-a190-e679b2f78bc8.evidence.json |    64 +
 ...831e4b6-3c6d-43d3-a190-e679b2f78bc8.result.json |     1 +
 ...d844f-9098-45e7-808e-0c3cf75b9ace.evidence.json |    64 +
 ...a5d844f-9098-45e7-808e-0c3cf75b9ace.result.json |     1 +
 ...d72452-8f3e-4508-bc2a-d4040fd7473a.request.json |     1 +
 ...46d7c-9e62-47bb-b8c2-18534f4d8b30.evidence.json |    64 +
 ...0d46d7c-9e62-47bb-b8c2-18534f4d8b30.result.json |     1 +
 ...c5f6b-132a-4fa0-ba04-d18fa802f37b.evidence.json |    68 +
 ...1fc5f6b-132a-4fa0-ba04-d18fa802f37b.result.json |     1 +
 ...cd2a5-8f23-4505-9579-bffb63660e27.evidence.json |    65 +
 ...97cd2a5-8f23-4505-9579-bffb63660e27.result.json |     1 +
 ...b46c3-6a7d-4627-9952-5759ceeb26c8.evidence.json |    64 +
 ...43b46c3-6a7d-4627-9952-5759ceeb26c8.result.json |     1 +
 ...4ec9b-76e6-466a-8918-e3b0f5f3d356.evidence.json |    64 +
 ...f64ec9b-76e6-466a-8918-e3b0f5f3d356.result.json |     1 +
 ...1d975-a5cb-4147-9b06-5a39820c493f.evidence.json |    64 +
 ...d51d975-a5cb-4147-9b06-5a39820c493f.result.json |     1 +
 ...854-3a056ca6-cc87-4012-80d5-5f4b753a2a47.cancel |     1 +
 ...56ca6-cc87-4012-80d5-5f4b753a2a47.evidence.json |    64 +
 ...a056ca6-cc87-4012-80d5-5f4b753a2a47.result.json |     1 +
 ...1d44b-ae30-45b7-8eaa-bd6900aaa056.evidence.json |    64 +
 ...ce1d44b-ae30-45b7-8eaa-bd6900aaa056.result.json |     1 +
 .../supervision/native-handoff-20261004-r1.json    |    39 +
 .../repairs/supervision/os-repair-handoff-v2.json  |    24 +
 .../supervision/repair-handoff-20261004.json       |    50 +
 .../110/repairs/supervision/reservation-v2.jsonl   |   263 +
 .../brokerdeath.json                               |     1 +
 .../manifest.json                                  |    47 +
 .../overflow-detached                              |     7 +
 .../overflow-normal                                |    14 +
 .../overflow-shell                                 |     7 +
 .../subordinate.pid                                |     1 +
 .../brokerdeath.json                               |     1 +
 .../dead-parent-reviewed-lease.json                |     1 +
 .../forged.json                                    |     1 +
 .../manifest.json                                  |    52 +
 .../overflow-detached                              |     7 +
 .../overflow-normal                                |     7 +
 .../overflow-shell                                 |     7 +
 .../parentdeath-review.json                        |     1 +
 .../parentdeath.json                               |     1 +
 .../subordinate.pid                                |     1 +
 .../brokerdeath.json                               |     1 +
 .../dead-parent-reviewed-lease.json                |     1 +
 .../forged.json                                    |     1 +
 .../manifest.json                                  |    57 +
 .../overflow-detached                              |     7 +
 .../overflow-normal                                |     7 +
 .../overflow-shell                                 |     7 +
 .../parentdeath-review.json                        |     1 +
 .../parentdeath.json                               |     1 +
 .../subordinate.pid                                |     1 +
 .../brokerdeath.json                               |     1 +
 .../manifest.json                                  |    47 +
 .../overflow-detached                              |     7 +
 .../overflow-normal                                |     7 +
 .../overflow-shell                                 |     7 +
 .../subordinate.pid                                |     1 +
 ...12456-b9e6-4ee5-8a01-9c5c62606397.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...b12456-b9e6-4ee5-8a01-9c5c62606397.request.json |     1 +
 ...8b12456-b9e6-4ee5-8a01-9c5c62606397.result.json |     1 +
 ...18ce3-d3fb-4ec6-8144-b9b0794e439e.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...618ce3-d3fb-4ec6-8144-b9b0794e439e.request.json |     1 +
 ...7618ce3-d3fb-4ec6-8144-b9b0794e439e.result.json |     1 +
 ...4d99b-b74a-487a-a25d-bb85b995f614.evidence.json |    65 +
 ...824d99b-b74a-487a-a25d-bb85b995f614.result.json |     1 +
 ...081-0824d99b-b74a-487a-a25d-bb85b995f614.stderr |     0
 ...6081-0824d99b-b74a-487a-a25d-bb85b995f614.stdin |     0
 ...081-0824d99b-b74a-487a-a25d-bb85b995f614.stdout |     1 +
 ...dc23a-197f-4683-9d1a-0263b964b087.evidence.json |    67 +
 .../broker.json                                    |     1 +
 ...1dc23a-197f-4683-9d1a-0263b964b087.request.json |     1 +
 ...31dc23a-197f-4683-9d1a-0263b964b087.result.json |     1 +
 ...3c21d-da11-4a78-86ff-9999d1a465a4.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...f3c21d-da11-4a78-86ff-9999d1a465a4.request.json |     1 +
 ...0f3c21d-da11-4a78-86ff-9999d1a465a4.result.json |     1 +
 ...130-08bcc7bd-1a7c-42da-acee-999c985a9286.cancel |     1 +
 ...cc7bd-1a7c-42da-acee-999c985a9286.evidence.json |    67 +
 .../broker.json                                    |     1 +
 ...bcc7bd-1a7c-42da-acee-999c985a9286.request.json |     1 +
 ...8bcc7bd-1a7c-42da-acee-999c985a9286.result.json |     1 +
 ...6acd5-90ca-46e6-8eff-27693ae5f17f.evidence.json |    64 +
 .../broker.json                                    |     1 +
 ...f6acd5-90ca-46e6-8eff-27693ae5f17f.request.json |     1 +
 ...2f6acd5-90ca-46e6-8eff-27693ae5f17f.result.json |     1 +
 ...3ddea-067a-4f7e-983d-4e6443fa3e43.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...83ddea-067a-4f7e-983d-4e6443fa3e43.request.json |     1 +
 ...283ddea-067a-4f7e-983d-4e6443fa3e43.result.json |     1 +
 ...7bea6-a8b4-41d6-89a3-d89f3ff280f0.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...97bea6-a8b4-41d6-89a3-d89f3ff280f0.request.json |     1 +
 ...e97bea6-a8b4-41d6-89a3-d89f3ff280f0.result.json |     1 +
 ...44b88-8dfe-4202-9a6d-8c8f1c7ecc63.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...544b88-8dfe-4202-9a6d-8c8f1c7ecc63.request.json |     1 +
 ...a544b88-8dfe-4202-9a6d-8c8f1c7ecc63.result.json |     1 +
 ...51ff1-7596-4e3f-af57-b4927354f435.evidence.json |    80 +
 .../broker.json                                    |     1 +
 ...a51ff1-7596-4e3f-af57-b4927354f435.request.json |     1 +
 ...ea51ff1-7596-4e3f-af57-b4927354f435.result.json |     1 +
 ...99044-d0dd-46a0-a45d-0d6b47cff5ae.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...a99044-d0dd-46a0-a45d-0d6b47cff5ae.request.json |     1 +
 ...6a99044-d0dd-46a0-a45d-0d6b47cff5ae.result.json |     1 +
 ...fa919-cf04-45b9-b6f6-45c4c99d5e92.evidence.json |    65 +
 ...5dfa919-cf04-45b9-b6f6-45c4c99d5e92.result.json |     1 +
 ...311-f5dfa919-cf04-45b9-b6f6-45c4c99d5e92.stderr |     0
 ...2311-f5dfa919-cf04-45b9-b6f6-45c4c99d5e92.stdin |     0
 ...311-f5dfa919-cf04-45b9-b6f6-45c4c99d5e92.stdout |     0
 ...70dda-c950-43bb-8936-0376a1148c4c.evidence.json |    67 +
 .../broker.json                                    |     1 +
 ...370dda-c950-43bb-8936-0376a1148c4c.request.json |     1 +
 ...a370dda-c950-43bb-8936-0376a1148c4c.result.json |     1 +
 ...33e1d-dcf4-4e17-b684-2a14dc28924f.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...933e1d-dcf4-4e17-b684-2a14dc28924f.request.json |     1 +
 ...8933e1d-dcf4-4e17-b684-2a14dc28924f.result.json |     1 +
 ...7bbfa-24df-4544-8abd-efcd9c4d870e.evidence.json |    65 +
 ...397bbfa-24df-4544-8abd-efcd9c4d870e.result.json |     1 +
 ...468-9397bbfa-24df-4544-8abd-efcd9c4d870e.stderr |     0
 ...4468-9397bbfa-24df-4544-8abd-efcd9c4d870e.stdin |     0
 ...468-9397bbfa-24df-4544-8abd-efcd9c4d870e.stdout |     1 +
 ...ea543-6682-461c-b294-7bf782afaca5.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...aea543-6682-461c-b294-7bf782afaca5.request.json |     1 +
 ...9aea543-6682-461c-b294-7bf782afaca5.result.json |     1 +
 ...62413-8445-4eb7-90ca-07af3b3f28b8.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...662413-8445-4eb7-90ca-07af3b3f28b8.request.json |     1 +
 ...d662413-8445-4eb7-90ca-07af3b3f28b8.result.json |     1 +
 ...455-df0643e2-a4bf-40e4-8089-ba0b92a55d61.cancel |     1 +
 ...643e2-a4bf-40e4-8089-ba0b92a55d61.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...0643e2-a4bf-40e4-8089-ba0b92a55d61.request.json |     1 +
 ...f0643e2-a4bf-40e4-8089-ba0b92a55d61.result.json |     1 +
 ...56271-6218-4d03-b3dc-f127212830a5.evidence.json |    64 +
 .../broker.json                                    |     1 +
 ...c56271-6218-4d03-b3dc-f127212830a5.request.json |     1 +
 ...6c56271-6218-4d03-b3dc-f127212830a5.result.json |     1 +
 ...10f03-a104-4cc2-8ccd-b64178ce8359.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...610f03-a104-4cc2-8ccd-b64178ce8359.request.json |     1 +
 ...b610f03-a104-4cc2-8ccd-b64178ce8359.result.json |     1 +
 ...08abf-3922-488e-a2d3-374c8a66aa3f.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...008abf-3922-488e-a2d3-374c8a66aa3f.request.json |     1 +
 ...c008abf-3922-488e-a2d3-374c8a66aa3f.result.json |     1 +
 ...65cee-47aa-49b7-9124-ee4441f59d46.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...765cee-47aa-49b7-9124-ee4441f59d46.request.json |     1 +
 ...5765cee-47aa-49b7-9124-ee4441f59d46.result.json |     1 +
 ...ee5e5-d39d-47cb-b890-669f62708308.evidence.json |    82 +
 .../broker.json                                    |     1 +
 ...cee5e5-d39d-47cb-b890-669f62708308.request.json |     1 +
 ...5cee5e5-d39d-47cb-b890-669f62708308.result.json |     1 +
 .../broker.json                                    |     1 +
 ...d2e815-2b96-4310-9b77-eb0ebad5239e.request.json |     1 +
 ...095-09802eba-59df-45dc-ad9b-21ef880c1f9e.stderr |     0
 ...9095-09802eba-59df-45dc-ad9b-21ef880c1f9e.stdin |     0
 ...095-09802eba-59df-45dc-ad9b-21ef880c1f9e.stdout |     0
 ...de490-8ecd-4cc5-a13b-80ebfc4b7681.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...ede490-8ecd-4cc5-a13b-80ebfc4b7681.request.json |     1 +
 ...5ede490-8ecd-4cc5-a13b-80ebfc4b7681.result.json |     1 +
 ...dd8be-5f9e-467d-b1a2-b84784cc2eec.evidence.json |    65 +
 ...c0dd8be-5f9e-467d-b1a2-b84784cc2eec.result.json |     1 +
 ...250-8c0dd8be-5f9e-467d-b1a2-b84784cc2eec.stderr |     0
 ...5250-8c0dd8be-5f9e-467d-b1a2-b84784cc2eec.stdin |     0
 ...250-8c0dd8be-5f9e-467d-b1a2-b84784cc2eec.stdout |     1 +
 ...ac811-be4e-4306-916b-1198f058b1b8.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...1ac811-be4e-4306-916b-1198f058b1b8.request.json |     1 +
 ...f1ac811-be4e-4306-916b-1198f058b1b8.result.json |     1 +
 ...d5f4f-d56a-486b-8014-4ad08c752b74.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...0d5f4f-d56a-486b-8014-4ad08c752b74.request.json |     1 +
 ...40d5f4f-d56a-486b-8014-4ad08c752b74.result.json |     1 +
 ...257-aa3ee756-c8e0-4bc5-ad5b-b9fafdde67a1.cancel |     1 +
 ...ee756-c8e0-4bc5-ad5b-b9fafdde67a1.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...3ee756-c8e0-4bc5-ad5b-b9fafdde67a1.request.json |     1 +
 ...a3ee756-c8e0-4bc5-ad5b-b9fafdde67a1.result.json |     1 +
 ...33bfb-8a92-4bb4-88aa-7a057e88895f.evidence.json |    64 +
 .../broker.json                                    |     1 +
 ...433bfb-8a92-4bb4-88aa-7a057e88895f.request.json |     1 +
 ...8433bfb-8a92-4bb4-88aa-7a057e88895f.result.json |     1 +
 ...22c2a-f518-45c2-bf50-4baf26c55b74.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...c22c2a-f518-45c2-bf50-4baf26c55b74.request.json |     1 +
 ...ec22c2a-f518-45c2-bf50-4baf26c55b74.result.json |     1 +
 ...5f3db-0ef6-403b-9d2f-2dbcd267a82f.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...55f3db-0ef6-403b-9d2f-2dbcd267a82f.request.json |     1 +
 ...b55f3db-0ef6-403b-9d2f-2dbcd267a82f.result.json |     1 +
 ...db4f0-1d4e-4709-b898-6212b87ba8fd.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...fdb4f0-1d4e-4709-b898-6212b87ba8fd.request.json |     1 +
 ...9fdb4f0-1d4e-4709-b898-6212b87ba8fd.result.json |     1 +
 ...03734-f360-4644-b76c-9f75d7cf5c30.evidence.json |    82 +
 .../broker.json                                    |     1 +
 ...d03734-f360-4644-b76c-9f75d7cf5c30.request.json |     1 +
 ...ad03734-f360-4644-b76c-9f75d7cf5c30.result.json |     1 +
 .../broker.json                                    |     1 +
 ...da4221-6174-4d79-9f38-4d787d7d97cd.request.json |     1 +
 ...380-1fb22851-e2b3-42e8-8717-e467a8099e07.stderr |     0
 ...9380-1fb22851-e2b3-42e8-8717-e467a8099e07.stdin |     0
 ...380-1fb22851-e2b3-42e8-8717-e467a8099e07.stdout |     0
 ...f12d7-2d29-4298-abf2-ea3410998e59.evidence.json |    72 +
 .../broker.json                                    |     1 +
 ...af12d7-2d29-4298-abf2-ea3410998e59.request.json |     1 +
 ...9af12d7-2d29-4298-abf2-ea3410998e59.result.json |     1 +
 ...459ef-3afa-4e32-a0e1-ae313038461c.evidence.json |    55 +
 ...0d459ef-3afa-4e32-a0e1-ae313038461c.result.json |     1 +
 ...5606-20d459ef-3afa-4e32-a0e1-ae313038461c.stdin |     0
 .../broker.json                                    |     1 +
 ...a38056-e542-445e-af32-191af29cf943.request.json |     1 +
 ...d9f8f-350c-4b97-9227-e836f6fedd1f.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...4d9f8f-350c-4b97-9227-e836f6fedd1f.request.json |     1 +
 ...94d9f8f-350c-4b97-9227-e836f6fedd1f.result.json |     1 +
 ...1babb-5bba-43cd-93d5-5a8505fd1315.evidence.json |    65 +
 ...d21babb-5bba-43cd-93d5-5a8505fd1315.result.json |     1 +
 ...025-cd21babb-5bba-43cd-93d5-5a8505fd1315.stderr |     0
 ...8025-cd21babb-5bba-43cd-93d5-5a8505fd1315.stdin |     0
 ...025-cd21babb-5bba-43cd-93d5-5a8505fd1315.stdout |     1 +
 ...b8583-0311-4ab3-82c8-79d894d9846a.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...3b8583-0311-4ab3-82c8-79d894d9846a.request.json |     1 +
 ...03b8583-0311-4ab3-82c8-79d894d9846a.result.json |     1 +
 ...7bf40-46fa-4f91-a449-8f1d462f3a05.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...a7bf40-46fa-4f91-a449-8f1d462f3a05.request.json |     1 +
 ...3a7bf40-46fa-4f91-a449-8f1d462f3a05.result.json |     1 +
 ...a1197-0c27-4616-9162-b773632696d3.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...3a1197-0c27-4616-9162-b773632696d3.request.json |     1 +
 ...b3a1197-0c27-4616-9162-b773632696d3.result.json |     1 +
 ...678-08b292cb-4215-4320-bbb0-b1ae4fdf430a.cancel |     1 +
 ...292cb-4215-4320-bbb0-b1ae4fdf430a.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...b292cb-4215-4320-bbb0-b1ae4fdf430a.request.json |     1 +
 ...8b292cb-4215-4320-bbb0-b1ae4fdf430a.result.json |     1 +
 ...c83d6-c0d6-4501-860d-fc260e71a5b4.evidence.json |    64 +
 .../broker.json                                    |     1 +
 ...bc83d6-c0d6-4501-860d-fc260e71a5b4.request.json |     1 +
 ...1bc83d6-c0d6-4501-860d-fc260e71a5b4.result.json |     1 +
 ...63e45-697f-49d2-b8be-20b8182c8ecf.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...e63e45-697f-49d2-b8be-20b8182c8ecf.request.json |     1 +
 ...ee63e45-697f-49d2-b8be-20b8182c8ecf.result.json |     1 +
 ...b3e4e-e9fa-4528-ad68-855653f0382b.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...6b3e4e-e9fa-4528-ad68-855653f0382b.request.json |     1 +
 ...96b3e4e-e9fa-4528-ad68-855653f0382b.result.json |     1 +
 ...8fead-1c50-468c-93fa-664103b0b4c3.evidence.json |    71 +
 .../broker.json                                    |     1 +
 ...98fead-1c50-468c-93fa-664103b0b4c3.request.json |     1 +
 ...e98fead-1c50-468c-93fa-664103b0b4c3.result.json |     1 +
 ...8e980-fade-4925-abf6-f4a5cdd2f9fe.evidence.json |    82 +
 .../broker.json                                    |     1 +
 ...78e980-fade-4925-abf6-f4a5cdd2f9fe.request.json |     1 +
 ...a78e980-fade-4925-abf6-f4a5cdd2f9fe.result.json |     1 +
 .../broker.json                                    |     1 +
 ...b8e554-988e-4586-8e39-5f9d59e49b2c.request.json |     1 +
 ...872-ff81f378-288d-4997-a5f9-e75c45c4b371.stderr |     0
 ...8872-ff81f378-288d-4997-a5f9-e75c45c4b371.stdin |     0
 ...872-ff81f378-288d-4997-a5f9-e75c45c4b371.stdout |     0
 ...325ff-8521-48d5-8df2-d747bc253d57.evidence.json |    72 +
 .../broker.json                                    |     1 +
 ...2325ff-8521-48d5-8df2-d747bc253d57.request.json |     1 +
 ...d2325ff-8521-48d5-8df2-d747bc253d57.result.json |     1 +
 ...4ab62-89a7-4133-871e-df71b8b69117.evidence.json |    55 +
 ...f04ab62-89a7-4133-871e-df71b8b69117.result.json |     1 +
 ...4968-7f04ab62-89a7-4133-871e-df71b8b69117.stdin |     0
 .../broker.json                                    |     1 +
 ...7e94a3-b28b-4cd0-9330-4efb7febbde3.request.json |     1 +
 ...c729c-12bb-4328-8c52-f0f6af6fcbbc.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...8c729c-12bb-4328-8c52-f0f6af6fcbbc.request.json |     1 +
 ...f8c729c-12bb-4328-8c52-f0f6af6fcbbc.result.json |     1 +
 ...a84c9-e87f-47de-bf77-ee69963eaef3.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...8a84c9-e87f-47de-bf77-ee69963eaef3.request.json |     1 +
 ...28a84c9-e87f-47de-bf77-ee69963eaef3.result.json |     1 +
 ...eade2-7b05-4f5e-9c57-b50c1eb25c6e.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...2eade2-7b05-4f5e-9c57-b50c1eb25c6e.request.json |     1 +
 ...d2eade2-7b05-4f5e-9c57-b50c1eb25c6e.result.json |     1 +
 ...fdae7-f957-4100-b7c4-d8edee52146f.evidence.json |    65 +
 ...4dfdae7-f957-4100-b7c4-d8edee52146f.result.json |     1 +
 ...462-84dfdae7-f957-4100-b7c4-d8edee52146f.stderr |    45 +
 ...7462-84dfdae7-f957-4100-b7c4-d8edee52146f.stdin |     0
 ...462-84dfdae7-f957-4100-b7c4-d8edee52146f.stdout |     0
 ...e6ccb-67e9-49bb-8b6a-48fb4e8a4f0a.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...2e6ccb-67e9-49bb-8b6a-48fb4e8a4f0a.request.json |     1 +
 ...62e6ccb-67e9-49bb-8b6a-48fb4e8a4f0a.result.json |     1 +
 ...d61c4-308a-46e6-92f0-dcbc6244e533.evidence.json |    69 +
 ...e6d61c4-308a-46e6-92f0-dcbc6244e533.result.json |     1 +
 ...243-de6d61c4-308a-46e6-92f0-dcbc6244e533.stderr |     5 +
 ...3243-de6d61c4-308a-46e6-92f0-dcbc6244e533.stdin |     0
 ...243-de6d61c4-308a-46e6-92f0-dcbc6244e533.stdout |     0
 ...515be-9dc4-44b9-ba16-84b2a8e7c7e1.evidence.json |    69 +
 ...f1515be-9dc4-44b9-ba16-84b2a8e7c7e1.result.json |     1 +
 ...557-ef1515be-9dc4-44b9-ba16-84b2a8e7c7e1.stderr |     5 +
 ...6557-ef1515be-9dc4-44b9-ba16-84b2a8e7c7e1.stdin |     0
 ...557-ef1515be-9dc4-44b9-ba16-84b2a8e7c7e1.stdout |     0
 ...7e3a9-1a18-4717-9a11-920070c1efda.evidence.json |    70 +
 ...b27e3a9-1a18-4717-9a11-920070c1efda.result.json |     1 +
 ...864-5b27e3a9-1a18-4717-9a11-920070c1efda.stderr |     0
 ...9864-5b27e3a9-1a18-4717-9a11-920070c1efda.stdin |     0
 ...864-5b27e3a9-1a18-4717-9a11-920070c1efda.stdout |    17 +
 ...e2d8b-1ff2-4ae9-a0b4-6713b2a98df5.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...5e2d8b-1ff2-4ae9-a0b4-6713b2a98df5.request.json |     1 +
 ...a5e2d8b-1ff2-4ae9-a0b4-6713b2a98df5.result.json |     1 +
 ...36e3c-4191-4f28-89fe-0115e8333782.evidence.json |    68 +
 ...3336e3c-4191-4f28-89fe-0115e8333782.result.json |     1 +
 ...056-93336e3c-4191-4f28-89fe-0115e8333782.stderr |     0
 ...3056-93336e3c-4191-4f28-89fe-0115e8333782.stdin |     0
 ...056-93336e3c-4191-4f28-89fe-0115e8333782.stdout |     1 +
 ...54d29-f1c5-42fc-8629-870cae52a617.evidence.json |    68 +
 ...e154d29-f1c5-42fc-8629-870cae52a617.result.json |     1 +
 ...674-fe154d29-f1c5-42fc-8629-870cae52a617.stderr |     1 +
 ...1674-fe154d29-f1c5-42fc-8629-870cae52a617.stdin |     0
 ...674-fe154d29-f1c5-42fc-8629-870cae52a617.stdout |     0
 ...85f7e-f58a-47c2-9997-34448dff8112.evidence.json |    77 +
 .../broker.json                                    |     1 +
 ...a85f7e-f58a-47c2-9997-34448dff8112.request.json |     1 +
 ...fa85f7e-f58a-47c2-9997-34448dff8112.result.json |     1 +
 ...e2e58-e870-4282-a566-a195fb50b333.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...0e2e58-e870-4282-a566-a195fb50b333.request.json |     1 +
 ...50e2e58-e870-4282-a566-a195fb50b333.result.json |     1 +
 ...28de9-35e4-4fbf-a0d2-08cfb1c4ef79.evidence.json |    66 +
 ...d228de9-35e4-4fbf-a0d2-08cfb1c4ef79.result.json |     1 +
 ...772-7d228de9-35e4-4fbf-a0d2-08cfb1c4ef79.stderr |   114 +
 ...2772-7d228de9-35e4-4fbf-a0d2-08cfb1c4ef79.stdin |     0
 ...772-7d228de9-35e4-4fbf-a0d2-08cfb1c4ef79.stdout |   314 +
 ...351d1-b771-4c7d-99ce-6b30f660d08f.evidence.json |    66 +
 ...f6351d1-b771-4c7d-99ce-6b30f660d08f.result.json |     1 +
 ...748-1f6351d1-b771-4c7d-99ce-6b30f660d08f.stderr |     0
 ...4748-1f6351d1-b771-4c7d-99ce-6b30f660d08f.stdin |     0
 ...748-1f6351d1-b771-4c7d-99ce-6b30f660d08f.stdout |   282 +
 ...cea90-87b6-4502-91f9-9a7bf4cddad8.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...5cea90-87b6-4502-91f9-9a7bf4cddad8.request.json |     1 +
 ...05cea90-87b6-4502-91f9-9a7bf4cddad8.result.json |     1 +
 ...57e15-9240-48c8-b172-ddf9d2630fa5.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...657e15-9240-48c8-b172-ddf9d2630fa5.request.json |     1 +
 ...5657e15-9240-48c8-b172-ddf9d2630fa5.result.json |     1 +
 ...41d64-b912-4ed2-8d8b-5b79ccc914a8.evidence.json |    66 +
 ...5b41d64-b912-4ed2-8d8b-5b79ccc914a8.result.json |     1 +
 ...635-55b41d64-b912-4ed2-8d8b-5b79ccc914a8.stderr |   114 +
 ...5635-55b41d64-b912-4ed2-8d8b-5b79ccc914a8.stdin |     0
 ...635-55b41d64-b912-4ed2-8d8b-5b79ccc914a8.stdout |   316 +
 ...563b6-914a-494e-8b3c-b7077b3a4c43.evidence.json |    66 +
 ...e2563b6-914a-494e-8b3c-b7077b3a4c43.result.json |     1 +
 ...464-1e2563b6-914a-494e-8b3c-b7077b3a4c43.stderr |     0
 ...1464-1e2563b6-914a-494e-8b3c-b7077b3a4c43.stdin |     0
 ...464-1e2563b6-914a-494e-8b3c-b7077b3a4c43.stdout |   284 +
 .../broker.json                                    |     1 +
 ...10ca9a-07d4-4448-b5c0-a320915c4abe.request.json |     1 +
 ...606-82f0a79a-29ad-4720-98dc-5a1cd7e4acd8.stderr |     0
 ...9606-82f0a79a-29ad-4720-98dc-5a1cd7e4acd8.stdin |     0
 ...606-82f0a79a-29ad-4720-98dc-5a1cd7e4acd8.stdout |     0
 .../broker.json                                    |     1 +
 ...239a35-b2e6-441e-872d-8b7636fe5419.request.json |     1 +
 ...6c8b8-a4f3-40f8-95e1-c56d85ff342b.evidence.json |    66 +
 ...2f6c8b8-a4f3-40f8-95e1-c56d85ff342b.result.json |     1 +
 ...446-a2f6c8b8-a4f3-40f8-95e1-c56d85ff342b.stderr |   114 +
 ...2446-a2f6c8b8-a4f3-40f8-95e1-c56d85ff342b.stdin |     0
 ...446-a2f6c8b8-a4f3-40f8-95e1-c56d85ff342b.stdout |   316 +
 ...1b501-8e48-4ebf-8723-d11613caed57.evidence.json |    66 +
 ...c11b501-8e48-4ebf-8723-d11613caed57.result.json |     1 +
 ...432-6c11b501-8e48-4ebf-8723-d11613caed57.stderr |     0
 ...3432-6c11b501-8e48-4ebf-8723-d11613caed57.stdin |     0
 ...432-6c11b501-8e48-4ebf-8723-d11613caed57.stdout |   284 +
 ...f305d-a994-48b0-9b37-83d093446aba.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...cf305d-a994-48b0-9b37-83d093446aba.request.json |     1 +
 ...8cf305d-a994-48b0-9b37-83d093446aba.result.json |     1 +
 ...8b7de-abe8-4c56-b95e-0efadc08915e.evidence.json |    66 +
 ...2b8b7de-abe8-4c56-b95e-0efadc08915e.result.json |     1 +
 ...759-92b8b7de-abe8-4c56-b95e-0efadc08915e.stderr |   114 +
 ...1759-92b8b7de-abe8-4c56-b95e-0efadc08915e.stdin |     0
 ...759-92b8b7de-abe8-4c56-b95e-0efadc08915e.stdout |   314 +
 ...3fd52-0edb-4b4b-be64-e05f6514b8ae.evidence.json |    66 +
 ...e93fd52-0edb-4b4b-be64-e05f6514b8ae.result.json |     1 +
 ...197-1e93fd52-0edb-4b4b-be64-e05f6514b8ae.stderr |     0
 ...2197-1e93fd52-0edb-4b4b-be64-e05f6514b8ae.stdin |     0
 ...197-1e93fd52-0edb-4b4b-be64-e05f6514b8ae.stdout |   282 +
 ...68501-a577-4776-9bc7-dc1e5bf9a895.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...068501-a577-4776-9bc7-dc1e5bf9a895.request.json |     1 +
 ...5068501-a577-4776-9bc7-dc1e5bf9a895.result.json |     1 +
 ...1824d-ec69-45dd-84cd-d36e4d29593e.evidence.json |    66 +
 ...571824d-ec69-45dd-84cd-d36e4d29593e.result.json |     1 +
 ...003-a571824d-ec69-45dd-84cd-d36e4d29593e.stderr |   114 +
 ...2003-a571824d-ec69-45dd-84cd-d36e4d29593e.stdin |     0
 ...003-a571824d-ec69-45dd-84cd-d36e4d29593e.stdout |   316 +
 ...aed80-d241-46b0-873c-594e18d0b76a.evidence.json |    66 +
 ...56aed80-d241-46b0-873c-594e18d0b76a.result.json |     1 +
 ...277-456aed80-d241-46b0-873c-594e18d0b76a.stderr |     0
 ...3277-456aed80-d241-46b0-873c-594e18d0b76a.stdin |     0
 ...277-456aed80-d241-46b0-873c-594e18d0b76a.stdout |   284 +
 ...a8f35-cde3-4339-8937-cdf924da52c9.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...4a8f35-cde3-4339-8937-cdf924da52c9.request.json |     1 +
 ...34a8f35-cde3-4339-8937-cdf924da52c9.result.json |     1 +
 ...4e57f-de46-4e55-b64f-a35664da36d9.evidence.json |    66 +
 ...024e57f-de46-4e55-b64f-a35664da36d9.result.json |     1 +
 ...448-d024e57f-de46-4e55-b64f-a35664da36d9.stderr |   114 +
 ...0448-d024e57f-de46-4e55-b64f-a35664da36d9.stdin |     0
 ...448-d024e57f-de46-4e55-b64f-a35664da36d9.stdout |   314 +
 ...0bb0f-cf1b-4928-9bb1-f1c175b0db3e.evidence.json |    66 +
 ...7f0bb0f-cf1b-4928-9bb1-f1c175b0db3e.result.json |     1 +
 ...714-37f0bb0f-cf1b-4928-9bb1-f1c175b0db3e.stderr |     0
 ...1714-37f0bb0f-cf1b-4928-9bb1-f1c175b0db3e.stdin |     0
 ...714-37f0bb0f-cf1b-4928-9bb1-f1c175b0db3e.stdout |   282 +
 ...88d17-77f9-4756-a2b8-0e548a34537b.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...488d17-77f9-4756-a2b8-0e548a34537b.request.json |     1 +
 ...3488d17-77f9-4756-a2b8-0e548a34537b.result.json |     1 +
 ...5b3de-18ca-41d2-b42f-615de4307ec7.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...e5b3de-18ca-41d2-b42f-615de4307ec7.request.json |     1 +
 ...de5b3de-18ca-41d2-b42f-615de4307ec7.result.json |     1 +
 ...5e40d-ad2f-4f73-9f4b-62a133ba2346.evidence.json |    74 +
 .../broker.json                                    |     1 +
 ...f5e40d-ad2f-4f73-9f4b-62a133ba2346.request.json |     1 +
 ...af5e40d-ad2f-4f73-9f4b-62a133ba2346.result.json |     1 +
 ...a7373-8f9b-4aa4-867c-9abbf0b0f81a.evidence.json |    74 +
 .../broker.json                                    |     1 +
 ...ea7373-8f9b-4aa4-867c-9abbf0b0f81a.request.json |     1 +
 ...5ea7373-8f9b-4aa4-867c-9abbf0b0f81a.result.json |     1 +
 ...99bf4-1c3d-48d4-85f1-60c715b36441.evidence.json |    74 +
 .../broker.json                                    |     1 +
 ...999bf4-1c3d-48d4-85f1-60c715b36441.request.json |     1 +
 ...3999bf4-1c3d-48d4-85f1-60c715b36441.result.json |     1 +
 ...e2b12-4b63-44ac-a297-4ad9e686310c.evidence.json |    67 +
 ...96e2b12-4b63-44ac-a297-4ad9e686310c.result.json |     1 +
 ...783-996e2b12-4b63-44ac-a297-4ad9e686310c.stderr |     0
 ...7783-996e2b12-4b63-44ac-a297-4ad9e686310c.stdin |     0
 ...783-996e2b12-4b63-44ac-a297-4ad9e686310c.stdout |     1 +
 ...53fbf-9e36-477b-bb6f-b22f998c7bbf.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...553fbf-9e36-477b-bb6f-b22f998c7bbf.request.json |     1 +
 ...e553fbf-9e36-477b-bb6f-b22f998c7bbf.result.json |     1 +
 ...d36a8-dc81-4a26-8a51-de05af6cba6d.evidence.json |    74 +
 .../broker.json                                    |     1 +
 ...fd36a8-dc81-4a26-8a51-de05af6cba6d.request.json |     1 +
 ...afd36a8-dc81-4a26-8a51-de05af6cba6d.result.json |     1 +
 ...3304c-c666-418f-916b-f19a09e8cb8c.evidence.json |    67 +
 ...933304c-c666-418f-916b-f19a09e8cb8c.result.json |     1 +
 ...725-f933304c-c666-418f-916b-f19a09e8cb8c.stderr |     0
 ...7725-f933304c-c666-418f-916b-f19a09e8cb8c.stdin |     0
 ...725-f933304c-c666-418f-916b-f19a09e8cb8c.stdout |     1 +
 ...03560-9c3d-4597-a9f4-d197108a7b97.evidence.json |    74 +
 .../broker.json                                    |     1 +
 ...b03560-9c3d-4597-a9f4-d197108a7b97.request.json |     1 +
 ...db03560-9c3d-4597-a9f4-d197108a7b97.result.json |     1 +
 ...60157-3be2-4936-b8d4-d56e59e889a2.evidence.json |    67 +
 ...6b60157-3be2-4936-b8d4-d56e59e889a2.result.json |     1 +
 ...748-56b60157-3be2-4936-b8d4-d56e59e889a2.stderr |     0
 ...6748-56b60157-3be2-4936-b8d4-d56e59e889a2.stdin |     0
 ...748-56b60157-3be2-4936-b8d4-d56e59e889a2.stdout |     1 +
 ...a52f7-de20-4137-adfd-ec1d627219f6.evidence.json |    65 +
 ...aca52f7-de20-4137-adfd-ec1d627219f6.result.json |     1 +
 ...091-6aca52f7-de20-4137-adfd-ec1d627219f6.stderr |     0
 ...3091-6aca52f7-de20-4137-adfd-ec1d627219f6.stdin |     0
 ...091-6aca52f7-de20-4137-adfd-ec1d627219f6.stdout |     1 +
 ...d6f21-4ed0-44ae-a9a8-b775b6f8ebc2.evidence.json |    68 +
 ...7ad6f21-4ed0-44ae-a9a8-b775b6f8ebc2.result.json |     1 +
 ...486-67ad6f21-4ed0-44ae-a9a8-b775b6f8ebc2.stderr |     0
 ...8486-67ad6f21-4ed0-44ae-a9a8-b775b6f8ebc2.stdin |     0
 ...486-67ad6f21-4ed0-44ae-a9a8-b775b6f8ebc2.stdout |   159 +
 ...34536-f103-46f9-9f02-82f4b8d00b1e.evidence.json |    64 +
 ...7734536-f103-46f9-9f02-82f4b8d00b1e.result.json |     1 +
 ...724-77734536-f103-46f9-9f02-82f4b8d00b1e.stderr |     0
 ...3724-77734536-f103-46f9-9f02-82f4b8d00b1e.stdin |     0
 ...724-77734536-f103-46f9-9f02-82f4b8d00b1e.stdout |     7 +
 ...6ad98-995b-46e7-bba6-2d2a13a04466.evidence.json |    67 +
 ...136ad98-995b-46e7-bba6-2d2a13a04466.result.json |     1 +
 ...337-1136ad98-995b-46e7-bba6-2d2a13a04466.stderr |     0
 ...9337-1136ad98-995b-46e7-bba6-2d2a13a04466.stdin |     0
 ...337-1136ad98-995b-46e7-bba6-2d2a13a04466.stdout |     1 +
 ...f39c0-fa3c-48c8-96c6-21b26925a4f1.evidence.json |    65 +
 ...6ef39c0-fa3c-48c8-96c6-21b26925a4f1.result.json |     1 +
 ...907-46ef39c0-fa3c-48c8-96c6-21b26925a4f1.stderr |     0
 ...4907-46ef39c0-fa3c-48c8-96c6-21b26925a4f1.stdin |     0
 ...907-46ef39c0-fa3c-48c8-96c6-21b26925a4f1.stdout |     1 +
 ...9a01e-bc7a-4ca5-a0e0-6dac9750c9a4.evidence.json |    68 +
 ...7e9a01e-bc7a-4ca5-a0e0-6dac9750c9a4.result.json |     1 +
 ...347-67e9a01e-bc7a-4ca5-a0e0-6dac9750c9a4.stderr |     0
 ...0347-67e9a01e-bc7a-4ca5-a0e0-6dac9750c9a4.stdin |     0
 ...347-67e9a01e-bc7a-4ca5-a0e0-6dac9750c9a4.stdout |   159 +
 ...b7c34-a190-4ded-b637-147f14de7cc4.evidence.json |    64 +
 ...53b7c34-a190-4ded-b637-147f14de7cc4.result.json |     1 +
 ...671-953b7c34-a190-4ded-b637-147f14de7cc4.stderr |     0
 ...7671-953b7c34-a190-4ded-b637-147f14de7cc4.stdin |     0
 ...671-953b7c34-a190-4ded-b637-147f14de7cc4.stdout |     7 +
 ...e8e97-34bf-4d26-81a2-95b5c855e1e8.evidence.json |    67 +
 ...b4e8e97-34bf-4d26-81a2-95b5c855e1e8.result.json |     1 +
 ...416-9b4e8e97-34bf-4d26-81a2-95b5c855e1e8.stderr |     0
 ...3416-9b4e8e97-34bf-4d26-81a2-95b5c855e1e8.stdin |     0
 ...416-9b4e8e97-34bf-4d26-81a2-95b5c855e1e8.stdout |     1 +
 ...259b0-c3b6-4f0c-9af4-e3b3f931b967.evidence.json |    65 +
 ...87259b0-c3b6-4f0c-9af4-e3b3f931b967.result.json |     1 +
 ...937-987259b0-c3b6-4f0c-9af4-e3b3f931b967.stderr |     0
 ...8937-987259b0-c3b6-4f0c-9af4-e3b3f931b967.stdin |     0
 ...937-987259b0-c3b6-4f0c-9af4-e3b3f931b967.stdout |     1 +
 ...d3c8a-a271-4018-a891-731824196151.evidence.json |    68 +
 ...b9d3c8a-a271-4018-a891-731824196151.result.json |     1 +
 ...383-0b9d3c8a-a271-4018-a891-731824196151.stderr |     0
 ...4383-0b9d3c8a-a271-4018-a891-731824196151.stdin |     0
 ...383-0b9d3c8a-a271-4018-a891-731824196151.stdout |   159 +
 ...81ecd-a5d9-42b3-aeaf-d2c69e95d384.evidence.json |    64 +
 ...1c81ecd-a5d9-42b3-aeaf-d2c69e95d384.result.json |     1 +
 ...742-11c81ecd-a5d9-42b3-aeaf-d2c69e95d384.stderr |     0
 ...9742-11c81ecd-a5d9-42b3-aeaf-d2c69e95d384.stdin |     0
 ...742-11c81ecd-a5d9-42b3-aeaf-d2c69e95d384.stdout |     7 +
 ...0b059-b24c-47d4-ada7-b5c84c82958d.evidence.json |    67 +
 ...1e0b059-b24c-47d4-ada7-b5c84c82958d.result.json |     1 +
 ...019-c1e0b059-b24c-47d4-ada7-b5c84c82958d.stderr |     0
 ...7019-c1e0b059-b24c-47d4-ada7-b5c84c82958d.stdin |     0
 ...019-c1e0b059-b24c-47d4-ada7-b5c84c82958d.stdout |     1 +
 ...2dacd-0d3d-4a7d-810b-8d7d8d9985ee.evidence.json |    65 +
 ...e32dacd-0d3d-4a7d-810b-8d7d8d9985ee.result.json |     1 +
 ...405-4e32dacd-0d3d-4a7d-810b-8d7d8d9985ee.stderr |     0
 ...4405-4e32dacd-0d3d-4a7d-810b-8d7d8d9985ee.stdin |     0
 ...405-4e32dacd-0d3d-4a7d-810b-8d7d8d9985ee.stdout |     1 +
 ...a6326-d5a3-4fc4-8446-c3553e9b8096.evidence.json |    68 +
 ...65a6326-d5a3-4fc4-8446-c3553e9b8096.result.json |     1 +
 ...325-765a6326-d5a3-4fc4-8446-c3553e9b8096.stderr |     0
 ...0325-765a6326-d5a3-4fc4-8446-c3553e9b8096.stdin |     0
 ...325-765a6326-d5a3-4fc4-8446-c3553e9b8096.stdout |   159 +
 ...2d7e6-a52b-4721-96fd-595b352bda78.evidence.json |    64 +
 ...0d2d7e6-a52b-4721-96fd-595b352bda78.result.json |     1 +
 ...976-c0d2d7e6-a52b-4721-96fd-595b352bda78.stderr |     0
 ...5976-c0d2d7e6-a52b-4721-96fd-595b352bda78.stdin |     0
 ...976-c0d2d7e6-a52b-4721-96fd-595b352bda78.stdout |     7 +
 ...104a7-9287-46af-bd6b-8608cdf012f9.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...4104a7-9287-46af-bd6b-8608cdf012f9.request.json |     1 +
 ...84104a7-9287-46af-bd6b-8608cdf012f9.result.json |     1 +
 ...46b71-fde7-4ccc-9f0b-f7d472da371d.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...646b71-fde7-4ccc-9f0b-f7d472da371d.request.json |     1 +
 ...8646b71-fde7-4ccc-9f0b-f7d472da371d.result.json |     1 +
 ...c8b3d-37d4-41e8-9e62-122c87832099.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...7c8b3d-37d4-41e8-9e62-122c87832099.request.json |     1 +
 ...b7c8b3d-37d4-41e8-9e62-122c87832099.result.json |     1 +
 ...6f0f4-97c9-4d23-80a5-98ea3016a7d8.evidence.json |    74 +
 .../broker.json                                    |     1 +
 ...46f0f4-97c9-4d23-80a5-98ea3016a7d8.request.json |     1 +
 ...b46f0f4-97c9-4d23-80a5-98ea3016a7d8.result.json |     1 +
 ...9f036-2880-4c4a-9d17-3afb9c662092.evidence.json |    75 +
 .../broker.json                                    |     1 +
 ...39f036-2880-4c4a-9d17-3afb9c662092.request.json |     1 +
 ...d39f036-2880-4c4a-9d17-3afb9c662092.result.json |     1 +
 ...6a336-b281-48c1-9865-922f22fe691b.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...66a336-b281-48c1-9865-922f22fe691b.request.json |     1 +
 ...666a336-b281-48c1-9865-922f22fe691b.result.json |     1 +
 ...c4108-e823-47da-aab1-7fef9ceccddb.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...fc4108-e823-47da-aab1-7fef9ceccddb.request.json |     1 +
 ...0fc4108-e823-47da-aab1-7fef9ceccddb.result.json |     1 +
 ...c1b05-92c2-4d8b-aece-8f7727aae7fc.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...5c1b05-92c2-4d8b-aece-8f7727aae7fc.request.json |     1 +
 ...05c1b05-92c2-4d8b-aece-8f7727aae7fc.result.json |     1 +
 ...97dab-ecdd-47e5-82b1-9aca206e77fa.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...797dab-ecdd-47e5-82b1-9aca206e77fa.request.json |     1 +
 ...2797dab-ecdd-47e5-82b1-9aca206e77fa.result.json |     1 +
 ...0f399-0151-42e1-a741-65c01e83d97e.evidence.json |    76 +
 .../broker.json                                    |     1 +
 ...80f399-0151-42e1-a741-65c01e83d97e.request.json |     1 +
 ...f80f399-0151-42e1-a741-65c01e83d97e.result.json |     1 +
 ...17957-065e-450f-b96e-fbe8d2961e47.evidence.json |    72 +
 .../broker.json                                    |     1 +
 ...f17957-065e-450f-b96e-fbe8d2961e47.request.json |     1 +
 ...cf17957-065e-450f-b96e-fbe8d2961e47.result.json |     1 +
 ...95fb4-7ee0-4f54-b045-869446066218.evidence.json |    72 +
 .../broker.json                                    |     1 +
 ...c95fb4-7ee0-4f54-b045-869446066218.request.json |     1 +
 ...bc95fb4-7ee0-4f54-b045-869446066218.result.json |     1 +
 ...c12ce-c304-4244-883d-ae6bbfb589ff.evidence.json |    74 +
 .../broker.json                                    |     1 +
 ...2c12ce-c304-4244-883d-ae6bbfb589ff.request.json |     1 +
 ...32c12ce-c304-4244-883d-ae6bbfb589ff.result.json |     1 +
 ...dc455-7730-4882-966e-b6a94fbd79a2.evidence.json |    64 +
 ...e2dc455-7730-4882-966e-b6a94fbd79a2.result.json |     1 +
 ...527-de2dc455-7730-4882-966e-b6a94fbd79a2.stderr |     2 +
 ...3527-de2dc455-7730-4882-966e-b6a94fbd79a2.stdin |     0
 ...527-de2dc455-7730-4882-966e-b6a94fbd79a2.stdout |     9 +
 ...5d8fb-46ee-4214-9ab9-32e858c09c48.evidence.json |    77 +
 .../broker.json                                    |     1 +
 ...25d8fb-46ee-4214-9ab9-32e858c09c48.request.json |     1 +
 ...d25d8fb-46ee-4214-9ab9-32e858c09c48.result.json |     1 +
 ...c14de-5bf2-4bcd-b905-61a0b1473f42.evidence.json |    85 +
 .../broker.json                                    |     1 +
 ...7c14de-5bf2-4bcd-b905-61a0b1473f42.request.json |     1 +
 ...27c14de-5bf2-4bcd-b905-61a0b1473f42.result.json |     1 +
 ...93887-306d-4b00-b511-c62682765657.evidence.json |    78 +
 .../broker.json                                    |     1 +
 ...093887-306d-4b00-b511-c62682765657.request.json |     1 +
 ...4093887-306d-4b00-b511-c62682765657.result.json |     1 +
 ...01f14-8e16-49c5-b7b9-8944704b4407.evidence.json |    85 +
 .../broker.json                                    |     1 +
 ...c01f14-8e16-49c5-b7b9-8944704b4407.request.json |     1 +
 ...ac01f14-8e16-49c5-b7b9-8944704b4407.result.json |     1 +
 ...8fdf9-6067-4261-b796-e7c802f40e53.evidence.json |    66 +
 ...378fdf9-6067-4261-b796-e7c802f40e53.result.json |     1 +
 ...349-b378fdf9-6067-4261-b796-e7c802f40e53.stderr |     0
 ...8349-b378fdf9-6067-4261-b796-e7c802f40e53.stdin |     1 +
 ...349-b378fdf9-6067-4261-b796-e7c802f40e53.stdout |     0
 ...b48b3-160b-45db-8404-44415212a12b.evidence.json |    66 +
 ...b6b48b3-160b-45db-8404-44415212a12b.result.json |     1 +
 ...909-1b6b48b3-160b-45db-8404-44415212a12b.stderr |     0
 ...8909-1b6b48b3-160b-45db-8404-44415212a12b.stdin |     1 +
 ...909-1b6b48b3-160b-45db-8404-44415212a12b.stdout |     0
 ...7afc3-16d6-4174-8ef6-9da634736f7b.evidence.json |    74 +
 .../broker.json                                    |     1 +
 ...37afc3-16d6-4174-8ef6-9da634736f7b.request.json |     1 +
 ...837afc3-16d6-4174-8ef6-9da634736f7b.result.json |     1 +
 ...17370-7a6e-4342-8a17-15c57396e8c3.evidence.json |    64 +
 ...7e17370-7a6e-4342-8a17-15c57396e8c3.result.json |     1 +
 ...986-67e17370-7a6e-4342-8a17-15c57396e8c3.stderr |     8 +
 ...5986-67e17370-7a6e-4342-8a17-15c57396e8c3.stdin |     0
 ...986-67e17370-7a6e-4342-8a17-15c57396e8c3.stdout |    10 +
 .../evidence/110/trials/base-file.json             |  5966 +++
 .../evidence/110/trials/materialization-gate.json  |    83 +
 .../evidence/110/trials/oracles.json               |  9299 ++++
 .../evidence/110/trials/process-bench.json         |  6085 +++
 .../evidence/110/trials/roots.json                 |    33 +
 .../110/usage/BASE_BUILD-before-restore.json       |    21 +
 .../evidence/110/usage/BASE_BUILD-built.json       |    21 +
 .../110/usage/BENCH_BUILD-before-restore.json      |    21 +
 .../110/usage/FILE_BUILD-before-restore.json       |    21 +
 .../evidence/110/usage/FILE_BUILD-built.json       |    21 +
 .../110/usage/PROCESS_BUILD-before-restore.json    |    21 +
 .../evidence/110/usage/PROCESS_BUILD-built.json    |    21 +
 .../evidence/110/usage/builds-complete.json        |    21 +
 .../evidence/110/usage/calibration.json            |    21 +
 .../evidence/110/usage/final-with-git.json         |    12 +
 .../evidence/110/usage/inventory.json              |    21 +
 .../evidence/110/usage/materialization.json        |    21 +
 .../execute-reconciliation-04d.mjs                 |    26 +
 .../execute-reconciliation-04e.mjs                 |    26 +
 .../execute-reconciliation-04f.mjs                 |    36 +
 .../failed-process-git-metadata/HEAD               |     1 +
 .../failed-process-git-metadata/config             |     7 +
 .../failed-process-git-metadata/description        |     1 +
 .../hooks/applypatch-msg.sample                    |    15 +
 .../hooks/commit-msg.sample                        |    24 +
 .../hooks/fsmonitor-watchman.sample                |   174 +
 .../hooks/post-update.sample                       |     8 +
 .../hooks/pre-applypatch.sample                    |    14 +
 .../hooks/pre-commit.sample                        |    49 +
 .../hooks/pre-merge-commit.sample                  |    13 +
 .../hooks/pre-push.sample                          |    53 +
 .../hooks/pre-rebase.sample                        |   169 +
 .../hooks/pre-receive.sample                       |    24 +
 .../hooks/prepare-commit-msg.sample                |    42 +
 .../hooks/push-to-checkout.sample                  |    78 +
 .../hooks/sendemail-validate.sample                |    77 +
 .../hooks/update.sample                            |   128 +
 .../failed-process-git-metadata/info/exclude       |     6 +
 .../final-evidence-pack.md                         |    37 +
 .../mcp110-execution-01a1040a/guard-tests.txt      |    28 +
 .../integration-preflight-report.mjs               |    13 +
 .../integration-ready-commands.md                  |   102 +
 .../integration-scoped.test.mjs                    |    62 +
 .../integration-stream-native.test.mjs             |    59 +
 .../materialize-resume.mjs                         |     5 +
 .../mcp110-execution-01a1040a/materialize.mjs      |    18 +
 .../mcp110-execution-01a1040a/mvp-gate.mjs         |    33 +
 .../mcp110-execution-01a1040a/preparation.mjs      |    86 +
 .../mcp110-execution-01a1040a/preparation.test.mjs |    11 +
 .../prepare-authorization-06.mjs                   |    42 +
 .../prospective-budget-v3.mjs                      |    75 +
 .../prospective-budget-v3.test.mjs                 |    31 +
 .../reconcile-path-join-amendment.json             |    16 +
 .../reconcile-path-join-puretest.mjs               |    39 +
 .../reconcile-path-join-report.md                  |    10 +
 .../mcp110-execution-01a1040a/reconcile.mjs        |     9 +
 .../reconciliation-04d-review-ready.md             |    52 +
 .../reconciliation-04e-review-ready.md             |    56 +
 .../reconciliation-04f-review-ready.md             |    43 +
 .../review-prompt-round2.md                        |    19 +
 .../review-prompt-round3.md                        |    20 +
 ...LD-test-read-completed-process.js-fresh-v3.json |   468 +
 ...LD-test-read-completed-process.js-fresh-v4.json |   570 +
 .../BASE_BUILD-test-read-completed-process.js.json |   460 +
 ...-test-file-search-edit-compact.js-fresh-v3.json |   598 +
 ...-test-file-search-edit-compact.js-fresh-v4.json |   702 +
 ...ILE_BUILD-test-file-search-edit-compact.js.json |   590 +
 ...BUILD-test-process-runtime-110.js-fresh-v3.json |   705 +
 ...BUILD-test-process-runtime-110.js-fresh-v4.json |   807 +
 .../PROCESS_BUILD-test-process-runtime-110.js.json |   697 +
 ...LD-test-read-completed-process.js-fresh-v3.json |   468 +
 ...LD-test-read-completed-process.js-fresh-v4.json |   570 +
 ...OCESS_BUILD-test-read-completed-process.js.json |   460 +
 .../fullserver-sensitivity-v2.json                 |   271 +
 .../fullserver-sensitivity-v3-draft.json           |  1125 +
 .../runner-review-report-v2.md                     |    67 +
 .../runner-review-template-v2.json                 |    14 +
 .../runtime-config/BASE_BUILD/config.json          |    44 +
 .../runtime-config/FILE_BUILD/config.json          |    45 +
 .../runtime-config/PROCESS_BUILD/config.json       |    44 +
 .../.reconciliation-owner.json                     |     1 +
 .../config.json                                    |    44 +
 .../.reconciliation-owner.json                     |     1 +
 .../config.json                                    |    44 +
 .../.reconciliation-owner.json                     |     1 +
 .../config.json                                    |    44 +
 .../.reconciliation-owner.json                     |     1 +
 .../config.json                                    |    44 +
 .../.reconciliation-owner.json                     |     1 +
 .../config.json                                    |    45 +
 .../.reconciliation-owner.json                     |     1 +
 .../config.json                                    |    44 +
 .../mcp110-execution-01a1040a/sensitivity.mjs      |    15 +
 .../single-target-build.mjs                        |    67 +
 .../supervisor-breakaway-test.ps1                  |    17 +
 .../mcp110-execution-01a1040a/supervisor-child.mjs |     8 +
 .../mcp110-execution-01a1040a/supervisor-job.ps1   |   123 +
 .../supervisor-native.test.mjs                     |    74 +
 .../supervisor-repair.test.mjs                     |    16 +
 .../mcp110-execution-01a1040a/supervisor-rerun.mjs |    13 +
 .../mcp110-execution-01a1040a/supervisor-stdio.mjs |    37 +
 .../mcp110-execution-01a1040a/supervisor.mjs       |   118 +
 .../mcp110-execution-01a1040a/supervisor.test.mjs  |    21 +
 .../wt-mcp-device-110-bench/PRIVACY.md             |     9 +
 .../wt-mcp-device-110-bench/README.md              |    26 +
 .../wt-mcp-device-110-bench/SECURITY.md            |    67 +
 .../wt-mcp-device-110-bench/bench/README.md        |   131 +
 .../wt-mcp-device-110-bench/bench/lib/core.mjs     |   513 +
 .../wt-mcp-device-110-bench/bench/lib/fixtures.mjs |   213 +
 .../bench/lib/mcp-stdio.mjs                        |    54 +
 .../bench/lib/resource-preload.cjs                 |    28 +
 .../bench/results/v1.0.9/BASELINE.md               |   173 +
 .../bench/results/v1.0.9/g6-win32/raw.jsonl        |   638 +
 .../results/v1.0.9/g6-win32/raw.standard.jsonl     |   509 +
 .../bench/results/v1.0.9/g6-win32/raw.stress.jsonl |   129 +
 .../bench/results/v1.0.9/g6-win32/summary.json     |  2196 +
 .../bench/results/v1.0.9/g8-linux/raw.jsonl        |   557 +
 .../results/v1.0.9/g8-linux/raw.standard.jsonl     |   440 +
 .../bench/results/v1.0.9/g8-linux/raw.stress.jsonl |   117 +
 .../bench/results/v1.0.9/g8-linux/summary.json     |  1739 +
 .../bench/results/v1.0.9/g8-md-remote/raw.jsonl    |     1 +
 .../bench/results/v1.0.9/g8-md-remote/summary.json |     1 +
 .../wt-mcp-device-110-bench/bench/run.mjs          |   173 +
 .../bench/scenarios/all.mjs                        |   460 +
 .../bench/test/core.test.mjs                       |   121 +
 .../wt-mcp-device-110-compat/PRIVACY.md            |     9 +
 .../wt-mcp-device-110-compat/README.md             |    26 +
 .../wt-mcp-device-110-compat/SECURITY.md           |    67 +
 .../wt-mcp-device-110-file/PRIVACY.md              |     9 +
 .../wt-mcp-device-110-file/README.md               |    26 +
 .../wt-mcp-device-110-file/SECURITY.md             |    67 +
 .../wt-mcp-device-110-process/PRIVACY.md           |     9 +
 .../wt-mcp-device-110-process/README.md            |    26 +
 .../wt-mcp-device-110-process/SECURITY.md          |    67 +
 .../wt-mcp-device-110-review/PRIVACY.md            |     9 +
 .../wt-mcp-device-110-review/README.md             |    26 +
 .../wt-mcp-device-110-review/SECURITY.md           |    67 +
 .../wt-mcp-device-110-stress/PRIVACY.md            |     9 +
 .../wt-mcp-device-110-stress/README.md             |    26 +
 .../wt-mcp-device-110-stress/SECURITY.md           |    67 +
 .../.specify/.gitignore                            |     9 +
 .../.specify/bundle-part-1.txt                     |   307 +
 .../.specify/bundle-part-2.txt                     |   307 +
 .../.specify/bundle-part-3.txt                     |   299 +
 .../.specify/bundle-part-4.txt                     |   372 +
 .../.specify/init-options.json                     |     8 +
 .../.specify/integration.json                      |    15 +
 .../.specify/integrations/pi.manifest.json         |    17 +
 .../.specify/integrations/speckit.manifest.json    |    19 +
 .../.specify/local-context-validation.json         |   Bin 0 -> 3122 bytes
 .../.specify/m365-review-bundle.txt                |  1282 +
 .../.specify/memory/.constitution-template.json    |     4 +
 .../.specify/memory/constitution.md                |    62 +
 .../scripts/powershell/check-prerequisites.ps1     |   185 +
 .../.specify/scripts/powershell/common.ps1         |   796 +
 .../scripts/powershell/create-new-feature.ps1      |   328 +
 .../scripts/powershell/resolve-template.ps1        |    38 +
 .../.specify/scripts/powershell/setup-plan.ps1     |    88 +
 .../.specify/scripts/powershell/setup-tasks.ps1    |    93 +
 .../scripts/validate-local-context-docs.mjs        |    87 +
 .../.specify/templates/checklist-template.md       |    45 +
 .../.specify/templates/constitution-template.md    |    50 +
 .../.specify/templates/plan-template.md            |   113 +
 .../.specify/templates/spec-template.md            |   131 +
 .../.specify/templates/tasks-template.md           |   252 +
 .../.specify/workflows/speckit/workflow.yml        |    74 +
 .../.specify/workflows/workflow-registry.json      |    13 +
 .../wt-mcp-device-local-context/PRIVACY.md         |     9 +
 .../wt-mcp-device-local-context/README.md          |    26 +
 .../wt-mcp-device-local-context/SECURITY.md        |    67 +
 .../specs/002-device-local-context/analysis.md     |   114 +
 .../checklists/implementation-gates.md             |    46 +
 .../checklists/requirements.md                     |    47 +
 .../contracts/context-api.md                       |   207 +
 .../contracts/context-policy.md                    |    92 +
 .../contracts/skill-contract.md                    |    94 +
 .../contracts/wiki-contract.md                     |    56 +
 .../specs/002-device-local-context/data-model.md   |   174 +
 .../002-device-local-context/integration-110.md    |   105 +
 .../specs/002-device-local-context/plan.md         |   251 +
 .../specs/002-device-local-context/quickstart.md   |   193 +
 .../references/runtime-110-manifest.json           |    55 +
 .../references/runtime-110/constitution.md         |    98 +
 .../references/runtime-110/data-model.md           |   139 +
 .../references/runtime-110/plan.md                 |   174 +
 .../references/runtime-110/runtime-contract.md     |   224 +
 .../references/runtime-110/spec.md                 |   278 +
 .../references/runtime-110/tasks.md                |   316 +
 .../specs/002-device-local-context/research.md     |   130 +
 .../reviews/opus-round2.md                         |   135 +
 .../specs/002-device-local-context/run-report.md   |    79 +
 .../specs/002-device-local-context/spec.md         |   143 +
 .../specs/002-device-local-context/tasks.md        |   204 +
 .pi/prompts/speckit.analyze.md                     |   251 +
 .pi/prompts/speckit.checklist.md                   |   375 +
 .pi/prompts/speckit.clarify.md                     |   287 +
 .pi/prompts/speckit.constitution.md                |   175 +
 .pi/prompts/speckit.converge.md                    |   269 +
 .pi/prompts/speckit.implement.md                   |   218 +
 .pi/prompts/speckit.plan.md                        |   166 +
 .pi/prompts/speckit.specify.md                     |   345 +
 .pi/prompts/speckit.tasks.md                       |   216 +
 .pi/prompts/speckit.taskstoissues.md               |   102 +
 .specify/.gitignore                                |     9 +
 .specify/init-options.json                         |     8 +
 .specify/integration.json                          |    15 +
 .specify/integrations/pi.manifest.json             |    17 +
 .specify/integrations/speckit.manifest.json        |    19 +
 .specify/mcp-device-110-review-cycle.txt           |    43 +
 .specify/mcp-device-110-spec-revision-cycle.txt    |   382 +
 .specify/memory/.constitution-template.json        |     4 +
 .specify/memory/constitution.md                    |   102 +
 .../scripts/powershell/check-prerequisites.ps1     |   185 +
 .specify/scripts/powershell/common.ps1             |   796 +
 .specify/scripts/powershell/create-new-feature.ps1 |   328 +
 .specify/scripts/powershell/resolve-template.ps1   |    38 +
 .specify/scripts/powershell/setup-plan.ps1         |    88 +
 .specify/scripts/powershell/setup-tasks.ps1        |    93 +
 .specify/templates/checklist-template.md           |    45 +
 .specify/templates/constitution-template.md        |    50 +
 .specify/templates/plan-template.md                |   113 +
 .specify/templates/spec-template.md                |   131 +
 .specify/templates/tasks-template.md               |   252 +
 .specify/workflows/speckit/workflow.yml            |    74 +
 .specify/workflows/workflow-registry.json          |    13 +
 package-lock.json                                  |     4 +-
 src/device/device.ts                               |     5 +-
 src/device/gateway-tool-adapter.ts                 |    30 +-
 src/terminal-manager.ts                            |     5 +
 src/utils/resource-accounting.ts                   |    47 -
 1594 files changed, 280876 insertions(+), 65 deletions(-)

```

## `git diff f2a5eeb HEAD -- test .gitignore > evidence/1.0.10/x1.patch`

Exit code: 0

```text

```

## `sha256sum evidence/1.0.10/x1.patch`

Exit code: 0

```text
09aec36b85b2b4234673d8a10bc73a461311df06c4625fdf7f61a30a22f3ee87 *evidence/1.0.10/x1.patch

```

## `rm -rf dist && npm run build && npm pack`

Exit code: 0

```text

> @hcu-lab.me/mcp-device@1.0.10 build
> shx rm -rf dist && tsc && shx chmod +x dist/*.js && shx cp src/device/update-helper.cjs dist/device/update-helper.cjs && shx mkdir -p dist/data && shx cp src/data/onboarding-prompts.json dist/data/ && node scripts/copy-official-ca.cjs && node scripts/build-ui-runtime.cjs

TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/bootstrap.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/bootstrap.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/version.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/version.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/capture.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/capture.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/command-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/command-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-field-definitions.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-field-definitions.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/custom-stdio.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/custom-stdio.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/shared/preview-file-types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/shared/preview-file-types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/error-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/error-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/system-info.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/system-info.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/schemas.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/schemas.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/unsupportedParams.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/unsupportedParams.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/feature-flags.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/feature-flags.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/config.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/config.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/usageTracker.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/usageTracker.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/usage.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/usage.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/prompts.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/prompts.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/trackTools.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/trackTools.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/dockerPrompt.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/dockerPrompt.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/toolHistory.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/toolHistory.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ab-test.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ab-test.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/logger.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/logger.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/open-browser.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/open-browser.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/welcome-onboarding.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/welcome-onboarding.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/contracts.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/contracts.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/resources.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/resources.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/mcp-ui-ab-test.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/mcp-ui-ab-test.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/withTimeout.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/withTimeout.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/base.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/base.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/text.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/text.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/image.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/image.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/binary.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/binary.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/excel.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/excel.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/extract-images.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/extract-images.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/lib/pdf2md.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/lib/pdf2md.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/markdown.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/markdown.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/manipulations.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/manipulations.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/pdf.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/pdf.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/docx.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/docx.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/factory.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/factory.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/mime-types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/mime-types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ripgrep-resolver.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ripgrep-resolver.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/search-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/search-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/filesystem.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/filesystem.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/output-budget.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/output-budget.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/filesystem-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/filesystem-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/process-detection.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/process-detection.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/terminal-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/terminal-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/improved-process-tools.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/improved-process-tools.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/terminal-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/terminal-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/process.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/process.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/process-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/process-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearchCore.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearchCore.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearch.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearch.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/lineEndingHandler.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/lineEndingHandler.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/fuzzySearchLogger.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/fuzzySearchLogger.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/edit.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/edit.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/edit-search-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/edit-search-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/search-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/search-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/history-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/history-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/server.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/server.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-state.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-state.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/execution-engine.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/execution-engine.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-identity.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-identity.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-secure-transport.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-secure-transport.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/project-inspection.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/project-inspection.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tool-dispatcher.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tool-dispatcher.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-tool-adapter.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-tool-adapter.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-url-policy.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-url-policy.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-channel.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-channel.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-config.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-config.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-pairing.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-pairing.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/official-trust.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/official-trust.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-status.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-status.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/runtime-owner.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/runtime-owner.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/linux-service.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/linux-service.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/windows-service.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/windows-service.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/self-update.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/self-update.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/npm-scripts/remote.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/npm-scripts/remote.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/mcp-device.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/mcp-device.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-bridge.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-bridge.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-shell.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-shell.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/escape-html.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/escape-html.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/compact-row.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/compact-row.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/widget-state.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/widget-state.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/host-context.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/host-context.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/ui-event-tracker.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/ui-event-tracker.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/array-modal.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/array-modal.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/app.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/app.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/main.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/main.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/highlighting.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/highlighting.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-outline.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-outline.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/slugify.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/slugify.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/path-utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/path-utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/linking.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/linking.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/editor.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/editor.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/model.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/model.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-workspace.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-workspace.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/payload-utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/payload-utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/directory-controller.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/directory-controller.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-layout.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-layout.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/code-viewer.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/code-viewer.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/html-renderer.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/html-renderer.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/image-preview.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/image-preview.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/conflict-dialog.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/conflict-dialog.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/parser.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/parser.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/outline.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/outline.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/markdown-renderer.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/markdown-renderer.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/preview.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/preview.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/controller.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/controller.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/file-type-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/file-type-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/external-actions.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/external-actions.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/selection-context.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/selection-context.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/panel-actions.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/panel-actions.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/app.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/app.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/main.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/main.d.ts
Files:                         724
Lines of Library:            50310
Lines of Definitions:       150505
Lines of TypeScript:         29199
Lines of JavaScript:             0
Lines of JSON:                   0
Lines of Other:                  0
Identifiers:                229044
Symbols:                    253587
Types:                       65000
Instantiations:             166396
Memory used:               341610K
Assignability cache size:    24117
Identity cache size:          1924
Subtype cache size:           1885
Strict subtype cache size:     499
I/O Read time:               0.57s
Parse time:                  0.87s
ResolveModule time:          0.29s
ResolveLibrary time:         0.02s
ResolveTypeReference time:   0.02s
Program time:                1.91s
Bind time:                   0.49s
Check time:                  4.98s
transformTime time:          0.44s
commentTime time:            0.14s
I/O Write time:              0.26s
printTime time:              1.71s
Emit time:                   1.71s
Total time:                  9.09s

> @hcu-lab.me/mcp-device@1.0.10 prepack
> node scripts/verify-production-trust.cjs

MCP Device production application CA preflight passed.

> @hcu-lab.me/mcp-device@1.0.10 prepare
> npm run build


> @hcu-lab.me/mcp-device@1.0.10 build
> shx rm -rf dist && tsc && shx chmod +x dist/*.js && shx cp src/device/update-helper.cjs dist/device/update-helper.cjs && shx mkdir -p dist/data && shx cp src/data/onboarding-prompts.json dist/data/ && node scripts/copy-official-ca.cjs && node scripts/build-ui-runtime.cjs

TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/bootstrap.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/bootstrap.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/version.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/version.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/capture.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/capture.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/command-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/command-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-field-definitions.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-field-definitions.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/custom-stdio.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/custom-stdio.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/shared/preview-file-types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/shared/preview-file-types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/error-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/error-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/system-info.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/system-info.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/schemas.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/schemas.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/unsupportedParams.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/unsupportedParams.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/feature-flags.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/feature-flags.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/config.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/config.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/usageTracker.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/usageTracker.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/usage.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/usage.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/prompts.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/prompts.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/trackTools.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/trackTools.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/dockerPrompt.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/dockerPrompt.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/toolHistory.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/toolHistory.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ab-test.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ab-test.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/logger.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/logger.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/open-browser.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/open-browser.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/welcome-onboarding.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/welcome-onboarding.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/contracts.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/contracts.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/resources.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/resources.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/mcp-ui-ab-test.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/mcp-ui-ab-test.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/withTimeout.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/withTimeout.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/base.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/base.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/text.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/text.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/image.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/image.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/binary.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/binary.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/excel.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/excel.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/extract-images.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/extract-images.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/lib/pdf2md.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/lib/pdf2md.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/markdown.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/markdown.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/manipulations.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/manipulations.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/pdf.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/pdf.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/docx.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/docx.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/factory.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/factory.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/mime-types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/mime-types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ripgrep-resolver.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ripgrep-resolver.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/search-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/search-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/filesystem.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/filesystem.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/output-budget.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/output-budget.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/filesystem-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/filesystem-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/process-detection.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/process-detection.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/terminal-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/terminal-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/improved-process-tools.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/improved-process-tools.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/terminal-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/terminal-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/process.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/process.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/process-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/process-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearchCore.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearchCore.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearch.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearch.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/lineEndingHandler.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/lineEndingHandler.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/fuzzySearchLogger.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/fuzzySearchLogger.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/edit.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/edit.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/edit-search-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/edit-search-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/search-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/search-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/history-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/history-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/server.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/server.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-state.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-state.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/execution-engine.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/execution-engine.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-identity.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-identity.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-secure-transport.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-secure-transport.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/project-inspection.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/project-inspection.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tool-dispatcher.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tool-dispatcher.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-tool-adapter.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-tool-adapter.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-url-policy.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-url-policy.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-channel.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-channel.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-config.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-config.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-pairing.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-pairing.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/official-trust.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/official-trust.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-status.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-status.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/runtime-owner.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/runtime-owner.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/linux-service.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/linux-service.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/windows-service.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/windows-service.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/self-update.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/self-update.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/npm-scripts/remote.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/npm-scripts/remote.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/mcp-device.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/mcp-device.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-bridge.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-bridge.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-shell.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-shell.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/escape-html.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/escape-html.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/compact-row.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/compact-row.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/widget-state.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/widget-state.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/host-context.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/host-context.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/ui-event-tracker.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/ui-event-tracker.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/array-modal.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/array-modal.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/app.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/app.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/main.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/main.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/highlighting.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/highlighting.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-outline.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-outline.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/slugify.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/slugify.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/path-utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/path-utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/linking.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/linking.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/editor.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/editor.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/model.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/model.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-workspace.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-workspace.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/payload-utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/payload-utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/directory-controller.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/directory-controller.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-layout.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-layout.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/code-viewer.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/code-viewer.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/html-renderer.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/html-renderer.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/image-preview.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/image-preview.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/conflict-dialog.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/conflict-dialog.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/parser.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/parser.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/outline.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/outline.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/markdown-renderer.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/markdown-renderer.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/preview.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/preview.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/controller.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/controller.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/file-type-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/file-type-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/external-actions.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/external-actions.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/selection-context.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/selection-context.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/panel-actions.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/panel-actions.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/app.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/app.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/main.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/main.d.ts
Files:                         724
Lines of Library:            50310
Lines of Definitions:       150505
Lines of TypeScript:         29199
Lines of JavaScript:             0
Lines of JSON:                   0
Lines of Other:                  0
Identifiers:                229044
Symbols:                    253587
Types:                       65000
Instantiations:             166396
Memory used:               344716K
Assignability cache size:    24117
Identity cache size:          1924
Subtype cache size:           1885
Strict subtype cache size:     499
I/O Read time:               0.58s
Parse time:                  0.92s
ResolveModule time:          0.30s
ResolveLibrary time:         0.02s
ResolveTypeReference time:   0.01s
Program time:                2.00s
Bind time:                   0.49s
Check time:                  4.52s
transformTime time:          0.42s
commentTime time:            0.14s
I/O Write time:              0.25s
printTime time:              1.71s
Emit time:                   1.71s
Total time:                  8.72s
hcu-lab.me-mcp-device-1.0.10.tgz
npm notice
npm notice 📦  @hcu-lab.me/mcp-device@1.0.10
npm notice Tarball Contents
npm notice 1.1kB LICENSE
npm notice 974B README.md
npm notice 11B dist/bootstrap.d.ts
npm notice 1.1kB dist/bootstrap.js
npm notice 311B dist/command-manager.d.ts
npm notice 10.7kB dist/command-manager.js
npm notice 2.4kB dist/config-field-definitions.d.ts
npm notice 2.0kB dist/config-field-definitions.js
npm notice 3.6kB dist/config-manager.d.ts
npm notice 13.6kB dist/config-manager.js
npm notice 275B dist/config.d.ts
npm notice 574B dist/config.js
npm notice 1.9kB dist/custom-stdio.d.ts
npm notice 13.5kB dist/custom-stdio.js
npm notice 644B dist/data/official-app-ca.pem
npm notice 3.6kB dist/data/onboarding-prompts.json
npm notice 294B dist/device/device-state.d.ts
npm notice 585B dist/device/device-state.js
npm notice 2.5kB dist/device/device-status.d.ts
npm notice 8.0kB dist/device/device-status.js
npm notice 616B dist/device/device.d.ts
npm notice 14.2kB dist/device/device.js
npm notice 5.4kB dist/device/execution-engine.d.ts
npm notice 5.7kB dist/device/execution-engine.js
npm notice 2.2kB dist/device/gateway-channel.d.ts
npm notice 24.4kB dist/device/gateway-channel.js
npm notice 1.1kB dist/device/gateway-config.d.ts
npm notice 7.7kB dist/device/gateway-config.js
npm notice 923B dist/device/gateway-identity.d.ts
npm notice 6.5kB dist/device/gateway-identity.js
npm notice 882B dist/device/gateway-pairing.d.ts
npm notice 4.4kB dist/device/gateway-pairing.js
npm notice 1.1kB dist/device/gateway-secure-transport.d.ts
npm notice 4.6kB dist/device/gateway-secure-transport.js
npm notice 729B dist/device/gateway-tool-adapter.d.ts
npm notice 12.8kB dist/device/gateway-tool-adapter.js
npm notice 189B dist/device/gateway-url-policy.d.ts
npm notice 1.8kB dist/device/gateway-url-policy.js
npm notice 2.2kB dist/device/linux-service.d.ts
npm notice 12.4kB dist/device/linux-service.js
npm notice 438B dist/device/official-trust.d.ts
npm notice 2.2kB dist/device/official-trust.js
npm notice 88B dist/device/project-inspection.d.ts
npm notice 8.0kB dist/device/project-inspection.js
npm notice 1.6kB dist/device/runtime-owner.d.ts
npm notice 6.9kB dist/device/runtime-owner.js
npm notice 4.2kB dist/device/self-update.d.ts
npm notice 31.9kB dist/device/self-update.js
npm notice 11.4kB dist/device/update-helper.cjs
npm notice 1.7kB dist/device/windows-service.d.ts
npm notice 9.1kB dist/device/windows-service.js
npm notice 260B dist/error-handlers.d.ts
npm notice 412B dist/error-handlers.js
npm notice 205B dist/handlers/edit-search-handlers.d.ts
npm notice 205B dist/handlers/edit-search-handlers.js
npm notice 1.2kB dist/handlers/filesystem-handlers.d.ts
npm notice 19.3kB dist/handlers/filesystem-handlers.js
npm notice 559B dist/handlers/history-handlers.d.ts
npm notice 2.2kB dist/handlers/history-handlers.js
npm notice 241B dist/handlers/index.d.ts
npm notice 292B dist/handlers/index.js
npm notice 275B dist/handlers/process-handlers.d.ts
npm notice 419B dist/handlers/process-handlers.js
npm notice 611B dist/handlers/search-handlers.d.ts
npm notice 11.4kB dist/handlers/search-handlers.js
npm notice 743B dist/handlers/terminal-handlers.d.ts
npm notice 1.1kB dist/handlers/terminal-handlers.js
npm notice 45B dist/index.d.ts
npm notice 6.7kB dist/index.js
npm notice 45B dist/mcp-device.d.ts
npm notice 273B dist/mcp-device.js
npm notice 587B dist/npm-scripts/remote.d.ts
npm notice 15.9kB dist/npm-scripts/remote.js
npm notice 4.8kB dist/search-manager.d.ts
npm notice 40.7kB dist/search-manager.js
npm notice 1.8kB dist/server.d.ts
npm notice 79.8kB dist/server.js
npm notice 4.3kB dist/terminal-manager.d.ts
npm notice 34.0kB dist/terminal-manager.js
npm notice 345B dist/tool-dispatcher.d.ts
npm notice 10.0kB dist/tool-dispatcher.js
npm notice 2.8kB dist/tools/config.d.ts
npm notice 10.7kB dist/tools/config.js
npm notice 1.7kB dist/tools/edit.d.ts
npm notice 25.3kB dist/tools/edit.js
npm notice 3.9kB dist/tools/filesystem.d.ts
npm notice 41.7kB dist/tools/filesystem.js
npm notice 784B dist/tools/fuzzySearch.d.ts
npm notice 3.4kB dist/tools/fuzzySearch.js
npm notice 1.9kB dist/tools/fuzzySearchCore.d.ts
npm notice 5.2kB dist/tools/fuzzySearchCore.js
npm notice 880B dist/tools/improved-process-tools.d.ts
npm notice 25.6kB dist/tools/improved-process-tools.js
npm notice 189B dist/tools/mime-types.d.ts
npm notice 887B dist/tools/mime-types.js
npm notice 1.2kB dist/tools/pdf/extract-images.d.ts
npm notice 5.8kB dist/tools/pdf/extract-images.js
npm notice 406B dist/tools/pdf/index.d.ts
npm notice 178B dist/tools/pdf/index.js
npm notice 1.0kB dist/tools/pdf/lib/pdf2md.d.ts
npm notice 3.1kB dist/tools/pdf/lib/pdf2md.js
npm notice 704B dist/tools/pdf/manipulations.d.ts
npm notice 4.5kB dist/tools/pdf/manipulations.js
npm notice 1.1kB dist/tools/pdf/markdown.d.ts
npm notice 10.3kB dist/tools/pdf/markdown.js
npm notice 558B dist/tools/pdf/utils.d.ts
npm notice 1.3kB dist/tools/pdf/utils.js
npm notice 183B dist/tools/process.d.ts
npm notice 1.9kB dist/tools/process.js
npm notice 676B dist/tools/prompts.d.ts
npm notice 10.0kB dist/tools/prompts.js
npm notice 19.0kB dist/tools/schemas.d.ts
npm notice 10.6kB dist/tools/schemas.js
npm notice 167B dist/tools/usage.d.ts
npm notice 649B dist/tools/usage.js
npm notice 2.5kB dist/types.d.ts
npm notice 11B dist/types.js
npm notice 441.4kB dist/ui/config-editor/config-editor-runtime.js
npm notice 337B dist/ui/config-editor/index.html
npm notice 1.5kB dist/ui/config-editor/src/app.d.ts
npm notice 31.9kB dist/ui/config-editor/src/app.js
npm notice 702B dist/ui/config-editor/src/array-modal.d.ts
npm notice 7.6kB dist/ui/config-editor/src/array-modal.js
npm notice 11B dist/ui/config-editor/src/main.d.ts
npm notice 81B dist/ui/config-editor/src/main.js
npm notice 11.7kB dist/ui/config-editor/styles.css
npm notice 702B dist/ui/contracts.d.ts
npm notice 748B dist/ui/contracts.js
npm notice 500B dist/ui/file-preview/index.html
npm notice 1.2MB dist/ui/file-preview/preview-runtime.js
npm notice 364B dist/ui/file-preview/shared/preview-file-types.d.ts
npm notice 1.4kB dist/ui/file-preview/shared/preview-file-types.js
npm notice 289B dist/ui/file-preview/src/app.d.ts
npm notice 28.0kB dist/ui/file-preview/src/app.js
npm notice 304B dist/ui/file-preview/src/components/code-viewer.d.ts
npm notice 2.3kB dist/ui/file-preview/src/components/code-viewer.js
npm notice 140B dist/ui/file-preview/src/components/highlighting.d.ts
npm notice 2.3kB dist/ui/file-preview/src/components/highlighting.js
npm notice 179B dist/ui/file-preview/src/components/html-renderer.d.ts
npm notice 2.3kB dist/ui/file-preview/src/components/html-renderer.js
npm notice 65B dist/ui/file-preview/src/components/markdown-renderer.d.ts
npm notice 2.5kB dist/ui/file-preview/src/components/markdown-renderer.js
npm notice 481B dist/ui/file-preview/src/directory-controller.d.ts
npm notice 10.6kB dist/ui/file-preview/src/directory-controller.js
npm notice 708B dist/ui/file-preview/src/document-layout.d.ts
npm notice 8.1kB dist/ui/file-preview/src/document-layout.js
npm notice 617B dist/ui/file-preview/src/document-outline.d.ts
npm notice 4.6kB dist/ui/file-preview/src/document-outline.js
npm notice 667B dist/ui/file-preview/src/document-workspace.d.ts
npm notice 1.2kB dist/ui/file-preview/src/document-workspace.js
npm notice 504B dist/ui/file-preview/src/file-type-handlers.d.ts
npm notice 4.8kB dist/ui/file-preview/src/file-type-handlers.js
npm notice 536B dist/ui/file-preview/src/host/external-actions.d.ts
npm notice 2.5kB dist/ui/file-preview/src/host/external-actions.js
npm notice 435B dist/ui/file-preview/src/host/selection-context.d.ts
npm notice 4.1kB dist/ui/file-preview/src/host/selection-context.js
npm notice 233B dist/ui/file-preview/src/image-preview.d.ts
npm notice 706B dist/ui/file-preview/src/image-preview.js
npm notice 11B dist/ui/file-preview/src/main.d.ts
npm notice 213B dist/ui/file-preview/src/main.js
npm notice 1.7kB dist/ui/file-preview/src/markdown/conflict-dialog.d.ts
npm notice 7.2kB dist/ui/file-preview/src/markdown/conflict-dialog.js
npm notice 2.6kB dist/ui/file-preview/src/markdown/controller.d.ts
npm notice 46.0kB dist/ui/file-preview/src/markdown/controller.js
npm notice 5.7kB dist/ui/file-preview/src/markdown/editor.d.ts
npm notice 70.7kB dist/ui/file-preview/src/markdown/editor.js
npm notice 691B dist/ui/file-preview/src/markdown/linking.d.ts
npm notice 7.8kB dist/ui/file-preview/src/markdown/linking.js
npm notice 154B dist/ui/file-preview/src/markdown/outline.d.ts
npm notice 624B dist/ui/file-preview/src/markdown/outline.js
npm notice 1.1kB dist/ui/file-preview/src/markdown/parser.d.ts
npm notice 1.3kB dist/ui/file-preview/src/markdown/parser.js
npm notice 78B dist/ui/file-preview/src/markdown/preview.d.ts
npm notice 692B dist/ui/file-preview/src/markdown/preview.js
npm notice 196B dist/ui/file-preview/src/markdown/slugify.d.ts
npm notice 999B dist/ui/file-preview/src/markdown/slugify.js
npm notice 95B dist/ui/file-preview/src/markdown/utils.d.ts
npm notice 438B dist/ui/file-preview/src/markdown/utils.js
npm notice 1.1kB dist/ui/file-preview/src/model.d.ts
npm notice 11B dist/ui/file-preview/src/model.js
npm notice 945B dist/ui/file-preview/src/panel-actions.d.ts
npm notice 7.9kB dist/ui/file-preview/src/panel-actions.js
npm notice 451B dist/ui/file-preview/src/path-utils.d.ts
npm notice 2.3kB dist/ui/file-preview/src/path-utils.js
npm notice 861B dist/ui/file-preview/src/payload-utils.d.ts
npm notice 4.6kB dist/ui/file-preview/src/payload-utils.js
npm notice 53B dist/ui/file-preview/src/types.d.ts
npm notice 11B dist/ui/file-preview/src/types.js
npm notice 34.8kB dist/ui/file-preview/styles.css
npm notice 759B dist/ui/resources.d.ts
npm notice 3.7kB dist/ui/resources.js
npm notice 315B dist/ui/shared/compact-row.d.ts
npm notice 999B dist/ui/shared/compact-row.js
npm notice 127B dist/ui/shared/escape-html.d.ts
npm notice 283B dist/ui/shared/escape-html.js
npm notice 643B dist/ui/shared/host-context.d.ts
npm notice 1.9kB dist/ui/shared/host-context.js
npm notice 935B dist/ui/shared/tool-bridge.d.ts
npm notice 4.8kB dist/ui/shared/tool-bridge.js
npm notice 945B dist/ui/shared/tool-shell.d.ts
npm notice 4.1kB dist/ui/shared/tool-shell.js
npm notice 475B dist/ui/shared/ui-event-tracker.d.ts
npm notice 850B dist/ui/shared/ui-event-tracker.js
npm notice 1.5kB dist/ui/shared/widget-state.d.ts
npm notice 5.5kB dist/ui/shared/widget-state.js
npm notice 459B dist/utils/ab-test.d.ts
npm notice 3.6kB dist/utils/ab-test.js
npm notice 753B dist/utils/capture.d.ts
npm notice 1.4kB dist/utils/capture.js
npm notice 626B dist/utils/dockerPrompt.d.ts
npm notice 3.1kB dist/utils/dockerPrompt.js
npm notice 377B dist/utils/feature-flags.d.ts
npm notice 515B dist/utils/feature-flags.js
npm notice 5.2kB dist/utils/files/base.d.ts
npm notice 130B dist/utils/files/base.js
npm notice 793B dist/utils/files/binary.d.ts
npm notice 2.2kB dist/utils/files/binary.js
npm notice 2.1kB dist/utils/files/docx.d.ts
npm notice 30.0kB dist/utils/files/docx.js
npm notice 942B dist/utils/files/excel.d.ts
npm notice 18.1kB dist/utils/files/excel.js
npm notice 1.6kB dist/utils/files/factory.d.ts
npm notice 4.3kB dist/utils/files/factory.js
npm notice 722B dist/utils/files/image.d.ts
npm notice 2.4kB dist/utils/files/image.js
npm notice 376B dist/utils/files/index.d.ts
npm notice 442B dist/utils/files/index.js
npm notice 1.0kB dist/utils/files/pdf.d.ts
npm notice 5.1kB dist/utils/files/pdf.js
npm notice 2.3kB dist/utils/files/text.d.ts
npm notice 16.8kB dist/utils/files/text.js
npm notice 832B dist/utils/fuzzySearchLogger.d.ts
npm notice 4.5kB dist/utils/fuzzySearchLogger.js
npm notice 644B dist/utils/lineEndingHandler.d.ts
npm notice 2.2kB dist/utils/lineEndingHandler.js
npm notice 1.3kB dist/utils/logger.d.ts
npm notice 2.6kB dist/utils/logger.js
npm notice 733B dist/utils/mcp-ui-ab-test.d.ts
npm notice 2.3kB dist/utils/mcp-ui-ab-test.js
npm notice 314B dist/utils/open-browser.d.ts
npm notice 1.5kB dist/utils/open-browser.js
npm notice 181B dist/utils/output-budget.d.ts
npm notice 550B dist/utils/output-budget.js
npm notice 734B dist/utils/process-detection.d.ts
npm notice 4.8kB dist/utils/process-detection.js
npm notice 327B dist/utils/ripgrep-resolver.d.ts
npm notice 2.9kB dist/utils/ripgrep-resolver.js
npm notice 2.0kB dist/utils/system-info.d.ts
npm notice 28.6kB dist/utils/system-info.js
npm notice 2.6kB dist/utils/toolHistory.d.ts
npm notice 9.1kB dist/utils/toolHistory.js
npm notice 248B dist/utils/trackTools.d.ts
npm notice 3.6kB dist/utils/trackTools.js
npm notice 1.3kB dist/utils/unsupportedParams.d.ts
npm notice 3.0kB dist/utils/unsupportedParams.js
npm notice 3.9kB dist/utils/usageTracker.d.ts
npm notice 19.2kB dist/utils/usageTracker.js
npm notice 481B dist/utils/welcome-onboarding.d.ts
npm notice 4.6kB dist/utils/welcome-onboarding.js
npm notice 1.6kB dist/utils/withTimeout.d.ts
npm notice 3.6kB dist/utils/withTimeout.js
npm notice 41B dist/version.d.ts
npm notice 33B dist/version.js
npm notice 4.6kB package.json
npm notice Tarball Details
npm notice name: @hcu-lab.me/mcp-device
npm notice version: 1.0.10
npm notice filename: hcu-lab.me-mcp-device-1.0.10.tgz
npm notice package size: 753.8 kB
npm notice unpacked size: 2.9 MB
npm notice shasum: 1274ff84cf1a17984070a60b545f7a5cb6aa022a
npm notice integrity: sha512-BfFqXbCLImKF0[...]hTCKiQ7omzBkg==
npm notice total files: 264
npm notice

```

## `sha256sum hcu-lab.me-mcp-device-1.0.10.tgz`

Exit code: 0

```text
c8368f4ab716d2019c996b020159de08d645efc2ca0e023878bf1ba9cbea73ee *hcu-lab.me-mcp-device-1.0.10.tgz

```

## `node test/run-all-tests.js`

Exit code: 0

```text
[1m[36m===== MCP DEVICE TEST RUNNER =====[0m
[34mStarting test execution at 2026-10-04T16:10:05.912Z[0m


[36m===== Building project =====[0m

[34mRunning command: npm run build[0m

> @hcu-lab.me/mcp-device@1.0.10 build
> shx rm -rf dist && tsc && shx chmod +x dist/*.js && shx cp src/device/update-helper.cjs dist/device/update-helper.cjs && shx mkdir -p dist/data && shx cp src/data/onboarding-prompts.json dist/data/ && node scripts/copy-official-ca.cjs && node scripts/build-ui-runtime.cjs

TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/bootstrap.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/bootstrap.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/version.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/version.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/capture.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/capture.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/command-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/command-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-field-definitions.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/config-field-definitions.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/custom-stdio.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/custom-stdio.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/shared/preview-file-types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/shared/preview-file-types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/error-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/error-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/system-info.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/system-info.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/schemas.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/schemas.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/unsupportedParams.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/unsupportedParams.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/feature-flags.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/feature-flags.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/config.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/config.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/usageTracker.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/usageTracker.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/usage.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/usage.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/prompts.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/prompts.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/trackTools.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/trackTools.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/dockerPrompt.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/dockerPrompt.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/toolHistory.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/toolHistory.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ab-test.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ab-test.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/logger.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/logger.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/open-browser.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/open-browser.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/welcome-onboarding.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/welcome-onboarding.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/contracts.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/contracts.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/resources.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/resources.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/mcp-ui-ab-test.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/mcp-ui-ab-test.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/withTimeout.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/withTimeout.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/base.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/base.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/text.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/text.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/image.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/image.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/binary.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/binary.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/excel.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/excel.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/extract-images.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/extract-images.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/lib/pdf2md.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/lib/pdf2md.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/markdown.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/markdown.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/manipulations.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/manipulations.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/pdf/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/pdf.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/pdf.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/docx.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/docx.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/factory.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/factory.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/files/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/mime-types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/mime-types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ripgrep-resolver.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/ripgrep-resolver.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/search-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/search-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/filesystem.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/filesystem.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/output-budget.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/output-budget.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/filesystem-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/filesystem-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/process-detection.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/process-detection.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/terminal-manager.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/terminal-manager.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/improved-process-tools.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/improved-process-tools.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/terminal-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/terminal-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/process.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/process.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/process-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/process-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearchCore.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearchCore.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearch.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/fuzzySearch.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/lineEndingHandler.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/lineEndingHandler.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/fuzzySearchLogger.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/utils/fuzzySearchLogger.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/edit.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tools/edit.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/edit-search-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/edit-search-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/search-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/search-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/history-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/history-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/handlers/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/server.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/server.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-state.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-state.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/execution-engine.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/execution-engine.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-identity.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-identity.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-secure-transport.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-secure-transport.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/project-inspection.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/project-inspection.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tool-dispatcher.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/tool-dispatcher.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-tool-adapter.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-tool-adapter.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-url-policy.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-url-policy.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-channel.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-channel.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-config.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-config.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-pairing.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/gateway-pairing.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/official-trust.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/official-trust.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-status.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device-status.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/runtime-owner.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/runtime-owner.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/linux-service.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/linux-service.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/windows-service.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/windows-service.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/self-update.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/self-update.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/device/device.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/npm-scripts/remote.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/npm-scripts/remote.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/index.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/index.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/mcp-device.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/mcp-device.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-bridge.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-bridge.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-shell.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/tool-shell.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/escape-html.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/escape-html.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/compact-row.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/compact-row.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/widget-state.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/widget-state.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/host-context.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/host-context.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/ui-event-tracker.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/shared/ui-event-tracker.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/array-modal.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/array-modal.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/app.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/app.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/main.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/config-editor/src/main.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/highlighting.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/highlighting.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-outline.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-outline.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/slugify.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/slugify.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/path-utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/path-utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/linking.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/linking.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/editor.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/editor.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/model.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/model.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-workspace.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-workspace.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/payload-utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/payload-utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/directory-controller.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/directory-controller.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-layout.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/document-layout.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/code-viewer.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/code-viewer.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/types.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/types.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/html-renderer.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/html-renderer.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/image-preview.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/image-preview.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/conflict-dialog.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/conflict-dialog.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/utils.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/utils.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/parser.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/parser.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/outline.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/outline.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/markdown-renderer.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/components/markdown-renderer.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/preview.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/preview.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/controller.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/markdown/controller.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/file-type-handlers.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/file-type-handlers.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/external-actions.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/external-actions.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/selection-context.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/host/selection-context.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/panel-actions.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/panel-actions.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/app.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/app.d.ts
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/main.js
TSFILE: E:/git-project/wt-mcp-device-110-integrate/dist/ui/file-preview/src/main.d.ts
Files:                         724
Lines of Library:            50310
Lines of Definitions:       150505
Lines of TypeScript:         29199
Lines of JavaScript:             0
Lines of JSON:                   0
Lines of Other:                  0
Identifiers:                229044
Symbols:                    253587
Types:                       65000
Instantiations:             166396
Memory used:               344575K
Assignability cache size:    24117
Identity cache size:          1924
Subtype cache size:           1885
Strict subtype cache size:     499
I/O Read time:               0.52s
Parse time:                  0.83s
ResolveModule time:          0.27s
ResolveLibrary time:         0.02s
ResolveTypeReference time:   0.02s
Program time:                1.79s
Bind time:                   0.47s
Check time:                  4.35s
transformTime time:          0.39s
commentTime time:            0.13s
I/O Write time:              0.24s
printTime time:              1.56s
Emit time:                   1.56s
Total time:                  8.18s

[36m===== Running tests =====[0m

[34mFound 66 test files:[0m
  - ./test.js
  - ./test-allowed-directories.js
  - ./test-blocked-commands.js
  - ./test-blocklist-bypass.js
  - ./test-canonical-release-cleanup.js
  - ./test-default-shell.js
  - ./test-device-productization.js
  - ./test-directory-creation.js
  - ./test-edit-block-line-endings.js
  - ./test-edit-block-occurrences.js
  - ./test-enhanced-repl.js
  - ./test-error-sanitization.js
  - ./test-excel-files.js
  - ./test-execution-engine-hardening.js
  - ./test-file-handlers.js
  - ./test-file-preview-directory-runtime.js
  - ./test-file-preview-image-runtime.js
  - ./test-forgotten-device-repair.js
  - ./test-gateway-account-link.js
  - ./test-gateway-channel-status.js
  - ./test-gateway-config.js
  - ./test-gateway-device-channel.js
  - ./test-gateway-pairing-status.js
  - ./test-gateway-secure-transport.js
  - ./test-green-hardening.js
  - ./test-home-directory.js
  - ./test-line-count.js
  - ./test-linux-device-service.js
  - ./test-literal-search.js
  - ./test-local-feature-flags.js
  - ./test-markdown-editor-edit-diff.js
  - ./test-markdown-editor-roundtrip.js
  - ./test-markdown-preview.js
  - ./test-mcp-device-branding.js
  - ./test-negative-offset-readfile.js
  - ./test-no-legacy-remote.js
  - ./test-node-repl.js
  - ./test-nonblocking-config-save.js
  - ./test-package-publish-surface.js
  - ./test-pdf-chrome-cache.js
  - ./test-pdf-creation.js
  - ./test-pdf-parsing.js
  - ./test-pid-collision-guard.js
  - ./test-process-pagination.js
  - ./test-public-contract.js
  - ./test-read-abort-timeout.js
  - ./test-read-completed-process.js
  - ./test-release-flow.js
  - ./test-remote-child-hygiene.js
  - ./test-remote-service-status.js
  - ./test-remote-startup-no-child.js
  - ./test-remote-yolo-path-access.js
  - ./test-repl-interaction.js
  - ./test-search-code-edge-cases.js
  - ./test-search-code.js
  - ./test-self-update.js
  - ./test-symlink-security.js
  - ./test-telemetry-handling.js
  - ./test-ui-event-tracking.js
  - ./test-version-consistency.js
  - ./test-widget-state-runtime.js
  - ./test-windows-device-service.js
  - ./test-windows-local-storage.js
  - ./test_enhanced_read.js
  - ./test_improved_search_truncation.js
  - ./test_search_truncation.js


[36mRunning test module: ./test.js[0m
[32m✓ Test passed: ./test.js (1633ms)[0m

[36mRunning test module: ./test-allowed-directories.js[0m
[32m✓ Test passed: ./test-allowed-directories.js (1590ms)[0m

[36mRunning test module: ./test-blocked-commands.js[0m
[32m✓ Test passed: ./test-blocked-commands.js (1548ms)[0m

[36mRunning test module: ./test-blocklist-bypass.js[0m
Testing extractCommands...

  /usr/bin/sudo ls => [ 'sudo' ]
  echo "$(iptables -L)" => [ 'iptables', 'echo' ]
  echo `rm -rf /` => [ 'rm', 'echo' ]
  ls -la /home => [ 'ls' ]
  echo $(cat $(which sudo)) => [ 'which', 'cat', 'echo' ]
  HOME=/tmp /usr/sbin/iptables => [ 'iptables' ]
  echo "`/usr/bin/sudo`" => [ 'sudo', 'echo' ]
  $MYVAR ls => [ 'ls' ]

All tests passed!
[32m✓ Test passed: ./test-blocklist-bypass.js (99ms)[0m

[36mRunning test module: ./test-canonical-release-cleanup.js[0m
canonical release cleanup tests passed
[32m✓ Test passed: ./test-canonical-release-cleanup.js (139ms)[0m

[36mRunning test module: ./test-default-shell.js[0m
[32m✓ Test passed: ./test-default-shell.js (1543ms)[0m

[36mRunning test module: ./test-device-productization.js[0m
MCP Device productization foundation tests passed
[32m✓ Test passed: ./test-device-productization.js (615ms)[0m

[36mRunning test module: ./test-directory-creation.js[0m
[32m✓ Test passed: ./test-directory-creation.js (1590ms)[0m

[36mRunning test module: ./test-edit-block-line-endings.js[0m
[32m✓ Test passed: ./test-edit-block-line-endings.js (1729ms)[0m

[36mRunning test module: ./test-edit-block-occurrences.js[0m
[32m✓ Test passed: ./test-edit-block-occurrences.js (1485ms)[0m

[36mRunning test module: ./test-enhanced-repl.js[0m
Testing enhanced REPL functionality...
Using python command: python
Starting Python REPL...
Result from start_process: {
  content: [
    {
      type: 'text',
      text: 'Process started with PID 30108 (shell: powershell.exe)\n' +
        'Initial output:\n' +
        'Python 3.13.9 | packaged by Anaconda, Inc. | (main, Oct 21 2025, 19:09:58) [MSC v.1929 64 bit (AMD64)] on win32\n' +
        'Type "help", "copyright", "credits" or "license" for more information.\n' +
        'Failed calling sys.__interactivehook__\r\n' +
        'Traceback (most recent call last):\r\n' +
        '  File "<frozen site>", line 536, in register_readline\r\n' +
        "AttributeError: module 'readline' has no attribute 'backend'\r\n" +
        '>>> \n' +
        '🔄 Process 30108 is waiting for input (detected: ">>>")'
    }
  ]
}
Started Python session with PID: 30108
Testing read_process_output with timeout...
Initial Python prompt: [Reading 1 new lines (total: 7 lines)]

(No output in requested range)
Testing interact_with_process with wait_for_prompt...
Python output with wait_for_prompt: ✅ Input executed in process 30108:

📤 Output:
Hello from Python with wait!


🔄 Process 30108 is waiting for input (detected: ">>>")
Testing interact_with_process without wait_for_prompt...
Python output without wait_for_prompt: [Reading 3 new lines (total: 9 lines)]

Hello from Python with wait!
>>> Hello from Python without wait!
>>> 
🔄 Process 30108 is waiting for input (detected: ">>>")
Testing multi-line code with wait_for_prompt...
Python multi-line output with wait_for_prompt: ✅ Input executed in process 30108.
📭 (No output produced)
🔄 Process 30108 is waiting for input (detected: "...")✅ Input executed in process 30108:

📤 Output:
>>> ... ...


🔄 Process 30108 is waiting for input (detected: ">>>")[Reading 1 new lines (total: 9 lines)]

... ... >>> ... ... 
🔄 Process 30108 is waiting for input (detected: ">>>")[Reading 4 new lines (total: 12 lines)]

Hello, Guest 1!
Hello, Guest 2!
Hello, Guest 3!
>>> 
🔄 Process 30108 is waiting for input (detected: ">>>")
Terminating session...
Python session terminated
Enhanced REPL test PASSED
[32m✓ Test passed: ./test-enhanced-repl.js (5471ms)[0m

[36mRunning test module: ./test-error-sanitization.js[0m
[32m✓ Test passed: ./test-error-sanitization.js (74ms)[0m

[36mRunning test module: ./test-excel-files.js[0m
[32m✓ Test passed: ./test-excel-files.js (1639ms)[0m

[36mRunning test module: ./test-execution-engine-hardening.js[0m
[DEBUG] LocalExecutionEngine.initialize() called
 - Local execution engine ready
Execution-engine runtime cwd and child PID hardening passed
[32m✓ Test passed: ./test-execution-engine-hardening.js (2588ms)[0m

[36mRunning test module: ./test-file-handlers.js[0m
[32m✓ Test passed: ./test-file-handlers.js (1529ms)[0m

[36mRunning test module: ./test-file-preview-directory-runtime.js[0m

--- Test: directory preview rendering ---
✓ directory preview renders folder, file, warning, and denied states

✅ File preview directory runtime tests passed!
[32m✓ Test passed: ./test-file-preview-directory-runtime.js (135ms)[0m

[36mRunning test module: ./test-file-preview-image-runtime.js[0m
[32m✓ Test passed: ./test-file-preview-image-runtime.js (81ms)[0m

[36mRunning test module: ./test-forgotten-device-repair.js[0m
Forgotten-device re-pair identity tests passed
[32m✓ Test passed: ./test-forgotten-device-repair.js (1964ms)[0m

[36mRunning test module: ./test-gateway-account-link.js[0m
Gateway account link/logout client test passed
[32m✓ Test passed: ./test-gateway-account-link.js (1918ms)[0m

[36mRunning test module: ./test-gateway-channel-status.js[0m
Gateway channel status callback test passed
[32m✓ Test passed: ./test-gateway-channel-status.js (1873ms)[0m

[36mRunning test module: ./test-gateway-config.js[0m
Gateway persisted config and proxy tests passed
[32m✓ Test passed: ./test-gateway-config.js (272ms)[0m

[36mRunning test module: ./test-gateway-device-channel.js[0m
Gateway identity, direct dispatch, enrollment, tool routing, and reconnect tests passed
[32m✓ Test passed: ./test-gateway-device-channel.js (6927ms)[0m

[36mRunning test module: ./test-gateway-pairing-status.js[0m
Gateway pairing + status tests passed
[32m✓ Test passed: ./test-gateway-pairing-status.js (224ms)[0m

[36mRunning test module: ./test-gateway-secure-transport.js[0m
Gateway secure transport tests passed
[32m✓ Test passed: ./test-gateway-secure-transport.js (309ms)[0m

[36mRunning test module: ./test-green-hardening.js[0m
Green hardening regressions passed
[32m✓ Test passed: ./test-green-hardening.js (1821ms)[0m

[36mRunning test module: ./test-home-directory.js[0m
[32m✓ Test passed: ./test-home-directory.js (1480ms)[0m

[36mRunning test module: ./test-line-count.js[0m
Testing line count accuracy in read_file...

  ✅ PASS: 3 lines + trailing newline → total: 3
  ✅ PASS: 3 lines no trailing → total: 3
  ✅ PASS: 1 line + trailing → total: 1
  ✅ PASS: 1 line no trailing → total: 1
  ✅ PASS: 100-line partial read → total: 100
  ✅ PASS: 100-line no trailing → total: 100

6 passed, 0 failed out of 6 tests
[32m✓ Test passed: ./test-line-count.js (1505ms)[0m

[36mRunning test module: ./test-linux-device-service.js[0m
Linux MCP Device service tests passed
[32m✓ Test passed: ./test-linux-device-service.js (124ms)[0m

[36mRunning test module: ./test-literal-search.js[0m
[32m✓ Test passed: ./test-literal-search.js (1559ms)[0m

[36mRunning test module: ./test-local-feature-flags.js[0m
Local feature flag compatibility surface passed
[32m✓ Test passed: ./test-local-feature-flags.js (92ms)[0m

[36mRunning test module: ./test-markdown-editor-edit-diff.js[0m
OK   append text to an existing paragraph (1 hunk, 1 lines changed)
OK   rename a heading (1 hunk, 1 lines changed)
OK   append a bullet to a list (1 hunk, 9 lines changed)
OK   fix a typo (1 hunk, 1 lines changed)
OK   no edit -> no hunks
OK   edit a paragraph in a doc with frontmatter + wikilinks + tasks + table (1 hunk, 1 lines changed)
OK   no edit on complex doc -> no hunks

7 passed, 0 failed
[32m✓ Test passed: ./test-markdown-editor-edit-diff.js (1665ms)[0m

[36mRunning test module: ./test-markdown-editor-roundtrip.js[0m

--- Test: GFM pipe table survives editor round-trip ---
OK pipe table preserved

--- Test: literal "~" is not escaped to "\~" ---
OK tilde preserved

--- Test: adjacent block-level elements keep original spacing ---
OK block spacing preserved

--- Test: wikilink round-trips through editor ---
OK wikilink preserved

--- Test: trailing newline is preserved ---
OK trailing newline preserved

--- Test: bug-report combined fixture ---
OK combined fixture preserved

--- Test: YAML frontmatter survives round-trip (#437 LevionLaurion, #440) ---
OK frontmatter preserved

--- Test: square brackets not escaped (#440) ---
OK brackets preserved

--- Test: underscores in identifiers not escaped (#440) ---
OK underscores preserved

--- Test: tilde paths (~/foo) not escaped (#440) ---
OK tilde-path preserved

--- Test: list with blank lines between items (#440) ---
OK loose list preserved

--- Test: CRLF line endings preserved (related to #97/#438) ---
OK CRLF preserved

--- Test: README-style file not collapsed by Tiptap (issue #437 in-the-wild reproduction) ---
OK README-style file preserved

--- Test: pipe table embedded in realistic doc does not erase neighbors ---
OK realistic doc preserved

--- Test: bare URL not wrapped in autolink brackets (best-value-ai #1) ---
OK bare URL preserved

--- Test: 3 consecutive emoji-prefixed lines stay separate (best-value-ai #2) ---
OK emoji-prefixed soft breaks preserved

--- Test: backtick-text link inside a table cell (best-value-ai #3) ---
OK link-in-cell preserved

--- Test: `*` bullet marker preserved (best-value-ai #4) ---
OK star bullet marker preserved

--- Test: links to relative paths survive (skill-files batch) ---
OK relative-path links preserved

--- Test: literal `<` in prose not converted to &lt; (skill-files batch) ---
OK literal `<` preserved

--- Test: trailing two-space hard break preserved (skill-files batch) ---
OK trailing hard-break whitespace preserved

--- Test: **bold around `code`** preserved (skill-files batch) ---
OK bold-around-code preserved

--- Test: \| inside a table cell is preserved (skill-files batch) ---
OK escaped pipe preserved

--- Test: list item with two-space indented continuation line preserved ---
OK list item continuation preserved

24 passed, 0 failed
[32m✓ Test passed: ./test-markdown-editor-roundtrip.js (1835ms)[0m

[36mRunning test module: ./test-markdown-preview.js[0m

--- Test 1: heading slug generation ---
✓ heading slugs are stable and unique

--- Test 2: markdown outline extraction ---
✓ outline extraction ignores fenced code and de-duplicates headings

--- Test 3: markdown link resolution ---
✓ anchors, file links, absolute paths, external URLs, and wiki links resolve correctly

--- Test 4: wiki link rewrite and rendering ---
✓ markdown rendering uses preview heading ids and rewritten wiki links

--- Test 6: fullscreen document helpers ---
✓ fullscreen entry support and partial-read auto-load are detected correctly

--- Test 8: copy formats and editor shell ---
✓ raw/rendered copy support and mode-specific editor shell are wired

--- Test 9: partial documents reset baseline after full load ---
✓ fullscreen edit mode replaces the partial baseline with the full document

--- Test 10: refresh does not treat note text as a missing-file error ---
✓ refresh only treats actual tool errors as missing files

--- Test 11: unsupported files render raw content ---
✓ unsupported raw structured content renders as source

--- Test 11: failed saves resync the edit baseline from disk ---
✓ failed saves resync the edit baseline without discarding local edits

--- Test 12: successful saves reset the undo baseline ---
✓ successful saves clear undo state against the latest saved content

✅ Markdown preview tests passed!
[32m✓ Test passed: ./test-markdown-preview.js (427ms)[0m

[36mRunning test module: ./test-mcp-device-branding.js[0m
MCP Device package identity test passed
[32m✓ Test passed: ./test-mcp-device-branding.js (2409ms)[0m

[36mRunning test module: ./test-negative-offset-readfile.js[0m
[32m✓ Test passed: ./test-negative-offset-readfile.js (1713ms)[0m

[36mRunning test module: ./test-no-legacy-remote.js[0m
MCP Device has no legacy remote transport
[32m✓ Test passed: ./test-no-legacy-remote.js (89ms)[0m

[36mRunning test module: ./test-node-repl.js[0m
[34mDirect Node.js REPL test...[0m
[34mStarting Node.js REPL...[0m
[34mWaiting for Node.js startup...[0m
[32m[STDOUT] Welcome to Node.js v22.22.2.
Type ".help" for more information.[0m
[32m[STDOUT] >[0m
[34mInitial output buffer: Welcome to Node.js v22.22.2.
Type ".help" for more information.
> [0m
[34mSending simple command...[0m
[32m[STDOUT] Hello from Node.js![0m
[32m[STDOUT] undefined[0m
[32m[STDOUT] >[0m
[34mOutput after first command: Welcome to Node.js v22.22.2.
Type ".help" for more information.
> Hello from Node.js!
undefined
> [0m
[34mSending multi-line command directly...[0m
[34mSending code:[0m

function greet(name) {
  return `Hello, ${name}!`;
}

for (let i = 0; i < 3; i++) {
  console.log(greet(`User ${i}`));
}

[32m[STDOUT] >[0m
[32m[STDOUT] ...[0m
[32m[STDOUT] ...[0m
[32m[STDOUT] undefined[0m
[32m[STDOUT] > >[0m
[32m[STDOUT] ...[0m
[32m[STDOUT] ...[0m
[32m[STDOUT] Hello, User 0![0m
[32m[STDOUT] Hello, User 1![0m
[32m[STDOUT] Hello, User 2![0m
[32m[STDOUT] undefined
>[0m
[32m[STDOUT] >[0m
[34mFinal output buffer: Welcome to Node.js v22.22.2.
Type ".help" for more information.
> Hello from Node.js!
undefined
> > ... ... undefined
> > ... ... Hello, User 0!
Hello, User 1!
Hello, User 2!
undefined
> > [0m
[34mFound "Hello from Node.js!": true[0m
[34mFound greetings: true[0m
[34mTerminating Node.js process...[0m
[34mNode.js process exited with code 0[0m

[34mDirect Node.js REPL test [32mPASSED[0m
[34mDebug log saved to: E:\git-project\wt-mcp-device-110-integrate\test\test_output\node_repl_debug.txt[0m
[32m✓ Test passed: ./test-node-repl.js (8135ms)[0m

[36mRunning test module: ./test-nonblocking-config-save.js[0m
✓ 100 non-blocking saves resolved in 0ms
✓ in-memory value reflects the latest write immediately
✓ config.json is valid and holds the coalesced final value

PASS (3/3)
[32m✓ Test passed: ./test-nonblocking-config-save.js (405ms)[0m

[36mRunning test module: ./test-package-publish-surface.js[0m
Package publish surface is bounded: 264 files
[32m✓ Test passed: ./test-package-publish-surface.js (2368ms)[0m

[36mRunning test module: ./test-pdf-chrome-cache.js[0m
Chrome cache pruning test passed
[32m✓ Test passed: ./test-pdf-chrome-cache.js (795ms)[0m

[36mRunning test module: ./test-pdf-creation.js[0m
[32m✓ Test passed: ./test-pdf-creation.js (1470ms)[0m

[36mRunning test module: ./test-pdf-parsing.js[0m
[32m✓ Test passed: ./test-pdf-parsing.js (903ms)[0m

[36mRunning test module: ./test-pid-collision-guard.js[0m
Testing PID collision cleanup and numeric/string session IDs...
PASS: colliding child killed; kill failure logged without replacing collision error
PASS: all session tools accept numeric/string IDs and reject invalid IDs before dispatch
[32m✓ Test passed: ./test-pid-collision-guard.js (112ms)[0m

[36mRunning test module: ./test-process-pagination.js[0m
🚀 Starting process pagination tests...


📋 Test 1: Basic new output behavior (offset=0) for running process...
  First read got 1 tick lines
  Second read status: [Reading 3 new lines (total: 5 lines)]
✅ Test 1 passed: New output behavior works correctly

📋 Test 2: Absolute position (positive offset)...
✅ Test 2 passed: Absolute position works correctly

📋 Test 3: Tail behavior (negative offset)...
✅ Test 3 passed: Tail behavior works correctly

📋 Test 4: Length limit enforcement...
✅ Test 4 passed: Length limit works correctly

📋 Test 5: Runtime info for completed processes...
✅ Test 5 passed: Runtime info works correctly

📋 Test 6: interact_with_process output truncation...
✅ Test 6 passed: Output within limits (no truncation needed)

📋 Test 7: Re-reading output with absolute offset...
✅ Test 7 passed: Re-reading with absolute offset works

🎉 All pagination tests passed!
[32m✓ Test passed: ./test-process-pagination.js (7897ms)[0m

[36mRunning test module: ./test-public-contract.js[0m
Public MCP Device gateway contract fixture is pinned to the gateway schema
[32m✓ Test passed: ./test-public-contract.js (2001ms)[0m

[36mRunning test module: ./test-read-abort-timeout.js[0m
✓ fast operation resolves and signal is not aborted
✓ slow operation rejects ETIMEDOUT and aborts the operation signal
✓ read timeout is 3 minutes, below the client hard cap
✓ normal read_file still works with the signal threaded through

PASS (4/4)
[32m✓ Test passed: ./test-read-abort-timeout.js (1799ms)[0m

[36mRunning test module: ./test-read-completed-process.js[0m
Testing read_process_output on completed process...
✅ Successfully read from completed process
✅ Retrieved echo output: [Reading 2 new lines (total: 2 lines)]

SUCCESS MESSAGE

✅ Process completed with exit code 0 (runtime: 1.33s)
Testing immediate completion...
✅ Successfully read from immediately completed process

🎉 All tests passed - read_process_output works on completed processes!
[32m✓ Test passed: ./test-read-completed-process.js (4699ms)[0m

[36mRunning test module: ./test-release-flow.js[0m
One-command release flow tests passed
[32m✓ Test passed: ./test-release-flow.js (13579ms)[0m

[36mRunning test module: ./test-remote-child-hygiene.js[0m
Remote child hygiene integration passed
[32m✓ Test passed: ./test-remote-child-hygiene.js (4352ms)[0m

[36mRunning test module: ./test-remote-service-status.js[0m
Remote service status transition test passed
[32m✓ Test passed: ./test-remote-service-status.js (2293ms)[0m

[36mRunning test module: ./test-remote-startup-no-child.js[0m
Testing remote startup generations, zero child spawns, and uninitialized shutdown...
🚀 Starting MCP Device...
⏳ Connecting directly to MCP Gateway https://gateway.test
✓ Device ready through direct Gateway channel
🚀 Starting MCP Device...
⏳ Connecting directly to MCP Gateway https://gateway.test
✓ Device ready through direct Gateway channel
🚀 Starting MCP Device...
⏳ Connecting directly to MCP Gateway https://gateway.test
✓ Device ready through direct Gateway channel

🛑 Shutting down device...
  → Closing direct Gateway channel...
✓ Device shutdown complete

🛑 Shutting down device...
  → Closing direct Gateway channel...
✓ Device shutdown complete
PASS: distinct per-start UUIDs, zero child spawns, and repeated uninitialized shutdown
[32m✓ Test passed: ./test-remote-startup-no-child.js (540ms)[0m

[36mRunning test module: ./test-remote-yolo-path-access.js[0m
Remote YOLO path access test passed
[32m✓ Test passed: ./test-remote-yolo-path-access.js (2157ms)[0m

[36mRunning test module: ./test-repl-interaction.js[0m
[32m✓ Test passed: ./test-repl-interaction.js (133ms)[0m

[36mRunning test module: ./test-search-code-edge-cases.js[0m
[32m✓ Test passed: ./test-search-code-edge-cases.js (1867ms)[0m

[36mRunning test module: ./test-search-code.js[0m
[32m✓ Test passed: ./test-search-code.js (1665ms)[0m

[36mRunning test module: ./test-self-update.js[0m
✓ Self-update pre-stage, lifecycle-isolated launchers, reconnect reconciliation, and offline rollback tests passed
[32m✓ Test passed: ./test-self-update.js (32790ms)[0m

[36mRunning test module: ./test-symlink-security.js[0m
[32m✓ Test passed: ./test-symlink-security.js (1655ms)[0m

[36mRunning test module: ./test-telemetry-handling.js[0m
[32m✓ Test passed: ./test-telemetry-handling.js (1806ms)[0m

[36mRunning test module: ./test-ui-event-tracking.js[0m
[32m✓ Test passed: ./test-ui-event-tracking.js (1745ms)[0m

[36mRunning test module: ./test-version-consistency.js[0m
PASS: package.json, package-lock.json (root and root package), version.ts, and device.ts match 1.0.10
[32m✓ Test passed: ./test-version-consistency.js (90ms)[0m

[36mRunning test module: ./test-widget-state-runtime.js[0m

--- Test: widget state keeps same-origin iframes isolated ---
✓ widget state keeps same-origin iframes isolated across refresh

✅ Widget state runtime tests passed!
[32m✓ Test passed: ./test-widget-state-runtime.js (98ms)[0m

[36mRunning test module: ./test-windows-device-service.js[0m
Windows device service tests passed
[32m✓ Test passed: ./test-windows-device-service.js (111ms)[0m

[36mRunning test module: ./test-windows-local-storage.js[0m
Windows local storage avoids legacy secret APIs
[32m✓ Test passed: ./test-windows-local-storage.js (163ms)[0m

[36mRunning test module: ./test_enhanced_read.js[0m
Testing enhanced file reading with our 1500-line file...

=== Test 1: Read first 10 lines ===
Result length: 691
First few lines of result:
This is line 1 of the test file with some content to make it longer
This is line 2 of the test file with some content to make it longer
This is line 3 of the test file with some content to make it l...
✓ Test 1 PASSED

=== Test 2: Read from offset 500, length 5 ===
Result length: 355
First few lines of result:
This is line 501 of the test file with some content to make it longer
This is line 502 of the test file with some content to make it longer
This is line 503 of the test file with some content to mak...
✓ Test 2 PASSED

=== Test 3: Read last 10 lines (lines 1491-1500) ===
Result length: 720
First few lines of result:
This is line 1491 of the test file with some content to make it longer
This is line 1492 of the test file with some content to make it longer
This is line 1493 of the test file with some content to make it longer
This is line 1494 of the test file with some content to make it longer
This is line...
✓ Test 3 PASSED

=== SUMMARY ===
Tests passed: 3/3
🎉 All tests PASSED!
[32m✓ Test passed: ./test_enhanced_read.js (1441ms)[0m

[36mRunning test module: ./test_improved_search_truncation.js[0m
Testing improved search result behavior with streaming API...
Searching for "." to get maximum results...
Search completed in 12281ms
Initial result type: string
Initial result length: 1103
Final result type: string
Final result length: 8508
✅ Results well within safe limits
ℹ️  Results complete, no truncation needed with new streaming API
First 200 characters of final result:
Search session: search_1_1791130366292
Status: COMPLETED
Runtime: 12s
Total results found: 17108 (17098 matches)
Showing results 0-99

Results:
📄 E:\git-project\wt-mcp-device-110-integrate\test\negat

📊 Safety Analysis:
   Initial response: 1,103 characters
   Final response: 8,508 characters
   Combined size: 9,611 characters
   API limit: 1,048,576 characters
   Safety margin: 1,038,965 characters
   Utilization: 0.9%
Improved search truncation test completed successfully.
[32m✓ Test passed: ./test_improved_search_truncation.js (13805ms)[0m

[36mRunning test module: ./test_search_truncation.js[0m
Testing search result behavior with new streaming API...
Searching for common JavaScript patterns...
Initial result type: string
Initial result length: 1064
Final result type: string
Final result length: 10150
✅ Results manageable size, no truncation needed
First 200 characters of final result:
Search session: search_1_1791130380185
Status: COMPLETED
Runtime: 0s
Total results found: 13428 (3040 matches)
Showing results 0-99

Results:
📄 E:\git-project\wt-mcp-device-110-integrate\test\negativ

📊 Response Analysis:
   Initial response: 1,064 characters
   Final response: 10,150 characters
   Combined: 11,214 characters
Search truncation test completed successfully.
[32m✓ Test passed: ./test_search_truncation.js (1744ms)[0m

[1m[36m===== TEST SUMMARY =====[0m

[1mOverall Results:[0m
  Total tests:     66
  [32m✓ Passed:        66[0m
  [32m✗ Failed:        0[0m
  Total duration:  164312ms (164.3s)

[1mPerformance Summary:[0m
  Average test duration: 2490ms
  Fastest test: ./test-error-sanitization.js (74ms)
  Slowest test: ./test-self-update.js (32790ms)

[32m[1m🎉 ALL TESTS PASSED! 🎉[0m
[32mAll 66 tests completed successfully.[0m

[36m===== Test run completed =====[0m

[34mTotal execution time: 174494ms (174.5s)[0m
(node:35828) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:10936) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:39036) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:39068) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:8212) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:37312) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:33360) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:16144) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:34172) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:28996) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:37944) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:36928) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:39300) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:38144) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:36364) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
error catch Error: ENOENT: no such file or directory, stat 'C:\Users\admin\AppData\Local\Temp\mcp-device-direct-sFeIHq\missing'
(node:39200) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:20048) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
Invalid MCP Device config preserved at C:\Users\admin\AppData\Local\Temp\mcp-device-green-hardening-WFnEEj\config.corrupt-2026-10-04T16-10-54-631Z.json: Unexpected end of JSON input
Process error for "echo never-runs": spawn C:\definitely-not-real\missing-shell.exe ENOENT
Process error for "Start-Sleep -Seconds 30": synthetic late error
(node:1492) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:37080) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:35328) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:34968) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:39264) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:15648) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:12604) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:35496) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:38852) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:24452) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:36392) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:29948) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:31432) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:28988) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:33488) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:35828) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:18736) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:30344) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:35896) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

```

## `git merge-base --is-ancestor main HEAD`

Exit code: 0

```text

```

## `git rev-parse main`

Exit code: 0

```text
e64045c25e722061cfe66f43dd09e7fac7bc98b4

```

## Verification summary

- Dedicated Linux service test: exit 0.
- Full suite: 66 total, 66 passed, 0 failed; exit 0.
- Clean build and npm pack: exit 0.
- x1.patch SHA-256: `09aec36b85b2b4234673d8a10bc73a461311df06c4625fdf7f61a30a22f3ee87`.
- hcu-lab.me-mcp-device-1.0.10.tgz SHA-256: `c8368f4ab716d2019c996b020159de08d645efc2ca0e023878bf1ba9cbea73ee`.
- `git diff --check` reports two whitespace warnings within the generated patch's context lines (368 and 403). The patch is kept byte-for-byte as produced by the requested git diff, rather than altered to suppress warnings.
- Git warns that x1.patch LF may become CRLF on a later checkout; the checksum above is for the exact current generated file bytes.

## B1 delivery strategy

Local main is an ancestor of the verified test commit (ancestor check exit 0). Use a fast-forward via Git CLI, preserving the verified history rather than squash/rebase:

```sh
git checkout main && git merge --ff-only 3607dc89fddcbaae345c91db609db3f1accfac30 && git push origin main
```

To also deliver the later evidence-only commit, replace the SHA above with the final branch-tip SHA reported after the evidence commit. Recheck the main ancestry if main advances. Merge and push are documented only, not performed.

The broad f2a5eeb stat is intentionally recorded in full and is NOT empty; it includes pre-existing repository artifacts. The required src/package comparison against 25718d3 is empty. Artifact checksums apply to the exact generated bytes in this run.
