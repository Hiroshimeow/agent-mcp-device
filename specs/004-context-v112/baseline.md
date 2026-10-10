# Phase R0 — Accepted baseline and reality check

Date: 2026-10-06. Phase: R0 RESEARCH/AUDIT. Status: synthesized research handoff; no implementation or release authorization.

Governing authority: `C:/Users/admin/Downloads/GOAL-mcp-device-1.0.12.md`. Treat `002-device-local-context` T001–T062 as DONE and accepted. The older `003-context-nextgen` planning documents are inputs to challenge, not current release truth. Companion: [research.md](research.md).

## 1. Three distinct repository identities

| Location | Observed identity | Meaning |
| --- | --- | --- |
| `E:/git-project/agent-mcp-device` | `main`, `1492747a53902ebdce7ad5b8eccd522fa8afdcc9` (v1.0.10 tracked tree) | Target repository; not the accepted context implementation checkout. Initially 18 untracked files: `.github/workflows/ci.yml` and 17 files under `specs/003-context-nextgen/`. Preserve all. |
| `E:/git-project/wt-mcp-device-111-context` | `feat/mcp-device-1.0.11-context`, HEAD `b3a5768`; evidence `714f3d8`; accepted code `a95a7dc` | Accepted 1.0.11 source, tests and acceptance evidence. Clean in this inspection. |
| `E:/git-project/wt-mcp-device-110-integrate` | `release/v1.0.10-clean`, `1492747` | Requested artifact-writing workspace, not the compatibility baseline. Pre-existing modifications to `LICENSE`, `README.md`, `package.json` and untracked archive/session/spec/tool artifacts are unrelated and preserved. |

The previous R0 drafts incorrectly used only the integration worktree, declared 1.0.11 unavailable, and carried a 2025-02-19 date. This report supersedes that blocker: the accepted worktree exists and is independently identifiable. Main still being v1.0.10 is not evidence that accepted 1.0.11 is incomplete. Acceptance does not imply merge, tag, publication or production enablement.

### Exact Git `core.worktree` anomaly and preservation

The shared repository file `E:/git-project/agent-mcp-device/.git/config` contains, under `[core]`, exactly:

```ini
worktree = /mnt/e/git-project/wt-mcp-device-111-context
```

This is a WSL/POSIX absolute path to the context worktree, not the Windows main checkout. Ordinary Windows `git -C E:/git-project/agent-mcp-device status` fails with `fatal: Invalid path '/mnt': No such file or directory`. A command-line `-c core.worktree=...` attempt also failed in this environment; do not use its failure to infer repository damage or missing files.

Use explicit directory binding instead:

```text
git --git-dir=E:/git-project/agent-mcp-device/.git --work-tree=E:/git-project/agent-mcp-device status --short --untracked-files=all
git --git-dir=E:/git-project/agent-mcp-device/.git --work-tree=E:/git-project/agent-mcp-device rev-parse HEAD
git --git-dir=E:/git-project/agent-mcp-device/.git --work-tree=E:/git-project/agent-mcp-device symbolic-ref --short HEAD
```

These establish `main@1492747` and the 18-file untracked inventory without changing the config. Linked-worktree inspection uses `git -C E:/git-project/wt-mcp-device-111-context ...`. Preserve the config byte-for-byte: no `git config`, reset, checkout, clean, stash, worktree repair or relocation is required. Mirroring these two new documents adds two untracked paths; it does not stage or modify the original 18 files. The anomaly is a local tooling concern, not a reason to reopen 1.0.11 acceptance.

## 2. Accepted 1.0.11 behavior and evidence

Accepted code SHA: `a95a7dce03fc8e80bab99af8f90597213f527fd3`. Evidence SHA: `714f3d83589fb12bede6935de2001669215daf8c`. HEAD `b3a5768` records final sign-off and T061/T062 completion; intervening commits include evidence-only `f58b95a` and `0c0a806`, so the acceptance chain is not a claim that the three named SHAs are adjacent parents.

Primary durable evidence in the accepted worktree:

- `evidence/context/checkpoint3-opus-signoff.md`: M365 Copilot Opus **READY_TO_PROCEED**, acceptance only; 198/198 context tests on Windows and native Linux, 15/15 valid benchmark samples on each.
- `evidence/context/phase9-linux-native-provenance.md`, `phase9-linux-native-context.tap`, `phase9-linux-native-footers.txt`, `phase9-linux-native-benchmark.jsonl` and its summary: native Ubuntu 22.04/ext4, fresh `npm ci`, native build, no copied Windows `node_modules` or `dist`. Tested source `0c0a806406e432181915425a4ccaba85dfc17dff`; source matches accepted code, with evidence-only `.gitattributes` differences explained in the sign-off.
- Windows raw evidence: `evidence/context/checkpoint3-context.tap` and Checkpoint 3 review/benchmark packets. This R0 synthesis inspects acceptance records; it does **not** claim to rerun either platform suite.
- `package.json` in the accepted worktree is **1.0.11**; Node requirement `>=22.13.0`.

Public contract inspected at `src/context/tool-contract.ts`:

| Tool | Existing semantics to preserve |
| --- | --- |
| `local_status` | Bounded freshness/storage/gaps/jobs; no indexing. |
| `local_search` | Retained history/checkpoint/activity in published generation; legacy source types unchanged. Default 8 hits; advertised schema `max_bytes` default 32 KiB (32,768 bytes), implemented omitted-field default 64 KiB (65,536 bytes); no hidden sync. |
| `local_read` | Retained historical evidence by opaque ref, aggregate bounds; default 256 KiB. Never substitutes current source. |
| `local_graph` | Bounded activity/provenance `neighbors`, `path`, `timeline`, `related`; not a current-code graph or runtime causality claim. |
| `local_index` | Explicit sync/checkpoint/rebuild/cancel jobs; write lane; no destructive administration exposed. |
| `local_wiki` | Reserved disabled status only; no provider generation. This is accepted compatibility behavior, not an unfinished mandatory wiki feature. |

Six schemas, gated catalog/forwarding seams, device capability advertisement/dispatch and SDK fixture registration are implemented and accepted. `contextToolCatalog()` and `callContextTool()` have no independently confirmed production server registration call sites; `test/context/catalog-rollout.test.js` registers test-created SDK servers. As `evidence/context/catalog-rollout.md` states, production registration/deployment and representative external-client rollout remain not independently measured. This boundary does not reopen T001–T062 or grant permission to enable production. `validateContextInput()` checks inputs without materializing schema defaults, and `device-adapter.ts` forwards omitted fields to the domain implementation: preserve the actual 64-KiB search fallback unless a separately reviewed 1.0.12 change explicitly addresses the schema/runtime discrepancy; do not silently fix 1.0.11. `src/context/gateway.ts`, `device-adapter.ts`, `authorization.ts`, `capture.ts`, `graph.ts`, `search.ts` and `store.ts` establish routing/gates, 48-lowercase-hex refs, authenticated cursors, historical-generation behavior, observer exclusions and capture authorization checks. Accepted fixes include key pinning, per-event revocation teardown, public-route fail-closed checks and 48-hex ref reconciliation. Preserve owner/repository/worktree isolation and redaction-before-persistence; opaque refs never confer authorization.

### Acceptance caveats are not concealed

Production enablement still requires direct external SOC confirmation of the pinned fingerprint and private-key custody. No merge/publish/tag/release/deploy/push is authorized. Sign-off retains M1 denied-capture/non-breaking-tool-call test confirmation, L1 hello/reconnect capability-snapshot documentation, L2 fixed unknown-local-tool error confirmation, and L3 minimum-Node-version coverage. These are bounded follow-ups, not grounds to restart T001–T062 wholesale.

Benchmark caveats: only three runs/workload; reported p95 is effectively the slowest sample, not an SLA. Platforms share physical hardware; do not interpret cross-platform differences causally. Native provenance reports Node 22.21.0 whereas sign-off prose says runs used 22.22.x: retain this discrepancy and use raw environment records for exact runtime identity. The 198/198 result is unaffected. Install audit reported 14 dependency vulnerabilities (2 moderate, 12 high); R0 makes no remediation claim.

## 3. Stale-assumption audit of `003-context-nextgen`

IDs below are this R0's durable reconciliation register; do not imply these IDs were present verbatim in older documents.

