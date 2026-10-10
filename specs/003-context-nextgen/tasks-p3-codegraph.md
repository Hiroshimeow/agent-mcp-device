# P3 Tasks — Deterministic Code-Graph Contract Only

These are future implementation-package tasks. They intentionally stop before wiki implementation.

- [ ] T075 Freeze P3 analyzer/version/support matrix fixture: product-owned TypeScript 5.9.3 compatibility target, supported project configs/extensions, unsupported-language behavior, explicit TS6/TS7 incompatibility/negative fixture expectations, analyzer read-root policy, package/license baseline; do not describe 5.9.3 as current upstream.
- [ ] T076 Add synthetic code-graph truth fixtures covering contains/imports/exports/reexports/references/calls/constructs/extends/implements plus ambiguous/dynamic negatives. Assert canonical source/target node kinds, dependent->dependency orientation, top-level file ownership fallback, `constructs` class-target-only semantics (constructor-target variant rejected), deterministic owning-symbol selection for nested/arrow/class-field/static-block/top-level sites, logical-edge dedup, occurrence counts and evidence refs.
- [ ] T077 Add code-generation/store contract tests for analyzer/config/source-manifest identity, scope isolation, compact facts only, last-good publication and failed/cancelled shadow state; include bounded CompilerHost/config-resolution authorization after canonical path/symlink resolution, authorized external resolution inputs in freshness manifests, and redacted degradation diagnostics.
- [ ] T078 Add TypeScript analyzer tests for exact symbol/file/span refs, alias resolution, canonical edge endpoints/direction, imports/exports/reexports, references and conservative call/inheritance semantics; `constructs` must resolve to exactly one repo-local class symbol and must not target constructor symbols, while an exact constructor callable may separately form a proven `calls` edge. Include deterministic ownership fixtures for nested named functions, arrow/function expressions bound to variables, class field initializers, static blocks and top-level initializers. Unresolved/dynamic targets must not become proven edges. Include external tsconfig extends, external paths/project-reference, symlink/junction escape, allowed node_modules/@types declaration resolution and Windows/POSIX canonicalization fixtures; blocked inputs yield partial/unsupported coverage without external text leakage.
- [ ] T079 Add incremental invalidation fixtures: no-change, predeclared semantically-local change, ambiguous/body-looking change expected to widen safely, exported API change, add/delete/rename, authorized external declaration/config freshness change, config/path/global/compiler-version change; assert incoming-edge reverse-dependent invalidation, parsed/revalidated/rewritten/fallback-unit counts and that soundness fallback remains legal outside the frozen local-change class.
- [ ] T080 Add P3 search contract fixture for additive `local_search.branch=code`, lexical ranking, compact no-body results, code-generation cursors, incompatible history fields and old-device capability rejection.
- [ ] T081 Add P3 graph contract fixture for additive `local_graph.graph_kind=code`, neighbors/path, canonical forward/reverse direction, incoming-edge structural impact, direction/relation echo, activity-only action rejection, logical-edge occurrence metadata, traversal budgets/work counts.
- [ ] T082 Add P3 index/status/NAVIGATE contract fixtures for `index_kind=code`, branch-specific freshness/coverage and zero compiler invocation from read/search/status/NAVIGATE.
- [ ] T083 Add guarded-hydration fixtures binding source-span ref -> repo/worktree/generation/file fingerprint/range and stale/moved/deleted/content-mismatch failures.
- [ ] T084 Add exact activity-code bridge fixtures for event->file, event/edit->symbol, checkpoint->generation and negative cross-revision cases; no implicit cross-graph traversal.
- [ ] T085 Run code-graph truth acceptance on synthetic corpus and labeled samples from this repo + second TS/JS project shape; retain per-relation endpoint/orientation correctness, explicitly reject constructor-target `constructs` variants, and retain precision/recall/unsupported/coverage with NOT_MEASURED non-pass.
- [ ] T086 Run Windows/Linux code-index resource matrix: cold/full, no-change, one-file, API-change, forced-unit fallback, concurrent capture/query; retain wall/CPU/RSS/IO and parsed/revalidated/rewritten counts.
- [ ] T087 Record pinned TypeScript 5.9.3 production packaging/support decision with tarball/install-size delta, Apache-2.0 attribution, lazy-load behavior, explicit supported syntax/config ceiling, TS6/TS7 incompatibility behavior, and analyzer upgrade/rebuild policy; reject extra parser/graph dependencies absent measured need.
- [ ] T088 Run G-SCHEMA planning check for `branch`/`graph_kind`/`index_kind` additive fields and old-device behavior.
- [ ] T089 Independent P3 review: correctness authority, dynamic-call conservatism, freshness, incremental soundness, hydration, privacy, dependency/resource cost, benchmark non-vacuity and P4 scope leakage.

## Dependencies

T075 -> T076/T077/T078/T087.
T076/T078 -> T085.
T077 -> T079/T082/T083/T084.
T080/T081/T082 -> T088.
T079/T085/T086/T087/T088 -> T089.

## Stop condition

After T089:
- any Critical/High -> PLAN revises P3 only;
- clean review -> PLAN may open P4 wiki contract phase;
- no DEV implementation route from P3 planning alone.
