# 06 — Runbook: thao tác an toàn trên Device/Gateway

Đây là **hướng dẫn**, không phải lệnh cho phép đổi production ngay. Luôn ghi ngày/host/exit code vào report.

## Kiểm tra danh tính Git trước khi làm

**G6 Device (Windows):**
```powershell
git -C E:\git-project\agent-mcp-device rev-parse --show-toplevel HEAD
git -C E:\git-project\agent-mcp-device branch --show-current
git -C E:\git-project\agent-mcp-device status --porcelain=v1 -uall
git -C E:\git-project\agent-mcp-device worktree list --porcelain
```

**G8 Device (Linux):**
```bash
git -C /home/ayumi/Workspace/git_project/agent-mcp-device rev-parse HEAD
git -C /home/ayumi/Workspace/git_project/agent-mcp-device status -sb
git -C /home/ayumi/Workspace/git_project/agent-mcp-device worktree list
```

**G8 Gateway — đúng base và runtime:**
```bash
git -C /home/ayumi/Workspace/git_project/agent-mcp-gateway-develop rev-parse HEAD
git -C /home/ayumi/Workspace/git_project/agent-mcp-gateway-develop status -sb
pm2 show mcp-device-gateway-8102
pm2 pid mcp-device-gateway-8102
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8102/login
```

Mục tiêu tại ảnh chụp này: Device main `9d96df9`; Gateway develop `c5862aa`; PM2 8102 `exec cwd` trỏ bản release `gateway-develop-c5862aa-20261010`. Không nhầm với Gateway 8101 chạy từ repo root G8 cũ.

## Xác minh version và tool

- **Version Git:** `package.json`/commit SHA. **Version cài đặt:** hỏi status/service package; **runtime đang chạy:** PID/process + thông tin Device báo qua Gateway. Không đánh đồng.
- Node Device 1.0.11 cần **>=22.13.0**. Không chạy Device context trên Node 18.
- Không dùng `mcp-device --version` để kiểm tra source trên G8: đã quan sát rằng lệnh có thể vào entrypoint start và bị từ chối takeover systemd; đọc package metadata thay thế khi chỉ cần kiểm tra mã.
- `list_devices` chỉ chứng minh capability được quảng bá; kiểm tra tool catalog, Gate/SOC và quyền caller trước khi kết luận công cụ Context có thể được gọi qua Gateway.

## Kiểm thử Device khi có thay đổi mã

Trên **checkout đúng, Node phù hợp, các package đã cài**:
```bash
npm ci
npm run build
npm test
node --test test/context/sqlite-platform.test.js
```

Nếu task chỉ sửa một phần, chạy test nhỏ có ý nghĩa trước rồi chạy full regression phù hợp. `docs/delivery-1.0.11-clean.md` có **198/198 Context, 66/66 core, 1/1 benchmark** là **bằng chứng lịch sử**, không phải test đã chạy lại hôm nay. Không đánh tráo triệu chứng PASS bằng “đã có log PASS cũ”.

## Kiểm thử Gateway

Chỉ trong bản checkout/release đã có `node_modules`:
```bash
node --test tests/dashboard-http.test.mjs tests/operator-dashboard-http.test.mjs
npm run smoke:mcp:tools
npm test
```

Khi kiểm tra UI bắt buộc bao phủ 24H/7D/30D, search/filter/sort devices, live activity, account isolation, CSRF, revoke/update, session, OAuth/login/pairing. Gateway 8102 từng đạt **333/333 test** khi chuyển sang develop ngày 10/10; cần fresh test cho lần đổi code tiếp theo. Trang `/login` trả HTTP 200 **không chứng minh** UI sau đăng nhập đã chạy E2E.

## Khi Git có file lạ hoặc worktree nhiều nơi

1. Chạy `git worktree list --porcelain` và `git status --porcelain=v1 -uall` từ root đúng.
2. Liệt kê cả ignored: `git ls-files -o -i --exclude-standard`. Phân biệt source/docs, patch, log, config, dependency, generated cache.
3. Kiểm tra tiến trình có dùng thư mục (PID cwd/command) và biến config nào còn trỏ vào nó. Không chỉ dựa `git status clean`.
4. Bảo toàn file không tái tạo bằng archive và hash; commit checkpoint trên nhánh riêng cho code chưa được review. Không merge commit checkpoint vào main mặc định.
5. Chỉ dùng `git worktree remove` thông thường sau khi nhánh đã được giữ và không còn tham chiếu. Nếu Windows báo khóa handle, không ép xóa.
6. Các file `.plan` raw bị Git ignore **không có trong clone**, dùng `source-index.json` kiểm `availability`. Kho riêng: G6 `E:\git-project\_mcp-consolidation-20261010\g6-device-plan-evidence\`, G8 `/home/ayumi/Workspace/git_project/_mcp-consolidation-20261010/g6-device-plan-evidence/`. Mỗi file có SHA trong manifest; chỉ mở thông tin cần thiết, không push log riêng ra ngoài.
6. Khi khôi phục state: dùng đúng source revision + receipt. Không lấy bản context ở release cũ ghi đè UI mới.

## Triển khai/reload (chỉ sau khi có task ủy quyền cụ thể)

1. Chốt SHA, feature matrix hiện có và acceptance contract. Không thay production trong task chỉ viết spec/kiểm kê.
2. Backup env/config/identity và SQLite **nhất quán kèm WAL**; bảo vệ quyền đọc của các file này. Không đưa token/private key vào handoff.
3. Build snapshot bất biến ngoài checkout; so SHA file quan trọng và package manifest với source, chuẩn bị rollback code.
4. Chạy test, review bảo mật/quota, xác nhận external MCP config vẫn còn đường dẫn hợp lệ.
5. Reload cuối cùng, xác nhận PM2 pid/cwd, login/dashboard, OAuth, thiết bị reconnect, MCP catalog và truy vấn thực. Nếu không đạt, rollback theo receipt và kiểm chứng dữ liệu/identity.
6. Không đẩy npm/tags, không bật Context/public capture hoặc email approval khi chưa có phê duyệt riêng.

**Dependency chưa giải quyết:** production Gateway 8102 hiện còn trỏ `MCP_UPSTREAM_CONFIG` vào `/home/ayumi/Workspace/git_project/agent-mcp-gateway-8102/.runtime/mcp-servers-nmem.toml`. Không xóa checkout G8 đó trước khi chuyển file config và reload có kiểm chứng.

## Chẩn đoán nhanh

| Triệu chứng | Kiểm tra đầu tiên |
| --- | --- |
| Dashboard mất 24H/7D/30D | PM2 cwd và bản release có đúng `c5862aa`? |
| Device 1.0.11 nhưng thiếu `local_*` | Gateway develop **chưa có Context patch**; kiểm catalog/approval |
| Context denied/unavailable | owner, Git common-directory scope, allowed roots, state/quota, Node/sqlite, approval |
| Process session stale | caller, connection epoch, runtime generation; không replay lệnh mơ hồ |
| Nhánh nhìn “sai” | host, `pwd`, `git rev-parse --show-toplevel HEAD`, `git worktree list` |
| Git có untracked/ignored lạ | phân loại và hash/backup trước; không `clean -fdx` |