| ID | Prior assumption / source | R0 disposition |
| --- | --- | --- |
| SA-01 | `research.md` observes HEAD `5b16d19`, Phase 3 unfinished. | Superseded by accepted `b3a5768` / code `a95a7dc`. |
| SA-02 | `plan-p5-readiness.md` observes `dea0b5b`, implementation through T023, no production registration. | Historical implementation snapshot; six schemas, gated catalog/forwarding seams, device advertisement/dispatch and SDK fixture registration are now accepted. Production registration/deployment and representative external-client rollout remain not independently measured. |
| SA-03 | P5 B1/B2/B3 mark post-T062 baseline, G-110 and N3 closure unverified/blocked. | Do not carry blanket baseline blockers forward; accepted completion governs. Preserve the separate SOC enablement gate. |
| SA-04 | P5 verdict `NOT_READY_FOR_IMPLEMENTATION` means complete 002 first. | Superseded **for 002 closure**; not blanket authorization for 1.0.12 DEV. S1/V1/B0/reviewed contracts still mandatory. |
| SA-05 | P3 clearance automatically opens mandatory P4, then I3 wiki implementation. | Replace with evidence-dependent W4 gate; wiki may be DEFERRED. |
| SA-06 | TS 5.9.3 sample and purported newer-version claims establish final analyzer choice. | Prior probe evidence only; verify accepted toolchain/package delta and freeze pin/support in P3 after B0. Do not repeat unverified upstream version claims. |
| SA-07 | S1–S5 plus existing microbenchmarks suffice; artifact presence equals accepted nextgen plan. | Add S6/S7 and end-to-end frozen B0. Untracked 003 files remain prior research, not release evidence. |

## 4. Overengineering assessment

| ID | Mechanism at risk | Keep / simplify / defer |
| --- | --- | --- |
| OE-01 | Mandatory P4 wiki sequence in research/plans/P5. | DEFER unless W4 demonstrates S4 benefit after provider/freshness costs. |
| OE-02 | Disabled wiki scaffolding with source manifests/jobs/provider machinery before a positive gate. | Preserve existing disabled status; do not build unused lifecycle/storage infrastructure. |
| OE-03 | Fine-grained incremental invalidation and mandatory narrow reanalysis from the P3 proposal. | Soundness first; explicit affected-unit rebuild is acceptable initially. Optimize only when measured work/resource cost justifies it. |
| OE-04 | Speculative bridge storage across revisions, symbols, events and wiki claims. | Explicit refs only when identity/revision/fingerprint evidence matches; no inferred mappings or redundant bridge database. |
| OE-05 | Hidden schema inflation via additive branch cards, flags, generations and action enums. | Measure per-tool and whole catalog on old/cached clients; six names alone do not prove small schemas or compatibility. Remove unused fields. |

## 5. Invariant verification against GOAL 1.0.12

| Invariant | Audit result / planning obligation |
| --- | --- |
| Source/raw evidence outranks derived output | 003 hydration/authority contract aligns; wiki claims still require current-source verification. |
| Separate history, code and NMem | 003 generally aligns; memory must not become a ContextService-proxied branch or automatic history conversion. |
| Need-driven one-authority route / no fan-out | Keep optional bypass and stopping rule; branch availability is not a retrieval request. |
| No hidden sync/rebuild/provider during reads | Legacy semantics align; NAVIGATE must read bounded status only, with instrumentation proving zero hidden work. |
| No new graph/vector/embedding/LLM dependency without evidence and separate decision | Retain; Graphiti/Neo4j rejected as core. TS packaging remains a measured proposed dependency delta. |
| Deterministic graph / no dynamic guessing | Keep provenance and unknown/unsupported outcomes; compiler resolution alone does not prove runtime dispatch. |
| Last-good generation on failure/cancel | Keep atomic publication and visible stale/failed state; do not mix partial generations. |
| Guarded hydration | Keep repo/worktree + authorized path + expected fingerprint/revision + intended range. Mismatch must be typed, never silent newer-content substitution. |
| Semantic 1.0.11 compatibility | Preserve legacy omitted-field behavior, refs/actions/source types, CLI/MCP parity; explicit negotiation for incompatible extensions. |
| Isolation/redaction/permission/fail-closed | Accepted baseline gates preserved; compiler config/module resolution must not widen allowed paths. |
| Gateway control plane / device execution plane | Keep corpus local; no gateway persistence or provider credential/corpus migration. |
| No unnecessary public tool | Existing six names are starting point; component count is not tool justification. |
| B0, W4, independent review, no unauthorized release | 003 sequencing is insufficient; replace with GOAL phase protocol. R0 stops here. |

