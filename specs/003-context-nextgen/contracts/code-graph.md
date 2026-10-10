# Deterministic Code-Graph Contract — P3

Status: proposed P3 contract for independent review. No product implementation is authorized.

## 1. Authority and scope

The code graph is deterministic **derived current-source state**.

Authority order:
1. current source under filesystem authorization;
2. deterministic code graph with exact extractor/generation provenance;
3. generated wiki.

The activity/history graph remains separate authority. Code graph facts never prove historical causality.

P3 v1 semantic support is limited to TypeScript/JavaScript files included by a supported compiler project. Unsupported languages remain explicit coverage gaps.

## 2. Storage boundary

Reuse the existing owner/repository device-local context store. Do not add a graph database.

Derived code tables are logically separate from:
- source events/blobs;
- FTS/history index;
- activity nodes/edges;
- wiki generations.

Code graph persists only compact structural facts/metadata required for navigation:
- file identity/path;
- symbol metadata;
- relation edges;
- source-span/proof metadata;
- analyzer/generation/coverage state.

It MUST NOT persist:
- full source bodies;
- comments/JSDoc by default;
- string/default-value bodies merely for search;
- node_modules source recursively;
- model-generated summaries.

Raw source may be parsed in memory, but only persistence-safe/minimized facts cross into Store. Existing path exclusions/redaction policy applies before derived facts are persisted.

Source-change fingerprints use an owner/repo-scoped keyed digest or equivalent opaque fingerprint, reusing existing context-secret/integrity material where feasible. Do not expose a raw content digest as an access token.

## 3. Analyzer identity

Initial analyzer:
- id: `typescript-compiler`;
- implementation target: product-owned pinned TypeScript **5.9.3**;
- supported project config: `tsconfig.json|jsconfig.json`;
- supported source extensions: compiler-included `.ts|.tsx|.js|.jsx`.

Extractor output records analyzer id/version and config hash.

The product MUST NOT silently load an arbitrary target repository's TypeScript package as the authoritative analyzer.

Compiler/analyzer upgrade is a graph schema/extractor change requiring:
- fixture rerun;
- generation rebuild or explicit compatibility proof;
- support-matrix review.

## 4. Analyzer unit

An analyzer unit is one resolved compiler project configuration plus its included repo-local source files.

Each unit records:
- opaque analyzer-unit ref;
- config path/ref;
- compiler options/config hash;
- root/source file manifest;
- project-reference metadata if present;
- analyzer id/version;
- coverage/degradation reasons.

P3 v1 does not invent a monorepo meta-graph. Multiple compiler projects are independent units bridged only by statically resolved repo-local import/reference edges when proven.

### Analyzer I/O boundary

The analyzer MUST use a bounded CompilerHost/config/module-resolution wrapper rather than unrestricted filesystem reads.

Every analyzer read is authorized **after canonical path plus symlink/junction resolution**.

Allowed read classes:
- selected repository/worktree source and config files that pass existing filesystem authorization;
- product-owned pinned TypeScript standard-library files;
- dependency declaration/config inputs required for semantic resolution only inside explicitly authorized dependency roots for the selected analyzer unit.

Disallowed by default:
- arbitrary absolute/parent-relative paths outside authorized roots;
- symlink/junction escapes;
- external config `extends` or project references outside authorized roots;
- `baseUrl`/`paths`/`rootDirs`/`typeRoots` targets outside authorized roots unless explicitly authorized for the unit.

When a required config/dependency input is blocked:
- do not silently broaden filesystem authority;
- mark the affected analyzer unit/file coverage partial/unsupported with a typed reason;
- omit any semantic fact that depends on the blocked input unless it can still be independently proven.

Authorized external dependency declarations used only for resolution:
- never become traversable repo-local nodes/edges;
- never expose external source text through persisted signature/label fields;
- remain provenance/coverage inputs only.

Required authorization fixtures:
- external tsconfig `extends`;
- external `paths` target;
- external project reference;
- symlink/junction escape;
- allowed `node_modules/@types` declaration resolution;
- Windows/POSIX canonicalization.

