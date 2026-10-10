# P3 Research — Deterministic Current-Code Graph

**Date:** 2026-10-05  
**Scope:** deterministic current-code graph only. No wiki design, no product implementation.

## 1. Repository/toolchain evidence

Observed on `@md g6`, workspace `E:\git-project\agent-mcp-device`:

- tracked `src/` is overwhelmingly TypeScript: 127 `.ts` files, plus non-code UI/assets;
- one root `tsconfig.json`, no project references/composite/incremental setting;
- static imports/re-exports are common;
- inheritance/interface relations exist in real source;
- `typescript` is already a devDependency (`^5.3.3`), current installed/lock-resolved tool observed as **5.9.3**;
- `typescript` is **not** a production dependency in the current package surface;
- installed TypeScript package footprint observed: about **23.6 MB unpacked**;
- `tree-sitter` is not installed.

A read-only compiler probe using the existing TypeScript compiler API over this repository observed:
- root files: 127;
- local non-declaration source files: 126;
- declarations visited: 4,475;
- call expressions visited: 6,679;
- import declarations visited: 511;
- cold Program + TypeChecker traversal: about **7.46 s**;
- process RSS at completion: about **377 MB**.

These are research samples, not acceptance benchmarks. They are strong evidence that semantic extraction must be explicit/off-query-path and resource-measured.

## 2. Current external API evidence

Primary TypeScript compiler documentation checked:
- https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-6.html

Relevant facts:
- TypeScript exposes Program, CompilerHost, SourceFile and TypeChecker APIs for semantic symbol/type resolution.
- official builder/incremental APIs exist and can determine affected files/dependencies.
- the current TypeScript wiki warns the compiler API described for <=6.x will materially change in a future 7.1 API.
- REVIEW Turn 6 verified npm currently reports TypeScript 7.0.2 as latest; therefore 5.9.3 is an intentionally scoped v1 compatibility target that matches this product toolchain, not the current upstream TypeScript release.

Therefore extractor behavior must be version-pinned and fixture-tested; floating compiler APIs are not an acceptable graph authority. The support matrix must include explicit incompatibility/negative coverage for newer unsupported TS6/TS7 syntax/config behavior rather than silently misparsing it.

## 3. Alternatives

### A. Product-owned pinned TypeScript compiler — recommended first analyzer

Pros:
- semantic resolution for symbols/references/imports/exports;
- direct use of project tsconfig/module resolution;
- can distinguish resolved from unresolved relations;
- one already-known toolchain instead of a new parser family.

Costs:
- promoting/bundling the analyzer increases production install/package footprint;
- cold semantic analysis is non-trivial in time/RSS;
- compiler API must be version-pinned and upgrade-tested.

Decision:
- P3 v1 targets a **product-owned pinned TypeScript compiler analyzer**, current implementation target **TypeScript 5.9.3**.
- Do not dynamically load arbitrary project-local TypeScript packages into the mcp-device process as the default authority.
- Exact packaging form (regular runtime dependency vs bundled analyzer asset) may be chosen in DEV, but the analyzer version/behavior must be pinned and owned by the product.
- DEV must record install/tarball footprint and Apache-2.0 attribution impact before rollout.

### B. Project-local TypeScript package

Rejected as default:
- avoids package footprint but makes extractor behavior repo-dependent;
- loading target-repo package code expands the trust boundary;
- version drift makes graph semantics non-deterministic across repos/devices.

May be reconsidered only as an explicit isolated opt-in compatibility mode, not P3 v1.

### C. Tree-sitter + grammars

Deferred:
- currently absent and would add parser/grammar dependencies;
- strong syntax parser but does not by itself prove cross-file semantic references/calls;
- adding it beside TypeScript would increase system surface without demonstrated value for this repo.

### D. ripgrep/regex

Keep only as ordinary lexical search/fallback:
- useful for finding text/path candidates;
- not sufficient authority for proven symbol/reference/call/inheritance relations.

## 4. Language support scope

