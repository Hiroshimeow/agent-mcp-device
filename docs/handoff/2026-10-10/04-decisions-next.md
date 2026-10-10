# 04 — Quyết định, blockers và backlog

Ngày 10/10/2026. Đây là sổ quyết định; **không** cấp phép triển khai.

## 1. Quyết định đã chốt

| Chủ đề | Quyết định |
| --- | --- |
| Gateway | `develop@c5862aa` là base đúng, giữ UI mới; **không merge Gateway Context** |
| Device | Hai repo G6/G8 `main@9d96df9` chứa mã GitHub v1.0.11; npm publish/tag và quyền bật production không được suy ra từ Git |
| Truy xuất | Ưu tiên xác định đúng file/ref rồi đọc đúng đoạn cần thiết; đã biết file thì đọc trực tiếp bằng native tool |
| Data authority | Current source/test và user instruction > evidence lịch sử > code graph dẫn xuất > wiki/experience memory |
| Các graph | Activity/provenance graph khác code symbol/call graph; không biến quan sát thành khẳng định nhân quả |
| Security | Device identity/owner/repo scope, sandbox, approval và quota vẫn áp dụng; không tự mở rộng quyền vì tool tồn tại |
| Agent tools | Reuse CLI dưới MCP Gateway/Device, không dựng routing/permission stack thứ hai; không thêm hàng chục public tool khi chưa đo được nhu cầu |
| Khả năng thử nghiệm | Context NextGen 003/004, Experience Memory 005 và Gateway email approval **chỉ ở mức spec/research**, không tự implement |
| Worktree | Không coi đường dẫn worktree là source of truth. Không reset/clean/force-remove nếu chưa kiểm kê và bảo toàn |

## 2. Trạng thái chức năng

- **Hoạt động trong code chính:** MCP Device 1.0.10 lifecycle/filesystem/process/direct dispatch; Device 1.0.11 ContextService/CLI và sáu schema có gate; Gateway dashboard 24H/7D/30D, tìm/lọc/sort, live activity.
- **Chưa có ở Gateway production:** tích hợp sáu tool `local_*`. Có trên nhánh riêng `c6cd6b1` và nhánh tích hợp thử nghiệm; không merge theo yêu cầu người sở hữu.
- **Chưa triển khai 1.0.12:** bộ định vị theo nhiệm vụ, static TS code graph, guarded hydration mới, human wiki dẫn xuất, benchmark đóng băng.
- **Chưa triển khai 005:** Experience Memory có curation, provenance, feedback, stale/invalidation, skill draft human approval; A/B và storage policy chưa phê duyệt.
- **Gateway email approval:** có tài liệu ở nhánh `backup/...@91cefbc`, không có trong `develop`.

## 3. Thứ tự công việc đề xuất tiếp theo

1. **B0 — Chốt baseline:** G6/G8 Device `main@9d96df9`, Gateway `develop@c5862aa`. Đối chiếu source, runtime, package và các bài test trên Windows/Linux. Tạo ma trận claim → commit → test → trạng thái.
2. **R1 — Xử lý tài liệu stale:** checklist 001/002 và P5 003 có trạng thái lịch sử; đối chiếu accepted Device 1.0.11 với report 004 R0. Không sửa hay xóa dấu tích cũ để hợp thức hóa lời kể.
3. **B1 — Benchmark toàn tác vụ:** A = agent + native tools; B = capability mới. Cố định fixture, revision, client/model, giới hạn; có cả trường hợp known-file/no-search và interrupted/resumed; đo đúng/sai, tool calls, token thực thấy, byte, thời gian, tái sử dụng; mọi fail tính vào mẫu.
4. **S1 — Khóa hợp đồng 1.0.12:** API, owner/repo identity, freshness/generation, cursor/byte/scope, source provenance, quyền và rollback.
5. **P2 — Retrieval/router:** định vị đúng thứ cần đọc, không truy vấn kho khi đã biết câu trả lời.
6. **P3 — Static code graph (có điều kiện):** chỉ nếu B1 cho thấy hữu ích; TypeScript compiler đã pin và provenance rõ, không suy diễn dynamic calls.
7. **P4 — Wiki dẫn xuất (có điều kiện):** không dựng tự động hoặc gọi provider ẩn khi đọc; không bổ sung nếu không chứng minh được lợi ích.
8. **P5 — Tích hợp và independent review:** đúng behavior, quotas, native tool parity, Windows/Linux, model-visible context và non-regression; chỉ sau đó mới xét release.
9. **005 Experience Memory:** final metadata review, quyết định lưu trữ, curation/skill approval, acquisition→reuse→invalidation A/B. Không tự merge.
10. **Gateway Context:** là task **độc lập**, chỉ triển khai từ Gateway develop nếu được ủy quyền sau này; bắt buộc giữ nguyên UI/auth/pairing và test E2E.

## 4. Những gate không được đánh tráo

- **SOC/approval:** `docs/context.md` ghi rõ public Context/capture cần approval và xác nhận custody. Thiết bị báo `context_version=1` không vượt gate.
- **Source thực tế:** P5 `specs/003-context-nextgen/plan-p5-readiness.md` từng ghi baseline T062 BLOCKED trên commit `dea0b5b`; `specs/004-context-v112/baseline.md` sửa giả định này và dẫn accepted 1.0.11. Cả hai giữ nguyên như bằng chứng theo thời điểm; bản code official v1.0.11 không làm 1.0.12 tự hoàn tất.
- **Review:** 005 vẫn FINDINGS/final-review-pending, không báo PASS vì spec đã sửa.
- **An toàn Context:** SQLite device-local chưa mã hóa; redaction có giới hạn, owner scope tuyệt đối, không tự chuyển corpus lên Gateway hay NMem.
- **Không giảm yêu cầu để tiết kiệm:** có thể ưu tiên code hiện có nhưng không hy sinh correctness, parity hoặc bảo mật chỉ để giảm số dòng/token.
