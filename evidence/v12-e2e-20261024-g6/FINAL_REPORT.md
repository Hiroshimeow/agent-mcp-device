# MCP Device v12 + Palace — current G6 continuation report

**RELEASE_BLOCKED_WITH_EVIDENCE** — checkpoint 2026-10-26, not release approval.

This report supersedes the outdated 2026-10-24 report. Its original bytes and ledger are preserved at `E:/test/mcp-device-v12-e2e-20261024-g6/pi-g6-2080-20261026/prior-release-ledger/`. Historical acceptance is not fresh final-artifact evidence.

## Identity, authority and preservation

- Product/version: `@hcu-lab.me/mcp-device@1.0.12`, standalone `@hcu-lab.me/palace@1.0.12`.
- Repo `E:/git-project/agent-mcp-device-v12`; branch `feat/v12-platform-20261022`; HEAD `1e454c1cdcbe3265892f751034fa389432d65405`, dirty WIP retained; no commit/push/tag/publish/deployment.
- Operator authorized this continuation from the fully read `PI_G6_2080_HANDOFF_20261026.md`; full completion spec read. Single implementer, G6 filesystem only. No FJP/MCP execution or extra agents.
- Session model/provider remains `cliproxy-2080/gpt-6.1-sol`; same interactive terminal, session `01a17855-54ac-70be-8982-7dece51ba05a`, logs in the requested sessions directory.
- Source/spec/test backup: `E:/test/mcp-device-v12-e2e-20261024-g6/pi-preservation-20261026T131300Z` (971 files plus Git diff/status). All original source files are unchanged except the intentional one-line fix in `src/plugins/palace/index.ts`; added `test/v12/palace-packed-validation.test.mjs`.
- Read-only listener observations found no listeners 8101–8104. No attempt was made to stop, restart, rebind, repair or otherwise modify live G6 Device/gateway/broker/agent state. Missing listeners are not a health claim.
- Windows Node `22.22.2`; WSL Ubuntu 22.04 Node `22.21.0`. Test installs use fresh homes/prefixes/state.

## Exact current artifacts

Artifact directory:
`E:/test/mcp-device-v12-e2e-20261024-g6/pi-g6-2080-20261026/candidate-2026-10-26T13-38-22-991Z/artifacts/`

| Package | Bytes | SHA256 |
|---|---:|---|
| Device | 2,157,078 | `8307a856353e64da7e2912f3d7c584a9b2ee3eccc7df578f325185421edec324` |
| Palace | 62,906 | `609a228b80063d2c53dd4d63cbe834afe4cf3dc8277d483e23cdf6a01db56a7f` |

Build, standalone assembly, CA preflight and npm pack exited 0 in a frozen private copy. Full payload audit: Device 753 files, Palace 40 files; zero installed-payload differences and zero compiled-code/declaration differences. Both include LICENSE; Palace has `dependencies: {}` and its manifest. Skill SHA256 `4e8642d49528be37b37c1bc82e6a5c2706cc49032a7a1ad645b1ddf737c14788` matches source and both packages. See candidate `build-receipt.json` and `artifact-audit/receipt.json`.

The previous “final-current” artifacts did not match existing source stderr/Skill-probe WIP. Their hashes and benchmark remain preserved and are not relabeled as current acceptance.

## S0–S9 status