P3 v1 declares semantic support only for files included by a supported TypeScript/JavaScript compiler project:
- `.ts`, `.tsx`;
- `.js`, `.jsx` only when the project configuration includes them.

A parseable `tsconfig.json` or `jsconfig.json` defines an analyzer unit.

Unsupported languages are reported as unsupported/partial coverage. They are not guessed through regex and are not counted as semantic coverage.

### Analyzer read boundary

Semantic analysis MUST NOT widen filesystem authority merely because TypeScript configuration or module resolution points elsewhere.

Every CompilerHost/config/module-resolution read must pass a bounded analyzer read policy **after canonical path + symlink/junction resolution**.

Allowed read classes are:
- selected authorized repository/worktree source and config files;
- product-owned pinned TypeScript standard-library files;
- dependency declaration/config inputs required for resolution only when they are under explicitly authorized dependency roots for the selected repo/worktree.

Disallowed by default:
- arbitrary absolute paths;
- parent-relative paths escaping authorized roots;
- symlink/junction escapes;
- external project references/config `extends` outside authorized roots;
- path aliases/rootDirs/typeRoots that resolve outside authorized roots unless that root is explicitly authorized for this analyzer unit.

When a required external input is blocked, coverage becomes partial/unsupported with a typed reason; the analyzer MUST NOT silently follow it.

External dependency declarations may influence bounded resolution when authorized, but they do not become traversable repo-local nodes/edges and their source text must not leak into persisted signatures/labels.

Required fixtures include external `extends`, external `paths`/project references, symlink/junction escape, allowed `node_modules/@types` declaration resolution, and Windows/POSIX canonicalization.

External dependency source under `node_modules` is not recursively indexed by default. External modules may appear only as bounded labels/provenance needed to explain a local import; traversal authority remains repo-local.

## 5. Proven relation support matrix

P3 v1 relation claims use one canonical orientation. Dependency-style edges point **dependent/source -> dependency/target**.

| Relation | Canonical endpoints/direction | Proven when | Unsupported/omitted when |
| --- | --- | --- | --- |
| `contains` | file -> declared symbol | declaration AST is in repo-local source file | parse/config failure |
| `imports` | importing file -> imported local file | compiler module resolution maps static import to repo-local file | dynamic require/import target unresolved; external-only dependency |
| `exports` | exporting file -> exported local symbol | source AST/checker proves symbol exported from file | synthesized/unknown export |
| `reexports` | reexporting file -> resolved local symbol | static re-export resolves exactly to repo-local symbol | unresolved/external dynamic path |
| `references` | innermost owning symbol, or file for top-level site -> referenced local symbol | TypeChecker resolves the reference site to exactly identified repo-local declaration/symbol | unresolved/ambiguous/error recovery |
| `calls` | caller symbol, or file for top-level site -> callee symbol | direct static call target resolves to one concrete repo-local callable declaration without dynamic dispatch ambiguity | interface/virtual/dynamic/computed/reflection/ambiguous overload target |
| `constructs` | owning symbol, or file for top-level site -> constructed class symbol | `new` target resolves to one exact repo-local class symbol; constructor detail is separate evidence/call only when independently proven | ambiguous/dynamic target or no exact local class symbol |
| `extends` | derived class/interface -> base class/interface | extends clause resolves to repo-local declaration | unresolved/external target |
| `implements` | implementing class -> interface | implements clause resolves to repo-local interface declaration | unresolved/external target |

Logical edge identity is `generation + relation kind + source ref + target ref`. Repeated use sites collapse into one logical edge with occurrence count and bounded evidence refs. `constructs` always targets the class symbol, never the constructor symbol. Reverse impact and reverse-dependent invalidation traverse incoming edges of the dependency-style relations; path/trace must state direction explicitly.

Important:
- TypeChecker resolution is necessary but not always enough for runtime call authority.
- instance method calls that may dispatch to overrides are not emitted as `calls` unless the extractor can prove one concrete local target.
- unsupported/ambiguous relations may still produce lexical/reference metadata but never a `proven` edge.

## 6. Current-code authority and refs

