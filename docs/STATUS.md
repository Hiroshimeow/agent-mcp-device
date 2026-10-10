# MCP Device / Gateway — ACTIVE STATUS

**Snapshot: 2026-10-10 JST.** Đây là điểm bắt đầu cho công việc còn hiệu lực. Trước mỗi task, xác minh Git SHA và runtime. Nội dung DONE/OUTDATED đã rời khỏi cây làm việc: [ARCHIVE.md](ARCHIVE.md).

## Source, môi trường, runtime

| Thành phần | Nguồn chuẩn và trạng thái |
| --- | --- |
| **Device trên G6** | `E:\git-project\agent-mcp-device`, `main`; GitHub release source `9d96df9` = v1.0.11; các commit tài liệu nội bộ nằm trên baseline |
| **Device trên G8** | `/home/ayumi/Workspace/git_project/agent-mcp-device`, `main`; đồng bộ G6; service systemd dùng bản đã cài, **không** trực tiếp chạy checkout |
| **Gateway phát triển** | G8 `/home/ayumi/Workspace/git_project/agent-mcp-gateway-develop`, `develop@7a5a30b` sau commit dọn tài liệu DONE; **product baseline `c5862aa`** giữ UI mới, **chưa có Gateway Context integration** |
| **Gateway 8102 đang chạy** | PM2 `mcp-device-gateway-8102`; release `/home/ayumi/.mcp-gateway-8102/releases/gateway-develop-c5862aa-20261010` |
| **Gateway 8101 cũ** | G8 `/home/ayumi/Workspace/git_project/agent-mcp-gateway`, backup branch `91cefbc`; còn tiến trình sử dụng, **không xóa** |
| **Gateway 8102 auxiliary** | G8 `agent-mcp-gateway-8102` (detached `c5862aa`); production còn dùng `.runtime/mcp-servers-nmem.toml` ở đây; **không xóa** |
| **Gateway G6** | `E:\git-project\agent-mcp-gateway`, `develop@89f7123` dirty/cũ; **không** làm base Gateway production |

**Không đồng nhất:** Git source, npm artifact, phiên bản installed và live process. Kiểm trạng thái thực tế thay vì suy từ tên nhánh.

## DONE — không thực hiện lại

- **Device 1.0.10/1.0.11:** file/read/edit/search, bounded CLI/process, lifecycle/reconnect/update; ContextService và CLI local. Evidence lịch sử: **198/198 Context**, **66/66 core modules**, **1/1 benchmark contract** (tại `evidence/context/` và `docs/delivery-1.0.11-clean.md`); chưa phải fresh test của phiên cleanup.
- **Gateway develop UI:** 24H/7D/30D, lọc/tìm/sắp xếp device, live activity, OAuth/account/session/pairing, remote tool routing.
- **Context v1.0.11 Device:** CLI `mcp-device context status/search/read/graph/sync/checkpoint/...` và sáu tool schemas `local_status`, `local_search`, `local_read`, `local_graph`, `local_index`, `local_wiki` (wiki chỉ trả `WIKI_DISABLED`). **Gateway develop chưa đăng ký sáu tool**. Public capture vẫn cần approval/SOC.
- Snapshot device khi kiểm kê: **8/8 online**, 5 máy 1.0.11, 3 máy 1.0.10; kiểm lại trước khi hành động.

## Còn mở — không tự implement

| Lĩnh vực | Trạng thái, nguồn cần mở |
| --- | --- |
| **B0 / v1.0.12** | `specs/004-context-v112/baseline.md` và `research.md` là R0 nghiên cứu; cần benchmark A/B có task correctness và negative/no-search control |
| **P2 progressive retrieval** | `specs/003-context-nextgen/plan-p2-retrieval.md`, contract; chỉ đề xuất, chưa triển khai |
| **P3 deterministic source graph** | `specs/003-context-nextgen/plan-p3-codegraph.md`, contract; chứng minh accuracy, coverage, freshness và chi phí trước |
| **P4 wiki** | `specs/003-context-nextgen/plan-p4-wiki.md`; **DEFER mặc định**, không gọi provider/auto-index |
| **Experience Memory** | `specs/005-experience-memory/`: nghiên cứu/spec, chưa code hoặc A/B, chưa final review PASS |
| **Gateway Context patch** | G8 `import/personal-context-20261010@c6cd6b1` và các nhánh thử nghiệm; **chưa merge, theo quyết định chủ repo** |
| **Email enrollment approval** | G8 backup `91cefbc:specs/003-device-email-approval`; spec only, chưa có trên `develop` |

Nguyên tắc: current source/tests và user intent > historical evidence > derived graph/wiki/memory. Activity graph khác source-code call graph; không tự fan-out, rebuild hoặc provider call khi read/status.

## DONE nhưng phải giữ để không gãy chức năng

- `specs/002-device-local-context/`: **đã nghiệm thu**, nhưng `scripts/check-context-acceptance.mjs` đọc trực tiếp 32 FR, 8 SC, 62 task và 12 tài liệu/contract. Vì vậy là **regression fixture**, không phải active backlog.
- `evidence/1.0.10/`, `evidence/context/` và `docs/context.md`: bằng chứng và contract kiểm chứng.
- `.archive-worktrees-docs/wt-mcp-device-110-bench/bench/lib/core.mjs`: **mã benchmark đang được import**, không phải cache bỏ được.

## Quy trình tiếp theo

1. Ghi host, repo_root, branch, HEAD, `git status --porcelain=v1 -uall` và runtime CWD nếu liên quan deployment.
2. Đọc đúng code và `004`/`005` hoặc phần `003 P2–P4` liên quan. Đừng chạy lại T001–T062 từ checklist cũ.
3. Với task code: PRESERVE/COMPLETE/FIX, acceptance, tests thật và independent review; không biến log cũ thành PASS mới.
4. Không reset/clean/force-remove/merge Context Gateway/restart trong task spec/cleanup.
5. Nếu deploy: snapshot nhất quán state SQLite/WAL + external MCP config + immutable release SHA + rollback.

Check tối thiểu khi sửa docs Device: `node scripts/check-context-acceptance.mjs` trên Node >=22.13, kiểm liên kết, `git diff --check`. Test full Windows/Linux khi thay product code. Tra cứu tài liệu cũ: [ARCHIVE.md](ARCHIVE.md).
