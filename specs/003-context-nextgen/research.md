# Research — Context NextGen (micro-phase R1)

**Date:** 2026-10-05  
**Lifecycle:** post-`002-device-local-context` / after T062 by product assumption.  
**This phase:** research + spec delta only. No product implementation, provider install, graph build, wiki generation, release, or branch switch.

## 1. Repository truth and planning baseline

Observed on `@md g6`:
- `E:\git-project\agent-mcp-device` is currently `main@1492747` (tag v1.0.10); this checkout does not contain `specs/`.
- `002-device-local-context` exists as a local branch at checkpoint `1e744a7`.
- active 1.0.11 worktree is `E:\git-project\wt-mcp-device-111-context`, branch `feat/mcp-device-1.0.11-context`, observed HEAD `5b16d19`.
- that worktree currently shows committed Phase 1–2 checkpoints plus uncommitted Phase 3 work. This is **not** used to challenge or interrupt the task's explicit assumption that T001–T062 are already complete/operating for purposes of the next design increment.
- the handoff explicitly says next design starts after T062 and prioritizes token-efficient progressive disclosure, a separate deterministic code graph, and a derived human wiki.

Planning therefore treats the **002 contracts as the compatibility baseline** while treating actual completion/production evidence for T001–T062 as outside this task. No PASS claim is made from the observed worktree.

## 2. External systems compared

| System | Useful observed pattern | Relevance here | Do not copy blindly |
| --- | --- | --- | --- |
| **Aider repo-map** | Concise repository map; key symbols/signatures selected under a token budget; graph ranking chooses relevant portions. Default map budget is around 1k tokens and may expand when needed. | Strong precedent for compact orientation before source hydration. | Do not inject a repo map into every turn automatically; our local agent should request/receive compact navigation only when the task needs repo context. |
| **CodeGraph (Lordymine/codegraph)** | Compact refs by default, source returned only through explicit snippet; graph stored as simple indexed adjacency data; Go/TS call relations delegate to real type-checking/indexing machinery; unresolved dynamic relations are dropped rather than guessed; atomic re-index leaves previous graph usable and surfaces staleness/failure. | Very strong fit for deterministic current-code graph, truthful coverage, explicit hydration, and last-good generation semantics. | Do not adopt its language/toolchain choices wholesale; claims such as speed/token savings are project-specific and need local benchmarks. |
| **CodeGraph / tree-sitter + SQLite variants** | Symbols/imports/exports in a local graph + FTS/MCP; agents query structure instead of reading whole files. | Supports a small local derived index. | Self-reported token reduction claims (e.g. 96%) are not acceptance evidence for this project. |
| **GitNexus** | Distinct intents/tools for query, symbol context, impact, detect-changes and execution/process views; next-step hints guide expansion; architecture docs can be generated from graph/process data. | Strong precedent for typed query branches and impact/trace workflows rather than a flat top-N blob. | Its broad surface, clustering, embeddings, PDG/taint, generated skills and wiki features are too wide to adopt as one increment. |
| **Graphiti** | Temporal knowledge graph with episodes, typed nodes/edges, hybrid search recipes, graph-distance reranking, incremental updates and historical semantics. | Useful design inspiration for activity/history routing and freshness semantics. | Poor fit for deterministic current-code authority: default stack includes LLM/embedding inference and graph DB dependencies; do not make it a core dependency. |
| **Grafiti / “Grafity”** | The relevant `MikeGraf/grafiti` repository is a fork of `getzep/graphiti`; another “grafity” result is an unrelated semantic ideation canvas. | Treat as naming ambiguity, not a distinct architecture requirement. | No separate provider/index should be added for “Grafity”. |
| **DeepWiki (Cognition) / DeepWiki-style systems** | Auto-generated repo documentation, architecture explanations/diagrams and Q&A over indexed repositories. | Good human-facing model for feature dossiers and navigation. | Wiki output remains derived and stale-able; it must never outrank current source/raw evidence or trigger automatically on normal coding tasks. |
| **Sourcegraph + SCIP** | Language-agnostic precise code-intelligence protocol; definitions/references/implementations backed by compiler/indexer information, with search-based fallback when precise data is unavailable. | Strong precedent for provenance/coverage and distinguishing precise vs heuristic results. | Avoid pretending heuristic fallback is precise. Coverage and extractor identity must be surfaced. |
| **Serena** | Symbol-level navigation and reference tools backed by LSP-style semantics; avoids whole-file reads for many coding tasks. | Confirms targeted symbol retrieval and explicit reference expansion are effective agent primitives. | Its own docs note small/single-file tasks may not benefit; do not force graph routing for trivial tasks. |