No new parser or sandbox framework is required; a bounded CompilerHost/resolution wrapper is the intended minimal mechanism.

## 5. Node model

### CodeFile

Fields:
- opaque `file_ref`;
- repo/worktree scope;
- analyzer unit;
- relative path;
- language;
- source fingerprint;
- generation;
- coverage state.

### CodeSymbol

Fields:
- opaque `code_ref`;
- symbol kind;
- name/qualified name when deterministic;
- owning file;
- declaration span ref;
- export visibility metadata;
- compact sanitized signature/label when available;
- generation;
- extractor/proof metadata.

Initial symbol kinds may include:
`function|class|interface|method|property|variable|type_alias|enum|namespace|constructor|other_supported`.

Unknown syntax is not coerced into a known kind.

### SourceSpanRef

Opaque, scope- and generation-bound ref resolving internally to:
- file ref;
- source fingerprint;
- byte/range location;
- analyzer unit/generation;
- proof site kind.

Ref lookup is authorized after owner/repo/worktree scope resolution. A ref never grants filesystem access.

## 6. Edge model

Every edge has:
- kind;
- from/to refs;
- generation;
- `proof=syntactic|semantic`;
- one or more source-span evidence refs;
- extractor id/version.

Allowed P3 v1 proven relations:
- `contains`;
- `imports`;
- `exports`;
- `reexports`;
- `references`;
- `calls`;
- `constructs`;
- `extends`;
- `implements`.

### Canonical endpoint and direction schema

Edge direction is observable contract. Implementations MUST emit the same logical orientation.

| Relation | Allowed source | Allowed target | Canonical direction | Logical-edge identity | Reverse impact |
| --- | --- | --- | --- | --- | --- |
| `contains` | `CodeFile` | `CodeSymbol` | container file -> declared symbol | one edge per file/symbol pair | no |
| `imports` | `CodeFile` | `CodeFile` | importing/dependent file -> imported local file | one edge per file/file pair + relation kind | yes |
| `exports` | `CodeFile` | `CodeSymbol` | exporting file -> exported local symbol | one edge per file/symbol pair + relation kind | no |
| `reexports` | `CodeFile` | `CodeSymbol` | reexporting/dependent file -> reexported local symbol | one edge per file/symbol pair + relation kind | yes |
| `references` | `CodeSymbol` or `CodeFile` | `CodeSymbol` | owning dependent symbol/file -> referenced declaration symbol | one edge per source/target pair + relation kind | yes |
| `calls` | callable `CodeSymbol` or `CodeFile` for top-level call site | callable `CodeSymbol` | caller/dependent -> callee/dependency | one edge per source/target pair + relation kind | yes |
| `constructs` | `CodeSymbol` or `CodeFile` for top-level construct site | class `CodeSymbol` | constructing dependent -> constructed class/type | one edge per source/target pair + relation kind | yes |
| `extends` | class/interface `CodeSymbol` | base class/interface `CodeSymbol` | derived/dependent type -> base type | one edge per source/target pair + relation kind | yes |
| `implements` | class `CodeSymbol` | interface `CodeSymbol` | implementing/dependent class -> interface | one edge per source/target pair + relation kind | yes |

For `references`/`calls`/`constructs`, the source is the innermost repo-local owning symbol that contains the use site. If the use site is top-level and has no owning symbol, the source is the `CodeFile`. P3 v1 does not add a synthetic module-initializer node solely for top-level sites.

For `constructs`, the target is **always the repo-local class `CodeSymbol` representing the constructed type**. Do not target the constructor symbol and do not emit both class-target and constructor-target `constructs` edges for the same `new` expression. Constructor invocation detail may appear as evidence metadata or as a separate ordinary `calls` edge only when one exact constructor callable target is statically proven under the existing conservative call rules. If no exact repo-local class symbol resolves, omit the proven `constructs` edge.

For `reexports`, wildcard/named re-exports are normalized to the resolved repo-local exported symbol where resolution is exact. Unresolved/external targets do not produce a local proven reexport edge.

### Logical edges versus occurrences

Logical edge key:
`(generation, relation_kind, source_ref, target_ref)`.

