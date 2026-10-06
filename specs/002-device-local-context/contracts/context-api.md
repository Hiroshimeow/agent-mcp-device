# Context API Contract — revision 2

**Status**: Proposed for implementation-readiness review. No tool is deployed by this document.

## 1. Common rules

Remote MCP requires authenticated device routing plus repo scope (`cwd` or approved `project_id`). Local CLI resolves `--cwd .` on the current host and never accepts `device_id`, DB path or arbitrary account id.

Scope authorization happens before ref/cursor/job lookup. `cwd`/project_id helps resolution but does not grant filesystem permission.

All adapters return the same domain envelope:

```json
{
  "schema_version": 1,
  "ok": true,
  "scope": {"repository_ref": "r-opaque", "worktree_ref": "w-opaque"},
  "index": {
    "generation": "g-opaque",
    "indexed_through_event": "e-opaque",
    "freshness": "current|stale|missing|unknown",
    "pending_events": 0
  },
  "coverage": {"complete": true, "reasons": []},
  "items": [],
  "partial": false,
  "next_cursor": null,
  "warnings": []
}
```

No response exposes owner key, state-root path, DB path, secret or raw registry metadata.

Typed errors include:
`DEVICE_UNSUPPORTED`, `DEVICE_OFFLINE`, `SCOPE_REQUIRED`, `SCOPE_AMBIGUOUS`, `ACCESS_DENIED`, `LOCAL_STATE_UNAVAILABLE`, `REPOSITORY_NOT_FOUND`, `INDEX_MISSING`, `INDEX_INCOMPATIBLE`, `REF_NOT_FOUND`, `EVIDENCE_EXPIRED`, `CURSOR_INVALID`, `CURSOR_STALE`, `BUSY`, `BUDGET_EXCEEDED`, `STORAGE_DEGRADED`, `ACTION_UNSUPPORTED`, `WIKI_DISABLED`.

Read-side partial results may be `ok=true, partial=true` only with a reason and continuation/coverage metadata.

## 2. Stable tool names and permissions

| MCP tool | Local CLI | Semantics |
| --- | --- | --- |
| `local_status` | `context status` | read-only/idempotent; bounded freshness/status inspection only |
| `local_search` | `context search` | read-only/idempotent; no hidden sync/provider call |
| `local_read` | `context read` | read-only/idempotent; evidence bytes only |
| `local_graph` | `context graph` | read-only/idempotent; activity graph only in 002 |
| `local_index` | `context sync/checkpoint/rebuild/cancel` | write; no provider, no destructive owner administration |
| `local_wiki` | reserved | open-world/write category reserved; 002 returns disabled/status contract only |

`purge`, namespace adoption/relink, backup/export convenience are **not** MCP actions in 002. If a local admin CLI is added later it is owner-controlled and not part of the portable agent skill.

This split intentionally avoids putting a read-only `status` action under a destructive mixed-action tool.

## 3. `local_status`

Input:
- remote: device_id + scope;
- local: cwd/project selection;
- optional `check_current` boolean and `job_id`.

`check_current` may perform bounded metadata checks (repo existence/head/hash hints) but must not parse/index/write.

Output:
- storage availability;
- active owner namespace status only;
- repository/worktree refs;
- active generation/indexed-through event/pending count;
- current/stale/missing/unknown freshness;
- capture health/gap counters;
- active index job summary;
- feature flags including `wiki_enabled=false` in 002.

If state root cannot be opened locally because of sandbox/permissions, CLI returns `LOCAL_STATE_UNAVAILABLE` or `ACCESS_DENIED`; the skill must not suggest remote fallback to bypass that denial.

## 4. `local_search`

Input:
- query non-empty;
- source_types subset `history|checkpoint|activity`;
- optional since/until;
- bounded `limit`, `max_bytes`, `cursor`, `include_related`.

No `llm`, `auto_sync`, raw FTS syntax or arbitrary SQL.

Pipeline:
existing published generation → exact/path/identifier candidates → FTS5 candidates → bounded activity expansion → deterministic rerank/dedup → snippets/refs.

Hit fields:
`ref`, source/evidence class, timestamp, label, snippet, relative location if safe, revision/worktree, match_reason, related_refs?, rank_score?.

`rank_score` is ranking only, never probability/confidence.

Cursor is authenticated or server-side opaque state binding owner/repo/generation/query/filter/position/expiry. Tampered/wrong-scope cursor is rejected before query.

## 5. `local_read`

