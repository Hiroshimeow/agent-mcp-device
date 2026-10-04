# Data Model — revision 2 proposal

**Related**: [spec](spec.md), [plan](plan.md), [API](contracts/context-api.md).

## 1. Storage layout

```text
<device-state-root>/context/
  registry.sqlite
  owners/<owner-key>/
    unscoped.sqlite
    repos/<opaque-repo-key>/
      context.sqlite
      blobs/<content-address>
```

`<device-state-root>` follows existing config (`MCP_DEVICE_CONFIG_DIR` or default state root). Caller never supplies DB path. `owner-key` and `repo-key` are opaque local identifiers.

`registry.sqlite` stores only store/namespace metadata and content-free admin tombstones. Evidence bodies live in owner/repo stores. `unscoped.sqlite` stores only minimal capture coverage records when one repo cannot be resolved; it never stores searchable args/result payload.

No context content is stored on gateway.

## 2. Registry entities

### OwnerNamespace
Fields: `owner_key`, trusted pairing identity hashes, `created_at`, `status=active|sealed`, `last_seen`.

Invariants:
- not caller-supplied;
- no bearer token;
- one active default namespace per current pairing;
- previous namespace after re-pair becomes sealed from MCP/skill/default CLI.

### Repository
Fields: `repo_uuid`, `owner_key`, `store_key`, display metadata, `created_at`, `last_seen`, `schema_version`, `status`.

Invariants:
- local random UUID;
- origin/root commit are hints, not authority;
- same-origin clones remain separate unless explicit owner-admin migration outside agent MCP;
- repo-store count subject to policy quota.

### Worktree
Fields: `worktree_uuid`, `repo_uuid`, `canonical_root`, `git_common_dir`, observed HEAD/branch, `last_verified_at`, resolution kind.

Two worktrees may share repository history while current source metadata stays distinct.

## 3. Capture entities

### ToolEvent
Fields:

`event_id`, `schema_version`, `owner_key`, `repo_uuid?`, `worktree_uuid?`, `scope_status`, `invocation_id`, `request_correlation`, `runtime_generation`, `public_tool`, `accepted_at`, `started_at?`, `completed_at?`, `execution_status`, `recording_status`, `transport_status?`, sanitized args metadata, outcome metadata, `payload_ref?`, observed Git revision, provenance.

`execution_status`: `accepted|running|succeeded|failed|cancelled|unknown_after_restart`.

`recording_status`: `committed|degraded|gap`.

`transport_status` is intentionally weak: at most `handed_to_adapter|handed_to_gateway|unknown`; device does not claim final client consumption.

Lifecycle:
1. insert intent row before dispatch when recorder healthy;
2. dispatch exactly once;
3. update same row with result/error;
4. committed intent with no outcome after restart => `unknown_after_restart`.

Uniqueness uses canonical invocation/attempt identity, not command hash/timestamp. Recorder retry updates same event; intentional repeated command creates separate event.

### CaptureGap
Owner/repo-resolved health record when durable intent could not be committed before dispatch.

Fields: `gap_id`, owner, repo/worktree if known, public tool, timestamp, reason code, request correlation if safe, `execution_was_allowed=true|false|unknown`.

No args/result body. Best-effort gap persistence itself may fail under total disk failure; metrics must not claim absolute losslessness.

### UnscopedEvent
Stored in owner `unscoped.sqlite`.

Fields: event id/time/tool, scope reason (`outside_repo|ambiguous_multi_repo|repo_resolution_failed`), recording/execution status, safe request correlation.

No payload ref, normalized args body, FTS document or graph node in repo stores.

### EvidencePayload
Fields: `payload_id`, content hash, media/encoding, captured bytes, original bytes known?, compression, `redaction_state`, `retention_state`, expiry?, source ranges, created_at.

Blob hash is over retained bytes **after** redaction/exclusion. No hidden raw-secret copy. Dedup only inside same owner/repo scope.

`retention_state`: `available|partial|expired|purged|capture_failed|redacted`.

### ProcessReference
References canonical process identity handed off by 1.0.10: execution UUID/runtime generation plus optional PID. Output ranges/chunks reference source ToolEvent/Payload; duplicated polling range does not duplicate corpus bytes.

