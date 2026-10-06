# US1 retrieval acceptance

Generated from the frozen corpus by `node --test test/context/acceptance.test.js` with `CONTEXT_RECORD_ACCEPTANCE=1`.

Runtime: Node 22.22.2; SQLite 3.51.2; win32/x64.

Exact path/identifier top-3: 100%. History Recall@8: 1.0000. Unauthorized hits: 0.

Negative queries include secret, cross-repository and sealed-owner canaries. Sealed-owner access explicitly returns ACCESS_DENIED.

## Raw query outcomes

```json
{
  "outcomes": [
    {
      "kind": "exact",
      "query": "src/context/store.ts",
      "expected": [
        "store"
      ],
      "returned": [
        "store",
        "redact",
        "index",
        "build"
      ],
      "recall": 1
    },
    {
      "kind": "exact",
      "query": "ContextStore",
      "expected": [
        "store"
      ],
      "returned": [
        "store"
      ],
      "recall": 1
    },
    {
      "kind": "exact",
      "query": "src/context/indexer.ts",
      "expected": [
        "index"
      ],
      "returned": [
        "index",
        "redact",
        "store",
        "build"
      ],
      "recall": 1
    },
    {
      "kind": "exact",
      "query": "validateCursor",
      "expected": [
        "cursor"
      ],
      "returned": [
        "cursor"
      ],
      "recall": 1
    },
    {
      "kind": "exact",
      "query": "readEvidence",
      "expected": [
        "read"
      ],
      "returned": [
        "read"
      ],
      "recall": 1
    },
    {
      "kind": "exact",
      "query": "importLegacy",
      "expected": [
        "import"
      ],
      "returned": [
        "import"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "tìm lịch sử nhập JSONL giữ tệp gốc",
      "expected": [
        "import"
      ],
      "returned": [
        "import",
        "read"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "làm sao cập nhật chỉ mục không quét mã nguồn",
      "expected": [
        "index"
      ],
      "returned": [
        "index",
        "jobs",
        "permission",
        "import",
        "store"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "quyền truy cập bị từ chối khi ghép nối mới",
      "expected": [
        "permission"
      ],
      "returned": [
        "permission",
        "busy",
        "read",
        "index",
        "store",
        "redact",
        "cursor"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "con trỏ hết hạn thay đổi thế hệ",
      "expected": [
        "cursor"
      ],
      "returned": [
        "cursor",
        "index",
        "noise1",
        "read",
        "busy"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "che bí mật trước lưu trữ",
      "expected": [
        "redact"
      ],
      "returned": [
        "redact",
        "store",
        "busy",
        "permission"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "Tiếng Việt UTF-8 tổng số byte",
      "expected": [
        "read"
      ],
      "returned": [
        "read",
        "import",
        "store"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "giao dịch ghi bị khóa",
      "expected": [
        "busy"
      ],
      "returned": [
        "busy",
        "build",
        "import",
        "redact",
        "permission"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "kiểm tra quyền chủ sở hữu SQLite",
      "expected": [
        "store"
      ],
      "returned": [
        "store",
        "import",
        "read",
        "build",
        "permission",
        "busy"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "CURSOR_STALE",
      "expected": [
        "cursor"
      ],
      "returned": [
        "cursor"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "ACCESS_DENIED",
      "expected": [
        "permission"
      ],
      "returned": [
        "permission"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "SQLITE_BUSY",
      "expected": [
        "busy"
      ],
      "returned": [
        "busy"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "npm run build",
      "expected": [
        "build"
      ],
      "returned": [
        "build"
      ],
      "recall": 1
    },
    {
      "kind": "history",
      "query": "node --test test/context/*.test.js",
      "expected": [
        "build"
      ],
      "returned": [
        "build",
        "redact",
        "index",
        "store"
      ],
      "recall": 1
    },
    {
      "kind": "negative",
      "query": "nonexistent_unicorn_57291",
      "expected": [],
      "returned": [],
      "recall": 1
    },
    {
      "kind": "negative",
      "query": "GROUND_TRUTH_SECRET_CANARY",
      "expected": [],
      "returned": [],
      "recall": 1
    },
    {
      "kind": "negative",
      "query": "CROSS_REPO_CANARY",
      "expected": [],
      "returned": [],
      "recall": 1
    },
    {
      "kind": "negative",
      "query": "SEALED_OWNER_CANARY",
      "expected": [],
      "returned": [],
      "recall": 1
    }
  ],
  "exact_top3": 1,
  "history_recall8": 1,
  "unauthorized_hits": 0
}
```

No provider, source-file scan, or source-code parser is used. Database/WAL bytes are unchanged by search/read; SQLite may update reader bookkeeping in SHM, which is not durable content.
