# D0 — Packaging, Skill ownership and single-writer review packet

**REVIEW_PENDING_G6_ONLY. Prepared, NOT SENT. No reviewer turn or approval exists.**

## Review routing and authority

Required reviewer: verified M365 Opus 5.5 on FJP, using the established `m365.cmd doctor` → worker submit with `--model opus` → status/wait → result workflow. Verify the actual model label and exact turn ID; reuse the conversation for follow-ups. The current user instruction permits only md on G6. No FJP access, weaker-model substitute, or self-approval has occurred.

Repository: `E:/git-project/agent-mcp-device-v12`, branch `feat/v12-platform-20261022`, starting HEAD `1e454c1cdcbe3265892f751034fa389432d65405`. Code remains uncommitted pending the required review. Initial dirty work was preserved with hashes and copies before edits.

## Current architecture retained

MCP Device remains the product. The generic PluginHost starts one process-isolated Palace writer. Palace remains default enabled and removable; native Device execution is separate. `src/plugins/palace` plus the retained log-palace index supply one implementation. The independently assembled `@hcu-lab.me/palace` archive contains the same engine, CLI and Skill assets, with no dependency on the Device package. No new Palace HTTP/MCP service, scheduler or memory backend was introduced.

The existing standalone builder and package integration were already WIP at start. Their architectural validity has not been silently approved. The CLI opens read-only SQLite snapshots; it explicitly does not reverify source evidence during read. Existing stopped-runtime `mcp-device knowledge` commands remain the mutation path; whether that limitation is sufficient for the agent workflow is an open decision.

## Current immutable test artifacts

| Product | SHA-256 | Bytes |
| --- | --- | --- |
| MCP Device 1.0.12 | `e494d7be162390b1aaf2359112e103b1cbcad13885c71b21c9a5b948c3d8343b` | 2128581 |
| Palace 1.0.12 | `db27ab6c60cbb14eb65ffd25424ed9bd867868061c332dba0d1353b9590133a6` | 35288 |

Location: `E:/test/mcp-device-v12-e2e-20261024-g6/artifacts/final/`. See `artifacts-final.json` for exact runtime fingerprints and `candidate-three-final-source.json` for build source. The later Windows fixture-cleanup repair changes only a test: `validation-source-final.json`; runtime hashes remain identical.

## Reproduced defects and narrow fixes

- CLI search/read measured compact JSON but emitted pretty JSON, exceeding the requested output budget. Exact UTF-8 bytes including the newline are now checked and emitted. Punctuation-only search no longer falls back to arbitrary cards. Red 3/4 failures, green 4/4 in `cli-contract-red.json` and `cli-contract-green.json`.
- The marker-only Skill copy fallback overwrote user edits and user-added files. It now replaces a marked copy only when all files and directory entries are byte-identical to the current source and no symlink is involved. Ambiguous/changed copies are retained. Three regression tests are in the platform suite.
- **Unresolved:** moving/removing the original package leaves a dangling managed Skill link. `skill-safety-after.json` has one PASS and one FAIL. There is no ownership record sufficient to replace a dangling symlink safely. Old-version copy upgrades also conservatively preserve content when the baseline cannot be proved.
- Version fallback in Device still said 1.0.11; it now agrees with package/version source 1.0.12. Test expectations were updated for the existing v12 product/CLI contract while preserving telemetry and vendor-branding checks.
- A Windows test removed its cwd after signaling, but before the owned PowerShell child closed. The test now waits for close with a bounded timeout; the production termination API was not changed. Its first failed run and focused green rerun are retained.

## Evidence already obtained on G6

- Actual production-only npm installs, scripts enabled, outside the checkout dependency tree: both products on Windows and WSL Ubuntu-22.04. Device installs its Skill into an isolated agent home. Standalone Palace works without MCP Device installed. Exact installed bins, plugin startup, persistent read and original-source byte verification pass.
- New Device archive passes 16 recorded cold checks on each OS: `final-package/cold-win32-mcp-device.json` and `final-package/cold-linux-mcp-device.json`.
- Final Palace archive is identical to the Windows-tested archive; Linux was repeated in a persistent native directory: `cold-win32-palace.json`, `final-package/cold-linux-palace.json`.
- Linux platform suite: 87/87 PASS, no skip (`platform-linux-final.json`). Windows final platform suite also passes 87/87, no skips (`platform-windows-final.json`).
- Server suite: 42/42 PASS on each OS, no skip (`server-suite-windows-final.json`, `server-suite-linux-final.json`). Includes authenticated dual listeners, default absence of `knowledge.*`, native dispatch, process-isolated remote Device Cores, source preservation, pairing and OAuth restore. Legacy knowledge MCP is explicitly opted into only by compatibility fixtures.
- Native Core comparator: 14 result families plus four side-effect families match frozen v11; baseline HEAD and compiled files unchanged (`core-parity-windows-final.json`, `core-parity-baseline-after.json`). Legacy exported-runner parity completed with 35 reported PASS and 6 FAIL: the same three suites fail on both baseline and candidate. Two reported sanitizer PASS rows are no-ops and excluded from acceptance; see `parity-interpretation.json`. The root runner's 66 successful module exits are not 66 proven assertion suites.
- Final-artifact stress: 1,000 real CLI processes while the isolated writer indexes appended synthetic operational records; all PASS, 111 appends, SQLite integrity ok, second writer lease refused (`live-cli-1000-windows-final-result.json`). Duration 58.521 seconds. This is not learning, agent-productivity, provider-token or 24h-soak evidence.

## Package inventory detail requiring closure

`palace-pack-final.stdout.log` lists no LICENSE file although the manifest declares MIT; the main Device archive includes LICENSE and its third-party notices. Confirm and include the applicable notice file in the standalone package before public distribution. No npm publication occurred.

## Concrete reviewer decisions requested: PASS / AMEND / BLOCK

1. Does same-source standalone assembly provide a sufficient independent package boundary and dependency closure? Confirm the exact exported manifest/plugin/CLI contract and offline bundled policy.
2. Choose the smallest ownership scheme for symlink/junction and copy installs, upgrade/relocation, disable/uninstall and reinstall. It must preserve user edits and never replace an unowned same-name Skill. Specify failure and rollback behavior.
3. Is stopped-runtime mutation under the existing exclusive lease sufficient for the documented agent flow? If not, name the existing owner-safe control path to extend and the bounded protocol contract; do not add a second writer or Palace service.
4. Identify concrete blockers in default installation versus standalone installation, managed Skill cleanup, interrupted upgrades and artifact licensing/closure.
5. Specify the minimal follow-up tests needed before D1, including real agent discovery/use; distinguish architectural decisions from the already-proven narrow bug fixes.

## Reviews and remaining release gates

D0 turn ID/model/verdict: null / NOT_RUN / REVIEW_PENDING_G6_ONLY. D1–D3: NOT_RUN. No disagreement disposition exists because no review has occurred.

Real agent Skill sessions, independent real-world procedure validation, held-out 20-pair provider-token A/B, complete cross-OS parity, upgrade/rollback acceptance, 24h soak and load comparison, and G8/fleet rollout remain unproved. Token savings are NOT_PROVEN. Keep RELEASE_BLOCKED_WITH_EVIDENCE until the actual gates pass.

Review bundle: D0-review-bundle.zip, with bundle-manifest.json and the included source manifest. Prepared locally; not sent. See FINAL_REPORT.md for the completed evidence checkpoint.
