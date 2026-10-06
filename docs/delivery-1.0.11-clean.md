# 1.0.11 clean GitHub delivery provenance

## Authority and lineage

The owner authorized GitHub-only 1.0.11 delivery and explicitly resolved the two clean-delivery blockers: retain the required small benchmark library at its existing path, and accept CRLF/LF-normalized parity rather than equality to a previous tarball's raw hash. This does not authorize npm publication, tags, deployments, or production context enablement.

- Remote: `https://github.com/Hiroshimeow/agent-mcp-device.git`.
- Delivery branch: `delivery/mcp-device-1.0.11-clean` in the isolated standalone repository `E:/git-project/wt-mcp-device-111-clean-delivery`.
- Sole parent/base main: `1492747a53902ebdce7ad5b8eccd522fa8afdcc9`.
- Verified integration candidate: `cdc3736ae4d9d29f81cb82118c8ebea02c193a3e`.
- Accepted feature tip: `b3a5768a612d3a7a8629978e27776b19789d471e`.
- Accepted code: `a95a7dce03fc8e80bab99af8f90597213f527fd3`.
- Original clean staged tree: `b6714962923630dc66625ba6c543c3c6affeb867`.
- Restored tree before adding this provenance record: `101fc0c52c61b3a4093f5234109b4ba62b5caa2d`.

This is a clean snapshot commit on existing remote main, not a merge of the accepted archival ancestry. The accepted/source histories remain unchanged locally; their giant benchmark/archive blobs must not become reachable from the delivery commit. `docs/integration-1.0.11-github.md` is the unchanged historical candidate report; this record supersedes its ordinary two-parent delivery strategy after GitHub rejected archival blobs. The 639 non-archive candidate files retain exact Git blob, mode, and physical byte parity. There are no new product features or production file rewrites.

## Minimal dependency exception

Exactly one file survives from `.archive-worktrees-docs/`:

- `.archive-worktrees-docs/wt-mcp-device-110-bench/bench/lib/core.mjs`
- Git blob `884fa959a473af6ccfecded762b8fc6d28870dd0`, exactly 21,456 bytes, identical at both the verified candidate and accepted feature tip.

The existing `bench/scenarios/context.mjs` import is unchanged. The library is necessary executable benchmark code, not a large archive artifact. Its complete source was inspected: its only six imports are Node built-ins (`node:fs/promises`, `node:path`, `node:os`, `node:crypto`, `node:child_process`, `node:perf_hooks`). It has no relative, package, or dynamic module imports, so no additional archived code dependencies are required. Its Git/npm subprocess calls and optional filesystem readers are operations, not imports of archived code; the passing benchmark contract exercises the required path. All other 1,556 candidate archive files remain excluded, including giant tar and raw JSONL blobs. No original local archive is deleted.

## Fresh versus retained verification

Fresh Windows verification used Node `v22.22.2` on 2026-10-06. Raw commands, times, exit codes, and output reside at `E:/git-project/mcp-device-111-delivery-evidence/clean/final/`:

- Benchmark contract immediately after restoration: 1/1 passed, 0 failed/skipped (`benchmark-contract.log`).
- Fresh complete build: exit 0 (`build.log`).
- Full context suite: 198/198 passed, 0 failed/skipped (`context.log`).
- Full core regression: 66/66 modules passed, 0 failed (`core-regression.log`).
- Benchmark contract again against fresh build: 1/1 passed (`benchmark-contract-full.log`).
- Spec implementation consistency: 32 requirements, 8 criteria, 62 tasks; exit 0 (`spec-consistency.log`). This check is not an independent code review.
- Package/lock/runtime/device-fallback version consistency: exit 0 (`version-consistency.log`).
- Dry-run and actual local pack: exit 0, including production CA prepack checks (`package-dry-run.log`, `package.log`).
- Exact staged/physical candidate parity and single-library archive exception: `parity-results.json`.

Retained evidence is explicitly separate: the prior clean `npm ci --ignore-scripts` log at `../npm-ci.log` remains applicable because both dependency manifests are physically and Git-blob identical to that verification, the same installed dependency tree was used, and no package changes/reinstall were made. It reported 19 audit findings (6 moderate, 12 high, 1 critical); no audit fix is claimed. Accepted historical Linux evidence and independent reviews remain unchanged with their source inputs byte-identical; no fresh Linux run or fresh independent reviewer signoff is claimed. Prior failing/mismatched reports remain intact as historical evidence rather than being relabeled passes.

## Fresh artifact identity

- Artifact: `E:/git-project/mcp-device-111-delivery-evidence/clean/final/hcu-lab.me-mcp-device-1.0.11.tgz`.
- Exact SHA-256: `04884e48176ae1407a4e4a135c06e851f0c2abb7d3720e47845e62c7cd6d6ab8`.
- Size: 805,757 bytes; 298 package entries.
- All 298 entries match the freshly built/source files byte-for-byte, including runtime entrypoints, context authorization/store/CLI, official CA, update helper, onboarding data, revocation config, and context skill.
- Embedded package/runtime/device fallback versions are `1.0.11`; package Node floor is `>=22.13.0`.
- No unexpected source, benchmark, archive, or evidence content is packaged.
- Prior artifact SHA-256: `2de5c05cd5695d921ca951c3e42d69eef44f069a9c9b841f048e6b58f9baf290`.
- All entries have normalized equality to that prior artifact. Exactly 36 entries differ in raw bytes solely through CRLF/LF, independently rechecked in `artifact-results.json`. The new exact hash is authoritative; no production files were altered to reproduce the old hash.

## Publication safeguards

Before pushing, audit every blob newly reachable from the committed delivery SHA relative to the base; each must be strictly below 100 MiB. The staged maximum is 589,614 bytes. Publish the explicit delivery branch first, then update remote main only by a normal fast-forward; do not force or bypass branch protection. Disable follow-tags for both pushes. Re-fetch remote refs and verify the resulting SHA is fetchable. Preserve all shared worktrees, accepted/integration branches, local archives, tags, and the shared Git config. The publish workflow is tag-triggered; no tag or npm publish command is part of this delivery. Postcommit object audit, push responses, fetch verification, tag comparison, and preservation results are recorded externally in the final evidence directory.
