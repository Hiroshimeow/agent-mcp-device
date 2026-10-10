# DONE / OUTDATED — Git history và private backup

Cleanup ngày **2026-10-10**, base Device `baf7c5f36ce5e632e3039f2b9247e900c09e99c6`, Gateway `develop@c5862aa`. File bị loại khỏi HEAD để agent chỉ thấy việc hiện tại; **không xóa Git history**.

| Phần retired | Lý do | Lệnh đọc lại |
| --- | --- | --- |
| `specs/001-mcp-runtime-review/` (16 file) | Plan/review v1.0.10 đã có code và evidence mới hơn; 8 ô chưa tích chủ yếu là deferred/not-selected historical | `git show baf7c5f:specs/001-mcp-runtime-review/tasks.md` |
| `specs/003-context-nextgen/plan-p5-readiness.md`, `tasks-p5-readiness.md`, `contracts/readiness.md` | P5 kết luận blocker từ phiên code cũ `dea0b5b`, đã được R0 v1.0.12 sửa giả định; không được coi là kế hoạch hiện tại | `git show baf7c5f:specs/003-context-nextgen/plan-p5-readiness.md` |
| `docs/handoff/2026-10-10/` (10 file) | Dated snapshot, chỉ mục 474 file và bảng 177 task; dư thừa trong active context | `git show baf7c5f:docs/handoff/2026-10-10/README.md` |
| G6 Device ignored `.plan/` (168 file) | Báo cáo PLAN/REVIEW cũ, đã snapshot và kiểm hash ở cả G6/G8; không còn active backlog | Private backup bên dưới |
| G8 Gateway `.plan/done/` (5 file) | Kế hoạch đánh dấu DONE về upstream MCP và legacy tool shell, không có runtime consumer | `git show c5862aa:.plan/done/external-mcp-handoff.md` |

**Giữ để tránh regression:** `specs/002-device-local-context` là fixture của `scripts/check-context-acceptance.mjs`; `evidence/context` và `evidence/1.0.10` là bằng chứng chấp thuận; `.archive-worktrees-docs/.../core.mjs` được benchmark import. `specs/003` P2–P4 vẫn là nghiên cứu/tham khảo **chưa implement**, không xóa nhầm.

## Backup evidence ngoài repo

- **G6:** `E:\git-project\_mcp-consolidation-20261010\g6-device-plan-evidence\`, `g6-device-plan-evidence-manifest.json`, `g6-device-plan-evidence.tgz`.
- **G8:** `/home/ayumi/Workspace/git_project/_mcp-consolidation-20261010/g6-device-plan-evidence/` và manifest/tar. 168 file / 3.264.173 bytes, từng SHA đã được kiểm cả hai nơi trước cleanup.
- Worktree cũ G6 có **1.534 file đã được bảo toàn** riêng tại `E:\git-project\_mcp-consolidation-20261010\g6-device-110-wt-preserved`. Không tự xóa backup này vì có spec, patch và evidence chưa phân loại đầy đủ.
- **4 log root cũ** ngày 15–16/09 (219.507 byte) được sao lưu, đối chiếu SHA rồi xóa khỏi checkout; backup tại `E:\git-project\_mcp-consolidation-20261010\retired-local-logs\manifest.json`. Không động tới log đang tạo bởi test hiện tại.
- Các backup này có thể chứa log nội bộ; **không push lên GitHub**.

Để phục hồi một tệp tracked: `git show <SHA>:<file>` hoặc `git restore --source=<SHA> -- <file>` sau khi kiểm quyền. Không reset cả repo và không rollback production chỉ để đọc tài liệu.

**Cleanup branch refs:** đã xóa **15 nhánh local hoàn toàn nằm trong lịch sử nhánh chuẩn**: Device G6 (3), Device G8 (8), Gateway G8 (4). SHA/nhãn gốc được ghi trong các file `retired-merged-refs-g6-device.txt`, `merged-refs-g8-device-before.txt`, `merged-refs-g8-gateway-before.txt` của kho backup. **Không xóa** các nhánh có commit độc lập/chưa merge. Hai nhánh Gateway có upstream khác (`feat/hot-reload-skills`, `fix/shell-adapt-linux`) được Git bảo vệ nên vẫn giữ nguyên; không sử dụng `branch -D`.

**Giới hạn ngoài scope:** G8 có checkout Gateway gốc đang chạy 8101, checkout 8102 mang cấu hình NeuralMemory còn được sử dụng, và trên G6 còn thư mục worktree trống bị Windows khóa. Không xóa cưỡng bức.
