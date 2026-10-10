# 01 — Hiện trạng, nguồn chuẩn và lịch sử mã

**Xác minh thực địa:** 10/10/2026 (JST). Trạng thái này có thể thay đổi sau lần kiểm kê. Với mọi phiên làm việc mới, chạy kiểm tra SHA/CWD ở [runbook](06-runbook.md).

## 1. Phải tách bốn khái niệm

- **Repository Source:** bộ mã do Git theo dõi, xác định bằng URL + SHA + đường dẫn vật lý.
- **Working tree:** một checkout tại một nhánh/HEAD; có thể khác bản chính và có file chưa commit.
- **Release artifact:** gói/tarball hoặc bản copy đã cài; không tự cập nhật khi checkout đổi SHA.
- **Live runtime:** tiến trình, cấu hình ngoài repo, tài khoản, trạng thái thiết bị. Không suy phiên bản runtime từ tên nhánh.

## 2. Ma trận nguồn mã hiện hành

| Máy và đường dẫn | Git/ref được quan sát | Vai trò, giới hạn |
| --- | --- | --- |
| **G6** `E:\git-project\agent-mcp-device` | `main` chứa base phát hành `9d96df9` + commit tài liệu sau kiểm kê | **Repo chính Device**; fast-forward từ `1492747`, không merge code tính năng; kiểm HEAD cụ thể bằng Git |
| **G8** `/home/ayumi/Workspace/git_project/agent-mcp-device` | `main` cùng HEAD tài liệu với G6; base phát hành `9d96df9` | Đồng bộ commit nội bộ G6→G8; systemd vẫn dùng bản cài, không chạy trực tiếp từ checkout này |
| **G8** `/home/ayumi/Workspace/git_project/agent-mcp-gateway-develop` | `develop@c5862aa` | **Base Gateway được chọn**: UI mới, không có mã Context Gateway |
| **G8** `/home/ayumi/Workspace/git_project/agent-mcp-gateway` | `backup/develop-before-ui-return-20261010@91cefbc` | Checkout cũ, còn được Gateway legacy 8101 sử dụng; **không đổi/di chuyển** |
| **G8** `/home/ayumi/Workspace/git_project/agent-mcp-gateway-8102` | detached `c5862aa`, có file sửa/untracked | Có cấu hình upstream NeuralMemory trong `.runtime/` đang được dịch vụ 8102 tham chiếu; **không xóa trước khi dời dependency và reload có kiểm soát** |
| **G6** `E:\git-project\agent-mcp-gateway` | `develop@89f7123`, dirty | Checkout Gateway **cũ** hơn `origin/develop@c5862aa`; không lấy làm nền triển khai |

### Các nhánh Context bảo toàn, chưa ghép Gateway

- Gateway Context gốc tại G6: `feat/personal-context@c6cd6b1`. Phần code từng chưa commit đã được checkpoint 10/10.
- G8: `import/personal-context-20261010@c6cd6b1`; thử tích hợp từ Gateway `develop`: `integrate/context-develop-20261010@d441ecf` và `integrate/context-develop-safe-20261010@2b44fae`. **Tất cả tách biệt**, không phải bản chạy.
- Bản Gateway Context cũ đã triển khai hôm 07/10 nằm tại `/home/ayumi/.mcp-gateway-8102/releases/gateway-context-20261007`, bảo toàn để đối chiếu/rollback; bị thiếu UI 24H/7D/30D.
- Device Context v1.0.11 **đã có trong GitHub main của Device**. Không nhầm với việc Gateway `develop` chưa tích hợp bộ điều phối 6 tool `local_*`.

### Nhánh tài liệu Gateway email approval

- G8 nhánh backup `91cefbc` chứa `specs/003-device-email-approval/` (spec, plan, tasks, research, contracts, checklist).
- Chưa được hợp nhất vào base Gateway `develop@c5862aa`, chưa triển khai luồng phê duyệt thiết bị qua email. Đây là đặc tả độc lập.

