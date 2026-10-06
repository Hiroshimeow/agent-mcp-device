# Phase 8 catalog rollout

## Observed client behavior

Command: `node --test test/context/catalog-rollout.test.js` (included in `phase8-targeted.log`).

Two actual `@modelcontextprotocol/sdk` Client instances connect to Server instances using the SDK InMemoryTransport. First registration returns six schemas. After `notifications/tools/list_changed`, a fresh `tools/list` returns the same six names/schemas without duplicates. A separately registered replacement client returns an identical catalog. Removing the approval artifact causes subsequent tools/list to fail closed and device capabilities to omit all local_* tools.

This measures SDK refresh/re-registration, not a simulated object cache. It does **not** establish behavior of Claude/ChatGPT/Pi UI account caches or demonstrate a production deployment. No authenticated representative external client accounts were supplied to this isolated worktree. Their refresh/reinstall behavior remains a live-rollout verification prerequisite; do not assume reinstall is required or sufficient.

## Registration and routing contract

`contextToolCatalog()` is the explicit custom-tool registration seam, protected on every call by `executePublicGateway`. `callContextTool()` uses the same pinned boundary and checks read/write lane, owned online device, context version 1, and tool capability before forwarding. Older devices return DEVICE_UNSUPPORTED; no gateway Store/search or fallback exists. Production approval remains necessary: test approvals use throwaway Ed25519 keys redirected only inside isolated tests.

Device hello (both protocols) advertises context_version=1 and local_* capabilities only while approved. Reconnection re-evaluates capability advertisement. Existing legacy capabilities are unchanged. Revocation blocks the next call immediately, even before the next catalog refresh/reconnection.

## Schema measurement (UTF-8 bytes / 4)

| Tool | Bytes | Estimated tokens | Lane |
|---|---:|---:|---|
| local_status | 510 | 127.5 | read |
| local_search | 862 | 215.5 | read |
| local_read | 887 | 221.75 | read |
| local_graph | 1104 | 276 | read |
| local_index | 737 | 184.25 | write |
| local_wiki | 368 | 92 | read |

Full JSON array including separators/brackets: 4,475 bytes, 1,118.75 estimated tokens; below 10,000. All tools are non-destructive and closed-world; only local_index is non-read-only/non-idempotent. Wiki status returns WIKI_DISABLED with zero device/provider calls.

T050 finalizes optional local_read ranges as `{ref,start,end?}` UTF-8 byte offsets, authenticated cursor-bound and aggregate-budgeted. Unknown inputs/actions are rejected. Foreground-only device adapter explicitly rejects unsupported orchestration options (`budget_profile`, `idempotency_key`) rather than silently pretending to implement them; graph cursors are rejected because the current domain graph has no continuation implementation. Trusted project lookup is an adapter seam and fails closed when no approved mapping is supplied.
