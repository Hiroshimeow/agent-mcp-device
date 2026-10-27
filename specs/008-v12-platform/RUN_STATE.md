# MCP Device v12 + Palace — RUN_STATE

**RELEASE_BLOCKED_WITH_EVIDENCE**

## CURRENT PI CHECKPOINT — 2026-10-26T13:49Z (G6 interactive terminal)

This section supersedes older checkpoints below; historical records are retained.
- Authorization: operator requested continuation from `E:/test/mcp-device-v12-e2e-20261024-g6/PI_G6_2080_HANDOFF_20261026.md`. Entire handoff and completion spec read. Single implementer; no FJP/MCP/subagents, model/provider change, production runtime mutation, publication, commit or deployment.
- Verified repository/branch/HEAD: `E:/git-project/agent-mcp-device-v12`, `feat/v12-platform-20261022`, `1e454c1cdcbe3265892f751034fa389432d65405`, dirty WIP preserved. Session `01a17855-54ac-70be-8982-7dece51ba05a`, `cliproxy-2080/gpt-6.1-sol`; logs under the requested sessions directory. Windows Node 22.22.2; WSL Ubuntu 22.04 Node 22.21.0.
- Original source/spec/test bytes plus Git diff/status preserved: `E:/test/mcp-device-v12-e2e-20261024-g6/pi-preservation-20261026T131300Z` (971 files). No observed listeners 8101–8104 during read-only preflight; missing live listeners were not restarted.
- Found old final-current packages did NOT match current source (driver stderr capture and CLI/Skill quick probe); preserved mismatch receipt under `pi-g6-2080-20261026/artifact-verification-2026-10-26T13-16-01-499Z/`. Did not mutate old tarballs or benchmark inputs.
- One new product fix: `src/plugins/palace/index.ts` candidate listings now exclude inactive procedures. New `test/v12/palace-packed-validation.test.mjs`: red on old packed provider (withdrawn candidate incorrectly returned), green after one-line fix; also behaviorally executes packed validation-module trust boundary. No other product source changed by this Pi continuation.
- Final current candidate: `E:/test/mcp-device-v12-e2e-20261024-g6/pi-g6-2080-20261026/candidate-2026-10-26T13-38-22-991Z/artifacts/`. Device SHA256 `8307a856353e64da7e2912f3d7c584a9b2ee3eccc7df578f325185421edec324`; Palace `609a228b80063d2c53dd4d63cbe834afe4cf3dc8277d483e23cdf6a01db56a7f`. Build/CA/assembly/pack exit 0; cold production-only installs with lifecycle scripts PASS on both OS. Full installed payload equals tarball; compiled payload equals frozen build; Skill source/package SHA `4e8642d49528be37b37c1bc82e6a5c2706cc49032a7a1ad645b1ddf737c14788`.
- Final candidate Windows platform exit 0: 185 total / 183 pass / 2 skip / 0 fail. Linux: 185 total / 182 pass / 3 skip / 0 fail. Server with exact cold package: 42/42 each OS, no skip. Receipts in candidate `windows-gates/` and `linux-gates/`. Linux root-only privileged-install test separately PASS 1/1; Windows file-symlink skip is covered by Linux execution, Windows-only cases by Windows.
- Supporting final gates PASS: packed validator 3/3, standalone strict consumer `tsc --noEmit`, real v11-v12 Core comparator 1/1 (14 result / 4 side-effect families); `supporting-gates/receipt.json`. Existing wider legacy parity dispositions remain historical and are not final-artifact fresh coverage.
- S5 v1e is FINISHED FAIL: 48 arms / 24 requested pairs, 23 valid telemetry pairs, control 21/24 correct vs treatment 22/24, zero recorded critical correctness regressions or control contamination. Median total tokens treatment +27.75%; paired delta -36,284 with 95% CI [-90,988,-8,169]. One control capacity failure lacked usage. No selected-arm retry or threshold relaxation. Audit `pi-g6-2080-20261026/benchmark-audit.json` recomputes raw usage/correctness/CI. Treatment incident arms only invoked status (no search/read); investigate real Skill adherence before a separately preregistered future holdout. Old run remains tied to old hashes, NOT these new artifacts.
- S7 isolated genuine-duration soak IN_PROGRESS: PID 13500, work `pi-g6-2080-20261026/soak-24h-20261026T1342/`, start `2026-10-26T13:42:27.336Z`, configured 86,460 seconds. One writer, lease exclusion, native reads, source append/ingest, CLI snapshots, hourly controlled fixture restarts, initial unrelated-plugin crash isolation, bounded health/WAL/RSS/handles/CPU receipts. No 24h PASS until actual duration plus integrity evidence. This synthetic local workload is NOT full comparative v11/production-auth S7 acceptance. Graceful stop only via its own `STOP` file; no broad process kill. Keep this terminal interactive.
- D0 historical verified Opus PASS retained; D1 historical AMEND remains pending fresh signoff; D2/D3 REVIEW_PENDING. No authorized reviewer tool in this terminal and no FJP execution allowed. S4 prior real-trace/procedure receipts are historical; final independent review unresolved. S8 not deployed; all production/fleet operations remain blocked.
- Additional final gates: same-prefix EEXIST PASS with full byte-identical private prefix (`same-prefix-1793022426539/receipt.json`); Linux Core comparator PASS 1/1; Linux root-only test PASS; exact final 1,000 CLI reads PASS 1000/1000, 0 errors, 461 appends, integrity ok and lease denial (`live-cli-1000-final-receipt.json`). Final-hash real Codex Skill functional test completed separately (not A/B) under `final-skill-agent-1793023278515/`: installed Skill, status/search/read/skills, original trace reads, truthful no-validated-procedure answer and cleanup mechanically PASS. Existing model/provider context unchanged, no secrets copied. Raw transcript also shows global process-Skill read and `codegraph` attempt/cache writes despite workspace/read-only restrictions: clean isolation/adherence NOT_PASS, S3 remains BLOCKED; see `independent-disposition.json`. Runner is finished; do not relaunch blindly.
- Current report/checklist/evidence index/SHA manifest refreshed in `evidence/v12-e2e-20261024-g6/`; prior ledger bytes in Pi `prior-release-ledger/`. D1–D3 packet `review-packet-20261026/REVIEW_PACKET.md` prepared, NOT_SENT, review PENDING. No deployment authorization follows.
- Next safe commands: inspect live `soak-24h-20261026T1342/status.json` (PID 13500; >20 minutes at 14:04Z, zero errors, NOT 24h), completed Skill receipt plus independent caveat, and current final receipts. Finish comparative fault/rollback/isolation evidence only in fixtures. D1–D3 require an explicitly authorized independent channel. Retain S5 FAIL; do not start another A/B against an already observed holdout.

