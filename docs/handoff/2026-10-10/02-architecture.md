# 02 — Kiến trúc, đường gọi tool và giới hạn chức năng

## Sơ đồ thực tế

```mermaid
flowchart TD
    A[AI agent / ChatGPT / MCP client] -->|MCP tools/list, tools/call; OAuth| B[Gateway device.hcu-lab.me/mcp]
    B --> C[Account ownership + device broker + policy + audit]
    C -->|WSS outbound connection + inner TLS| D[MCP Device on g6 / g8 / Windows / Linux]
    D --> E[Local file, shell, process and native tools]
    D --> F[ContextService: repo-scoped SQLite/WAL/FTS5]
    G[Local terminal / CLI / PI] -->|mcp-device context ...| F
    F --> H[Retained evidence + activity/provenance]
    B -. proposed, NOT in develop .-> X[Gateway Context integration (isolated branch)]
```

**Quan trọng:** MCP Device chủ động mở kết nối **đi ra** Gateway, không yêu cầu mở cổng điều khiển công khai vào từng máy. Gateway là control plane; Device giữ mã thực thi và corpus Context cục bộ. MCP không phải phần mềm thay thế Git CLI, mà là giao thức xuất tool với schema cho AI.

## Quyền sở hữu và lớp thực thi

| Thành phần | Nhiệm vụ |
| --- | --- |
| **AI client** | Chọn tool, truyền tham số; không được tự quyết định quyền sở hữu của thiết bị |
| **Gateway** | Đăng nhập/OAuth, thiết bị thuộc tài khoản, `list_devices`, MCP catalog, chính sách truy cập, định tuyến, audit tối thiểu và usage metadata |
| **Device broker** | Quản lý kết nối/epoch, kiểm tra tình trạng online, dispatch request, timeout/fail-closed, không tự replay lệnh không chắc kết quả |
| **MCP Device** | Đọc/sửa file, shell/process, khởi tạo/cập nhật thiết bị, identity/reconnect, ContextService bên máy |
| **Device Context** | Chỉ số/tìm kiếm bằng chứng lịch sử thuộc **repo + owner**, quan hệ activity, freshness/cursor/retention |
| **Gateway Context patch** | Bổ sung sáu công cụ cho client và chuyển qua Device; **chưa đưa vào Gateway `develop`** |
| **External MCP/NMem** | Nhà cung cấp khác có cấu hình riêng; không tự hòa vào Context hoặc tự đồng bộ memory |

Quyền Gateway và giới hạn cho từng thiết bị là độc lập với việc một CLI lệnh có tồn tại trên máy. Tool schema không thay thế kiểm tra owner, allowed-root và profile trước thực thi.

## Tool thường gặp

- `read_text_file`, `write_file`, `edit_file`: tool có schema rõ, dùng cho file biết trước.
- `shell_execute`: chạy CLI trong thư mục làm việc được kiểm tra (Git, npm, Python, v.v.); cần phân biệt stdin/stdout/stderr và giới hạn output.
- `start_process` + `read_process_output` + `interact_with_process` + `terminate_process`: tác vụ dài, session/caller identity, offset/cursor, completion và cleanup. Không tự coi “timeout” là lệnh chưa chạy.
- `list_devices`, `project_list`, `project_inspect`, `skill_catalog` / `load_skill`: khám phá theo nhu cầu, tránh đưa hết schema và raw dữ liệu vào model.
- `local_status`, `local_search`, `local_read`, `local_graph`, `local_index`, `local_wiki`: **six Context schemas ở Device 1.0.11; chưa công bố bởi Gateway develop hiện hành**. Tool cuối chỉ báo `WIKI_DISABLED`; `local_index` là nhóm ghi, không phải read-only.

## Mã Device và đối chiếu

