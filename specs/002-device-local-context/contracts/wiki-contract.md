# Manual Wiki Contract — DEFERRED INPUT FOR FEATURE 003

**Not an implementation contract for feature 002.** Feature 002 only reserves `local_wiki` disabled/status semantics. Provider generation, upstream reuse, egress, cost and publishing rules below are retained as review input for a future `003-manual-repo-wiki` Spec Kit cycle.

**Scope**: Wiki chủ yếu để human đọc. Core retrieval ưu tiên nguồn evidence/code graph, không phụ thuộc wiki. Tắt mặc định; user phải yêu cầu generate/update.

## 1. Upstream reuse gate

Ứng viên ưu tiên là phần phù hợp của `microsoft/llmwiki` core; không import nguyên watcher/self-maintaining extension. Trước code cần ghi commit/version, LICENSE/NOTICE, files/API được reuse, dependency graph, Node compatibility và tests. Không giả định package TypeScript là drop-in với Node >=18 hoặc endpoint provider tùy ý.

`FSoft-AI4Code/CodeWiki` là alternative cho repo documentation nếu core không phù hợp; phải kiểm tra license/code/dependency riêng trước reuse. Không cài cả hai hoặc tạo framework LLM mới chỉ để lấy vài ý tưởng. G-WIKI có quyền hoãn helper mà không chặn core context.

## 2. Trigger và egress

Chỉ explicit user request cho generate/update mới tạo job; agent không coi routine sync/checkpoint/idle như request. Trước chạy, resolve repository/worktree, scope topics, source manifest, provider profile và budget đã cấu hình.

Chỉ gửi nguồn trong manifest tới endpoint allowlist được owner cấu hình. Không gửi secret, `.env`, credential store, toàn bộ home hoặc repo khác. Không cho wiki model gọi arbitrary tools/commands. API key không nằm trong tool args/log/wiki. Local storage không đồng nghĩa provider xử lý local; UI/response phải nói rõ outbound provider.

## 3. Source manifest và coverage

Mỗi source có ref/path tương đối, revision/content hash, range, source kind và capture completeness. Input có thể gồm code snapshots hiện tại đã được phép đọc, typed graph và selected history. Tool-call history mỏng không đủ để khẳng định mô tả trọn kiến trúc repo.

Trước generate có coverage summary: số file/module đã có nguồn, ngôn ngữ/parser hỗ trợ, missing areas và source age. Nếu cần đọc thêm source để viết wiki, phải nằm trong scope request và budget; không tải repo/private remote khác ngầm.

## 4. Chất lượng tối thiểu

Wiki scaffold theo nhu cầu repo, không template rỗng chung chung:
- Overview/phạm vi và cách các thành phần tương tác.
- Module pages với trách nhiệm, entrypoints, data/control flows và source refs.
- Testing/build/deployment chỉ khi có nguồn cụ thể; command lịch sử không mặc nhiên là hướng dẫn mới nhất.
- Work-history riêng với timestamp/revision, không trộn vào mô tả code hiện tại.
- Known gaps/uncertainty và links tới bằng chứng.

Bản publish phải qua kiểm tra: source refs tồn tại, không có link nội bộ gãy, heading/module coverage hợp manifest, không placeholder, không secret marker, không đưa claim “verified” khi chỉ có reported summary. Mermaid/diagram nếu có cần syntax validation; diagram không là bằng chứng độc lập.

## 5. Revision và cập nhật

Job lưu staged output và content hashes. Sau validate mới đổi pointer last-good. Provider timeout/rate-limit/trả rỗng/không đủ nguồn không được ghi đè wiki cũ. Source đổi giữa generate và publish -> stale/conflict, không tự gọi thêm model vô hạn.

Human edits có user-overrides hoặc optimistic hash check; mặc định giữ thay đổi của người đọc. User quyết định overwrite/merge khi conflict. Search wiki dùng published revision và ghi `derived=true`, source refs/age; không biến text wiki thành observed facts.

## 6. Cost contract

Estimate trước run công bố model/profile, số source/chunk/page, input/output-token budget, retries cap, deadline/concurrency và local artifact quota. Nếu tokenizer hoặc provider pricing không biết, báo estimated/unknown, không in một con số USD giả.

Usage sau run: input/output/cached/reasoning tokens nếu API trả được; chỉ suy chi phí từ đơn giá người dùng cấu hình và đúng loại usage. Ghi số attempts/failed pages/cost-known flag. Tách network/model latency khỏi DB/index time. Không bill hoặc gọi endpoint trong bước `estimate`, `status`, `list`, `read`, `lint`.

## 7. Failure/cancel/export

Cancel chỉ dừng wiki job, không kill user workload. Retry pages bị lỗi trong giới hạn request đã duyệt; sau restart interrupted job chờ lệnh user, không auto-run.

Export tới folder được chọn rõ, qua path guard; canonical wiki vẫn ở device context store. Không tự viết vào docs/ hoặc `.mcp-device` bên trong repo khi user chỉ yêu cầu tạo wiki local. Purge source có thể invalidate/delete dependent wiki theo policy; không để source đã xóa sống lại qua wiki cache.

## 8. Acceptance tests

Disabled core path có 0 provider calls; generate cần request/permission; endpoint-secret không lộ; cross-repo manifest denied; source-change conflict; user-edit conflict; empty result giữ last-good; budget stop; interrupted-no-auto-resume; cost-unknown honest; lint nguồn/link; derived result không xuất hiện lại như captured event.