The source file is authority. The graph is deterministic derived state.

Every graph generation records:
- owner/repository/worktree scope;
- Git HEAD when available;
- owner/repo-scoped keyed or otherwise opaque source-manifest fingerprint for included repo-local files;
- analyzer unit/config fingerprint;
- analyzer id/version;
- generation id;
- coverage + unsupported reasons;
- indexed timestamp.

Every repo-local file record binds:
- opaque file ref;
- relative path;
- language/analyzer unit;
- owner/repo-scoped keyed or otherwise opaque content fingerprint;
- generation.

Every symbol/node and edge evidence binds:
- opaque code/source-span ref;
- generation;
- file ref/content fingerprint;
- byte/range location;
- extractor id/version;
- proof kind `syntactic|semantic`.

Refs never grant access; scope authorization happens first.

This is sufficient for P2 guarded hydration: a current file range is accepted only when the current file fingerprint matches the generation-bound span ref. Otherwise return an explicit stale/source-changed outcome.

## 7. Incremental/freshness design

No query/search/read/status path runs the compiler.

Only explicit code-index `sync` or `rebuild` may analyze source.

### Sync

At sync:
1. resolve analyzer units/configs;
2. build/compare source manifest;
3. identify added/changed/deleted files and config/global-input changes;
4. re-extract the smallest safely affected set;
5. validate staged facts;
6. atomically publish the new code generation.

Safe fallback:
- when semantic invalidation cannot be proven narrow, re-analyze the **affected analyzer unit**, not silently publish incomplete edges;
- config/compiler-version/global declaration/path-mapping/lock-resolution changes may force full affected-unit reanalysis;
- this fallback is reported with reason and actual reparsed/revalidated file counts.

Graph row publication remains incremental: unchanged unrelated analyzer-unit facts are not rewritten merely because one unit changed.

### Rebuild

`rebuild` explicitly reconstructs the selected code analyzer units into shadow derived state and publishes only after validation.

Failure/cancel leaves the last-good generation queryable and marks it stale/failed. Partial new facts are never mixed into the published graph.

### Freshness

Search/graph responses include code-specific:
- generation;
- source HEAD + manifest id;
- `freshness=current|stale|missing|unknown`;
- last verified time;
- freshness basis/reason;
- coverage.

The 002 activity generation does not imply code freshness.

A stale/unknown graph may still be queried as last-good data, but every result carries that state. Guarded hydration prevents stale source ranges from silently becoming current-source evidence.

## 8. Public surface mapping — additive only

Capability bit/version detail: `code-graph-v1` inside the existing context capability/version advertisement.

### local_search

Add optional `branch=code` only on P3-capable devices.

- omitted branch = exact legacy/history behavior;
- `branch=code` performs compact lexical symbol/path lookup over published code graph only;
- `source_types`, `since/until`, history-only flags are not reinterpreted; incompatible combinations fail typed;
- no embeddings/LLM/provider call;
- no source body/snippet hydration.

Code result items are compact:
- code ref;
- symbol/file kind;
- name;
- relative path;
- declaration range;
- compact one-line signature/label when available;
- generation/freshness/coverage;
- match reason.

Exact identifier/path match ranks before prefix/lexical fallback. No semantic-confidence claim.

### local_graph

Add optional `graph_kind=code`:
- omitted = legacy 002 activity graph;
- code graph supports existing `neighbors` and `path` actions;
- `timeline` and activity-specific `related` remain activity-only and return typed unsupported when combined with code graph;
- existing hop/node/edge/byte/wall-time bounds remain hard safety ceilings; P3 does not inherit their old defaults as proven optimal agent defaults.

Impact is not a new action:
- bounded reverse `neighbors` over selected dependency/reference/call/inheritance relations is the structural blast-radius query.

Trace is not a new action:
- bounded `path` over proven code relations is the structural trace query.

Neither means runtime causal proof.

### local_index

Add optional `index_kind=code` to explicit sync/rebuild behavior:
- omitted = exact 002 behavior;
- code indexing is never triggered by search/read/status/NAVIGATE.

