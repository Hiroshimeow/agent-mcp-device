# Retrieval Router Contract — P2

Status: proposed P2 contract for independent review. No product implementation is authorized by this document.

## 1. Purpose

Provide a token-small first step that tells an agent which evidence authority is available without querying every store or returning source/history/wiki bodies.

P2 freezes only retrieval/router behavior. Code-graph extraction belongs P3; wiki generation belongs P4.

## 2. Backward compatibility

All valid 002 calls remain valid with unchanged semantics.

In particular:
- `local_search` with no new navigation field remains the 002 history/checkpoint/activity search contract;
- existing `source_types=history|checkpoint|activity` meanings do not change;
- existing `local_graph` actions remain activity/provenance semantics;
- historical refs remain historical refs;
- `local_read` remains retained historical evidence only.

P2 adds no public MCP tool name and does not add code values to 002 `source_types`.

### Capability gate

Progressive navigation is advertised by a named device capability:
`progressive-retrieval-v1`.

The only P2 input extension is an optional `local_search.view`:
- omitted or `results`: exact 002 behavior;
- `navigate`: P2 compact branch-card behavior.

A gateway MUST NOT forward `view=navigate` to a device that does not advertise `progressive-retrieval-v1`. It returns typed `DEVICE_UNSUPPORTED` or `ACTION_UNSUPPORTED`; it must not strip the field and accidentally execute legacy search.

Clients with a cached 002 schema continue to use 002 calls. They are not required to discover P2 until their catalog/schema refreshes.

Local CLI parity for a P2-capable binary is `context search --view navigate`. Older binaries need not accept the flag.

G-SCHEMA must record the additive field, capability advertisement, old-device behavior, per-tool schema delta and total catalog estimate.

## 3. Logical stages

### NAVIGATE

Entry: `local_search(view=navigate, query=...)`.

NAVIGATE returns compact branch metadata only. It MUST NOT:
- return source snippets/bodies;
- return historical evidence bodies;
- return wiki page bodies;
- call NMem;
- invoke a wiki/model provider;
- execute code/history/wiki searches behind the scenes;
- rebuild/sync/index;
- hydrate source;
- fan out to all stores.

It may read bounded published status metadata needed to report branch availability/freshness.

Maximum branch kinds owned by ContextService:
- `history`;
- `code`;
- `flow`;
- `impact`;
- `wiki`.

`memory` is NOT a ContextService branch and MUST NOT be proxied by `local_search`. Agent policy may independently choose the existing NMem surface when the task asks for durable preferences/rules/decisions.

### EXPAND

There is no generic new public EXPAND tool in P2.

Expansion is authority-specific:
- history: existing `local_search(view=results)` and activity `local_graph`;
- code/flow/impact: future P3 code-graph contract using existing public surface only if compatibility review accepts it;
- wiki: future P4 `local_wiki`;
- memory: separate NMem surface, outside ContextService.

This prevents one mixed endpoint from becoming a mandatory mega-query.

### HYDRATE

Hydration is also authority-specific:
- retained historical evidence -> `local_read`;
- current source -> guarded filesystem hydration contract below;
- wiki body -> P4 `local_wiki` read semantics;
- NMem -> separate NMem response.

No authority may impersonate another. In particular, `local_read` never fetches current source.

## 4. NAVIGATE response

The response uses the common 002 scope/index/coverage envelope plus:

```json
{
  "view": "navigate",
  "router_version": 1,
  "branches": [
    {
      "kind": "history",
      "status": "available",
      "authority": "observed_evidence",
      "freshness": "current",
      "expand_with": "local_search",
      "reasons": []
    }
  ]
}
```

Allowed `status`:
`available|stale|missing|disabled|unsupported`.

Allowed `authority`:
`observed_evidence|derived_current_code|derived_wiki`.

`expand_with` is a tool name hint only; it does not contain full argument objects or execute a call.

Branch cards may add bounded generation/coverage identifiers but no snippets, ranked hits, source bodies, history bodies, prompts or generated prose.

A disabled or not-yet-implemented P3/P4 branch is reported honestly rather than omitted in a way that implies current coverage.

## 5. Agent routing policy

The portable context skill should take the shortest path that answers the task.

- exact known file/range or trivial single-file task: use existing file read directly; NAVIGATE is optional and normally skipped;
- historical question: history path first;
- structural symbol/reference/flow/impact question: code/flow/impact path only when P3 capability is available;
- human architecture/feature explanation: wiki may be chosen when available, but current source/raw evidence is required for claims that need current authority;
- durable user/project decision/preference/rule: separate NMem may be appropriate;
- ordinary code discovery MUST NOT auto-call NMem, wiki or history just because they exist.

No default route queries every branch.

## 6. Repo-map decision

P2 does not create a `repo_map` tool or top-level branch.

Aider-style compact orientation is retained as a candidate representation inside the future `code` EXPAND path. P3 may define an orientation result if it demonstrates value within token/correctness gates.

## 7. Guarded current-source hydration invariant

P2 does not choose the transport mechanism, but every accepted current-source hydration path MUST enforce:

1. unambiguous repository/worktree binding;
2. expected source revision/content fingerprint from the selected code ref/generation;
3. path authorization through existing filesystem guards;
4. range accepted as corresponding evidence only if the fingerprint/revision guard matches;
5. changed/moved/deleted/mismatched source returns typed stale/ref-mismatch behavior;
6. no silent fallback from a stale graph range to same line numbers in newer content.

P3 must make code refs strong enough to satisfy this invariant.

The preferred implementation remains an additive guard on existing bounded `read_file` or an equivalent opaque locally-resolved source ref. A duplicate public source-read tool requires benchmark/compatibility evidence that guarded reuse is insufficient.

## 8. Failure and freshness

NAVIGATE does not turn stale into current.

If a branch has a last-good generation but current refresh failed:
- `status=stale`;
- generation/revision/freshness metadata remains visible;
- expansion must retain the same stale marker.

Missing/unsupported branches are not errors for NAVIGATE as a whole; they are branch-card states. Scope/auth/access errors remain typed operation errors.

## 9. Token and schema constraints

NAVIGATE is a compact control response, not content retrieval.

Acceptance is governed by the benchmark contract:
- p95 <=1500 estimated agent-context tokens;
- no full bodies;
- no hidden branch execution.

Schema growth is separately governed by G-SCHEMA. If the additive `view` field/capability metadata causes an unacceptable catalog delta, P2 must revise the shape before implementation rather than merging read/write tools or adding a new tool.

## 10. P2 contract tests required before implementation acceptance

- omitted `view` is byte/semantic-compatible with accepted 002 fixture behavior except allowed nondeterministic metadata;
- old device + `view=navigate` -> typed unsupported before dispatch;
- cached 002 client continues legacy call successfully;
- navigate returns only branch cards and common envelope;
- navigate performs zero branch-body queries, zero sync/rebuild, zero provider calls and zero NMem calls;
- disabled code/wiki branches are honest;
- local CLI/MCP domain parity for navigate;
- scope/auth/ref isolation remains 002-equivalent;
- NAVIGATE token gate passes benchmark;
- guarded hydration mismatch cases are represented in contract fixtures but implementation completion depends on P3 provenance contract.
