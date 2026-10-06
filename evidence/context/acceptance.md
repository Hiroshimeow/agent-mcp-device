# Phase 9 acceptance / consistency record

Target **1.0.11 unreleased**, branch `feat/mcp-device-1.0.11-context`. Delivery boundary: commit locally; **do not merge, publish, tag or release**.

## Verdict

**Unconditional feature acceptance PASS at X_final / Y_final3; production release gated on external SOC confirmation.**

M365 Copilot Opus final verdict: **READY_TO_PROCEED** for Checkpoint 3 / Phase 9 acceptance (T061/T062). Full verbatim sign-off: [checkpoint3-opus-signoff.md](checkpoint3-opus-signoff.md). Accepted code X_final: `a95a7dce03fc8e80bab99af8f90597213f527fd3`; evidence Y_final3: `714f3d83589fb12bede6935de2001669215daf8c`.

Historical Phase 9 artifacts recorded both platforms passing build, 186 context tests, 66 regression modules, benchmark contract test and 15 correctness-checked benchmark samples. The H1 rerun at unchanged X_final supersedes those counts for the selected rerun: Windows full context 198/198 passed; WSL2 Linux context 194 passed / 3 sharp-related native dependency failures, not a Linux full-suite pass. Both benchmark reruns are 15/15 valid. Spec Kit consistency passes. The final Opus sign-off accepts the subsequent native Linux fresh-install run (198/198 passed) and Windows run (198/198 passed), with benchmarks 15/15 valid on each platform. This supersedes the earlier WSL native-dependency blocker for feature acceptance; these results are not proof of production rollout.

## Task disposition

| Task | Status | Evidence |
| --- | --- | --- |
| T057 | COMPLETE | bench/scenarios/context.mjs reuses accepted core; five correctness-checked workloads, actual work counts, CPU/RSS/identity; bench/test/context.test.mjs |
| T058 | COMPLETE with explicit NOT_MEASURED scopes | platform-matrix.md and preserved Windows/Linux raw artifacts; Linux is WSL2/Linux filesystem, not separate physical fleet hardware |
| T059 | COMPLETE | package.json/lock engines >=22.13.0; version 1.0.11 in package/lock/runtime/device fallback; README/docs/context.md/CHANGELOG migration guidance. Existing 1.0.10 changelog entry unchanged |
| T060 | COMPLETE | Public CLI/schema/skill/privacy/license/source documentation; skill test passes. Existing implementation limitations described rather than overclaimed |
| T061 | COMPLETE (Opus sign-off obtained) | independent-review.md and checkpoint3-opus-signoff.md; final READY_TO_PROCEED verdict |
| T062 | COMPLETE (Unconditional feature acceptance PASS at X_final / Y_final3, production release gated on external SOC confirmation) | phase9-speckit-consistency.json, final verification artifacts and checkpoint3-opus-signoff.md |

## Verification

- `npm run build`: exit 0, zero TypeScript errors on Windows and Linux. Final full regression runner rebuilds the final version/fallback state.
- `node --test test/context/*.test.js`: 186 passed / 0 failed / 0 skipped on both platforms (`phase9-*-context-verified.tap`).
- `node test/run-all-tests.js`: 66 modules passed / 0 failed on both platforms (`phase9-windows-regression-verified.log`, `phase9-linux-regression-final.log`).
- `node --test bench/test/context.test.mjs`: 1 passed / 0 failed on both platforms (`phase9-*-benchmark-final.tap`).
- `node bench/scenarios/context.mjs <new-output>`: 15 measured valid rows per platform; all assertion records retained, final summary contains median/p95/max, resource counters and work counts.
- `node scripts/check-context-acceptance.mjs`: 32 FRs, 8 SCs, 62 sequential tasks, all FR/SC task coverage present, required artifacts/link targets and package/runtime compatibility consistent. This current implementation checker does not apply the archived planning-only validator's obsolete rules that prohibit implementation diffs or checked tasks.
- Raw artifacts are hash-addressed by phase9-artifacts.sha256; source identities distinguish Windows worktree and Linux snapshot. Runs preceding the evidence commit identify their then-current HEAD/dirty state explicitly.

## Checkpoint 3 H1 rerun and provenance