### local_status / NAVIGATE

Expose branch-specific code generation/freshness/coverage as additive metadata. Activity freshness must never stand in for code freshness.

All new inputs are rejected before dispatch on unsupported old devices. G-SCHEMA remains mandatory.

## 9. Bridges to activity/history

Graphs remain separate stores/authorities.

Allowed bridge facts require exact evidence:
- activity event -> file only when repo/worktree/path identity is resolvable;
- event/edit -> symbol only when event source revision/content fingerprint can be matched to a code generation/span;
- checkpoint -> code generation only when revision/worktree source state matches;
- code node may expose related activity refs but code traversal never silently crosses into activity graph.

If exact cross-revision mapping is unavailable, no symbol bridge is fabricated.

## 10. Non-vacuous acceptance

Support matrix is frozen before candidate results.

### Synthetic truth corpus

For every declared supported construct category:
- positive and negative/ambiguous examples are included;
- `proven` edge precision = 100%;
- supported `contains/imports/exports/reexports/constructs/extends/implements` recall = 100%;
- supported `references/calls` recall >=95%;
- unsupported dynamic/ambiguous constructs must produce zero false proven edge.

### Real-repo sample

Use this repo plus at least one second TypeScript fixture/repo shape to avoid fitting only one codebase.

For manually labeled sampled seeds:
- proven precision = 100%;
- recall >=95% within the predeclared supported construct set;
- unsupported/unknown rate is reported, not hidden;
- every declared supported relation has non-zero ground-truth fixture coverage or remains NOT_MEASURED/non-PASS.

### Coverage

Report:
- eligible source files;
- analyzed source files;
- unsupported files;
- files with parse/type degradation;
- relation counts by kind;
- unsupported/ambiguous relation counts.

An empty/all-unsupported graph cannot pass.

## 11. Incremental/resource acceptance

Required measurements:
- cold full analyzer-unit baseline;
- no-change sync;
- predeclared semantically-local one-file change;
- body-looking/ambiguous change whose locality is intentionally not provable;
- exported API change with reverse dependents;
- file add/delete/rename;
- tsconfig/global declaration change forcing safe wider invalidation;
- concurrent capture/query while explicit indexing runs.

The semantically-local fixture is frozen before results and must satisfy all of:
- same analyzer/config and dependency-resolution inputs;
- no exported/public type-shape change;
- no global/module augmentation;
- no import/export/path/config change;
- no construct category the analyzer declares as requiring wider invalidation.

Required properties:
- search/graph query invokes analyzer zero times;
- the predeclared semantically-local fixture does not rewrite unrelated file facts and does not fall back to full-unit analysis;
- the ambiguous/body-looking fixture is expected to widen safely when locality cannot be proven, and reports fallback reason/counts;
- exported API fixture revalidates at least required reverse dependents but not unrelated analyzer units;
- config/global declaration change may full-reanalyze the affected unit and must report that reason;
- failed/cancelled update keeps last-good generation;
- actual parsed/revalidated/rewritten counts are reported.

Soundness outranks incremental optimization: outside the frozen semantically-local class, affected-unit fallback remains legal whenever narrow invalidation cannot be proven safe.

Resource metrics include wall time, CPU, RSS, IO and event-loop/capture impact on Windows+Linux.

The observed ~7.46 s / 377 MB cold probe is research context only. Implementation must benchmark and may choose a bounded short-lived analyzer process if in-process analysis violates runtime/capture acceptance. No persistent hidden analyzer worker is permitted.

## 12. Dependency/package gate

Promoting/bundling pinned TypeScript is an intentional production dependency change.

Before rollout DEV must record:
- exact analyzer version;
- package/tarball/install-size delta;
- license/NOTICE impact (TypeScript observed Apache-2.0);
- Windows/Linux install/build behavior;
- lazy-load behavior;
- cold/incremental analyzer resource metrics.

Do not add Tree-sitter, SCIP server, graph DB, embeddings or a second parser in P3 v1 unless a measured blocker demonstrates need.