| Gate | Status | Current evidence / remaining requirement |
|---|---|---|
| S0 | BLOCKED | G6 identity/WIP frozen; current G8 production baseline not observed in authorized local-only scope. |
| S1 | BLOCKED | Both exact packages cold-install on Win/Linux with production dependencies and scripts; Skill lifecycle regressions pass; same-prefix EEXIST leaves byte-identical prefix. Fresh independent D1 signoff and complete fault/upgrade matrix remain. |
| S2 | BLOCKED | Final 1,000/1,000 live CLI reads, schema/scope/budget/lease tests and integrity PASS. Independently accepted full mutation workflow closure still required. |
| S3 | BLOCKED | Exact rebuilt-hash real Codex loaded Skill, status/search/read/skills and original logs, with truthful abstention; functional result PASS. Inherited global guidance/cache-writing violated requested isolation/read-only constraints, so full clean-adherence gate remains blocked. A/B incident arms were status-only. |
| S4 | BLOCKED | Current exact provider reruns resolvable engineering red/green trace validation with actual postconditions, independent repeat and adversarial withdrawal. Distinct artifacts are not independent incidents; original two production candidates/independent review and held-out retrieval acceptance unresolved. |
| S5 | FAIL | Completed sealed v1e has one missing-usage capacity failure; treatment total tokens increased. Old artifact identity, no final-artifact savings proof. |
| S6 | BLOCKED | Final Win/Linux platform and server/cold flows pass; Core comparator passes both OS. Wider legacy/production/upgrade-client compatibility matrix not fully refreshed. |
| S7 | BLOCKED | Genuine 24h isolated soak IN_PROGRESS, not elapsed. Comparative v11 load/auth/reconnection/rollback matrix not complete. |
| S8 | BLOCKED | No G8/fleet production verification or rollout. Prerequisite gates and D3 absent. |
| S9 | BLOCKED | Current report/manifest/review packet prepared; independent signoffs, complete final gates, reviewed commits and production evidence missing. |

## Installation and lifecycle demonstrations

1. **Standalone Palace:** Windows `windows-gates/palace-prefix`, Linux `/var/tmp/mcp-v12-pi-20261026-1340/palace-prefix`; actual new tarball, `npm install --omit=dev --include=optional --ignore-scripts=false`. CLI/Skill status and dependency tree exit 0; no Device dependency; packed adapter performs real ingest/search/validation tests.
2. **Default Device:** Windows `windows-gates/device-prefix`, Linux `/var/tmp/mcp-v12-pi-20261026-1340/device-prefix`; same cold procedure. Server tests prove default Palace, normal authenticated pairing/OAuth, native tools and stopped backup/restore identity/refresh/evidence continuity.

Platform suites test disable/uninstall/re-enable/tombstone preservation with Core healthy and Skill ownership/user-edit preservation. Same global-prefix conflict experiment uses a **private** prefix: Device install 0; standalone second install 1/EEXIST; all preexisting bytes identical, no added files, Device CLI still 0. Receipt: `pi-g6-2080-20261026/same-prefix-1793022426539/receipt.json`. No real global package installation changed.

## Fresh test results

All paths below are under the current candidate unless stated otherwise.

| Gate | Result | Evidence |
|---|---|---|
| Windows platform | 185 total, 183 pass, 0 fail, 2 skip, exit 0 | `windows-gates/platform.stdout.log`, `receipt.json` |
| Linux platform | 185 total, 182 pass, 0 fail, 3 skip, exit 0 | `linux-gates/platform.stdout.log`, `receipt.json` |
| Windows server + exact cold package | 42/42, no skip, exit 0 | `windows-gates/server.stdout.log` |
| Linux server + exact cold package | 42/42, no skip, exit 0 | `linux-gates/server.stdout.log` |
| Packed validation adapter | 3/3 on exact standalone, both OS | `supporting-gates/packed-validation.stdout.log`; Pi `linux-packed-validator.stdout.log` |
| External consumer TypeScript | strict `tsc --noEmit`, exit 0 | `supporting-gates/standalone-consumer-tsc.*` |
| v11/Core comparator Windows | 1/1, exact normalized outputs/side effects | `supporting-gates/core-parity.stdout.log` |
| v11/Core comparator Linux | 1/1, same workload | Pi `linux-core-parity.stdout.log` |
| Privileged root install Linux | 1/1, real root invocation | Pi `linux-root-privileged.stdout.log`, exit file |
| Withdrawal regression | old packed provider FAIL 1; final standalone PASS 3 | Pi `withdrawal-red-green-receipt.json` |