This is documentary alignment, not proof that unimplemented 1.0.12 paths pass runtime invariants.

## 6. Rejection register

| ID | Rejected direction / reason |
| --- | --- |
| R-01 | Reopen accepted 1.0.11 completion from stale P5 observations; contradicts current evidence. |
| R-02 | Silently repair shared Git config or discard untracked work; unnecessary mutation. |
| R-03 | Make NAVIGATE mandatory for known-file/trivial tasks; adds overhead. |
| R-04 | Automatic history/code/wiki/NMem fan-out; availability is not need. |
| R-05 | Merge activity and current-code graph authority; provenance conflict. |
| R-06 | Convert captured history into NMem automatically; changes authority/privacy semantics. |
| R-07 | Graphiti/Neo4j as core; unnecessary operational/provider stack. |
| R-08 | Default vector DB/embedding pipeline; no measured requirement. |
| R-09 | LLM extraction of deterministic code edges; loses reproducibility/proof. |
| R-10 | Guess dynamic/reflection/DI/virtual calls; false proven edges. |
| R-11 | Treat missing edges as absence or structural paths as runtime causality; incomplete coverage. |
| R-12 | Mandatory P4 wiki or disabled future scaffolding; no benefit demonstrated. |
| R-13 | Automatic wiki generation/provider call on query/idle; hidden cost/egress. |
| R-14 | Wiki or stale graph outranks current source; false authority. |
| R-15 | Duplicate public source-read tool by default; prefer guarded bounded read reuse. |
| R-16 | Query-time compiler/rebuild or background hidden indexing; violates read contract. |
| R-17 | Load arbitrary project-local compiler/plugins into trusted process by default; version/trust drift. |
| R-18 | Adopt full SCIP/LSIF server pipeline or multi-language parser fleet immediately; unsupported dependency weight. |
| R-19 | Aggressive incremental/cache/bridge optimization before cost evidence; premature state complexity. |
| R-20 | Token-only success, empty-graph precision gaming, post-result threshold tuning, or external marketing ratios as local proof. |

## 7. Benchmark gaps and closure owners

| ID | Gap | Required closure |
| --- | --- | --- |
| BG-01 | Existing corpus only S1–S5. | B0 adds S6 interrupted/resumed with verified durable refs and freshness. |
| BG-02 | No explicit negative-routing class. | B0 adds S7 with all authorities available but forbidden unnecessary calls. |
| BG-03 | No frozen accepted baseline A/B inventory before candidate code. | Mandatory B0 hashes corpus/config/harness and runs 1.0.11 + native tools first. |
| BG-04 | Runtime capture/search microbenchmarks do not demonstrate agent task completion. | End-to-end rubrics, patches/tests, terminal states and repeated trials. |
| BG-05 | Compiler probe: 127 roots/126 source files, 4,475 declarations, 6,679 calls, 511 imports, ~7.46 s / 377 MB. | Single prior sample, not extracted-edge precision, recall, latency SLA or cross-platform proof. Re-measure representative units, cold/warm and package impact. |
| BG-06 | Precision alone permits empty graph. | P3 freezes nonzero truth counts, supported categories and recall/coverage thresholds before D3. |
| BG-07 | Costs can hide in calls/envelopes/schema/index preparation. | Count request/response bytes, schemas separately, all tool calls, setup/update work and wall time. |
| BG-08 | Three samples and successful-run-only summaries are weak. | Frozen repetitions, retained failures/harness retries, denominators and uncertainty; no survivor-only PASS. |
| BG-09 | Latency/RSS/IO/concurrent capture effects incompletely established. | Windows/Linux separately; index cancellation/failure, contention and no-change/wide-invalidation cases. |
| BG-10 | Compatibility/security/freshness not exercised together in task benchmark. | Old device/cached schema, revocation/redaction/worktree isolation, rename/delete/change hydration, generation failure and resume fixtures. |

## 8. Handoff / stop condition

R0 ends with these two durable files, preserving source/package/config and unrelated changes. Fresh PLAN role next: **S1** constitution/spec delta with PRESERVE/COMPLETE/FIX/DEFER/REJECT. Then independent **V1**, mandatory **B0** benchmark freeze/run before candidate implementation, **P2** reviewed retrieval contract. No automatic continuation to DEV or mandatory wiki. R0 has not created frozen fixture files, run the new benchmark, resolved SOC enablement or authorized a release.
