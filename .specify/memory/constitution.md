<!--
Sync Impact Report
2.1.0-proposed -> 2.2.0-proposed.
Clarify capture durability/degraded gaps, unscoped evidence, local sandbox/re-pair behavior,
and distinguish stale-selection tokens from actual human approval. Move Wiki implementation
to a separate feature while preserving manual-only policy and reserved tool contract.
No amendment to sibling 1.0.10 worktree; no ratification or implementation approval inferred.
-->
# MCP Device Constitution — đề xuất bổ sung Local Context

**Version**: 2.2.0-proposed  
**Status**: PROPOSED / UNRATIFIED  
**Last Amended**: 2026-10-04  
**Ratified**: Chưa được chủ dự án phê chuẩn.

Đây là constitution proposal của feature `002-device-local-context`. Nó không thay thế constitution đang review ở 1.0.10. Snapshot nguồn và manifest phải được giữ để reconcile sau handoff; không được ghi đè lịch sử review.

## Core Principles

### I. Compatibility and Security Before Change
So sánh với baseline được ghim. Không âm thầm đổi schema, error, authorization, platform support, Node floor hoặc tool behavior. Bỏ self-MCP hop phải đi qua migration/equivalence gate của 1.0.10; feature context không dựng dispatcher thứ hai. Attribution/license bắt buộc của code upstream phải được giữ.

### II. Evidence and Distinct Decision Classes
Phân biệt user requirement, source observation, design decision và hypothesis cần đo. Correctness, architecture simplification và performance có acceptance riêng. Không biến microbenchmark hoặc số quảng cáo thành SLA; NOT_MEASURED/failed/degraded phải hiển thị.

### III. Aggregate Boundedness and Observable Failure
Runtime, context DB, payload, cursor, graph traversal, jobs và adapters đều phải có finite bounds. Không retry side effect vì recorder/delivery fail. Nếu capture không persist được trong bounded time, existing tool behavior được ưu tiên và coverage gap phải observable; không được gọi gap đó là captured evidence.

### IV. Windows and Linux Acceptance
Windows và Linux đều là target bắt buộc. Path/Unicode/locking/SQLite/CLI/MCP/process cleanup phải có evidence trên cả hai. macOS chỉ được công bố sau test riêng.

### V. Independent Reconciliation and Gates
Pin candidate/evidence identity trước integration. Material change của dispatcher/process/resource contract invalidates dependent context evidence. Reviewer độc lập phải khác author. Không gắn live capture/gateway route vào vùng 1.0.10 chưa handoff.

### VI. One Canonical Behavior, Multiple Adapters
CLI local và MCP remote gọi cùng ContextService/domain behavior. Adapter chỉ map schema/auth/context. Không memory server, LLM broker hoặc gateway loopback cho local CLI. New abstraction phải có concrete need.

### VII. Device-Owned, Repository-Scoped Evidence
Content nằm dưới device state root, partition theo owner namespace và local repository identity. Gateway không persist corpus. Query phải authorize owner/repo trước lookup ref/cursor/job. Same origin không đủ merge clone.

Event không resolve được repo vẫn có thể để lại owner-scoped **minimal coverage metadata**, nhưng không được index payload vào repo bất kỳ. Active paired owner namespace là default cho CLI/skill/MCP; namespace cũ sau re-pair bị sealed khỏi automatic search. Local OS user là trust boundary, không phải sandbox bypass.

### VIII. Preserve Evidence; Derive Structure Conservatively
Committed tool event/payload là evidence; FTS/activity graph là derived/rebuildable. Checkpoint summary của agent là `reported`, không phải observed tool trace. Không suy causal/fixes/decision từ temporal adjacency. Redaction/exclusion xảy ra trước persistence; raw secret không được cất trong hidden blob.

### IX. Capture Automatically; Enrich Cooperatively
Observer cố persist intent trước dispatch và outcome sau dispatch; committed intent không có outcome sau restart là `unknown_after_restart`. Recorder failure không được gây replay side effect. Graph/index sync không chạy mỗi tool, idle, startup hoặc implicit sau search. Agent có thể chủ động gọi bounded incremental sync; rebuild chỉ thay derived state.

Search/read/status/graph không hidden-write hay provider call. Full source-code parser graph không phải requirement của first increment.

### X. Human Approval, Admin, Wiki and Portable Guidance
Preview/confirmation token chỉ chống stale selection; nó **không chứng minh human consent**. Destructive owner administration như purge/namespace adoption/relink không nằm trong agent MCP surface của feature 002. Nếu có local admin CLI, nó phải dùng explicit owner-controlled workflow và audit content-free.

Wiki human-readable vẫn manual/opt-in nhưng provider generation được tách sang feature 003. Feature 002 chỉ reserve `local_wiki` disabled/status contract để tránh catalog churn; no provider call. Portable skill hướng dẫn public CLI/MCP, không đọc SQL/transcript/credentials, không tự cài và không fallback từ permission denial sang đường yếu hơn.

## Development and Acceptance Workflow

002 có thể tiến store/redaction/repository resolver/FTS/search/read/CLI/checkpoint/activity fixtures độc lập. Live observer capture, process correlation, shared budgets và gateway mapping chờ 1.0.10 handoff. Trước implementation phải khóa runtime floor/SQLite choice, retention/quota, tool schema và durability ordering. Sau implementation phải có adversarial isolation, crash/concurrency, Windows/Linux, CLI/MCP parity và correctness-checked benchmark.

## Governance

Constitution version độc lập product version. Ratification cần human approval + ngày thực; proposal date không phải ratification date. Material amendments cần rationale, compatibility/migration/rollback và reviewer. Session command như “documentation only” thuộc run report, không thành vĩnh viễn trừ khi được ratify.
