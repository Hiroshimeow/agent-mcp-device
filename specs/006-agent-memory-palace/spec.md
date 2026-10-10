# 006 — Agent Memory Palace: governing product specification

**Status:** ACTIVE / SPECIFICATION ONLY — implementation **NOT STARTED**.
**Authority:** User direction, 2026-10-11. This specification supersedes proposed Context NextGen 003, Context v1.0.12 R0 004, and Experience Memory 005 **as future-work plans**; it does **not** change or reopen the accepted 002 Device Context v1.0.11 contract.
**Canonical implementation bases:** Device `main` (G6), Gateway **G8 `develop`**. Verify actual SHA before any code; G6 Gateway `develop@89f7123` is stale and is NOT an integration base.
**Scope of this task:** documentation, migration of active planning and cleanup only. Do not edit product code, switch Gateway base, install providers, merge Context, schedule jobs, deploy or reload.

## Goal / definition of success

An agent entering a familiar or **completely new repository** can recognize earlier similar tool/session experiences on G6, G8 or another authorized host and continue solving the task **without being taught the same workflow again**. Preserve far more evidence than can fit in the LLM context while using **less total model-visible text, fewer redundant tool calls and lower amortized total token cost**.

The system is not primarily a static source-code searcher. Its authoritative raw inputs are **tool invocations/results and agent sessions**. A bounded search index and **activity/provenance graph** locate relevant observations. A self-evolving **LLM Wiki is the Mind Palace**, organizing durable cross-task and cross-repository knowledge. Versioned **skills** represent reusable ways to act, are **lazy-loaded** and are merged/refined **automatically on a bounded schedule**. User approval for each skill creation/merge is **NOT REQUIRED**.

### Explicitly IN scope
1. Log/session capture, ingestion, correlation, dedupe and gaps across authorized MCP/CLI/agent hosts.
2. Fast keyword/metadata search (SQLite FTS5/BM25 first), graph traversal based on historical relationships; search → read specific refs, timeline/graph only when helpful.
3. LLM Wiki as **one durable, extensible Palace**: digest from evidence, wikilinks, page revisions, stale/conflict management and provenance.
4. Cross-session, cross-repository and cross-device personal recall: agent bootstraps automatically with a tiny memory locator, not a giant prompt or manual guidance.
5. Auto-learning procedures into skills, lazy discovery/loading, automatic scheduled dedupe/merge/archive and tested rollback, without manual approval.
6. Quantitative end-to-end benchmark for **correctness and amortized token economy** including offline background model calls.
7. Reuse mature upstream components (e.g. ReMe/OpenViking) behind an adapter after evidence-based evaluation. No local reimplementation of a wiki engine by default.

### Explicitly OUT of scope
- New mandatory source-code AST/call graph, compiler analyzer, symbol graph or code wiki separate from tool/session activity. Allow optional existing CLI tools for code inspection, but do not make them the architecture.
- Replacing MCP Gateway's existing auth, device broker, filesystem/shell/process tools, skill catalog, or rebuilding a parallel control plane.
- Changing v1.0.11 `local_*` schemas or activating the old Gateway Context feature simply to ship Palace.
- Running LLM extraction for every tool call, unbounded polling/goal loops, implicitly executing an old remembered command, or silently exporting raw secrets/transcripts.
- Auto-modifying user-owned/bundled/pinned skills or product source as a side effect of memory consolidation. Auto-merging **agent-owned skill versions** is allowed and expected.
- Human approval **for ordinary agent-owned skill promotion/merge**. Security/owner access policies remain separate, not approval popups for each skill.

## Authority and evidence model

**Trusted current source, tests, user instructions and runtime permissions take priority over historical logs, wiki pages and skills.** A remembered fix is a candidate procedure, not proof it still works or permission to run it. A successful tool exit is not equivalent to whole-task success.

Keep four distinguishable layers:
- **L0 Raw evidence:** immutable redacted tool/session events and outcome refs; append-only with source identity, gaps, retention and content hashes.
- **L1 Search/graph:** deterministic indices built from L0; replaceable/rebuildable, versioned, never the only copy of evidence.
- **L2 Wiki Palace:** source-linked LLM synthesis and structured linked pages; update version and stale/conflict state rather than rewriting raw history.
- **L3 Skills:** procedures distilled from wiki/evidence, including applicability conditions, verification commands and failures; lazy loaded and versioned.

The L0/L1/L2/L3 terms here describe **authority layers**, NOT an instruction to require three prompt-loading tiers or four databases. Minimize storage/daemon duplication.

## Functional requirements