## PREVIOUS CHECKPOINT — 2026-10-26 (G6 md)

This supersedes dated 2026-10-24 status counts below; keep older entries for provenance.
- Execution owner G6 only. FJP used ONLY for M365 Opus review, no product deployment. Do NOT stop/restart the G6 MCP live process or touch G8/fleet before accepted gates and rollback proof.
- G6 md agent online v1.0.11. Read-only Windows netstat probe found NO live listeners 8101/8102/8103; do not claim the production runtime is healthy or restart blindly.
- Git HEAD unchanged `1e454c1cdcbe3265892f751034fa389432d65405`, dirty WIP preserved, no commit/publish/deploy.
- Exact candidate artifacts: Device `bf575c83646dfd98ad09ffad2cfab6324d085f17544793ce8301f67a39053cdf`, Palace `60a9054a2e5e3b6917d26903b18046921319a299778595891430b5f88f5176b1`, path `E:/test/mcp-device-v12-e2e-20261024-g6/artifacts/final-current/`.
- Windows platform receipt `evidence/v12-e2e-20261024-g6/platform-after-d1-fixes.stdout.log`: exit 0, 182 total, 180 PASS, 0 FAIL, 2 SKIP (Linux root-only test and Windows symlink privilege unavailable). Cold Device+Palace from exact hashes: both install exit 0, SKILL owned-pristine, LICENSE+manifest present, standalone no Device dependency, `E:/test/mcp-device-v12-e2e-20261024-g6/final-current-cold-win3/receipt.json`.
- Linux Ubuntu 22.04 WSL on G6 from same hashes: `linux-final-current-fixed.exit.txt` exit 0, 182 total, 179 PASS, 0 FAIL, 3 SKIP (Windows-only cases and root-only test). Both Skills owned-pristine.
- Server current-cold previously exit 0 42/42 no skip on a prior candidate; NOT a final-current hash-matching server gate.
- S3 actual Codex final-current agent exit 0: discovered project Skill, called palace status/search/read/skills, read original source traces and did not fabricate validated procedure; receipt at `E:/test/mcp-device-v12-e2e-20261024-g6/real-codex-final-current/`. Its CLI displayed Skill missing because runtime HOME differs from project Skill discovery: UX evidence gap.
- S4 final executable replay+retrieval benchmark PASS: `evidence/v12-e2e-20261024-g6/s4-final-current.exit.txt` exit 0 and associated receipts. Updated test harness should be traced separately from built product source.
- S5 v4 real provider A/B FAIL: 40 runs/20 pairs, median total-token reduction 6.52%, 95% paired CI [-21684,25122.5] includes zero. v1d invalid due to missing VLLM_API_KEY provider auth; stopped its isolated benchmark process after 14 invalid pre-send arms. New preregistered v1e corpus/order unchanged: 24 paired tasks / 48 runs, exact final-current artifacts, authenticated existing CODEX_HOME, fresh workspaces/HOME, memories disabled, control contamination checks, authoritative token usage required, no paired task excluded. `E:/test/mcp-device-v12-e2e-20261024-g6/token-ab-v1e-final/`; runner `run-token-ab-v1e.mjs`, retained session `remote-0dbf860a-a57e-430c-86a7-fb5629c4546a`; status IN_PROGRESS, not PASS.
- D0 Opus 5.5 architecture PASS, six-round consensus. D1 old Opus 5.5 review AMEND (MF-1..MF-6). Source has subsequent fixes and platform tests but no new signoff. Follow-up FJP turn `2e4a9646-m365-worker-20261026-214235-9da1aca3` FAILED_BEFORE_SEND due TimeoutError, `send_intent=false`, `send_confirmed=false`; do NOT claim it was reviewed or bypass worker anti-duplicate-send contract. Verified source pack transferred to FJP review workspace `D1-refresh-20261026/D1-review-refresh.txt`, 33 files.
- D2/D3 NOT_SIGNED; S7 genuine >=24h soak NOT_RUN; G8/production/fleet NOT_DEPLOYED. S5 full result, D1-D3 independent review, parity/rollback/soak and G8 are mandatory before RELEASE_READY.



