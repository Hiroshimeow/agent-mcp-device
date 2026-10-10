# 03 — Spec Kit, các handoff, task và evidence hiện có

**Quy tắc đọc:** file task đánh dấu checkbox là một snapshot lịch sử, không tự chứng minh source đã được merge hay release. Ưu tiên `commit chính thức + kết quả verification tương ứng + source thực tế`; nếu khác nhau phải ghi rõ nguồn nào cũ.

## 1. Bộ spec đặt đúng chỗ trong repo Device

| Nhóm | Tệp gốc / phạm vi | Đánh giá tại 10/10 |
| --- | --- | --- |
| **001 — Runtime review v1.0.10** | `specs/001-mcp-runtime-review/`: spec, plan, tasks, contracts, data-model, review/acceptance | V1.0.10 đã phát hành ở Git, nhưng `tasks.md` còn **54 đã tích / 8 chưa tích** theo dấu cũ. Đừng diễn giải số ô này là lỗi trong v1.0.11 |
| **002 — Device-local Context v1.0.11** | `specs/002-device-local-context/`: spec, plan, 62-task contract, analysis, handoff-110, checklists, API/policy/skill/wiki contracts | `tasks.md` có **9 tích / 53 chưa tích** là tài liệu chưa được cập nhật; nhận định đã chấp nhận T001–T062 phải đối chiếu `evidence/context` và bản GitHub v1.0.11, không sử dụng trạng thái P5 của checkout cũ |
| **003 — Context NextGen** | `specs/003-context-nextgen/`: spec delta, research, P2–P5 plan/tasks, 5 hợp đồng | **Chỉ tài liệu và research**; P2 retrieval/router, P3 deterministic code graph, P4 wiki contract đã được review ở mức thiết kế. Kết luận P5 “BLOCKED/NOT_READY” viết lúc chưa có baseline 002 mới, nên cần tái đối chiếu |
| **004 — Context v1.0.12** | `specs/004-context-v112/`: `baseline.md` và `research.md` | **R0 nghiên cứu/audit** ngày 06/10. Phân biệt rõ accepted v1.0.11, sửa giả định sai của 003; chưa có code 1.0.12/benchmark A/B được phê duyệt |
| **005 — Experience Memory** | `specs/005-experience-memory/`: baseline/spec/research/review/manifest | **Đặc tả nghiên cứu**, chưa có implementation, chưa đạt final independent PASS (review: FINDINGS rồi sửa phần mô tả; final metadata review còn chờ). Đã di chuyển bản nháp khỏi worktree thừa về repo chính và đối chiếu hash |
| **Gateway 003 — Email enrollment approval** | G8 `agent-mcp-gateway@91cefbc:specs/003-device-email-approval/` | Có spec, plan, tasks, research, contracts; **không có trên Gateway `develop@c5862aa`**, không triển khai, không tự nhận là feature đang chạy |

Liên kết trực tiếp trong repo:
- [001 spec](../../../specs/001-mcp-runtime-review/spec.md) · [plan](../../../specs/001-mcp-runtime-review/plan.md) · [tasks](../../../specs/001-mcp-runtime-review/tasks.md)
- [002 spec](../../../specs/002-device-local-context/spec.md) · [plan](../../../specs/002-device-local-context/plan.md) · [tasks](../../../specs/002-device-local-context/tasks.md) · [handoff 1.0.10](../../../specs/002-device-local-context/integration-110.md)
- [003 spec](../../../specs/003-context-nextgen/spec.md) · [research](../../../specs/003-context-nextgen/research.md) · [P5 readiness](../../../specs/003-context-nextgen/plan-p5-readiness.md)
- [004 baseline](../../../specs/004-context-v112/baseline.md) · [research](../../../specs/004-context-v112/research.md)
- [005 spec](../../../specs/005-experience-memory/spec.md) · [research](../../../specs/005-experience-memory/research.md) · [review](../../../specs/005-experience-memory/review.md) · [manifest](../../../specs/005-experience-memory/manifest.json)

## 2. Handoff trong `.plan` và những gì không được suy diễn

Bộ `.plan/mcp-device-context-nextgen-20261005-r2/` chứa **29 handoff** theo lượt PLAN/REVIEW (turn 1–16). Chúng là log từng vòng điều phối CDPA, không phải source code; bản cuối quan trọng:

