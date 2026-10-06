# 1.0.11 GitHub-only integration

This integration follows the owner's explicit authorization to deliver the accepted 1.0.11 commits to GitHub. It does not authorize npm publication, tags, device deployment, or production context enablement. Historical feature-acceptance delivery restrictions in earlier evidence describe their original checkpoint, not this later GitHub-only authorization. External SOC confirmation/private-key custody remains a production gate.

## Inputs and reconciliation

- Remote: `https://github.com/Hiroshimeow/agent-mcp-device.git`.
- Current fetched main: `1492747a53902ebdce7ad5b8eccd522fa8afdcc9`.
- Accepted feature tip: `b3a5768a612d3a7a8629978e27776b19789d471e`.
- Accepted code: `a95a7dce03fc8e80bab99af8f90597213f527fd3`.
- Common ancestor: `ee87d0f3057e01e8087db99615d14bd1b4c626d4`.
- Fresh isolated worktree starts at fetched main; ordinary two-parent merge preserves both histories. No force, reset, shared-config repair, or dirty-worktree edits.

Ten files conflicted because main's squashed 1.0.10 reconciliation and the feature's original 1.0.10 lineage independently changed the same ancestor. Each conflict was inspected against both tips. There were no runtime fixes unique to current main needing a new implementation delta:

- `package.json`, `package-lock.json`, `src/version.ts`, `test/test-version-consistency.js`: retain consistent accepted 1.0.11 metadata and Node >=22.13.0.
- `src/device/device.ts`: retain main's direct runtime readiness/boot nonce and accepted device-bound context options and 1.0.11 fallback.
- `src/device/gateway-tool-adapter.ts`: retain main's direct dispatcher, allowed-root enforcement, PID validation and bounded image preview alongside accepted approval-gated context calls and canonical observer.
- `src/terminal-manager.ts`: retain completed-output replay, PID-collision handling and close-time finalization; include accepted execution identity retention.
- `src/tool-dispatcher.ts`: retain canonical direct dispatch; include accepted exactly-once observation/history exclusion.
- `test/test-pid-collision-guard.js`: retain collision and numeric/string PID assertions; include observer injection required by accepted adapter.
- `CHANGELOG.md`: retain the identical historical 1.0.10 entry and add accepted unreleased 1.0.11 entry, without rewriting historical claims.

The resolved index tree before this integration record was exactly `1c79fed21484fdda5429b0f7e600675dd570b7ca`, identical to the accepted feature-tip tree. Thus no source/test/package/dependency/config/skill/benchmark input changed relative to accepted code. Differences from accepted code to accepted feature tip are evidence and `.gitattributes` only (57 files); the integrated tree adds only this delivery record. Historical evidence/log whitespace is preserved rather than rewritten.

## Delivery gates

Rebuild, full context suite, full core regression runner, benchmark contract, Spec Kit consistency, explicit version consistency, production CA prepack check and local npm package inventory must all pass before pushing. Raw integration logs are retained outside the source tree at `E:/git-project/mcp-device-111-delivery-evidence/`; verification metadata records exact commands, exit codes and counts. This record is provenance, not a substitute for those raw results.

Fresh integration verification on Windows with Node v22.22.2: build exit 0; context 198/198 passed (0 failed/skipped); core regression 66/66 modules passed (0 failed); benchmark contract 1/1 passed; implementation consistency 32 FR / 8 SC / 62 tasks passed; explicit version consistency passed. Local dry-run and actual pack each exit 0 with CA prepack checks. The tarball inventory has 298 entries, all 9 required runtime/config/skill files match source, and no unexpected source/evidence files. Raw artifact check initially failed because GNU tar interpreted a Windows drive-letter path as a remote host; switching only the external inspection harness to a relative archive path passed, without a product change. No fresh Linux integration execution is claimed; historical accepted Linux evidence remains unchanged. Fresh npm ci reports 19 existing audit findings (6 moderate, 12 high, 1 critical); dependencies/lock inputs are unchanged, and no unapproved audit fix is applied.

The publish workflow triggers only `v*` tags. The release script and npm version hooks are not used. The delivery pushes only explicit branch refs with follow-tags disabled. Main can be updated only as a normal fast-forward from the fetched remote main; protection or unexpected remote/credential conflicts must not be bypassed.