Input:
- bounded refs array;
- optional per-ref range/cursor;
- aggregate `max_bytes`.

Output per input ref, preserving order:
`ref`, source_kind, evidence_class, content, retained-content hash, captured range, total bytes known?, retention/redaction state, truncated, next cursor, per-ref error?.

It reads retained evidence only. It does not fetch current source to impersonate historical data.

## 6. `local_graph`

Actions in 002:
`neighbors`, `path`, `timeline`, `related`.

Inputs:
seed refs, optional target, relation filters/direction, bounded max_hops/nodes/edges/bytes/wall-time/cursor.

Traversal must cap frontier, visited nodes and examined edges *during* search. Response includes `visited_nodes`, `examined_edges`, `returned_nodes`, `truncated_by`.

Graph is activity/provenance graph only. `related` means relation reachable in current coverage, not causal similarity. No source-code parser is required in 002.

## 7. `local_index`

Allowed actions:

| Action | Semantics |
| --- | --- |
| `sync` | Incrementally materialize pending event FTS/activity relations within budget. No source-code full scan by default. |
| `checkpoint` | Record observed Git metadata + optional reported summary/evidence refs. |
| `rebuild` | Rebuild **derived** FTS/activity state from retained evidence into shadow generation then publish. Does not delete source events/blobs. |
| `cancel` | Request cancellation of scoped index job. Does not kill user work process. |

Common inputs:
scope, `budget_profile`, optional paths/source selection where supported, `idempotency_key`.

Outputs:
job ref/state or immediate bounded completion; source/target generation; progress; coverage; retryability.

When daemon is offline, CLI may run bounded foreground sync/checkpoint/rebuild. If projected/actual work exceeds offline budget, return `BUDGET_EXCEEDED`/typed offline-maintenance limit. Do not spawn hidden persistent worker.

No `confirm=true` is treated as human approval because 002 has no destructive MCP admin action.

## 8. `local_wiki` reserved contract in 002

Purpose: reserve one public name during catalog rollout, per user preference to avoid repeated client registration.

002 behavior:
- `status` may report `enabled=false`, `implementation_feature="003-manual-repo-wiki"`.
- All generation/read/export/provider actions return `WIKI_DISABLED` or `ACTION_UNSUPPORTED`.
- No wiki library/provider config is loaded.
- No network/provider call occurs from startup/status/search/sync.

Actual action/schema enabling for generation is governed by feature 003; if 003 requires incompatible schema change, G-SCHEMA must surface that rather than silently expanding behavior.

## 9. Local CLI examples

```text
mcp-device context status --cwd . --json
mcp-device context search --cwd . --query "gateway reconnect" --json
mcp-device context read --cwd . --ref event-opaque --json
mcp-device context graph --cwd . --action neighbors --ref event-opaque --json
mcp-device context sync --cwd . --json
mcp-device context checkpoint --cwd . --summary "Refactor complete; test claim is reported unless evidence refs are supplied" --json
mcp-device context rebuild --cwd . --json
```

CLI write operations never call gateway. CLI read/search/status require local state access. Technical logs go stderr and are redacted.

## 10. Capture health contract

Context result metadata/status distinguishes:
- `capture_healthy`;
- committed pending events;
- counted `capture_gap`;
- committed intent with `unknown_after_restart`;
- redacted/expired payload.

No contract says every invocation is lossless under disk/DB failure. In healthy-store acceptance fixtures, exactly one event identity per supported invocation is required.

## 11. Catalog/rollout

Device advertises context capability/version. Gateway forwards only when supported; old device returns `DEVICE_UNSUPPORTED`, never server fallback.

Feature 002 does not remove project_list/NMem/external broker. Catalog refresh behavior is measured on representative clients before rollout.

G-SCHEMA records:
- total tool count;
- total schema bytes/token estimate;
- per-tool schema size;
- annotations/risk lane;
- old-device behavior.

Target total schema estimate: <=10,000 tokens unless owner explicitly approves a larger stable manifest.

## 12. Required contract tests

- all six names/actions/errors/annotations;
- CLI/MCP parity;
- no hidden write/provider call from read tools;
- wrong owner/repo/ref/cursor/tamper denied;
- local sandbox denial typed/no bypass;
- re-pair active namespace only;
- old-device unsupported/no server fallback;
- response/cursor byte budgets/Unicode;
- index cancel/idempotency;
- rebuild source-event invariance;
- no `local_*` self-ingestion;
- capture gap/unknown-after-restart semantics;
- gateway content marker absence;
- schema-size measurement.