- Cập nhật: 2026-10-24T12:27:27.776Z. Thực thi kỹ thuật trên G6 qua md; FJP chỉ dùng M365 Opus 5.5 review, không triển khai/chỉnh runtime sản phẩm.
- Kho `E:/git-project/agent-mcp-device-v12`; nhánh `feat/v12-platform-20261022`; HEAD `1e454c1cdcbe3265892f751034fa389432d65405`. Working tree dirty/WIP được bảo toàn; chưa commit/publish/deploy.
- Báo cáo checkpoint trước review: `evidence/v12-e2e-20261024-g6/FINAL_REPORT.md`. Checklist: `evidence/v12-e2e-20261024-g6/release-checklist.json`.
- **D0 architecture review PASS** bằng M365 **Opus 5.5** trên FJP sau 6 vòng phản biện cùng thread. Final: `NO MATERIAL D0 DISAGREEMENT`. Durable receipt: `evidence/v12-e2e-20261024-g6/D0-review-consensus.md`, `D0-review-verdict.json`.
- Conversation D0: `a39299d6-2bc1-486f-9d62-2f972057cae3`; final turn `2e4a9646-m365-worker-20261024-212628-17acf0e4`.

## Gates

| Gate | Trạng thái | Bằng chứng / thiếu |
| --- | --- | --- |
| D0 | **PASS** | Architecture/lifecycle consensus; Opus 5.5 verified. Không đồng nghĩa release-ready. |
| S0 | BLOCKED | G6 baseline/WIP đã đóng băng; G8 production baseline chưa được thực hiện trong phạm vi review này. |
| S1 | FAIL | Cold install hai gói trên hai OS đạt, nhưng Skill relocation/lifecycle, standalone LICENSE/manifest/closure, provenance/bundled upgrade và same-prefix bin policy còn phải sửa/test. |
| S2 | BLOCKED | D0 chấp nhận stopped-runtime mutation là policy hợp lệ nếu S2 E2E chứng minh đủ. CLI/provider search parity, wrong-schema behavior, runtime-aware status và mutation workflow chưa khép. |
| S3 | NOT_RUN | Chưa có Pi/Codex thật discover → status → CLI → evidence; scripts-disabled recovery và Skill lifecycle chưa đạt. |
| S4 | NOT_RUN | Chưa có procedure thực được tái hiện độc lập với postcondition. |
| S5 | NOT_RUN | 0 paired A/B có provider token telemetry; token savings là release gate bắt buộc và còn NOT_PROVEN. |
| S6 | FAIL | Platform 87/87 và server 42/42 mỗi OS đạt; Core comparator đạt. Legacy parity vẫn 35 PASS / 6 FAIL, 2 no-op bị loại; chưa có disposition đầy đủ. |
| S7 | NOT_RUN | Chưa có genuine >=24h timestamped soak. Stress 1000 CLI không thay thế gate này. |
| S8 | BLOCKED | Chưa G8 production update/rollback verification. |
| S9 | BLOCKED | Chưa fleet rollout. FJP EXCLUDED_BY_USER; Z99 offline. |