### Primary sources inspected

- Aider repo-map: https://github.com/Aider-AI/aider/blob/main/aider/website/docs/repomap.md
- CodeGraph: https://github.com/Lordymine/codegraph
- GitNexus examples/tooling: https://github.com/nxpatterns/gitnexus and related GitNexus MCP/impact docs surfaced in current search
- Graphiti: https://github.com/getzep/graphiti
- Grafiti ambiguity: https://github.com/MikeGraf/grafiti (fork of Graphiti)
- DeepWiki announcement: https://cognition.com/blog/deepwiki
- DeepWiki-style open implementation: https://github.com/KnightCorp/deepwiki_open
- Sourcegraph precise navigation / SCIP: https://sourcegraph.com/docs/code-navigation/precise-code-navigation and https://github.com/scip-code/scip
- Serena: https://github.com/oraios/serena

## 3. Design findings

### R1 — Preserve two graph authorities
Keep **activity/history graph** and **current-code graph** distinct.

- Activity graph answers: what happened, when, through which tool/process/checkpoint, and what evidence was captured.
- Code graph answers: what exists in the current indexed source revision and which structural relations are statically proven.
- Bridges are refs only: event -> file/symbol, checkpoint -> revision, edit -> affected file/symbol.
- No temporal proximity edge becomes a code relation; no code relation becomes historical proof.

### R2 — Progressive disclosure is the primary next capability
Replace “search then dump top-N text” with three stages:

1. **NAVIGATE** — compact branch cards/typed refs only.
2. **EXPAND** — compact symbol/graph/history/wiki metadata and edges relevant to one chosen branch.
3. **HYDRATE** — snippets/ranges/full content only by explicit follow-up.

The first stage must not include full source/history/wiki bodies.

### R3 — Prefer existing file hydration, but require consistency guards
Do **not** add a new public “source read” tool merely because code graph exists.

Existing `read_file` supports bounded offset/length semantics, but its current contract is not bound to a code-graph generation, expected source revision/fingerprint, or opaque worktree ref. Therefore reuse is a **preference, not a frozen conclusion**.

P2/P3 MUST define a hydration-consistency invariant before source ranges are accepted as corresponding evidence:
- bind the selected repository/worktree unambiguously;
- bind or verify the graph ref's expected source revision/content fingerprint before accepting the returned range;
- changed/moved/deleted/mismatched source returns an explicit stale/ref mismatch outcome rather than silently hydrating the same line numbers from different content;
- preserve existing allowed-directory/path authorization.

Choose the smallest mechanism that satisfies those invariants: e.g. an additive guarded `read_file` field/response, an opaque locally resolved source ref, or equivalent. Add a duplicate public source-read tool only if guarded reuse cannot satisfy the contract.

### R4 — Preserve the six public context names unless benchmarks prove a new tool is needed
Current 002 names remain the starting point:
`local_status`, `local_search`, `local_read`, `local_graph`, `local_index`, `local_wiki`.

Candidate evolution:
- `local_search`: compact discovery across typed branches, no implicit hydration.
- `local_graph`: read-only graph queries with explicit `graph_kind=activity|code`; internal stores remain separate.
- `local_read`: retained historical evidence only; it must not impersonate current source.
- current source hydration: existing `read_file`.
- `local_wiki`: human-facing derived documents only, explicit generation/update.

