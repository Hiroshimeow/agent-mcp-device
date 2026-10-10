# MCP Device / MCP Gateway — handoff tập trung (10/10/2026)

**Mục tiêu:** Đây là điểm bắt đầu duy nhất để hiểu hệ thống, tình trạng phát hành, mọi nhánh/spec/plan/task/evidence liên quan và cách thao tác tiếp mà không lệch nhánh hoặc mất dữ liệu. Các tài liệu gốc vẫn giữ ở đường dẫn tiêu chuẩn của Spec Kit; tệp `source-index.json` lập chỉ mục để không phải lục nhiều worktree.

**Thời điểm kiểm kê:** 10/10/2026 (Asia/Tokyo). Mọi số liệu runtime là ảnh chụp tại thời điểm kiểm tra, phải xác minh lại trước khi quyết định triển khai.

## Tóm tắt cần nhớ

1. **Device GitHub/main = v1.0.11, SHA `9d96df9`.** Repo Device trên G6 và G8 đã đồng bộ tới commit này bằng fast-forward. Phát hành này là **giao mã lên GitHub**, KHÔNG phải bằng chứng npm publish/tag hoặc cấp phép bật mọi chức năng Context trong production.
2. **Gateway production 8102 = `develop@c5862aa`, KHÔNG có Gateway Context.** Đây là lựa chọn đã xác nhận: ưu tiên UI mới (24H/7D/30D), chưa hợp nhất nhánh Context. Mã Context Gateway được giữ ở nhánh riêng `import/personal-context-20261010@c6cd6b1` và hai nhánh tích hợp thử nghiệm; không triển khai chúng.
3. **Runtime Device ≠ mã nguồn Git checkout.** 8/8 thiết bị trực tuyến khi kiểm tra; 5 máy báo v1.0.11, 3 máy v1.0.10. Khả năng Context ở máy không đồng nghĩa sáu tool `local_*` đã được Gateway hiện tại công bố.
4. **Spec Kit 003 / 004 / 005 vẫn là đặc tả/nghiên cứu.** 003 có tài liệu P2/P3/P4 được review, nhưng các kết luận P5 cũ dựa trên baseline sai; 004 R0 đã giải quyết phân biệt baseline. 005 Experience Memory chưa được triển khai hoặc chứng minh lợi ích.
5. **Không dùng đường dẫn worktree cũ để xác định base.** G6 repo Device chính: `E:\git-project\agent-mcp-device`. G8 Gateway base phát triển chính: `/home/ayumi/Workspace/git_project/agent-mcp-gateway-develop`, nhánh `develop`. Xem lý do các checkout khác còn tồn tại trong `worktrees.md`.

## Mục lục làm việc

| Tài liệu | Nội dung |
| --- | --- |
| [01 — Hiện trạng và nguồn chuẩn](01-current-state.md) | SHA, repo, môi trường, triển khai, thiết bị đang kết nối, lịch sử |
| [02 — Kiến trúc và API](02-architecture.md) | Gateway/Device/CLI/MCP, quyền, Context, đường dẫn mã, giới hạn |
| [03 — Spec Kit, handoff, task/evidence](03-specs-handoffs.md) | Toàn bộ cụm 001–005, tình trạng nhiệm vụ, các kết quả kiểm chứng |
| [04 — Quyết định và việc cần làm](04-decisions-next.md) | Phần đã xong, chưa xong, tiêu chí để bắt đầu phần tiếp theo |
| [05 — Dọn worktree và bảo toàn](05-worktrees.md) | Trước/sau, nhánh được giữ, checkpoint, file lạ, chỗ chưa thể xóa |
| [06 — Quy trình vận hành](06-runbook.md) | Lệnh xác minh repo và runtime, an toàn nhánh, test, rollback |
| [07 — Handoff cho agent mới](07-agent-handoff.md) | Checklist đầu phiên, phân vai, lệnh kiểm chứng, giới hạn thao tác |
| [Chỉ mục file có SHA](source-index.json) | Đường dẫn tài liệu gốc/spec, `.plan`, bằng chứng và checksum |

## Thứ tự tin cậy của bằng chứng

- **LIVE:** PID/CWD/port, phiên bản thiết bị báo qua Gateway, API phản hồi. Chỉ đúng ở thời điểm quan sát.
- **GIT:** commit SHA, trạng thái dirty, nội dung tại đúng ref. Một nhánh tên `main` hoặc `develop` không đủ; phải so sánh SHA.
- **ACCEPTED HISTORICAL:** báo cáo review, benchmark, kiểm thử đã ký nhận trước đó. Không gọi là “đã chạy hôm nay”.
- **SPEC/PROPOSED:** tính năng/thiết kế mới chỉ có tài liệu; không được mô tả như đã tồn tại trong runtime.
- **UNKNOWN / NOT_MEASURED:** chưa kiểm nghiệm trực tiếp; không suy diễn thành PASS.

## Quy tắc bắt buộc khi dùng bộ handoff

- Không tự merge Context vào Gateway, không reset/clean/stash tùy tiện, không ép thay đổi nhánh vì tên giống nhau.
- Không động tới cấu hình, token, khóa riêng, state SQLite/WAL hoặc dịch vụ Gateway/Device nếu không có mục tiêu triển khai riêng và điểm quay lui.
- Công việc tiếp theo trước hết kiểm tra nhánh và SHA thật, sửa/cập nhật handoff nếu bằng chứng mới làm tình trạng thay đổi.
- Không commit cache, log chứa bí mật, bản sao dữ liệu vận hành hoặc phụ thuộc `node_modules` vào Git; phân loại từng file lạ trước.
- Các spec chính được giữ đúng chỗ ở `specs/` để Spec Kit còn dùng; handoff là lớp mục lục/đối chiếu, không phải một bản fork của spec.

**Phạm vi thực hiện 10/10:** Kiểm kê, gom tài liệu, đồng bộ Device `main` bằng fast-forward và bỏ worktree dư thừa. Không chỉnh tính năng sản phẩm, không triển khai Gateway Context, không restart production.