## D0 consensus — implementation blockers trước D1

1. Skill ownership/reconcile: multi-owner record, installed-baseline hashes/3-way check, staged replacement/recovery, foreign/user-edit preservation, scripts-disabled repair.
2. Palace CLI runtime-aware; state-coded limitation cho disabled/uninstalled/faulted/upgrade-required.
3. `plugins` và `knowledge` mặc định phải dùng server root `~/.mcp-device/server`.
4. PalaceStore kiểm tra schema trước WAL pragma/DDL; wrong schema không được tạo thay đổi.
5. CLI và provider dùng chung canonical search pipeline; không pre-truncate 300 rồi rank khác.
6. ProcessDriver: cooperative cancel → bounded grace → kill/fault chỉ khi child không phản hồi.
7. Plugin registry stale-lock: token + recovery lock + token-matched release, reuse runtime-lease technique.
8. Upgrade provenance: external manifest = manual; explicit bundled upgrade = distribution.
9. Bundled Device version update cần version-only repin/recovery; schema/capability changes vẫn explicit upgrade.
10. Standalone: LICENSE, recursive import closure, `palace.plugin.json`.
11. Packaging: Device giữ stable `palace` bin; standalone dùng standalone/separate prefix. Same-prefix dual root install phải fail cleanly; không dùng `--force`. Test separate-prefix lifecycle + manual registration + status package/version/path.
12. SKILL.md: `palace status` trước, limitation rõ, bỏ source-checkout fallback, candidate-only honesty; Skill không tự stop runtime.

## D0 decisions đã thống nhất

- MCP Device là product; Palace là optional default-enabled generic PluginHost plugin, process-isolated, một writer.
- Không Palace MCP server, không second writer, không registry/scheduler/control-plane mới.
- `palace` CLI read-only khi runtime chạy. Mutation stopped-runtime qua `mcp-device knowledge` + existing lease được D0 chấp nhận theo SPEC; chỉ mở live owner-routed path nếu S2 chứng minh workflow thực sự cần.
- Default catalog không advertise `knowledge.*`. Internal `platform.invoke` không được coi là public live-write API.
- Account isolation nằm ở authenticated broker/router. Một Device có một owner hiện hành; cross-account dispatch fail trước Core. Palace SQLite là Device-local state kể cả trước pairing; deliberate ownership transfer chuyển local state cùng Device.
- Skill ownership thuộc package/user-home, không thuộc một runtime registry.
- Reuse PluginHost, RuntimeOwner/runtime lease và process protocol trước khi custom.
- Standalone và Device dùng cùng implementation; không cần Palace daemon hoặc release cadence riêng.

