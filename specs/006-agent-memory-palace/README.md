# 006 — Agent Memory Palace

**ACTIVE SPEC KIT · chưa implement · 2026-10-11**

**Mục tiêu:** Agent dùng được kinh nghiệm từ **tool/session logs** và lịch sử của các repo trước ngay khi bước vào repo mới, không cần người dùng hướng dẫn lại, và chỉ tốn token cho đúng thông tin cần đọc.

- **Log Search:** FTS5/BM25, định vị chứng cứ nhanh → đọc đúng ref; không đổ toàn bộ log vào prompt.
- **Activity Graph:** session/turn/tool/error/file/test/outcome — không làm code AST graph mặc định.
- **LLM Wiki = Mind Palace:** một backend wiki có sẵn (PoC ReMe/OpenViking), tự tổng hợp, liên kết bài học, cập nhật theo bằng chứng.
- **Auto Skills:** tự học, lazy load, tự merge/dedupe theo lịch và rollback **không cần duyệt từng skill**.
- **Shared Recall:** cùng owner có thể mang kiến thức từ G6/G8 sang một repo mới; source evidence vẫn kiểm quyền riêng.

## Chỉ đọc tài liệu cần thiết

| File | Khi nào cần |
| --- | --- |
| [spec.md](spec.md) | Ý định, yêu cầu, giới hạn, tiêu chí chấp nhận |
| [plan.md](plan.md) | Phase P0–P6, merge base đúng, dependency/điểm dừng |
| [tasks.md](tasks.md) | **51 task OPEN**; chưa có task DEV nào DONE |
| [contracts.md](contracts.md) | Event/session schema, search, graph, wiki, skill, auth |
| [evaluation.md](evaluation.md) | A/B, E2E cross-repo, tổng token kể cả background |
| [research.md](research.md) | Reuse upstream, quyết định, những giả định cũ đã supersede |

**Nguồn mã:** Device G6 `E:\git-project\agent-mcp-device` `main`. Nếu sau này cần Gateway, chỉ dùng **G8 canonical `develop`**, không merge nhánh Context Gateway cũ nguyên vẹn. G6 Gateway checkout là bản cũ.

**Ngoại lệ bắt buộc:** `specs/002-device-local-context/` là contract v1.0.11 đã DONE nhưng cần cho `scripts/check-context-acceptance.mjs`; không phải backlog. Các spec 003, 004, 005 sai/lỗi thời được truy hồi qua lịch sử Git trước đợt cleanup.

**Trong lượt này:** chỉ sửa spec/plan/docs và dọn repo; **không viết mã, không tạo cron thật, không đổi server hoặc release**.