- Code X_final: `a95a7dce03fc8e80bab99af8f90597213f527fd3`; run HEAD: `f58b95ae1c1be735f3f9601d8a8695e445a8b101`, its evidence-only descendant. All 210 source/test/harness/package input hashes remain unchanged.
- Windows benchmark rerun: 15/15 valid, capture median **3035.22 ms** versus previous **3142.51 ms**, zero observed degradation.
- WSL2 Linux benchmark rerun: 15/15 valid, capture median **2162.98 ms**.
- Windows full context test rerun: **198/198 passed, 0 failed**.
- Corrected Linux context rerun: **194 passed / 3 failed**. Failures in adapter-parity, catalog-rollout and capture-routes stem from missing Linux sharp native binaries in Windows-installed node_modules on the WSL mount. This historical blocker was superseded for acceptance by the native Linux fresh npm ci run accepted in checkpoint3-opus-signoff.md: 198/198 passed and benchmark 15/15 valid.
- `checkpoint3-h1-provenance.txt` attaches raw `git rev-parse f58b95a^` and `git diff --stat a95a7dc f58b95a` outputs: parent is X_final and changes are only evidence/ and .gitattributes.
- Detailed rerun boundaries, retained failed initial attempt, exact commands and hashes: `checkpoint3-h1-xfinal-evidence.md`, `phase9-h1-xfinal-runs.json`, `phase9-h1-xfinal-source-identity.json`, `phase9-h1-xfinal-artifacts.sha256`. Historical verification above is not a claim of rerunning Linux build/full regression at X_final.

## Success criteria and limitations

| Criterion | Evidence / interpretation |
| --- | --- |
| SC-001 | Capture routes/faults/outcomes/process fixtures pass; actual benchmark exactly-once outcomes. Production approved live activation NOT_MEASURED |
| SC-002 | Access/redaction/persistence/gateway canary suites pass on both OSes; no exhaustive arbitrary-secret detection guarantee |
| SC-003 | Adapter parity/CLI offline/denial tests pass; transport equality fixture, not external hosted deployment |
| SC-004 | Index-job/read-only/no-provider fixture tests pass; no new scheduler/provider introduced |
| SC-005 | Frozen acceptance test exact top-3 100%, history Recall@8 >=90%, zero unauthorized hits asserted on both OSes |
| SC-006 | Import/rebuild/generation/process-kill/fencing suites pass on Windows/Linux. Physical power-loss NOT_MEASURED |
| SC-007 | Correctness-checked benchmark summaries and in-process CPU/RSS counters measured; no-op sync checked with zero indexing. No SLA inferred from n=3 |
| SC-008 | Fixture/catalog schemas and SDK refresh pass; Phase 8 measured 4,475 bytes / 1,118.75 estimated tokens. Representative external account rollout remains NOT_MEASURED |

## Historical acceptance findings and retained production gate

1. **Resolved live graph integration mismatch:** canonical capture previously emitted UUID payload refs, whereas graph input accepts 48-hex refs. Reconciled in commit f48fedd with 48-hex opaque randomBytes(24) and verified with capture→sync→graph end-to-end regression test.
2. **Independent Phase 9 review complete:** M365 Copilot Opus issued READY_TO_PROCEED for T061/T062 at X_final / Y_final3; see checkpoint3-opus-signoff.md for the verbatim response.
3. **H1 Linux native dependency blocker superseded for acceptance:** the historical WSL rerun had 194 pass / 3 sharp-related failures. Opus subsequently accepted native Linux (Ubuntu 22.04, ext4, fresh npm ci) context 198/198 passed and benchmark 15/15 valid. Historical failed artifacts remain retained, not relabeled as passes.
4. **Production gate unchanged:** production enablement requires SOC confirmation of fingerprint 45fa563f…d0d6a7c4 and private-key custody directly to the user, not through a developer packet. Do not mistake acceptance or forwarding/SDK fixtures for production authorization.
5. **Reviewer open items retained:** M1/L1/L2/L3 and benchmark qualifications are recorded verbatim in checkpoint3-opus-signoff.md. Opus explicitly states nothing more is needed for acceptance itself; these items are not silently claimed resolved.

KISS/YAGNI: no runtime dependency added, no broad redesign, no fake evidence, no additional feature behavior changed beyond authorized 1.0.11 compatibility metadata. Test expectations were advanced only where the old release version conflicted with the explicit target. Existing schema/domain gaps are documented for review rather than broadened opportunistically.

## Handoff

T057–T062 are complete for feature acceptance. M365 Copilot Opus signed off Checkpoint 3 / Phase 9 with READY_TO_PROCEED at X_final / Y_final3. Production release remains gated on external SOC confirmation; no merge, publication, tag, release or production enablement is authorized or performed by this evidence-only update.