Multiple source occurrences proving the same logical relation collapse to one logical edge with:
- `occurrence_count`;
- bounded evidence/source-span refs;
- truncation/continuation metadata when evidence exceeds the response/storage evidence cap.

Occurrence count is descriptive only; it does not change traversal weight unless a later reviewed ranking contract explicitly says so.

`contains`/`exports` normally have one declaration/export proof site but still follow the same logical-edge key.

### Traversal orientation

Dependency-style relations use **dependent/source -> dependency/target**. Therefore:
- forward traversal follows what the source depends on/uses;
- reverse traversal follows dependents/users;
- structural impact/blast-radius uses incoming/reverse traversal only on relations marked `Reverse impact=yes`;
- reverse-dependent invalidation uses the same incoming dependency orientation;
- `path` follows caller-requested direction over these canonical edges and MUST report direction/relation kinds in the result.

Rules:
- repo-local traversal targets only;
- unresolved/external dynamic target is not converted to a local proven edge;
- alias resolution must terminate at an exact local symbol before semantic relation is proven;
- `calls` requires one concrete local callable target with no dynamic-dispatch ambiguity;
- instance/interface/virtual/computed/reflection calls that may select multiple runtime targets are omitted from `calls`; they may still be ordinary `references` where symbol reference itself is proven;
- temporal proximity/activity history never creates a code edge.

## 7. Generation and current-source state

### CodeGeneration

Records:
- generation id;
- owner/repo/worktree;
- analyzer version/schema version;
- HEAD oid when available;
- keyed source-manifest id;
- config/dependency-resolution manifest id;
- included analyzer units;
- coverage;
- started/published/verified times;
- state `building|published|failed|cancelled`;
- last sync/rebuild outcome.

Published graph rows bind to a code generation.

Old generation data needed by still-valid cursors/refs follows the existing 002 cursor/generation retention contract in `specs/002-device-local-context/data-model.md §6 Cursor and refs` / FR-018; it is not silently invalidated mid-cursor.

### Freshness

Code responses expose code-specific:
- generation;
- source-state/manifest id;
- `freshness=current|stale|missing|unknown`;
- `verified_at`;
- freshness reason/basis;
- coverage/degradation.

The activity index generation is never used as code freshness.

`current` means current against the last explicit verified source-state check at `verified_at`, not a claim that unobserved external edits cannot happen afterward.

Known mutation after verification => stale.
Unable to verify cheaply => unknown.
Last-good after failed sync => stale with failure reason.

## 8. Sync/invalidation

Search/read/status never parse source or mutate the code graph.

Only explicit code `sync` or `rebuild` analyzes source.

### Incremental sync

Sync computes a source/config manifest, then identifies:
- added/changed/deleted files;
- import/export/API-shape changes;
- reverse dependents by incoming traversal over the canonical dependency-direction relations defined in §6;
- config/path-mapping/compiler/global declaration/dependency-resolution changes requiring wider invalidation;
- any authorized external declaration/config input whose bytes or resolution identity can affect semantic results.

Every authorized external resolution input that can influence semantic resolution contributes to the config/dependency-resolution manifest/freshness basis. A change to such an input cannot leave the code generation reported current without explicit revalidation.

Required behavior:
- changed file facts are replaced atomically in staged derived state;
- safely affected reverse dependents are revalidated;
- unrelated analyzer units are not rewritten;
- actual `parsed_files`, `revalidated_files`, `rewritten_files`, `fallback_full_units` and reasons are reported.

If narrow invalidation cannot be proven sound, full reanalysis of the affected analyzer unit is allowed and MUST be reported. Publishing a knowingly incomplete narrow delta is forbidden.

### Rebuild

Rebuild creates shadow code-derived state for selected analyzer units and publishes only after validation.

Failure/cancel:
- last-good generation remains active;
- staged partial graph is not query-visible;
- coverage/freshness exposes stale/failure honestly;
- no automatic retry loop.

No startup/idle/read/search/NAVIGATE path triggers compiler analysis.

## 9. Public search contract

Capability: `code-graph-v1` inside the existing context capability/version channel.