## 4. Checkpoint

Fields: `checkpoint_id`, repo/worktree, timestamp, observed HEAD/branch/status digest/changed paths, optional `reported_summary`, reported claims, evidence refs.

Git metadata read by CLI is `observed`. Agent statement like “tests passed” without captured evidence is `reported`. Checkpoint does not fabricate native command/test events.

## 5. Derived indexing

### IndexGeneration
Fields: `generation_id`, repo/worktree?, schema/extractor version, `indexed_through_event`, source manifest hash, coverage, started/published timestamps, status, error.

Ordinary `sync` does **not** full-copy FTS/graph per generation. It incrementally updates derived rows and advances a published watermark.

`rebuild` alone creates shadow derived tables/state, validates, then atomically switches active generation pointer. Interrupted rebuild leaves previous published generation.

### SearchDocument / FTS
Fields: document id, source ref/kind, normalized searchable text, path/identifier tokens, timestamp, revision/worktree, first/last indexed generation, coverage.

FTS remains per repo. Display/evidence text is not replaced by normalized tokens. Query compiler escapes/validates FTS input; caller cannot send raw SQL.

### ActivityNode
Kinds for first increment:
`event|file|process|command|test_run|error_signature|checkpoint`.

Fields: node id, stable key, label, repo/worktree, source ref, revision?, evidence class, status.

Evidence class: `observed|parsed|reported`. No `inferred_by_llm`.

### ActivityEdge / EdgeEvidence
Allowed relations initially:
`read_from|edit_succeeded|write_succeeded|attempted|started_process|observed_output|mentions|recorded_in|checkpoint_of`.

No `caused_by|fixes|implements_decision` from temporal proximity. Every edge has evidence refs.

Source-code symbol/call graph is deferred; schema may later add node kinds without changing evidence-class rules.

## 6. Cursor and refs

### EvidenceRef
Random opaque identity. Ref lookup happens only after owner/repo authorization. Ref itself never grants access.

### Cursor
Authenticated token or equivalent server-side opaque state binding:
`owner_key`, `repo_uuid`, active generation, normalized query hash/filter hash, position, expiry.

Tampered/stale/wrong-scope cursor => typed error. Compaction cannot invalidate a still-valid cursor silently; either preserve referenced generation until cursor TTL or return explicit stale after documented expiry.

## 7. MaintenanceJob

Actions in 002: `sync|checkpoint|rebuild|cancel`.

Fields: job id, owner/repo/worktree, action, request origin/idempotency key, state, lease owner/expiry, source generation, budget profile, progress, cancel flag, error, timestamps.

Rules:
- at most one modifying index job per repo;
- capture has priority;
- no parse/source IO under DB write transaction;
- no automatic startup/idle resume;
- offline CLI does bounded foreground maintenance only; if it exceeds offline budget, return typed limit instead of hidden persistent worker.

## 8. Redaction model

Persistable representation is produced before Store:
- safe scalar metadata;
- redacted/omitted sensitive values;
- bounded retained payload;
- redaction reasons/counts;
- opt-out/path exclusion state.

FTS and graph only see persistable representation. Tests seed canary secrets and assert absence across DB/blob/FTS/errors/export surfaces.

## 9. Lifecycle and migration

1. Fresh install: registry only; repo store created on first eligible resolved evidence/sync, subject to quota.
2. Legacy import: source-preserving/idempotent; malformed and unknown-owner records reported/quarantined.
3. Sync: consume pending committed events -> update FTS/activity rows -> validate -> advance watermark.
4. Rebuild: rebuild derived state from retained evidence -> validate shadow -> atomic pointer switch.
5. Re-pair: old owner sealed; new owner active; no automatic reassociation.
6. Purge/namespace migration: local owner-admin workflow outside MCP 002; content-free tombstone may remain in registry.
7. Downgrade: unsupported schema fails explicitly; never create empty replacement DB.

SQLite synchronous mode, busy timeout, quotas/retention and exact admin UX are policy values fixed before real-data enablement. Secure erase across SSD/backups is not claimed.