No new public name is justified in R1.

Preserving names is not enough: P2 MUST preserve the semantics of valid 002 calls or explicitly version/negotiate any incompatible schema change. It must define capability/schema-version behavior for old devices and clients with cached schemas, keep CLI/MCP parity and typed unsupported behavior, and run the existing G-SCHEMA gate for per-tool + total schema delta. Existing `local_search.source_types`, `local_graph` actions, and historical refs must not be silently reinterpreted.

### R5 — Agent routing must be need-driven, not availability-driven
A task does not query every store.

Proposed branch intents:
- **code** — current files/symbols/definitions/imports/references.
- **flow** — proven calls/entrypoints/structural traces.
- **impact** — upstream/downstream dependents and changed-symbol blast radius.
- **history** — captured events/checkpoints/activity.
- **wiki** — human explanation when useful and available.
- **memory** — NMem only for explicit durable decisions/preferences/rules, not ordinary code discovery.

A simple exact-code task should normally use code -> one range hydration. It should not automatically call history/wiki/NMem.

### R6 — Deterministic graph facts only
Allowed current-code facts must identify extractor/provenance and coverage.

Candidate proven relations:
- file contains symbol;
- definition;
- import/export;
- reference;
- interface/inheritance/implementation when statically proven;
- call edge only when a supported analyzer/type checker proves it.

Unknown/dynamic/reflection/DI relations are omitted or marked unsupported/unknown, never promoted to fact.

### R7 — Incremental freshness, last-good publication
Code graph is a derived generation, independent from activity generation.

Required semantics:
- changed/dirty files can be reparsed selectively;
- successful generation publishes atomically;
- failed refresh keeps previous graph queryable and marks it stale/failed;
- no full rebuild on every search/read/tool call;
- query results expose revision/generation/freshness/coverage.

Exact incremental strategy is deferred until language/extractor evidence is measured.

### R8 — Wiki is a comprehension layer, not a retrieval authority
A feature/function dossier may include purpose, spec refs, entry points, important symbols/files, architecture, code/data/sequence flows, invariants/security boundaries, tests, recent relevant history and evidence refs.

Generation rules:
- explicit user-requested job only;
- sources are current-code graph + selected current source + specs/tests + selected history;
- generated page records source manifest and generation;
- changed source makes page stale;
- current source/raw evidence outrank wiki;
- no routine search/index/idle path invokes a provider.

### R9 — Do not freeze old retrieval numbers as agent defaults
002 values (8 hits / 32 KiB search / 256 KiB read) remain compatibility/safety evidence only.

003 must choose defaults from a benchmark that measures:
- correctness;
- estimated tokens delivered until correct answer;
- tool calls until correct answer;
- irrelevant-context ratio;
- wall latency;
- index/update CPU/RSS/IO;
- graph coverage and false positive/negative behavior.

## 4. Provisional measurable acceptance gates

These are **spec acceptance targets, not runtime defaults**. Review may tighten or revise them before contracts/tasks are frozen.

### Benchmark classes

- **S1 Exact navigation:** find file/symbol/definition and hydrate only required range.
- **S2 Structural flow/impact:** callers/callees/import/reference/impact on fixtures where truth can be proven.
- **S3 History:** explain a past change/error/checkpoint from retained evidence.
- **S4 Mixed feature understanding:** combine current code + selected history; wiki optional, never required for correctness.
- **S5 Trivial single-file:** prove the context system can choose to do almost nothing.

### Gates

