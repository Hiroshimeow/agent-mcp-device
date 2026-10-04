# Handoff với 1.0.10 — revision 2

**Kết luận**: Feature 002 có một lane độc lập đủ lớn để implement trước handoff, nhưng live capture/process/gateway integration vẫn phụ thuộc 1.0.10. Không cần chờ 1.0.10 release mới bắt đầu store/search/CLI work.

## Evidence snapshot

Reference source: `wt-mcp-device-110-integrate`, branch `feat/mcp-device-1.0.10-integrate`, baseline `ee87d0f3057e01e8087db99615d14bd1b4c626d4`. Snapshot tài liệu 001 được giữ để audit; nếu source 001 drift, không rewrite snapshot cũ mà tạo handoff mới.

## Ownership matrix

| Vùng | 001 / 1.0.10 | 002 / Context | Handoff requirement |
| --- | --- | --- | --- |
| Canonical dispatcher/self-MCP removal | owns | consume only | invoke signature + equivalence accepted |
| Canonical observer | owns hook/boundary | pre-intent/post-outcome recorder adapter | hook runs once per public invocation |
| Observer exclusion | owns hook/filter capability | excludes `local_*` result bodies from corpus | explicit exclusion hook/contract |
| Process/session/output | owns lifecycle/correlation/ranges | references process evidence | execution UUID/runtime generation/ranges |
| Shared resource accounting | owns runtime ceilings | adds DB/index dimensions | no bypass/unbounded queue |
| Tool history compatibility | owns legacy/current logging coordination | imports old JSONL and removes duplicate canonical writers when authorized | no double record/no missing direct route |
| CLI lifecycle/entrypoint | may change during 001 | context subcommands consume final entrypoint | start/update/shutdown contract |
| Device/gateway capability mapping | 001 stabilizes adapter semantics | six context schemas/routes | final mapping + old-device behavior |
| Store/redaction/repo resolver/FTS/search/activity graph | no ownership | owns | independent implementation allowed |
| Skill source | no ownership | owns | depends only on tested CLI contract |
| Wiki provider engine | no ownership | feature 003 | not a 002 handoff |

## Independent implementation lane — may proceed after feature authorization

These do **not** require G-110:
- `src/context/redact.ts` and privacy fixtures;
- registry/repository/worktree resolver;
- node:sqlite schema/migrations/manifests/content-addressed retained blobs;
- ref/cursor security;
- legacy JSONL importer over copied fixtures;
- sync/FTS/activity relations over synthetic/imported events;
- search/read/status domain service;
- CLI adapter against test state root where entrypoint wiring can be isolated;
- checkpoint domain model;
- skill content and contract tests;
- retrieval correctness/performance harness that does not claim live capture cost.

## Wait for G-110

Do not implement/integrate these until handoff:
- attaching capture to real canonical observer;
- process output correlation;
- suppressing/replacing old canonical recorder paths;
- shared busy/resource accounting with production dispatcher;
- final CLI entrypoint changes if 001 owns same file;
- device capabilities/gateway routing;
- combined compatibility/capture benchmark.

## Mandatory handoff record

Handoff JSON/document must state:

1. source commit + dirty/worktree state accepted by 001 owner;
2. public invocation identity and exactly-once observer placement;
3. **pre-intent hook point**: after authorization/scope context exists but before side-effect dispatch;
4. **post-outcome hook point**: actual execution result/error before transport-only handling;
5. **observer exclusion hook** for `local_status/search/read/graph/index/wiki` result bodies and context maintenance audit;
6. process correlation: execution/runtime generation, ranges, truncation/completeness/terminal state;
7. shared resource/busy/shutdown semantics;
8. readiness/update/shutdown lifecycle;
9. final regression/comparator suite and route coverage;
10. rule that material signature/semantic changes after handoff invalidate dependent 002 evidence.

## Capture contract expected from handoff

002 does not require 001 to persist context. It requires enough lifecycle context to implement:

```text
authorized public invocation
    ↓
context pre-intent callback (bounded; may report degraded)
    ↓
execute exactly once
    ↓
context post-outcome callback
    ↓
transport delivery
```

Transport delivery failure must not cause another execution. Device does not claim final client consumption.

## Stop rules

- No stable observer hook → 002 live capture tasks stop; independent store/search lane continues.
- Process identity changes → refresh process-related fixtures before integration.
- Shared resource policy changes → rerun contention/capture benchmarks.
- Adapter/tool schema changes → rerun public manifest/parity/security tests.
- Do not create self-MCP/context proxy fallback to “decouple” from 001.
- Do not remove old tools as compensation for six new names unless separate owner-approved migration exists.

## Version/runtime placement

002 explicitly targets a post-1.0.10 release with Node >=22.13 + built-in node:sqlite. This is a compatibility decision of 002, not an amendment to the 1.0.10 patch branch. Release notes/migration gate must disclose it.

## Revalidation after final 1.0.10

Before public rollout rerun:
- capture route matrix;
- process mapping;
- CLI entrypoint/help;
- resource/contention behavior;
- six-tool schema/annotations;
- combined Windows/Linux compatibility benchmark.