| Module | Vai trò |
| --- | --- |
| `src/device/device.ts` và `src/device/gateway-tool-adapter.ts` | kết nối Device/Gateway, capability negotiation và dispatch |
| `src/tool-dispatcher.ts` | tuyến thực thi chung; kiểm soát không đếm trùng sự kiện |
| `src/terminal-manager.ts` | session/output/process và vòng đời terminal |
| `src/context/service.ts` | API domain của Context |
| `src/context/store.ts` và các file kề `src/context/` | lưu trữ/migration/index/authorization (xem tree tại SHA hiện hành, không giả định tên con) |
| `src/context/tool-contract.ts` | schema và tên tool public đã đóng băng |
| `src/context/device-adapter.ts`, `src/context/gateway.ts` | adapter cho Device/Gateway Context được gate |
| `skills/mcp-device-context/SKILL.md` | hướng dẫn sử dụng Context CLI theo nhu cầu |
| `test/context/`, `evidence/context/` | kiểm thử, bằng chứng và giới hạn đo |

Mã Gateway tương ứng (trên **G8 develop**):
- `scripts/authenticated-mcp-wrapper.mjs` — MCP HTTP/OAuth/catalog.
- `scripts/device-broker.mjs` — quản lý Device và dispatch.
- `scripts/dashboard-http.mjs` — giao diện Usage/24H/7D/30D.
- `scripts/device-usage.mjs` — thống kê theo khoảng `since`.
- `scripts/device-execution-tool-definitions.mjs` — khai báo schema cho tác vụ filesystem/process.
- `scripts/remote-process-sessions.mjs` — gắn session với caller/device.
- `scripts/custom-tools/index.mjs` — phần mở rộng tool; **chưa chứa `context-tools.mjs` trên develop**.

Đọc đúng nội dung ở SHA đang làm việc. Danh mục trên là điểm vào, không khẳng định tất cả logic đều nằm trong một tệp.

## Context 1.0.11: đã có gì

CLI Device trực tiếp chạy bên máy, không cần Gateway:
```text
mcp-device context status --cwd . --json
mcp-device context search --cwd . --query "reconnect" --json
mcp-device context read --cwd . --ref <evidence-ref> --json
mcp-device context sync --cwd . --json
mcp-device context checkpoint --cwd . --summary "..." --json
```

Còn có graph, rebuild, cancel. Tìm kiếm status/read **không âm thầm chạy sync/index**. Kết quả là bằng chứng lịch sử, không phải bản sao mã hiện tại. Sau khi tìm ref, xác minh file/source thực tế bằng tool bản địa. CLI đòi Node **>=22.13.0** với `node:sqlite`, WAL, FTS5.

**Giới hạn đặc biệt:**
- Không có parser call-graph mã nguồn xác định trong Context 1.0.11; `local_graph` là quan hệ hoạt động/chứng cứ. Sơ đồ dependency/call code graph còn ở nghiên cứu 004.
- Không tự tạo wiki, embedding, vector DB, Graphiti hoặc đồng bộ NMem.
- Scope dùng Git common-directory để hiểu các worktree cùng repo, nhưng **clone khác không đương nhiên chung corpus**. Owner namespace được phân tách; đổi tài khoản không tự chuyển lịch sử.
- Captured event có thể bị lỗ hổng khi crash/mất điện; không tuyên bố exactly-once tuyệt đối ở cấp ổ đĩa. Quan hệ quan sát không chứng minh nhân quả.
- SQLite Context cục bộ **không mã hóa mặc định**, redaction cố gắng nhưng không bảo đảm loại mọi bí mật. Xem `PRIVACY.md`.
- Bật live capture/public Context chịu **approval gate**. `docs/context.md` ghi cần xác nhận SOC/custody; không có quyền mặc định chỉ vì thiết bị báo `context_version=1`.
- `uninstall` dịch vụ không đồng nghĩa `logout` tài khoản, và không được tự xóa identity trong `~/.mcp-device`.

## Vì sao không bỏ MCP để chuyển hẳn CLI?

CLI (Git, CLI-Anything, v.v.) là **cách thực thi ứng dụng**, MCP là **hợp đồng cung cấp tool/định tuyến qua nhiều client/thiết bị**. Kiến trúc đúng là tái dùng CLI/lõi thực thi dưới tool chuyên dụng, không tạo gateway, quyền truy cập hay route thứ hai. Chỉ tạo thêm public tool khi đo được nhu cầu, nếu không dùng `shell_execute` hoặc tool hiện có.

Nguồn chi tiết: [docs/context.md](../../context.md), [bảo mật](../../../PRIVACY.md), [Spec 002](../../../specs/002-device-local-context/spec.md).
