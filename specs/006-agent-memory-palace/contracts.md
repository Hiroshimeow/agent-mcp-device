# Interface and lifecycle contracts — proposed, NOT implemented

Every interface below is a candidate for P0/P1 freezing and must preserve v1.0.11 authorization/semantics. These are contracts, **not executable source**, CLI commands or a public MCP catalog commitment.

## 1. Shared identity and provenance

Names are conceptual, NOT new required public MCP flags.

| Attribute | Meaning / invariant |
| --- | --- |
| `owner_key` | Authenticated per-owner tenant (not supplied freely in query) |
| `origin_device` | Device producing tool/session evidence |
| `repo_lineage` | Canonical namespace for a Git project, linked via verified remote/identity; cannot be an arbitrary user-entered path alias |
| `repo_instance` | Host-specific clone/worktree identity; preserved even if lineage matches |
| `repo_revision` | Observed Git revision/fingerprint or `unknown` |
| `session_ref` | Trusted session from agent hook; if missing, generated scoped synthetic ref with `lineage=unknown` |
| `turn_ref` | Turn identity if client provides it; may be unknown; not derived from adjacent timestamps |
| `task_ref` | Separate task/goal ID provided by supported caller, can span sessions |
| `invocation_ref` | Stable event/tool-call identifier with import-source & epoch |
| `evidence_ref` | Authenticated pointer to redacted immutable source and optional bounded byte range |
| `generation` | Published index/wiki/skill version with source manifest and stale state |

**Rules:** Two clones with same Git remote are not automatically the same authorized raw evidence location. A shared Palace entry can **recommend** knowledge from another repo but cannot elevate raw ref permissions. Owner isolation applies before search/index/ref existence lookup.

## 2. Event envelope

Minimum event envelope (not a copy of transcript):

| Field | Status |
| --- | --- |
| `schema_version`, `event_id`, `event_kind` | required; kinds include session_begin/end, turn, tool_intent, tool_result, checkpoint, task_outcome, user_feedback |
| `owner_key`, `origin_device`, `source_adapter`, `repo_instance` | required and authenticated; no raw access token |
| `repo_lineage`, `repo_revision` | optional/unknown with explicit coverage |
| `session_ref`, `turn_ref`, `task_ref`, `invocation_ref`, `parent_invocation_ref` | nullable and coverage-labeled, not silently synthesized as verified links |
| `tool_name`, `status`, `duration_ms`, `timestamp` | typed; status includes pending, succeeded, failed, cancelled, unknown, partial |
| `input_evidence_ref`, `output_evidence_ref`, `error_signature` | optional; only redacted/authorized bounded originals |
| `content_digest`, `idempotency_key`, `import_cursor` | dedupe/replay; crash-resumable |
| `outcome_authority` | observed command exit, test artifact, agent-reported, user-confirmed or not-observed |

Do not claim `task_success` from `tool_status=succeeded`. A failing test may coexist with a successfully executed test command. Keep explicit negative attempts.

### Capture/import invariants

- Durable intent and outcome may arrive separately; failed outcome retention remains `unknown` until proven, not retried as a shell action.
- All queue/process budgets bounded. Crash recovers imports idempotently by `source+event_id`; no duplicate graph edges/wiki summary because of replay.
- No transcript is gathered from clients without a supported authorized adapter. An agent that has only tool metadata gets a `partial_capture` marker.
- A redacted/truncated payload must store `coverage=partial`; do not fill missing bytes by a hallucinated summary.

## 3. Search: location first, details only on demand

### Locate request

Inputs: `query`, `scope` (current repo / same-owner cross-repo), optional tool/status/error/path/time/kind filters, `limit`, `max_response_bytes`, `cursor`.

Output: bounded cards with `ref`, `kind` (session/tool/error/wiki/skill), `title`, `one_line_preview`, `source_scope`, `timestamp`, `generation`, `freshness`, `top_evidence_ref` and reason for rank.

Errors: `SCOPE_REQUIRED`, `ACCESS_DENIED`, `INDEX_MISSING`, `STALE`, `PARTIAL`, `BUDGET_EXCEEDED`. Never fall back to an unscoped global search on denial.

Default behavior:
1. Find a relevant **locator**, not body. FTS5/keyword/path/error/status first.
2. Read selected refs/ranges, aggregate-bounded. No need to run graph for every search.
3. Stop when evidence sufficient. If query is known-file/current-source, use native tool and skip Palace.

### Read request

Inputs: one or more `refs`, optional byte/time window, `max_bytes`, `cursor` and **authorized source instance**.

Output: exact redacted evidence or wiki excerpt, hash/source/revision, gaps and freshness; no substitution of current code for historical text.