## 3. Bản production/thiết bị khi kiểm kê

- Địa chỉ công khai Gateway: `https://device.hcu-lab.me/mcp`; dashboard `/dashboard`.
- PM2 ứng dụng `mcp-device-gateway-8102` phục vụ local `127.0.0.1:8102`. Sau lần reload 10/10: code chạy từ `/home/ayumi/.mcp-gateway-8102/releases/gateway-develop-c5862aa-20261010`; PID được quan sát `3341418`. Dùng `pm2 pid/show` để xác minh lại, không coi PID cố định.
- `/login` phản hồi HTTP 200; `/dashboard` khi chưa đăng nhập chuyển hướng 302. Không dùng trạng thái HTTP công khai này để tuyên bố đã kiểm thử UI có phiên đăng nhập.
- Gateway 8101 khác vẫn chạy mã trong repo Gateway G8 cũ. **Không dừng hoặc đổi 8101** để dọn Git.
- Thông tin nguồn Gateway và dữ liệu account/pairing/usage là hai lớp riêng. Các đường dẫn DB/config phải giữ nguyên khi thay đổi bản chạy.

### 8/8 Device đang online tại thời điểm kiểm tra

| Máy | Báo phiên bản | Context capability |
| --- | --- | --- |
| docker | 1.0.11 | `context_version=1` |
| g6 | 1.0.11 | `context_version=1` |
| a5 | 1.0.11 | `context_version=1` |
| g8 | 1.0.11 | `context_version=1` |
| r28 | 1.0.11 | `context_version=1` |
| fjp | 1.0.10 | chưa báo v1 |
| r28-nspawn | 1.0.10 | chưa báo v1 |
| z99 | 1.0.10 | chưa báo v1 |

Quan sát qua `list_devices` hiện có 19 tool ở catalog Gateway. Device hỗ trợ Context không có nghĩa `local_status/search/read/graph/index/wiki` đã được công bố trong catalog này. Mọi kiểm tra thay đổi quyền phải sử dụng phiên xác thực hợp lệ, không đoán từ log.

## 4. Mốc lịch sử và quan hệ Git

1. 18–24/09: chuẩn hóa Device v1.0.3→v1.0.9, Gateway UI; Gateway `c2beabd` ngày 22/09 thêm 24H/7D/30D và theo dõi hoạt động.
2. 04–05/10: Device `1492747` đóng gói v1.0.10, là nền cho v1.0.11.
3. 06/10: accepted Device Context, kiểm thử riêng và giao bản v1.0.11 lên GitHub: `9d96df9`. Đây là **GitHub-only**, tài liệu không cho phép suy ra npm/tag/release production được chấp thuận.
4. 07/10: Gateway Context xây từ `develop@89f7123` cũ được đóng gói; sản phẩm bị thiếu các cải tiến dashboard đã có ở `c2beabd`.
5. 10/10: Gateway production quay về `develop@c5862aa` để giữ UI; Context Gateway **không merge**. Đồng bộ Device `main` G6/G8 về cùng nền `9d96df9`, rồi thêm commit handoff/spec tài liệu (không thay mã sản phẩm) và đồng bộ qua Git nội bộ; cô lập và ghi nhận các worktree thừa.

## 5. Các giới hạn cần giữ

- Handoff chứng minh các SHA/source và quan sát endpoint, **không chứng minh** toàn bộ đường đi OAuth/WSS/Context trên mọi máy đã E2E thành công sau 10/10.
- Không đưa raw OAuth token, email, private key, nội dung SQLite hoặc device identity nhạy cảm vào bộ tài liệu.
- Phiên bản ghi trong `CHANGELOG.md` (“Unreleased”) nói về trạng thái đóng gói/phát hành lúc viết, không phủ nhận GitHub main đã được giao v1.0.11.