Skip disposition: root-only privileged test skipped on ordinary Windows/nonroot WSL and separately executed as Linux root. Windows file-symlink privilege skip executes successfully on Linux. Linux skips Windows share-delete and SYSTEM-profile tests; Windows executes both. No “zero skips” claim.

Frozen v11 baseline source HEAD `1df22e6bca3e4f5fa7bfd94f814c1b7409fd7848` and Gateway baseline `7a5a30b4a5f6226cf65b395ddfa0424677184592` retained. Historical wider parity has shared stale edit-message assertion, Windows drive fixture and symlink privilege failures; see `parity-current-interpretation.json`. These are explicit dispositions, not final-artifact complete parity or hidden passes.

## CLI, source evidence and learning

New product defect: provider `skills --include-candidates` included withdrawn procedures after correction, while CLI filtered them. Narrow test-first fix sets `includeInactive: false` in the provider candidate catalogue. Exact historical reads still expose withdrawn status; no data deletion or promotion occurs.

Packed behavior tests reject absent/relative/malformed configured validators, execute a real child and independently inspect its output before activation, and verify correction removes the dependent procedure from candidate listings. Caller text and shell exit alone are not validation.

Final exact-artifact live-read stress: **1,000/1,000 CLI processes, 0 errors**, 461 source appends, SQLite integrity `ok`, second lease refused, cleanup complete. Duration 237.473 s; p50/p95/p99 907.14/1244.23/1509.09 ms under concurrent acceptance/soak host load. This is not isolated comparative performance or a 24h result. Receipt: Pi `live-cli-1000-final-receipt.json`, raw `live-cli-1000-final/cli-raw.jsonl`.

Current real engineering-trace audit is recorded under Pi `procedure-audit-*`: hashes resolve to prior original red/green closure logs, exact source bytes are verified, closure tests execute twice, strict external consumer proof is separate, and an adversarial correction withdraws the procedure. This is bounded local mechanical evidence, **not** approval of original production candidates or proof of unrelated real-world trace independence. Independent D2 remains pending.

### Final-hash real agent functional evidence and caveat

`pi-g6-2080-20261026/final-skill-agent-1793023278515/receipt.json` records real Codex exit 0, provider usage, installed Skill read, successful status/search/selected read/validated-only skills, both exact original red/green log reads, truthful no-validated-procedure answer, healthy writer and cleanup. Provider input/output were 191,808/2,017 tokens; this is **not an A/B measurement**.

Raw events also show inherited global process-Skill access and an attempted `codegraph explore`; a fixture-local `.codegraph` cache appeared despite the instruction not to modify files. The harness's mechanical functional checks say PASS, but **isolation/read-only adherence is NOT_PASS**. This caveat must not be omitted or converted into clean S3 acceptance. No secrets/config were copied and no production runtime was touched.

## Actual provider token A/B — FAIL, no savings claim

Sealed v1e preregistration SHA `dbe30affd9fbe0ffb28605aff211f396cc9c429bfe09cef7e2ad2fd4bc3e9661`. Existing runner was already active at takeover and was not duplicated, modified or rerun. Model remained `gpt-6.1-sol` under its preregistered provider context. This benchmark uses **older** artifacts `bf575c...` / `60a905...`, not the final packages above.

| Arm | Completed usage records | Provider input | Provider output | Cached input | Input + output | Correct tasks |
|---|---:|---:|---:|---:|---:|---:|
| Control | 23/24 | 4,296,957 | 24,976 | 3,621,376 | 4,321,933 | 21/24 |
| Treatment | 24/24 | 5,434,688 | 29,296 | 4,700,032 | 5,463,984 | 22/24 |

Aggregate arms have unequal usage completeness and are **not** a fair aggregate cost comparison. On the 23 fully measured pairs: median control total 181,124; treatment 231,385; reduction **−27.75%** (treatment worse). Median paired control−treatment delta **−36,284**, bootstrap 95% CI **[−90,988, −8,169]**. Monetary billing/rates unavailable; no fabricated billed cost.

