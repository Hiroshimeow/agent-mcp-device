[Reading 133 lines from start (total: 133 lines, 0 remaining)]

Review vòng 2 — 002-device-local-context (revision 2)

Phạm vi đã nhận: 11 file, file nào cũng đủ, không bị cắt. Còn thiếu các file sau: quickstart.md r2, checklists/*, run-report.md, wiki-contract.md, manifest/snapshot 001 và kết quả validator. Vì vậy tôi không kiểm chứng được ba điểm:

tasks có tham chiếu đúng Q1–Q9 của quickstart hay không;
con số 25 task [P];
nhận định A2-01 rằng hash snapshot còn khớp.
sharepoint
1. Verdict

READY_FOR_IMPLEMENTATION

Kết luận này chỉ áp dụng cho lane độc lập: Phase 1–4, Phase 5 dùng fake observer, và Phase 6. Live capture, process và gateway (T045–T056) vẫn bị gate bởi G-110. Ranh giới giữa hai lane đã được đặc tả đủ rõ.

2. Unresolved Critical/High blockers

None.

3. Disposition các finding vòng 1
Finding	Kết luận	Căn cứ
C1 human confirmation	PASS	Constitution X và D-13 nêu rõ token không phải consent. FR-022 đưa purge/relink/adoption ra khỏi MCP. API §7 bỏ confirm=true và chỉ giữ local_index ở 4 action. Skill contract cấm gọi admin destructive. rebuild chỉ thay derived state (FR-029), nên không cần human gate.
sharepoint
+ 3

C2 thứ tự capture	PASS, còn một chỗ mơ hồ ở mức Medium (N1)	Plan §A các bước 1–7, FR-002/003, data model ToolEvent và CaptureGap, policy 5 ms/10 ms. Thời điểm unknown_after_restart và lượng coverage có thể thiếu khi lỗi đều đã định nghĩa. SC-001 giới hạn trong trường hợp store khỏe. Plan nói rõ power-loss được tách khỏi process-crash.
sharepoint
+ 2

C3 event không có scope	PASS	FR-001, owners/<k>/unscoped.sqlite, entity UnscopedEvent không có payload/FTS/node, và repo search không bao giờ truy vấn store này (plan §C).
sharepoint

H1 redaction	PASS	T009 (test) và T011 (redact.ts) chạy trước T012 store. FR-004, data model §8. T036 quét cả WAL. Còn thiếu redaction cho importer (N5).
sharepoint

H2 sandbox/WAL	PASS	FR-012 định nghĩa LOCAL_STATE_UNAVAILABLE/ACCESS_DENIED. Skill contract cấm fallback. T024 có test. Nên bổ sung case thư mục đọc được nhưng không ghi được: WAL vẫn cần ghi -shm. Đây là việc làm rõ test, không phải blocker.
H3 namespace sau re-pair	PASS	FR-021, entity OwnerNamespace có active/sealed, D-11, test T008. Hệ quả về bounds và quyền truy cập dữ liệu sealed nằm ở N3.

Các điểm Medium vòng 1:

Điểm	Kết luận
Tách annotation	PASS. Đã có local_status riêng; local_index không còn action destructive.
transport_status	PASS. Chỉ còn handed_to_adapter/gateway/unknown.
Generation/watermark	PASS. Sync thường cập nhật incremental; chỉ rebuild mới dùng shadow. Còn một chỗ cần nói rõ (N4).
Cursor	PASS về binding. Thiếu đặc tả quản lý HMAC key (N6).
Quota số repo-store	PASS. Mặc định 256, vượt thì rơi vào unscoped.
Admin audit	PASS. Tombstone trong registry đã đặc tả; flow dùng nó sẽ làm sau.
Writer contention	PASS một phần (N2).
Kích thước schema	PASS. Mục tiêu ≤10k token, đo ở T003/T050.
Handoff 1.0.10	PASS. Thêm 2 field (exclusion hook, pre/post hook point) và có stop rules.
4. Vấn đề mới trong revision 2 (đều ở mức Medium)

N1 — Nhánh thiếu intent chưa được nêu đủ. FR-003 viết "execution có thể tiếp tục" mà không nói ai quyết. Policy cần chốt fail-open cho 002. Ngoài ra, khi pre-intent fail mà outcome sau đó ghi được, spec chưa nói sẽ insert muộn với recording_status=degraded hay chỉ giữ gap record. Nếu chính gap record cũng không ghi được, cần có bộ đếm trong RAM hiển thị qua local_status.

N2 — Thiếu giới hạn thời gian giữ write lock của maintenance. Policy mới giới hạn thời gian chờ lấy lock (100 ms), chưa giới hạn thời gian giữ lock. SQLite không có cơ chế ưu tiên writer. "Capture priority" chỉ thực hiện được khi sync commit theo batch nhỏ, mỗi batch giữ lock ngắn hơn hẳn budget 5 ms của capture. Nếu không, mỗi lần sync sẽ sinh capture gap hàng loạt. Cũng cần nói rõ khi daemon online, sync chạy ở đâu: DatabaseSync trên main thread sẽ chặn heartbeat. Cần thêm hai con số vào context-policy.md: thời gian giữ write tối đa mỗi batch, và bước yield cho event loop. Đây là giá trị có thể tinh chỉnh khi implement, và T033 sẽ đo.
sharepoint

N3 — Dữ liệu tăng không có giới hạn và không có cách gỡ được hỗ trợ. 002 không có TTL, không có purge, và namespace sealed không truy cập được. Quota 8 GiB chỉ tính cho active owner. Hệ quả:

Tổng dung lượng trên device không bị chặn, trái với Constitution III.
Repo chạm mức 2 GiB sẽ degrade vĩnh viễn.
Secret lọt qua redaction không có đường xóa chính thức.

Cần thêm quota tổng cho cả device (gồm namespace sealed) và một trong hai thứ sau: CLI admin tối thiểu (chạy local, có TTY, không qua MCP) hoặc quy trình xóa thủ công đã được test, kèm khôi phục registry. Phải xong trước T047 (bật capture thật), không chặn lane độc lập.

N4 — Visibility của cursor khi sync cập nhật tại chỗ. Cursor pin generation G, nhưng sync incremental sửa row tại chỗ. Query phải lọc theo first/last_indexed_generation ≤ G, nếu không trang sau có thể thấy dữ liệu của G+1. Chi tiết này nên ghi vào API §4 và thêm test vào T034.

N5 — MVP dựa trên import mâu thuẫn với rule quarantine. JSONL cũ gần như chắc chắn không có owner, nên FR-020 sẽ quarantine toàn bộ. Như vậy câu "useful repo history … on imported evidence" trong tasks (MVP và checkpoint Phase 3) không đúng: corpus thật trước G-110 chỉ còn checkpoint. Có hai cách: thêm bước admin local chủ động gán legacy cho active namespace, hoặc sửa lại claim. T016 cũng cần thêm canary secret, vì importer phải đi qua redact.ts.
sharepoint

N6 — Chưa đặc tả HMAC key của cursor. Cần nói key nằm ở đâu (state root, quyền theo OS user), có xoay khi re-pair không, và key dùng chung cho CLI và MCP để giữ parity.

N7 — Annotation của local_wiki reserved. Tool được gắn "open-world/write" nhưng 002 không làm gì. Tool sẽ chiếm schema token và có thể khiến client hỏi quyền vô ích. Xem mục 8.

5. Ranh giới với 1.0.10

Lane độc lập implement được ngay sau T001/T004/T005/T006: redact, registry/resolver, store và migration, ref/cursor, importer, FTS/search/read/status, CLI qua seam tách biệt, checkpoint, activity graph, nội dung skill, và test crash dùng fake observer (T031–T035).

Vẫn bị gate:

T045–T049: observer thật, process correlation, gỡ recorder cũ.
T050–T056: gateway và catalog.
Đăng ký CLI vào entrypoint chung nếu 001 đang sửa cùng file.
Benchmark combined.

Phải chạy lại sau handoff: field của observer, exclusion hook, process field, chính sách busy/resource dùng chung, độ trễ capture, parity và schema.

Các nội dung trên đã nhất quán giữa integration-110, plan và tasks.
sharepoint

6. Đánh giá task plan
Thiếu:
Test chứng minh unscoped store không chứa payload và không bị search (bổ sung vào T021/T036).
Runtime test cho stub local_wiki: 0 provider call, trả WIKI_DISABLED. Hiện FR-030 chỉ map sang T006/T050/T060.
Quản lý HMAC key (bổ sung vào T010).
Bounds giữ lock (N2), thêm vào T005 và T033.
Sửa:
T004 phải test đúng mức sàn 22.13.x. Fleet hiện chạy ≥22.22, nên chưa có bằng chứng cho mức sàn.
T016 thêm redaction.
T024 thêm case đọc được nhưng không ghi được.
T023 hoặc mô tả MVP sửa theo N5.
Đúng chỗ, không cần đổi: T002 chỉ chặn Phase 7–8. T049 nằm sau G-110. T059 (đổi Node floor) để ở nhánh sau 1.0.10.
Trùng lặp/sớm: không thấy task trùng. T014 làm status trước indexer T020 là chấp nhận được, miễn status trả INDEX_MISSING.
7. Node/SQLite/policy

Node ≥22.13 + node:sqlite: chấp nhận được. Bằng chứng gồm fleet 8/8 máy và probe FTS5 trên cả Windows/Linux, và quyết định được tách khỏi 1.0.10. Còn ba rủi ro, đều có thể xử lý trong T004:

Node 22 vẫn in ExperimentalWarning ra stderr. CLI --json phải giữ stdout sạch, test nên assert điểm này.
API là synchronous (N2).
Nếu dùng option timeout của constructor để đặt busy timeout, cần xác minh option đó có từ phiên bản nào. PRAGMA busy_timeout là cách chắc chắn chạy được ở mọi phiên bản.

Không có điểm nào ở trên là blocker cho contract.

Các con số trong policy: đều là giá trị có thể tinh chỉnh khi implement, trong một contract đã có giới hạn. Ví dụ: 5/10/100 ms, 32 KiB/256 KiB, graph 2/50/500/200/25 ms, 4 MiB/event, Recall@8 ≥0.90. Riêng synchronous=NORMAL vẫn được, vì contract chỉ hứa an toàn khi process crash, không hứa khi mất điện. Lỗ hổng duy nhất mang tính cấu trúc là N3 (thiếu quota tổng cho device và đường xóa), nhưng nó chỉ chặn việc bật capture thật.

8. Tool schema

Sáu tên tool và cách tách read/write đều đúng. Về reserve local_wiki ngay bây giờ: lợi ích thực tế thấp. A2-04 tự thừa nhận 003 nhiều khả năng vẫn phải đổi schema. Annotation open-world/write cũng sẽ phải đổi theo, nên client vẫn cần refresh catalog. Không phải blocker. Tôi khuyến nghị một trong hai:

(a) Giữ tool, nhưng schema tối giản chỉ có action: "status" và annotation readOnly đúng với hành vi của 002. Chấp nhận rằng 003 sẽ là một lần refresh có kiểm soát.
(b) Bỏ khỏi catalog của 002.

Owner chọn. Nếu không có quyết định, mặc định là (a).

9. Thay đổi bắt buộc trước implementation

None. Các điểm N1–N7 nên được ghi vào T001/T005 (decision register và policy). Riêng N3 phải đóng trước T047.

10. Khuyến nghị cuối

Có thể cho phép implement lane độc lập (T001–T044) ngay khi owner ký T001. Khi chốt T005, ghi thêm vào policy: thời gian giữ lock theo batch và cách sync yield cho event loop (N2), quota tổng device (N3), và nhánh fail-open (N1). Không bắt đầu T045+ khi chưa có handoff G-110 và chưa đóng N3. Analysis r2 kết luận "no Critical/High", và lần này tôi đồng ý, nhưng 7 điểm Medium ở trên chưa có trong analysis đó.
sharepoint

ソース