- `...plan_turn13...md`: P5 từng ghi B1 (post-T062), B2 (G-110 live wiring), B3 (N3 quota/cleanup), B4 (003 tài liệu bền vững) đều chưa được chứng minh.
- `...plan_turn14...md`: khuyến nghị thứ tự T024–T044 rồi N3/G-110 rồi T045–T062 dựa trên checkout lúc đó.
- `...plan_turn15...md`: mở hẹp DEV T024–T029 (CLI/checkpoint/skill).
- `...plan_turn16...md`: phát hiện phần DEV slice lúc đó còn thiếu checkpoint implementation/skill, không nên route TEST giả vờ hoàn thành.
- **Phân biệt thời điểm:** Các kết luận này thuộc checkout/nhánh thực thi cũ. `specs/004-context-v112/baseline.md` và bản **Device main v1.0.11 đã được GitHub giao** xác nhận baseline khác. Không dùng turn 16 để tự hạ trạng thái bản release chính thức thành “v1.11 chưa tồn tại”, cũng không bỏ qua những defect lịch sử chưa tái kiểm tra.

Các cụm khác trong `.plan/` vẫn được giữ nguyên:
- `mcp-device-release-canonical-cleanup-20260917/`.
- `mcp-device-release-publish-20260917/`.
- `release-finalize-hcu-scope/`.

`source-index.json` lưu đường dẫn và checksum của tài liệu thuộc `.plan`, `specs`, `docs` và `evidence/context`, để tìm lại từng bản gốc mà không phải tái tạo từ trí nhớ.

## 3. Accepted evidence của Device v1.0.11 (lịch sử)

Các tài liệu lưu bằng chứng chính thức:
- [Giao nguồn 1.0.11](../../delivery-1.0.11-clean.md) — accepted feature tip `b3a5768`, accepted code `a95a7dc`, integration `cdc3736`, clean GitHub main `9d96df9`.
- [Tích hợp GitHub](../../integration-1.0.11-github.md) — xử lý xung đột 10 file giữ runtime 1.0.10 + Context 1.0.11.
- [Context usage/limitations](../../context.md).
- `evidence/context/` — acceptance, independent review, platform matrix, benchmark, trust signoff, kỹ năng và các log nhận diện đầu vào.

**Lịch sử đã ghi nhận (KHÔNG phải test chạy mới trong phiên kiểm kê này):**
- Windows Context suite **198/198 pass**.
- Core regression **66/66 module pass**.
- Benchmark contract **1/1 pass**.
- Spec consistency **32 yêu cầu / 8 tiêu chí / 62 task**.
- Artifact chuẩn GitHub clean 1.0.11: **298 mục, 805.757 byte**, SHA-256 `04884e48176ae1407a4e4a135c06e851f0c2abb7d3720e47845e62c7cd6d6ab8`.
- Historical Linux evidence ở riêng `evidence/context`; không tự nhận đã chạy Linux mới trong phiên này.
- Báo cáo `npm ci` lịch sử ghi **19 advisory (6 moderate, 12 high, 1 critical)**, chưa có phê duyệt thay đổi dependency chỉ để giảm số advisory.
- Delivery GitHub-only **không đồng nghĩa** được phép npm publish/tag hoặc bật capture, SOC approval vẫn là gate riêng.

## 4. Các thứ mới chỉ là phương án, không phải sản phẩm

**003/004:** Progressive disclosure chọn đúng vùng thông tin rồi mới đọc; đồ thị mã nguồn tách hoạt động; TypeScript compiler/pinned analyzer là ứng viên; wiki chỉ là dẫn xuất; đánh giá A/B có fixture phủ tình huống không cần search. Không mở rộng mặc định thành graph DB/vector/embedding/provider mới.

**005:** Memory kinh nghiệm theo repo chỉ nên được **đề xuất có provenance, xác minh lại hiện trạng, feedback/invalidation**, không tự bơm prompt, không tự chạy lại lệnh, không xuất bản skill tự động. Storage (SQLite hiện tại/SQLite riêng/NMem) **chưa quyết**, cần benchmark và privacy review.

**Gateway Context:** Code cô lập ở các nhánh riêng; tên/tool/schema `local_*` không xuất hiện trong Gateway develop. Không được merge cho tới khi có yêu cầu cụ thể.

## 5. Khuôn vận hành Spec Kit kế tiếp

`constitution → specify → clarify → plan → tasks → implement → converge → independent review`.

Tài liệu ghi đúng ở `specs/<feature>/`, report điều phối ở `.plan/<task>/`, evidence kiểm thử trong `evidence/`. Mỗi bước phải kèm commit SHA, môi trường Windows/Linux, đường dẫn repo và lệnh test; không dùng đầu ra mô tả bằng lời thay cho actual run.

Nghiên cứu/đặc tả có thể được cam kết vào Git mà **không cho phép bắt đầu viết code**, deploy hay thay đổi production. Danh mục file chi tiết nằm trong [source-index](source-index.json).
