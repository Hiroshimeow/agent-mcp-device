# MCP Device v12 + Palace — RUN_STATE

**RELEASE_BLOCKED_WITH_EVIDENCE**

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

