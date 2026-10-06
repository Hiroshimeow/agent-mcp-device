# H1 rerun — Checkpoint 3 / Phase 9 refreshed evidence

Recorded 2026-10-05T23:51:58.960Z. Worktree: E:/git-project/wt-mcp-device-111-context; branch feat/mcp-device-1.0.11-context.

Code X_final: a95a7dce03fc8e80bab99af8f90597213f527fd3. Run HEAD: f58b95ae1c1be735f3f9601d8a8695e445a8b101 (Checkpoint 3 evidence commit). All 210 tracked source/test/harness/package inputs hashed before and after execution are byte-identical. No production or package changes; no merge/release/production enablement authorized.

## Results

- Windows Node v22.22.2 x64 / npm 11.17.0: npm run build exit 0 (checkpoint3-build-xfinal.txt); full context suite exit 0, 198/198 passed, zero failures/skips/cancellations, 54749.8403 ms (phase9-windows-context-xfinal.tap).
- Windows benchmark exit 0: 15 measured samples, 15 valid, zero invalid, 3 per workload, count=40, no warmup. Raw: phase9-windows-benchmark-xfinal.jsonl; summary: same name + .summary.json.
- WSL2 Ubuntu-22.04, kernel 6.6.87.2-microsoft-standard-WSL2, native Linux Node v22.21.0 x64 / npm 11.6.3 / SQLite 3.50.4: selected benchmark exit 0, 15/15 valid, zero invalid. Raw: phase9-linux-benchmark-xfinal-verified.jsonl; summary: same name + .summary.json.
- Corrected full Linux context suite exit 1: 197 reported tests, 194 pass, 3 failures, zero skips/cancellations, 61065.505931 ms. Raw: phase9-linux-context-xfinal-verified.tap. All remaining failures are missing linux-x64 sharp native binaries in Windows-installed node_modules: adapter-parity.test.js and catalog-rollout.test.js fail module loading; capture-routes.test.js fails its gateway route test on the same sharp import. This is NOT a Linux full-suite pass or completed cross-platform acceptance. No dependency installation was performed because the requested scope is evidence-only. Follow-up requires an isolated Linux dependency install and full-suite rerun.
- node scripts/check-context-acceptance.mjs exit 0: 32 requirements, 8 success criteria, 62 tasks, passed=true, errors=[] (phase9-speckit-consistency-xfinal.json). This script is implementation consistency, not independent review.

## Timing distributions (milliseconds)

| Workload | Windows median / p95 / max | WSL2 Linux median / p95 / max |
| --- | --- | --- |
| capture | 3035.22 / 3165.84 / 3165.84 | 2162.98 / 2286.95 / 2286.95 |
| sync | 61.87 / 71.51 / 71.51 | 32.33 / 43.34 / 43.34 |
| search | 161.13 / 167.00 / 167.00 | 132.81 / 141.50 / 141.50 |
| activity | 1769.22 / 2344.00 / 2344.00 | 1117.54 / 1129.57 / 1129.57 |
| contention | 113.18 / 121.09 / 121.09 | 32.08 / 32.72 / 32.72 |

With n=3, p95 equals max; timings are descriptive, not SLA evidence. Same physical host; different Node versions, OS/resource allocations and filesystem boundaries prevent interpreting differences as implementation improvements. CPU is same-process delta and RSS is process-lifetime high-water mark, not per-scenario peak. Authorization uses isolated throwaway fixture signing keys, not installed production approvals. git_dirty=true reflects new evidence files, not changed production inputs.

## Execution and retained failed attempt

All exact commands, start/end timestamps, exit codes and stdout/stderr paths are recorded in phase9-h1-xfinal-runs.json. TAP stdout is captured directly, without shell prompts or appended exit markers; warnings appear as TAP diagnostic comments. Empty stderr files are retained and hashed. Reproduction drivers: run-h1-xfinal.mjs, run-h1-linux-verified.mjs, finalize-h1-xfinal.mjs.

Initial WSL full suite: exit 1, 180 pass / 17 failures out of 197. Both missing sharp binaries and inherited GIT_DIR/GIT_WORK_TREE caused failures. Initial test fixture Git commands created four empty commits on the branch (all identical trees); the original branch ref was restored via guarded update-ref. The initial Linux benchmark recorded incidental HEAD 117731e... and is retained as audit evidence only; the verified benchmark rerun captures original HEAD f58b95ae1c1be735f3f9601d8a8695e445a8b101. Corrected Linux suite unsets both overrides, resolving the Git-related failures without source changes. This incident is detailed in phase9-h1-xfinal-source-identity.json.

No native independent Linux host, Linux install/build, full regression runner rerun, Node-minimum version run, or reviewer sign-off is claimed. Historical checkpoint3-* and phase9-* evidence is preserved, not overwritten. This addendum supersedes the historical-only benchmark statement in checkpoint3-review-packet.md only for the selected rerun artifacts above.

## Artifact integrity

New exact-byte hashes are in phase9-h1-xfinal-artifacts.sha256 and appended to phase9-artifacts.sha256 and checkpoint3-artifacts.sha256. Historical manifest entries (including pre-existing missing .log paths) are retained unchanged; only the new rerun set is freshly validated. SHA256 paths are worktree-relative.