One control turn failed with provider “model at capacity” and no authoritative usage. A different treatment capacity event recovered; all events retained. Zero recorded control Palace contamination, unsupported procedure uses, or critical correctness regressions. Incident treatment arms invoked status but no search/read; this is a real Skill-adherence/evaluation issue, not evidence of useful retrieval. Raw independent audit checks usage against events, correctness against sealed expectations, hashes, pairing and CI. See `token-ab-v1e-final/{results.jsonl,summary.json,independent-verification.json}` and Pi `benchmark-audit.json`.

**S5 FAIL.** No selected-arm retry, threshold relaxation, post-hoc cherry-pick or new usage run. Future measurement requires justified product/environment diagnosis and a new sealed independent holdout on exact artifacts; it is not authorized to reuse observed tasks as held-out evidence.

## Soak, rollback and runtime safety

Live isolated soak PID **13500**, started **2026-10-26T13:42:27.336Z**, target **86,460 seconds**; earliest duration completion **2026-10-27T13:43:27Z**. Status/progress/owner files:
`E:/test/mcp-device-v12-e2e-20261024-g6/pi-g6-2080-20261026/soak-24h-20261026T1342/`.

The harness uses one process-isolated Palace writer, exclusive lease denial, native exact reads, minute source append/ingest, CLI search/read snapshots, initial unrelated-plugin crash isolation, hourly controlled fixture disable/re-enable, and durable timestamps/RSS/heap/handles/CPU/WAL/process-parent receipts. Two short harness self-tests passed integrity and restart/fault controls and are **not** counted as 24h. Current soak is IN_PROGRESS; inspect live receipts for actual elapsed time, no future PASS implied.

This synthetic local workload is near 2× the historical local peak by call count, not representative G8 production traffic. Full comparative v11 stress, auth/reconnect traffic and power-fault/production rollback evidence remain incomplete. Cold fixtures demonstrate isolated stopped-state restore only. No production rollback/deployment attempted. To request graceful stop, create `STOP` **inside this fixture work directory**; do not kill broad process names or touch production.

## Independent reviews

| Gate | Historical verified turn | Verdict / current status |
|---|---|---|
| D0 | final `2e4a9646-m365-worker-20261024-212628-17acf0e4` | Opus 5.5 PASS after six rounds; architecture only |
| D1 | `2e4a9646-m365-worker-20261025-164417-e6b74a82` | verified Opus 5.5 AMEND; subsequent fixes need fresh signoff |
| D1 follow-up | `2e4a9646-m365-worker-20261026-214235-9da1aca3` | historical FAILED_BEFORE_SEND, not a review |
| D2 / D3 | none | REVIEW_PENDING |

Current packet: `E:/test/mcp-device-v12-e2e-20261024-g6/pi-g6-2080-20261026/review-packet-20261026/REVIEW_PACKET.md`, 27 exact source files, hashes, cumulative diff, artifact identities, MF/P2 dispositions, test evidence and explicit risks. **NOT SENT**: this terminal has no authorized independent reviewer channel; FJP execution is forbidden by the handoff. No self-review substituted for Opus.

## Smallest next safe actions

1. Continue observing the exact isolated soak; only accept real elapsed duration plus postconditions. Complete comparative fault/rollback coverage without live G6 mutation.
2. Final 1,000-read and real-agent functional receipts exist. Resolve inherited-global-guidance/cache-writing isolation gap before clean S3 acceptance, without changing model/provider or contaminating A/B evidence.
3. Diagnose status-only treatment behavior and provider-capacity failure scientifically; preserve FAIL. Any new A/B requires a genuinely independent preregistration and final artifacts.
4. Obtain D1/D2/D3 through an explicitly authorized independent channel; resolve named gaps in the prepared packet.
5. No G8/fleet rollout until every prerequisite and rollback review passes. No npm publish/tag/push without separate authority.

The terminal remains available for operator instructions. **RELEASE_BLOCKED_WITH_EVIDENCE**, not complete, released or production-verified.