1. **Correctness first:** candidate answer correctness must be >= the 002/file-search baseline on the same corpus; security/isolation regressions = fail.
2. **Initial discovery budget:** p95 serialized agent-facing NAVIGATE response <= **1,500 estimated tokens** and contains no full source/history/wiki body.
3. **Simple-task total context:** S1 and S5 p95 retrieval payload until a correct answer <= **4,000 estimated tokens**.
4. **Token non-regression + improvement:** first, candidate median tokens-to-correct-answer for S2–S4 MUST NOT regress versus the same baseline/corpus beyond a measurement tolerance frozen in P2 from estimator repeatability. Separately, the improvement target is <= **70% of baseline** OR <= **8,000 tokens absolute**. The absolute target never waives the non-regression gate. P2 must freeze the tokenizer/estimator and state whether tool request/response envelopes count.
5. **Irrelevant-context ratio:** median <= **20%**, p95 <= **35%**, using benchmark-labeled relevant spans/refs.
6. **Tool-call discipline:** S1/S5 p95 <= **3 retrieval/hydration calls**; multi-stage expansion must not create a call explosion.
7. **No unnecessary branches:** S1/S5 trace must show **0 automatic wiki provider calls**, **0 automatic NMem calls**, and no history/code-graph branch when not needed by the task.
8. **Truthful, non-vacuous graph:** false positive rate for relations marked `proven` = **0** on the frozen ground-truth corpus, AND the benchmark must publish a language/relation support matrix, ground-truth fixture counts per supported relation type, recall/coverage separately from precision, and unsupported/unknown rate. P3 must freeze a minimum non-regressing recall/coverage threshold (or stronger evidence-based threshold) for each declared supported relation before implementation readiness. An empty graph, all-unsupported result, or NOT_MEASURED coverage cannot PASS.
9. **Freshness honesty:** stale/failed code generation may return last-good data only with revision/generation/freshness visible; no silent stale-as-current result.
10. **Resource gate:** local query p95 and incremental update CPU/RSS/IO must be recorded on Windows+Linux; no latency SLA is frozen until baseline numbers exist. A candidate that saves tokens by causing material interactive regression (>20% p95 latency vs comparable baseline task) fails unless separately justified.

## 5. Micro-phase lifecycle to reduce over-engineering/timeout risk

Each phase is intentionally small and independently reviewable.

### P0 — R1 research + spec delta (this turn)
Artifacts: `research.md`, `spec.md`.
Stop condition: enough evidence/boundaries for an independent reviewer.
No contracts/tasks/product code yet.

### P1 — Independent REVIEW of research/spec delta
Reviewer checks:
- missing systems/evidence;
- mistaken authority boundaries;
- whether six-tool reuse is viable;
- benchmark gates for gaming or impossible targets;
- hidden over-engineering.
Critical/High => route PLAN to revise only those blockers.

### P2 — Retrieval/router contract only
PLAN writes:
- compact branch/ref envelope;
- NAVIGATE/EXPAND/HYDRATE behavior;
- benchmark corpus/measurement contract;
- minimal T063+ tasks for retrieval/router only.
Independent REVIEW follows before any code-graph task is frozen.

### P3 — Deterministic code-graph contract only
PLAN chooses supported language/extractor strategy using measured repo composition/tool availability.
Freeze nodes/edges/provenance/freshness/impact/trace contracts and its own small tasks.
Independent REVIEW follows.

### P4 — Wiki contract only
PLAN refines the deferred 002 wiki contract into human feature-dossier generation, stale semantics, diagrams and explicit provider/egress rules.
Independent REVIEW follows.

### P5 — Cross-layer acceptance + final implementation readiness
PLAN reconciles P2–P4, removes redundant tooling, writes final dependency graph and phased implementation order.
Final independent REVIEW must have no unresolved Critical/High before `READY_FOR_IMPLEMENTATION`.

## 6. Explicit non-goals for the next increment

- no Graphiti/Neo4j/provider dependency in core;
- no embeddings/vector DB unless benchmark later proves necessary;
- no automatic repo-wide wiki generation;
- no new public MCP tool name in R1;
- no dynamic call-edge guessing;
- no merged activity+code graph;
- no per-turn/per-read hidden indexing;
- no full repository body injection into agent context;
- no rewrite/interruption of active 002 implementation;
- no publish/release/tag.