## Bằng chứng kỹ thuật đã có

- Windows/Linux platform 87/87; server 42/42; no skip.
- Core comparator PASS 14 result + 4 side-effect families.
- Legacy parity 35 PASS / 6 FAIL; 2 no-op excluded; 3 paired failing suites giống baseline/candidate.
- Immutable-artifact live stress 1000/1000 CLI, 111 appends, SQLite integrity ok, second writer refused, 58.521 s.
- Device artifact SHA-256 `e494d7be162390b1aaf2359112e103b1cbcad13885c71b21c9a5b948c3d8343b`.
- Palace artifact SHA-256 `db27ab6c60cbb14eb65ffd25424ed9bd867868061c332dba0d1353b9590133a6`.
- Candidate focused tests: 30 tests, 29 PASS, 0 FAIL, 1 SKIP; source-checkout `dist` intentionally stale nên không dùng kết quả ad-hoc của checkout làm regression.
- Same-prefix npm experiment: Device install PASS; standalone Palace second install FAIL `EEXIST palace.ps1`; stable Device `palace` command vẫn hoạt động; Skill postinstall đã chạy.

## Durable D0 review

- `evidence/v12-e2e-20261024-g6/D0-review-consensus.md`
- `evidence/v12-e2e-20261024-g6/D0-review-verdict.json`
- `evidence/v12-e2e-20261024-g6/D0-opus-round-{1..6}-prompt.md`
- `evidence/v12-e2e-20261024-g6/D0-opus-round-{1..6}-response.md`
- `evidence/v12-e2e-20261024-g6/D0-opus-round-{1..6}-state.json`

## Tiếp tục an toàn

1. Xử lý blockers 1–12 theo test-first trên G6, không phá WIP và không sửa baseline v11.
2. Sau implementation, D1 Opus 5.5 review exact diff/artifacts + standalone/CLI/Skill/single-writer.
3. S2/S3 chứng minh real agent workflow; chỉ thêm live mutation nếu evidence cho thấy stopped-runtime policy không đủ.
4. Sau D1 mới chạy procedure validation, provider-token A/B, full parity/rollback và genuine 24h soak.
5. Chưa deploy G8/fleet; FJP chỉ là reviewer và luôn excluded khỏi rollout.


## CHECKPOINT — 2026-10-27T14:20Z (phiên kết thúc, handoff viết)

- **S7 SOAK PASS**: 2026-10-27T13:43:27Z. 86,460.608s, 81,395 checks, 0 errors, RAM max 142MB, WAL max 4MB, SQLite integrity ok, 24 restarts controlled, secondLeaseDenied=true. productionTouched=false. Receipt: soak-24h-20261026T1342/receipt.json. Committed: f4094c4.
- **Handoff viết**: E:/test/mcp-device-v12-e2e-20261024-g6/HANDOFF_20261027_TO_NEXT_SESSION.md — đầy đủ cho cold start phiên mới.
- **FJP online** nhưng MCP tools (list_devices, shell_execute) không accessible từ PowerShell trong phiên Pi này — phiên mới phải dùng Pi runtime context để gọi MCP tools.
- **D1 review prompt sẵn sàng**: E:/test/mcp-device-v12-e2e-20261024-g6/pi-g6-2080-20261026/d1-review-request-20261027.md
- **Trạng thái**: RELEASE_BLOCKED_WITH_EVIDENCE. S7=PASS; D1=AMEND (MF-1..MF-6 chưa sửa); S5=FAIL (harness bug đã chẩn đoán); D2/D3=PENDING.
- **Việc tiếp theo**: Phiên mới cold-start → (1) list_devices FJP → (2) submit D1 review Opus → (3) sửa MF-1..MF-6 test-first song song → (4) rebuild candidate sau khi D1 PASS.
