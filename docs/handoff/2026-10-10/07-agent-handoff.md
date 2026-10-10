# 07 — Handoff dùng trực tiếp cho agent/maintainer kế tiếp

> **Scope:** Tiếp tục MCP Device / MCP Gateway đúng nguồn, không tạo lại hệ thống từ trí nhớ. Handoff này là ảnh chụp ngày 10/10/2026, không tự cấp phép merge hay deploy.

## 1. Đọc trước khi gọi bất kỳ công cụ sửa file

1. `docs/handoff/2026-10-10/README.md` và `01-current-state.md`.
2. `02-architecture.md` và `03-specs-handoffs.md`.
3. `04-decisions-next.md`, `05-worktrees.md`, `06-runbook.md`.
4. Sau đó mới mở đúng spec/handoff cụ thể trong `source-index.json` và source code ở đúng Git SHA.

Không hỏi lại những quyết định đã có bằng chứng; **tuyệt đối không đoán** chỗ thiếu evidence. Nếu ảnh chụp và runtime khác nhau, ưu tiên kiểm tra runtime thực tế và ghi nhận drift.

## 2. Source checklist

**Device GitHub/main:** `9d96df95d0bd4d7c5b7e7cda994e232a6871b4c1` — v1.0.11.
- G6 Windows: `E:\git-project\agent-mcp-device`.
- G8 Linux: `/home/ayumi/Workspace/git_project/agent-mcp-device`.
- Existing accepted historical context: `docs/delivery-1.0.11-clean.md`, `evidence/context/`, `specs/002-device-local-context/`.
- Spec 003/004/005 đã ở trong root Device; là research/spec, chưa thể gọi là implemented.

**Gateway canonical develop:** `c5862aaf5f19be30363b0b31faaa279a0aab3c70` tại G8 `/home/ayumi/Workspace/git_project/agent-mcp-gateway-develop`.
- Production `device.hcu-lab.me` dùng `gateway-develop-c5862aa-20261010` trên port 8102; UI mới.
- **Không có Context Gateway patch** trên develop. Code Context đã bảo toàn riêng `c6cd6b1`, G8 nhánh `import/personal-context-20261010`; trial integrations cũng chưa merge.
- G8 root Gateway cũ ở backup `91cefbc` phục vụ 8101 và có đặc tả email approval. G6 Gateway `develop@89f7123` là nguồn cũ có thay đổi chưa commit, không dùng để sửa 8102.

## 3. Những điều có thể nói với độ tin cậy cao

- Device GitHub main v1.0.11 được giao lên GitHub ngày 06/10, không phải bằng chứng đã npm publish/tag.
- Historical accepted Context 198/198 tests, core 66/66, benchmark 1/1; cần đọc từng log trước khi gán nhãn fresh.
- 8/8 thiết bị đang trực tuyến tại thời điểm kiểm kê; 5 v1.0.11, 3 v1.0.10. Không suy rằng mọi tool Context đã được expose qua Gateway.
- Gateway `develop` có UI bộ lọc 24H/7D/30D, tìm/lọc/sort device, live status.
- 003/004/005 vẫn là research/spec; 003 P5 cũ dựa trên baseline cũ và 004 R0 đã sửa giả định. Không triển khai mã khi chưa có quyết định task riêng.
- Dọn worktree đã giảm 20→6 registration; refs và bản backup file lạ được bảo toàn; một đường dẫn G6 còn thư mục rỗng bị khóa, không phải registered WT.

## 4. Việc không làm trong phiên tự khởi động

- Không cherry-pick/merge Context Gateway chỉ để “đủ sáu tool”; không đổi Gateway develop hoặc restart.
- Không reset --hard, git clean -fdx, xóa nhánh, force-push, xóa .runtime, update npm/global package.
- Không sửa auth/approval/env hoặc lưu secrets vào commit/handoff.
- Không tự bật Context live capture, wiki provider, Experience Memory, tool/skill autopromotion.
- Không thêm lớp graph/vector/wiki thứ ba nếu benchmark không chứng minh nhu cầu.
- Không tái hiện nguồn bằng copy cả release đè source: lịch sử đã cho thấy regress UI.

## 5. Cách cập nhật handoff mỗi khi có thay đổi

Mỗi task phải ghi tối thiểu:
- thời điểm + máy, repo_root, branch, SHA, `git status`;
- chức năng cần preserve / complete / fix, non-goals;
- source files/diff, root cause hoặc spec contract, exact tests/exit codes;
- nếu deploy: artifact SHA, active PID/CWD, rollback receipt;
- file lạ và backup archive/manifest SHA nếu có;
- điều thay đổi trong ma trận trạng thái/tính năng và quyết định owner.

Thay đổi giấy tờ ghi vào `docs/handoff/`/`specs/`, commit có review. Đối với file `.plan` theo task, giữ report đầy đủ tại task path và tham chiếu từ chỉ mục; tránh nhân bản nhiều nguồn mâu thuẫn.

## 6. Tiêu chí để tự xác nhận “xong”

Không tuyên bố DONE nếu thiếu một trong các bằng chứng: source SHA đúng, test liên quan chạy thật, phạm vi feature/non-feature chính xác, trạng thái dirty được phân loại, và runtime checked **khi** mục tiêu liên quan production. Nếu chưa đo được hãy ghi `NOT_MEASURED`; nếu thiếu phê duyệt ghi `BLOCKED`.

**Bước tiếp theo an toàn nhất:** kiểm tra `specs/004-context-v112/` cùng bản `main@9d96df9` và dựng báo cáo B0/A-B baseline; không cần khởi động thêm worktree hoặc chuyển nhánh Gateway.