## 4. Activity graph from tool/session logs only

Allowed conceptual entities:
`Owner`, `RepoInstance`, `Session`, `Turn`, `Task`, `ToolInvocation`, `Tool`, `File`, `Process`, `Error`, `TestResult`, `Revision`, `WikiPage`, `SkillVersion`.

Edges (provenance required):
- session `contains` turn; turn `invoked` tool call; tool call `returned` result/error.
- tool `read`/`modified` file only if tool input or explicit result supports this.
- invocation `observed_failure`/`observed_pass` test result only when a test artifact ties them together.
- task `reported_completed` when explicit task-end signal; **different** from verified test pass.
- wiki `derived_from` evidence; skill `learned_from` wiki/evidence; skill `supersedes` previous skill version.
- `nearby_in_time` may be supported as an **unproven association** but never rendered as causal.
- Cross-repo `related_to` is **ranked semantic suggestion**, not a proven code dependency.

Graph read has action (`neighbors`, `path`, `timeline`), `max_hops`, `max_nodes`, `max_edges`, `max_bytes`, `wall_ms` and `cursor`. Return `evidence_class=observed|reported|inferred` and refs, not huge JSON/graph dumps. Expose graph/administration **via CLI and lazy skill** first.

## 5. Wiki Palace adapter

Backend-independent actions:
- `upsert_source(evidence_manifest)` — source-index only; idempotent.
- `digest(changed_session_refs, budget)` — end-of-task/idle LLM summary, not per-tool call.
- `locate(query, owner_scope, budget)` — compact wiki page refs.
- `read_page(page_ref, range, budget)` — source-linked excerpt and revision/stale state.
- `mark_contradicted(page_claim, new_evidence_ref)` — never silently rewrite source history.
- `sync_owner_space(changed_generations)` — authorized knowledge across machines; deleted/denied refs remain denied.
- `health/generation` — safe local state and last-good status.

A Wiki page has `page_id`, `topic`, `scope`, `claims[]` with refs, `applicability`, `source_manifest_hash`, `revision`, `freshness`, `contradictions[]`, `last_updated`. The backend owns wiki algorithms/storage; our adapter must not duplicate them.

One writer per workspace/generation; publish atomically. Optional backend vector semantics must be measured, not assumed.

## 6. Skill library and automatic curator

Each **agent-owned skill** has:
`skill_id`, `semantic_tags`, `short_description`, `version`, `body_ref`, optional scripts/resources, `preconditions`, `verification`, `known_failures`, `evidence_refs`, `status`, `owner_scope`, `digest`.

- `catalog` exposes **small metadata only**, `load_skill(name, version?)` gets body only on selection.
- `learn` creates a candidate; machine checks publish to active without asking user.
- `consolidate` merges agent-owned duplicates, keeps runnable resources/ref links and archives absorbed versions.
- `archive` inactive skill; `restore` reads snapshot or retained version.
- `rollback` atomically restores previous active skill snapshot and marks failed run.
- `scheduler` uses a bounded once-per-interval policy, last successful input digest, distributed single writer, max calls/tokens/time, cancellation, log of merge decisions.
- Never overwrite **bundled/user-authored/pinned** skills. Never interpret a wiki page or memory as an instruction to bypass existing shell or filesystem permission checks.
- “Merge skills” here means **catalog/content consolidation**, not Git branch merges or code deployment.

## 7. CLI and MCP policy

Proposed CLI UX for engineering design only (commands below are illustrative, **NOT available in v1.0.11**):

```text
palace search "timeout reconnect" --scope my-knowledge --limit 5 --json
palace read <ref> --max-bytes 8192 --json
palace graph neighbors <ref> --hops 2 --json
palace wiki status --json
palace skills list --compact --json
palace skills merge --scheduled --budget-profile idle --json
```

Until a CLI implementation is authorized, existing `mcp-device context search/read/graph` remain the real supported commands for local historical evidence. Do not advertise the proposed commands in live MCP `tools/list`. If one minimal MCP facade becomes necessary, freeze typed schema and apply Gateway owner/device authorization identically to CLI.

## 8. Versioning, privacy, compatibility

- v1.0.11 `local_status/search/read/graph/index/wiki` calls and scopes retain their exact existing semantics. Proposed cross-repo Palace cannot reinterpret them silently.
- No transient page/content credential embedded in Wiki/skills or emitted to unauthorized models/providers.
- Retrieval indexed across owner's repos never grants access to raw evidence of a different account or source device.
- Deletion/retention must include source and derived wiki/skill refs, with tombstones and index purge semantics; backups have policy.
- Explicit unavailability and stale generation preferred over hidden sync/LLM call.