Extend `local_search` with optional `branch=code`.

Compatibility:
- branch omitted = exact 002/P2 legacy history behavior;
- `view=navigate` requires branch omitted; it reports code branch availability only;
- `view=results, branch=code` performs code lookup;
- history-only fields such as `source_types` and time filters are rejected as incompatible with code branch rather than silently reinterpreted;
- unsupported device is rejected before dispatch.

Code query semantics are deterministic lexical navigation, not semantic LLM search:
1. exact relative path/name/qualified-name;
2. exact exported identifier;
3. prefix/normalized lexical match;
4. bounded substring/DB lexical fallback if needed.

No embedding/model/provider call.

Result item:
- `code_ref`;
- symbol/file kind;
- name/qualified name;
- relative path;
- declaration/source-span ref + safe display range;
- compact sanitized signature/label when available;
- match reason/rank score;
- generation/freshness/coverage.

No source body/snippet is returned by default.

Cursor binds owner/repo/worktree + code generation + query/filter/position/expiry.

## 10. Public graph contract

Extend `local_graph` with optional `graph_kind=code`.

Compatibility:
- omitted = exact 002 activity graph behavior;
- code supports existing `neighbors` and `path`;
- activity-only `timeline|related` with `graph_kind=code` returns typed unsupported;
- code cursor/generation is distinct from activity cursor/generation.

Existing traversal bounds remain safety ceilings, not automatically optimal defaults.

### Impact

No new action.

Impact/blast-radius is bounded **incoming/reverse** `neighbors` traversal over caller-selected canonical dependency relations marked reverse-impact-capable:
`imports|reexports|references|calls|constructs|extends|implements`.

`contains` and `exports` are structural ownership/public-surface relations and are not impact relations in P3 v1.

Response language is **structural candidate impact**, never guaranteed runtime breakage/causality. Response metadata includes traversal direction and relation kinds so clients cannot infer orientation implicitly.

### Trace

No new action.

Trace is bounded `path` over canonical proven code relations. The caller selects forward or reverse direction; the response echoes the direction and relation filter. It is a structural dependency/call path, not an execution trace.

Results include visited/examined counts and truncation reason as in 002 graph discipline.

## 11. Explicit code indexing contract

Extend `local_index` with optional `index_kind=code` for:
- `sync`;
- `rebuild`.

Omitted index kind preserves exact 002 behavior.

`checkpoint` remains history semantics.
`cancel` cancels by scoped job identity.

Index response includes:
- source/target code generation;
- analyzer units;
- parsed/revalidated/rewritten counts;
- fallback-full-unit count/reasons;
- coverage;
- wall/resource accounting where available.

No source analysis occurs under a long SQLite write transaction.

## 12. Status/NAVIGATE contract

P3-capable `local_status` and P2 NAVIGATE may add:
- code capability/version;
- published code generation;
- analyzer support matrix summary;
- freshness/verified-at;
- analyzed/eligible/unsupported file counts;
- last code index job status.

These are additive response metadata. They do not trigger source scanning.

## 13. Guarded hydration

P3 supplies the provenance required by P2:
- source-span ref is bound to owner/repo/worktree;
- code generation;
- file identity;
- source fingerprint;
- exact range.

The final filesystem integration may use a guarded extension to existing `read_file` or an equivalent opaque ref resolution, but it MUST:
1. authorize path/scope;
2. resolve span ref;
3. verify current file fingerprint;
4. verify requested range is within/refines the bound span or explicitly requests a broader guarded file read;
5. return typed stale/source-changed outcome on mismatch;
6. never silently hydrate identical line numbers from changed content.

P3 does not create a duplicate source-read tool.

## 14. Activity bridges

Bridge storage is derived and separate from both graphs.

Allowed bridges:
- activity event -> file: exact scoped path/worktree resolution;
- event/edit -> symbol: only when event revision/content state exactly matches a code generation/span;
- checkpoint -> code generation: exact revision + source-state match;
- code node -> selected activity refs: only via those exact bridge records.

No automatic cross-graph traversal. Caller/agent chooses whether to switch authority.

## 15. Privacy/security

