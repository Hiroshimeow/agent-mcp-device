# 05 — Worktree cleanup: trước/sau, bảo toàn, ngoại lệ

Kiểm kê 10/10/2026 trên cả G6 (Windows) và G8 (Linux). **Không xóa nhánh Git khi bỏ một worktree.** Không bỏ qua file lạ hoặc data ignored.

## Số lượng

| Repo | Trước | Còn đăng ký |
| --- | ---: | ---: |
| G6 MCP Device | 2 | **1** |
| G6 MCP Gateway | 3 | **1** |
| G8 MCP Device | 8 | **1** |
| G8 MCP Gateway | 7 | **3** |
| **Tổng** | **20** | **6** |

14 checkout Git đã được tháo đăng ký. G8 MCP Device chỉ còn checkout `main@9d96df9`. G6 Device chỉ còn checkout `main@9d96df9`. **Không** xóa Git commit/nhánh cũ.

## Đã dọn ở G6

- `E:\git-project\wt-gateway-personal-context` — sạch. Xóa WT, giữ `feat/personal-context@c6cd6b1`; G8 có `import/personal-context-20261010` cùng commit.
- `E:\git-project\wt-mcp-gateway-device-update-1.0.6` — sạch. Xóa WT, giữ `fix/device-update-bootstrap-1.0.6@fb05f57`.
- `E:\git-project\wt-mcp-device-110-integrate` — trước dọn có 6 file tracked modified và **1.376 untracked**. Đã chuyển **1.534 file** gồm untracked + 158 ignored ngoài dependency ra kho bảo toàn và **kiểm SHA-256 tất cả**, tổng **154.317.083 byte**. Đã checkpoint phần code tracked ở nhánh `archive/g6-device-wt110-checkpoint-20261010@503f9f7`, không merge vào main. Có patch gốc và manifest tường minh.
- Tác vụ xóa WT trên Windows báo `Permission denied` ở bước xóa **tên thư mục cuối cùng**; kiểm tra lại cho thấy `.git`, `specs`, `node_modules` đã không còn và Git chỉ liệt kê repo chính. Thư mục trống `E:\git-project\wt-mcp-device-110-integrate` còn bị giữ handle; không dùng xóa cưỡng bức khi chưa giải phóng khóa.
- Các draft `specs/005-experience-memory` đã được chép từ archive về `E:\git-project\agent-mcp-device\specs/005-experience-memory` (5 file), đối chiếu SHA. `specs/004` trùng hash giữa bản main và archive, không nhân đôi.
- File `.github/workflows/ci.yml` chưa commit (Node 18/24 matrix, trái yêu cầu Node >=22.13 của Device 1.0.11) được lưu nguyên bản vào kho bảo toàn ngoài repo, **không kích hoạt CI**.

Ignored bị loại khỏi kho Git: dependency/build tái tạo `node_modules/**` và `dist/**`, trước đó khoảng 466 MB ở WT bẩn. Những ignored khác (log/evidence/sidecar) đều nằm trong danh sách 1.534 file được bảo toàn.

## Đã dọn ở G8

**Device:** xóa 7 checkout sạch:
`wt-mcp-device-1.0.6-acceptance`, `wt-mcp-device-110-bench`, `wt-mcp-device-110-file`, `wt-mcp-device-110-integrate`, `wt-mcp-device-110-process`, `wt-mcp-device-110-review`, `wt-mcp-device-yellow-red-20260922`. Các branch feature/review vẫn còn. Output `dist/test` của hai checkout có cache được lưu hai gói tar ở kho kiểm kê. G8 `main` fast-forward từ `259d5d2` lên `9d96df9`; ref `archive/g8-pre-111-sync-20261010` giữ HEAD cũ.