### A. Ingestion and session identity
- **FR-01** Capture tool intent/outcome, failure, execution location and limited safe payload refs from `MCP Device`, plus agent session messages/checkpoints when the client supplies a supported adapter/hook.
- **FR-02** Identify `owner_id` (trusted auth), `device_id`, `repo_identity`, `session_id`, `turn_id`, `task_id`, `tool_call_id`, `parent_call_id`, tool name, timestamps, outcome, code/revision and evidence refs. Absent IDs are explicitly `unknown`/synthesized with provenance; never fake correlation.
- **FR-03** Support idempotent import with stable event IDs, offsets/checkpoints, bounded batches and deduplication; reconnect/replay must not duplicate a solved task or a skill-learning event.
- **FR-04** Ingestion handles retries, failed/partial tool output, crashes, missing response, concurrent sessions and out-of-order events; incomplete sequences are visible as gaps, not success.
- **FR-05** Retain original evidence under authorized scope; cap/redact content before storage. Gateway's minimal usage audit is **not** a substitute for tool/session evidence.
- **FR-06** One client may provide a transcript, another only tool metadata: coverage must be visible per session; Wiki cannot claim to know unseen reasoning.

### B. Search, graph, token budget
- **FR-07** Fast search by keyword, error signature, exact path/tool, result status, task/repo/session/agent/device, revision/time and cross-repo similarity. SQLite FTS5/BM25 as first candidate; embeddings optional only after benchmark.
- **FR-08** Default query returns **compact locator cards** (ID, short title, scope, kind, timestamp/freshness, top evidence ref, tiny preview); **no raw log body**.
- **FR-09** Typical recall uses **locate → read**. Read accepts exact authorized refs/ranges with aggregate byte/token ceilings. Optional timeline or graph traversal does not become a mandatory third hop.
- **FR-10** Graph nodes represent sessions, turns, tool calls, tools, files, processes, revisions, errors, test runs, outcomes, wiki claims and learned skills. Edges must be grounded in explicit identifiers/retained data (`belongs_to`, `invoked`, `read`, `modified`, `observed_failure`, `observed_pass`, `references`, `derived_from`, `supersedes`, etc.).
- **FR-11** Graph never equates chronology with causality. “Fix X caused test Y to pass” requires a separate explicit, checkable revision/test chain and confidence label.
- **FR-12** Keep graph/node traversal a **CLI/skill function**, not a large list of MCP public tools or unbounded full graph injected into model context.
- **FR-13** Index/search/read operations must expose freshness/generation, omissions, partial results and provenance. Search never secretly rebuilds all repos or invokes an LLM.
- **FR-14** Known-file/known-answer tasks that do not benefit from recall bypass Palace. Unknown/no match returns concise no-result, not speculative wiki.

### C. Wiki Palace and autonomous accumulation
- **FR-15** Reuse **one wiki backend** (first evaluate ReMe against OpenViking, retain replaceable backend interface). This backend is the durable knowledge palace; do not author our own wiki engine initially.
- **FR-16** Process evidence in bounded **end-of-task/session** or idle batches. Derive daily summaries, problem → tried paths → verified result → conditions → unresolved issues, and longer-lived linked pages.
- **FR-17** Every wiki claim links to available evidence refs, source revision/scope, extraction/model version, confidence/coverage, update time and applicability. Claims about current code need an explicit freshness check.
- **FR-18** Failed attempts and contradictions are valuable knowledge, not noise. Track what failed, why, and conditions; mark stale pages and superseded advice without losing prior versions.
- **FR-19** Wiki supports links between concepts, errors, technologies, procedures, repos and devices, so an agent can enter by problem and reach the relevant history.
- **FR-20** Wiki synchronization carries **authorized, redacted knowledge** and refs between G6/G8 and newly cloned repos. Raw private evidence stays in its authorized store unless a separately authorized explicit transfer occurs.
- **FR-21** No cross-user/owner leakage. Across repos of the SAME owner, distinguish `global reusable` from `repo-specific` knowledge; unknown owner or repo identity fails closed (no anonymous global fallback).
- **FR-22** Provider failure, unreachable wiki, corruption or stale corpus must **not block ordinary tool calls**. Serve last-good marked-stale knowledge or a typed unavailable response, never a fabricated success.

### D. New repository, zero manual teaching
- **FR-23** Supported agent startup automatically detects accessible repo/device/toolchain and Palace availability, without user-authored `AGENTS.md` instructions in the new repo.
- **FR-24** Start with a tiny locator/profile of prior relevant knowledge; only retrieve when task warrants. Never paste whole user profile, old conversations or wiki into a new context.
- **FR-25** Related experiences from another repo are discoverable through scoped tags, error/tool signatures and topic similarities; retrieval shows origin and compatibility conditions.
- **FR-26** Agent can resume work with verified wiki/skill pointers, exact session/revision refs and next-step hints, not a guessed recreation of previous actions.
- **FR-27** Support offline fallback to local indexed memories without allowing a denied remote lookup to bypass owner authorization.