- same owner/repo/worktree authorization as 002;
- excluded paths never enter code graph;
- no gateway corpus persistence;
- no raw source body stored in graph;
- no comments/JSDoc/literal/default initializer indexing by default;
- compact signatures are sanitized through persistence policy;
- source fingerprints are opaque/keyed and scope-bound;
- every CompilerHost/config/module-resolution read is constrained by the analyzer I/O boundary after canonical path/symlink resolution;
- blocked external config/dependency inputs produce partial/unsupported coverage rather than broader filesystem authority;
- authorized external declarations/config inputs that affect resolution contribute to the dependency-resolution freshness manifest;
- authorized external declarations used for resolution do not become traversable local graph facts or leak source text;
- analyzer diagnostics/coverage/degradation reasons pass the same redaction policy as 002 errors/logs and MUST NOT expose blocked absolute paths, excluded values, credentials or raw external source text;
- no project-local analyzer package execution by default;
- analyzer failure cannot replay or affect user side-effecting work.

## 16. Acceptance

### Truth fixtures

Freeze support matrix before results.

Synthetic corpus:
- each declared supported construct has positive and ambiguous/negative fixtures;
- proven-edge precision = 100%;
- supported `contains/imports/exports/reexports/constructs/extends/implements` recall = 100%;
- supported `references/calls` recall >=95%;
- unsupported dynamic/ambiguous constructs emit zero false proven edge.

Real-repo labeled sample:
- this repo plus at least one second TS/JS project shape;
- proven precision = 100%;
- recall >=95% inside the frozen supported set;
- every declared supported relation has non-zero ground-truth cases or is NOT_MEASURED/non-PASS;
- unsupported/unknown rate is reported.

No relation may be removed from the support matrix after seeing results merely to make recall pass; support changes require a new fixture/version/review.

### Coverage

Report:
- eligible/analyzed/unsupported/degraded files;
- relation counts;
- unsupported/ambiguous counts;
- analyzer units/configs.

Empty/all-unsupported/NOT_MEASURED graph cannot PASS.

### Incremental behavior

Required fixture outcomes:
- query path analyzer invocations = 0;
- no-change sync rewrites 0 source facts;
- a **predeclared semantically-local** one-file change does not rewrite unrelated file facts and does not use full-unit fallback;
- an ambiguous/body-looking change whose locality cannot be proven is expected to widen safely and report fallback reason/counts;
- exported API change revalidates required reverse dependents without rewriting unrelated analyzer units;
- config/global declaration/compiler-version change may full-reanalyze affected unit and must report reason;
- failed/cancelled publication preserves last-good.

The semantically-local fixture is frozen before results and requires:
- unchanged analyzer/config/dependency-resolution inputs;
- no exported/public type-shape change;
- no global/module augmentation;
- no import/export/path/config change;
- no construct category declared by the analyzer as requiring wider invalidation.

Outside that fixture class, soundness wins: affected-unit fallback remains legal whenever narrow invalidation cannot be proven safe.

### Resources

Measure cold/full, no-change, one-file, API-change and forced-full-unit cases on Windows+Linux:
- wall time;
- CPU;
- peak RSS;
- IO;
- parsed/revalidated/rewritten counts;
- capture/query latency while explicit indexing runs.

Query path must remain compiler-free.

If in-process indexing materially violates existing capture/interactive acceptance (>20% comparable p95 regression), implementation must isolate/bound analyzer execution; no persistent hidden analyzer worker is allowed.

### Token/schema

P2 token/correctness gates continue to apply to code search/impact/trace tasks.

G-SCHEMA records additive `branch`, `graph_kind`, `index_kind` fields/capability metadata and old-device behavior. No new public tool is allowed merely to avoid schema design work.

## 17. Typed degraded behavior

Required typed outcomes include existing 002 errors plus code-specific reason/state sufficient to distinguish:
- analyzer unsupported;
- code index missing;
- code index stale;
- source changed since code ref;
- analyzer/config incompatible;
- budget exceeded/cancelled.

Exact error string additions must be frozen with the final P3/P5 schema fixture; they may not alias source-changed into success or silently return newer source.