**Gateway:** xóa `wt-gateway-context-develop-20261010`, `wt-gateway-context-safe-20261010`, `/tmp/agent-mcp-gateway-audit-ux`, giữ nguyên `integrate/context-*` refs. WT `wt-mcp-gateway-yellow-runtime-20260922` còn 2 thay đổi schema paging: đã lưu patch, kiểm 6/6 test contract/process, checkpoint `feat/mcp-device-runtime-contract-hardening@eb632db` rồi xóa WT. **Đó chỉ là checkpoint thử nghiệm, không merge vào Gateway develop.**

## Các checkout phải giữ và lý do

| Vị trí | Trạng thái | Không thể xóa an toàn vì |
| --- | --- | --- |
| G8 `agent-mcp-gateway` | backup `91cefbc`, Git sạch | tiến trình Gateway **8101** vẫn chạy nguồn từ đây; còn specs email approval |
| G8 `agent-mcp-gateway-develop` | `develop@c5862aa`, Git sạch | nguồn chuẩn hiện tại của Gateway; runtime 8102 chạy gói build từ base này |
| G8 `agent-mcp-gateway-8102` | detached `c5862aa`, 3 modified + 6 untracked | biến môi trường `MCP_UPSTREAM_CONFIG` của production **đang trỏ vào `.runtime/mcp-servers-nmem.toml` bên trong thư mục**; cần chuyển dependency có kiểm soát và restart |
| G6 `agent-mcp-gateway` | `develop@89f7123`, 1 modified + 3 untracked | nguồn Gateway cũ và các tài liệu/config chưa review, không đồng bộ bằng reset |
| G6/G8 `agent-mcp-device` | `main@9d96df9` | repo chính mỗi máy, không phải worktree thừa |

## Kho bằng chứng và backup — KHÔNG push

**G6:** `E:\git-project\_mcp-consolidation-20261010\`
- `inventory-g6.json` — toàn bộ worktree/refs trước cleanup.
- `backup-g6-main-untracked/`, `backup-g6-main-manifest.json` — 20 file main untracked đã sao lưu trước fast-forward.
- `g6-device-110-wt-preserved/complete-manifest.json` — phân loại, path, checksum của **1.534** file đã di chuyển; kèm `tracked-modifications.patch`.
- `draft-ci-node18-incompatible.yml` — CI draft chưa được kích hoạt.
- `g6-device-plan-evidence/`, `g6-device-plan-evidence-manifest.json`, `g6-device-plan-evidence.tgz` — **168 file trong `.plan`** (3.264.173 byte) đã snapshot và kiểm SHA-256; 115 file được liệt kê ở `source-index.json` là chỉ mục local-only. Đã sao chép archive này sang G8 và xác minh 168/168 hash; không đưa raw handoff/log bị Git ignore vào GitHub.

**G8:** `/home/ayumi/Workspace/git_project/_mcp-consolidation-20261010/`
- `inventory-g8-before.json`; hai gói `*-generated-files.tgz`; `g8-gateway-yellow-20261010.patch` và `g8-yellow-test.log`.

**Lưu ý:** backup ngoài repo có thể chứa log hoặc dấu vết vận hành, không phát hành/tải lên GitHub và không xóa theo thói quen. Các commits checkpoint cũng không phải feature được review.

## Quy tắc cho worktree về sau

1. Ghi **host + repo_root + branch + HEAD + WT path + service dependency** vào mỗi task/handoff.
2. Trước xóa: kiểm tra `git status --porcelain=v1 -uall`, cả ignored, file lạ và PID/CWD/config sử dụng path.
3. Không còn người dùng/process tham chiếu → commit hoặc archive diff + file chưa theo dõi bằng hash; chỉ dùng `git worktree remove` thông thường.
4. Không `branch -D`, `reset --hard`, `clean -fdx`, `worktree remove --force` chỉ để lấy “status sạch”.
5. Khi đường dẫn còn gắn với production, chuyển dependency và reload có receipt/rollback ở **task riêng**, không làm trong đợt vệ sinh Git.