### E. Skill learning, loading, merging
- **FR-28** Detect repeated useful procedures from task outcomes and wiki claims. Create/edit **agent-owned** versioned skills with short metadata, preconditions, steps, validation, known failures, evidence refs and revision.
- **FR-29** No manual approval for these agent-owned skill drafts or routine promotions. **Automatic validation** (syntax/sandbox checks, scope, secrets scan, unchanged safety-critical files, regression where relevant) is a required *machine gate*, not a user approval dialog.
- **FR-30** Skills are **lazy-loaded**: listing returns name/description/version/tags only; skill body, scripts and resources load only when selected for task relevance.
- **FR-31** A scheduled bounded curator deduplicates overlapping agent-owned skills, merges improved procedures, updates references, archives stale versions and maintains an audit/rollback manifest. No automatic merge into product Git main.
- **FR-32** Every curator pass has max token/call/time/bytes limits, distributed lock, idempotency key, changed-input gate and cancellation; idle/no-change periods cost essentially no LLM tokens.
- **FR-33** Back up the active skill tree before destructive merge, atomically publish on passing checks, auto-rollback failed or regressed versions. Built-in, user-authored and pinned skills are immutable to curator unless explicitly opted in.
- **FR-34** Agent feedback/success/failure updates skill confidence and applicability. One success cannot turn a narrow fix into a universal rule.

### F. Tool/API surface and compatibility
- **FR-35** Keep existing MCP Device v1.0.11 catalog and semantics intact; if external agent needs a shared entrypoint, prefer **one bounded search/recall facade** with progressive disclosure. Additional public tools need demonstrated utility and stable schema/version negotiation.
- **FR-36** Use CLI under existing `shell_execute` (or a single authorized transport) for graph, node, wiki maintenance and skill curator; do not build another auth/remote-shell broker.
- **FR-37** Preserve Gateway `develop` UI (24H/7D/30D), accounts, ownership, OAuth/pairing, WSS, remote processes and current skill catalog. No cherry-pick of an entire older Gateway Context branch.
- **FR-38** Never expose inaccessible wiki/evidence refs as a permissions side channel; reject unauthorized identifiers before existence lookup.
- **FR-39** Provide bounded CLI/MCP output, cursor pagination and compact structured errors with actionable cause (`INDEX_MISSING`, `SCOPE_REQUIRED`, `STALE`, `ACCESS_DENIED`, `BACKEND_UNAVAILABLE`), not enormous stack dumps.

## Data ownership and costs

- Raw event/session evidence defaults to local Device capture when authorized; shared wiki/skill pages live in the selected per-owner Palace workspace. Indexes are rebuildable.
- Budget BOTH foreground and background: model-visible prompt/response tokens, embedding tokens if any, extraction/dream/curation tokens, tool-call count, bytes, CPU/RSS/IO, wall time and search latency.
- Background summarization/consolidation is asynchronous from the *agent's perspective* but implemented as explicitly scheduled work with bounded queue, checkpoint and recovery; it must never silently run forever.
- Policy is **no manual skill approvals**; keep existing operating-system/account/device authorization and SOC-dependent capture safeguards unchanged.
- Secrets, protected user conversations and raw tool payloads must not migrate across owners or appear inside executable skills. Treat wiki/log content as untrusted data, not instructions.

## Success acceptance (binding, measured on frozen fixtures)

1. A cold agent on **new repo G8** recalls a useful solution produced on **G6** without a user guide, can open evidence, apply under the new repo's constraints and reach a correct result. Also demonstrate the converse and a no-match case.
2. Graph queries traverse a concrete **session → tool → error → changed file → test outcome** chain with correct refs, failures preserved and zero false “proven causality” links.
3. A second agent retrieves a relevant wiki page from historical sessions, expands **only** needed log refs and does not load complete chat logs into model context.
4. An automated scheduled pass merges two overlapping **agent-owned** skills, publishes a version with lazy-loaded body, and rolls back a failed/regressed merge; **zero user approval prompts**.
5. All owner/scope/secret isolation cases pass (zero unauthorized content); stale/contradicted advice cannot silently become authoritative.
6. Compare identical tasks using native tools alone vs Palace. Freeze total-token accounting **including LLM wiki/skill maintenance amortized over actual reuse**, correctness, latency and tool-call count. Target at least **30% fewer total model-visible tokens on repeated tasks** without lower correctness; if not measured, return **NOT_PROVEN**, not “efficient”.
7. Cold-start auto memory locator target **<=250 estimated tokens**, typical locate return **<=1200 tokens**, known-file/no-need case **zero Wiki LLM work**, typical lookup **<=2 calls** (locate + selected read). Freeze tokenizer and measurement definitions before test.
8. Compatibility: Device v1.0.11 contract/fixtures remain passing, existing Gateway UI and public tools do not regress, Windows/Linux including disconnect/reconnect behave correctly.

## Decisions explicitly still requiring engineering evidence

- ReMe vs OpenViking backend and interface/hosting model — PoC and version/license/security audit required, **not already selected for deployment**.
- Source session adapter(s) for Pi/CDPA/ChatGPT/Codex — they expose different hooks and privacy guarantees.
- Whether shared wiki is centrally hosted, synchronized Markdown/Git or hybrid — security, latency, deletion and offline tests decide.
- Whether current SQLite context DB should host additional event correlation/index tables or use a sidecar; no automatic migration of v1.0.11 raw corpus.
- Exact skill-curator schedule, quotas and similarity threshold; default candidate once per day/idle **only when changes exist**, subject to benchmark.

## Change control

Implement only after the active `plan.md` and `tasks.md` are independently reviewed with the actual repo/HEAD and frozen measurement contract. **No product changes, merges, server reload or schedule creation were authorized by this documentation cleanup.**