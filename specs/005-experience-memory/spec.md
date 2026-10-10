# Experience Memory — proposed specification

Date: 2026-10-06. Status: research/specification only. This document proposes behavior and acceptance criteria; it authorizes no implementation, rollout, production enablement, or release.

## 1. Goal

Provide an optional, device-local, project/repository-scoped experience memory shared by agents taking turns in the same repository. Turn observed tool actions into evidence-linked candidate facts, decisions, procedures, failure modes, success patterns, and project knowledge; retrieve a small relevant subset only when the active task has a concrete unresolved question; verify it against current authoritative evidence; then record whether reuse helped, failed, or was irrelevant.

The intended outcomes are fewer duplicate tool calls and tokens, shorter time to a correct solution, and validated reuse across sessions/agents. These are hypotheses, not established benefits. Correctness, permissions, privacy, and isolation are non-regression gates and cannot be traded for lower cost.

## 2. Current state versus proposed state

### Current state (source reads versus historical reports)

- The pinned MCP Device delivery graph source/test definitions and context docs describe bounded retained-evidence/activity queries, not current source structure, causality or proof that an action caused an outcome. This repair read/hashes those sources and docs; it did not run tests or audit the historical acceptance sign-offs. Production activation is separately gated according to the pinned docs. Delivery/writing checkout identities differ; see `baseline.md` and the claim-specific receipts in `research.md`.
- Existing activity/history evidence is not a curated durable experience catalog. No evidence in the packet establishes an implemented project-local experience-memory feature in this integration checkout.
- Current-source/code graphs, history/activity evidence, and experience memory are different authorities. Existing NMem/global memory is also a separate authority; the packet does not establish that its scope/lifecycle is suitable for repo-local sharing.
- No local A/B evidence currently demonstrates memory benefit, SQLite/FTS5 suitability in the existing context store, or comparative performance against a separate store or NMem.

### Proposed state

A separately scoped experience-memory subsystem (name/transport/implementation undecided) with explicit capture-to-candidate curation, provenance and lifecycle, opt-in need-driven retrieval, live verification, feedback, and human-reviewed skill drafts. It must not alter existing history semantics or write through to global NMem. It should not require embeddings, an LLM, a graph database, a provider, or automatic prompt injection.

## 3. Non-goals and prohibited behavior

- No implementation in this task; no changes to `specs/004-context-v112/` or product code.
- No automatic prompt/system-message injection, always-on memory snapshot, or retrieval merely because the capability exists.
- No known-file bypass violation: for a small, known-file task already answerable with native tools, do not query experience memory.
- No blind replay, execution authorization, or automatic execution of a recalled command/procedure. A memory item is advisory and must be checked against task intent, scope, current files/configuration, tool availability, permissions, and relevant tests before use.
- No automatic conversion of every tool event or success-looking sequence into a reusable fact; no unsupported causal inference (e.g. “edit fixed test” without explicit corroborating evidence).
- No cross-owner, cross-repository, or cross-clone sharing. No implicit global NMem writes, imports, exports, synchronization, or fan-out.
- No memory overriding current source, tests, explicit user instruction, security policy, or authoritative retained evidence.
- No automatic skill publication, installation, loading, approval, or promotion. No self-modification of user-owned/bundled skills.
- No hidden indexing/rebuild/provider call on retrieval or status. No external service, vector/graph dependency, or LLM extraction requirement absent measured evidence and a separate decision.
- No product-performance claim based only on a microbenchmark, retrieval relevance, tokens alone, or upstream vendor/project metrics.

## 4. Concepts and data requirements

### 4.1 Evidence and candidate memory

Maintain a strict conceptual boundary between source evidence (retained event/evidence references and explicit human input) and a derived memory candidate. Every candidate must identify its provenance; evidence references do not themselves prove generality or causation.

A candidate record must, at minimum, carry:

- opaque candidate ID; owner and canonical repository identity (and any necessary worktree/revision scope);
- type: `fact`, `decision`, `procedure`, `failure_mode`, `success_pattern`, or `project_knowledge`;
- concise claim/content and applicability scope/preconditions;
- evidence references, evidence kind, and the observed result/feedback associated with each reference;
- author/source (agent or human), created/updated time, and extraction method (explicit human curation, agent-proposed, or other approved method);
- confidence/status and lifecycle: candidate, accepted, contradicted, stale, superseded, or withdrawn;
- version/revision and a reason/provenance link for any change, acceptance, contradiction, or withdrawal.

The chosen schema, evidence-ref authorization, content bounds, retention, redaction, deletion semantics, and encryption/key handling are design gates before implementation. Do not duplicate raw unredacted tool payloads into memory. Sensitive or unavailable evidence must be represented as unavailable, not reconstructed or copied without authorization.

### 4.2 Curation and feedback

Actions and results may produce a proposal for a candidate only through explicit, observable curation. A proposal must distinguish observations from inferences, link the supporting evidence, state limits/preconditions, and remain non-authoritative until accepted under a reviewed policy. User/agent feedback (`helpful`, `not helpful`, `incorrect`, `stale`, `not used`, or equivalent) is recorded separately from the claim and linked to the task/revision and item version. Feedback updates confidence/lifecycle only through a specified, auditable transition; one success does not imply universal validity.

The exact level of human approval required for ordinary memory cards is an open decision. Skill drafts have the stricter mandatory human review gate below.

### 4.3 Skill authoring boundary

If repeated evidence suggests a reusable procedural skill, the system may create a **versioned draft** only. The draft must include its proposed scope, rationale, supporting evidence refs, known exceptions/risks, version, and review state. It must be stored separately from active skills and must not be loaded or executable as an instruction before explicit human review and approval through a separately defined skill lifecycle. No autonomous autopromotion or edits to existing user-owned/bundled/installed skills are allowed. Approval is not proof of task benefit; later outcomes remain measurable feedback.

## 5. Isolation, identity, and authority

- Derive owner identity only from trusted local/device identity, not caller-supplied owner names.
- Resolve repository scope through the trusted repository resolver and canonical Git common-directory identity, consistent with existing context isolation. Worktrees of the same repository may share repo memory only if the identity policy explicitly allows it; unrelated clones/repositories and owners remain separate. No fallback to global/unscoped memory on ambiguity or scope failure.
- Authorize owner and repository before looking up IDs, refs, search results, or cursors. Opaque identifiers never grant access.
- Fail closed for ambiguous, inaccessible, untrusted, stale, or unauthorized scope. Record only safe typed failures; do not leak whether another owner's/repository's memory exists.
- Current source, tests, permissions, and fresh task evidence outrank derived memory. Memory can direct an agent to evidence but cannot be used to silently substitute for it.
- Preserve existing context/activity behavior and authority boundaries. Do not merge the memory store with the activity graph solely because both are local or evidence-linked.

## 6. Retrieval and agent workflow

1. Agent identifies the task and a concrete uncertainty that memory could address. If a known file/range or ordinary native tool resolves it, bypass memory.
2. If chosen, explicitly request one bounded lookup scoped to the active owner/repository, with a short task/query, result limit, and response-byte budget. No implicit retrieval, full-store dump, cross-store fan-out, or query-time index/rebuild.
3. Return concise candidate cards with type, scope/preconditions, status/version, confidence, evidence refs and freshness/known limitations. Report no-match, stale, unavailable evidence, or partial results explicitly. Results are suggestions, not instructions.
4. Agent opens authorized referenced evidence and/or checks current source, configuration, tests, tool availability, and permissions before relying on a card. Hydration must not substitute newer source for historical evidence or stale refs for current content.
5. Agent decides whether to apply an approach; any action executes through ordinary tools and authorization, never by blind memory replay.
6. Observe the outcome. Record feedback against the exact memory version and task evidence. Keep failure and non-use outcomes to enable invalidation and measure retrieval precision.
7. Stop when the task rubric is supported; do not repeat retrieval absent a new named uncertainty.

Retrieval ranking method, stale thresholds, result and byte limits, user-visible tool contract, and whether retrieval is exposed as an MCP tool or another explicit interface are intentionally undecided pending research/design review.

## 7. Storage decision to investigate

No backend is selected. Evaluate these options before implementation:

1. **Reuse device-local SQLite/FTS5** only if an inspection proves suitable ownership boundaries, schema/migration compatibility, locking/contention behavior, transaction/recovery behavior, retention/deletion policy, and no coupling that violates the existing store's responsibilities. Lexical matches are candidates, not proof of applicability.
2. **Separate SQLite database/file** if this gives a safer lifecycle/rollback boundary or avoids incompatible coupling; account for backup, permissions, locking, quotas, migrations, and duplicate-store overhead.
3. **Existing NMem** only after a capability/privacy audit establishes repo-local owner partitioning, device-locality, no unintended sync/injection, authorization, retention/deletion, provenance, and lifecycle compatibility. No implicit bridge or write-through is allowed.
4. **External database, Graphiti, vector search, embeddings, or LLM extraction** are not initial defaults. Reconsider only if simple local retrieval fails a predeclared acceptance need and a separate cost/privacy/dependency review approves it.

The pinned Graphiti README describes temporal context graphs. Historical research describes LLM/embedding and graph-backend requirements, but no deployment/configuration audit was performed here. Neither description establishes suitability for this local experience-memory scope. See the verification labels and source receipts in `research.md`.

## 8. Evaluation and measurable acceptance

### 8.1 Frozen A/B design

Before implementation or examining candidate results, freeze an evaluation manifest containing task fixtures, repository snapshots, owner/repo scope, evidence and expected answers/outcomes, model/client/agent versions and settings (if used), tool availability, trial/retry rules, platform, cache state, budgets/timeouts, scoring rules and measurement boundaries. Include a hashed initial memory-card corpus (including an explicitly empty corpus where required), exact card IDs/versions/statuses/scope, supporting historical evidence and outcomes, and extraction/curation/acceptance records with their actors, methods and policy versions. Preserve immutable snapshots or authorized reproducible artifacts for this evidence lineage; mutable refs alone are insufficient. Hash the manifest and each initial-state/lineage artifact, and retain every trial, including failed, slow, timeout, no-answer, harness-error, and retrieval-not-used outcomes.

Compare at minimum:

- **A — baseline:** same agent/client/model/config and native tools, no experience-memory retrieval; existing normal history/context capabilities may be used only as allowed by the frozen task protocol.
- **B — candidate:** same task state/config/permissions/native tools with the candidate memory capability and explicit need-driven retrieval.

Use paired task fixtures and frozen seeds/order where possible; conduct repeated runs for stochastic outcomes. Reset memory and evidence to the hashed initial state before each trial. Freeze acquisition/lifecycle rules and their scoring before runs: fixture-generated cards and feedback/invalidation transitions are permitted only through those preregistered operations, with every version and evidence link retained. They are not permission to manually tune ranking, memory contents, thresholds, or prompts on acceptance fixtures after the freeze. If a paired comparison or required metric cannot be measured, report `NOT_MEASURED`, not PASS.

Include at least these fixture classes:

- repeated known-file/trivial task where memory should be bypassed;
- repeated repo task with genuinely relevant, previously validated experience;
- at least one end-to-end cross-session/cross-agent acquisition-to-reuse fixture: a producer agent performs work, captures its observed outcomes and explicitly extracts/curates a candidate; acceptance under the frozen policy is recorded; a distinct fresh consumer agent in a later session, with no producer conversation or hidden transferred state, retrieves the acquired card, checks its evidence/current preconditions and attempts reuse. Shared inputs are only those declared in the frozen protocol. Include an incorrect or failed experience, the contradicting outcome, an auditable invalidation/status transition, and a subsequent lookup proving that invalidated advice is not silently reusable as current truth. Manually preloaded cards alone cannot satisfy this fixture; score acquisition, acceptance, consumer correctness and invalidation separately;
- near-match with wrong scope, changed version, stale or contradicted memory;
- prior failed procedure and a correct alternative;
- memory-free task despite other repo memories being available;
- owner/repository isolation and denied/ambiguous scope;
- new-task cold start, restart/resume, evidence-ref unavailable/expired, and memory-store unavailable/corrupt/degraded cases;
- skill candidate generation/review state proving drafts cannot load or autopromote.

### 8.2 Metrics and gates

Report per fixture and overall, with denominators and uncertainty:

- task correctness (rubric or patch/test results), terminal status, and baseline-correct to candidate-incorrect paired outcomes;
- validated reuse rate: retrieved card was applicable, its evidence/current preconditions were checked, and the resulting action was correct under the frozen rubric;
- false reuse rate: retrieved/applied item was inapplicable, stale, contradicted, wrong-scope, or unsupported;
- duplicate tool calls and total tool calls, including memory lookup, evidence hydration, validation and retries;
- actual model-visible context/token accounting where observable, and separately raw request/response bytes; do not substitute normalized JSON estimates for delivered context or call them provider-billed tokens;
- time-to-correct-solution and end-to-end wall time, including retrieval and verification overhead;
- storage/write/index/query time, CPU/RSS/IO and contention, plus setup, migration, maintenance and dependency footprint;
- acquisition costs separately from reuse costs: producer work, extraction, curation, acceptance/review, failed/rejected candidates and lifecycle/invalidation operations, including model calls and delivered context, tool calls, wall time/resources and any human review/curation effort (person-time and, if monetized, the declared rate). Attribute incremental memory work separately from ordinary task work without excluding either from end-to-end totals;
- retrieval/bypass rates and unnecessary memory calls, including no-search fixtures;
- isolation, authorization, redaction, stale-reference and failure-mode outcomes.

Acceptance requires all of the following before any benefit claim:

1. No correctness regression on any frozen baseline-correct fixture under the predeclared paired/adjudication rule; any unresolved comparison is `NOT_MEASURED`, not PASS.
2. Zero unauthorized cross-owner/repository disclosure or access, no stale/contradicted item silently presented as current truth, and no blind execution or skill autopromotion.
3. In bypass fixtures, zero unnecessary experience-memory retrievals and no hidden indexing/provider work.
4. Candidate B improves at least one predeclared primary efficiency outcome (duplicate calls, actual context tokens, or time-to-correct) on relevant-reuse fixtures, while not worsening the other primary outcomes beyond predeclared non-inferiority margins. Include lookup, evidence verification, retries, and setup/amortized costs. Any amortized efficiency claim must include extraction/curation/acceptance and human-effort costs, disclose the frozen reuse count/horizon and allocation rule, and report both acquisition-inclusive totals and marginal reuse results; do not treat preloaded cards or human curation as free.
5. On all fixtures combined, report complete costs and correct/failed denominators. Token reduction alone, a high retrieval score, or a success-only subset cannot PASS.
6. Validated reuse and false reuse meet numeric thresholds set and justified before candidate outcomes are viewed. No numeric threshold is established by this research; selecting thresholds is an explicit review item.
7. The chosen store passes the isolation, recovery, retention/deletion, migration, and contention checks for the selected device-local architecture.
8. The producer-to-fresh-consumer fixture demonstrates evidence-linked acquisition, recorded acceptance, validated cross-agent reuse and subsequent invalidation of incorrect/failed experience under the frozen protocol. A retrieval-only test with manually preloaded cards cannot establish this lifecycle or PASS this gate.

The numeric margins, repetition count, confidence/statistical method, sample size, token boundary, and amortization horizon are not evidenced by the supplied packet and must be preregistered in the evaluation plan. Do not invent a performance claim in this spec.

## 9. Security, privacy, and failure behavior

- Apply existing device-local trust, path/repository authorization, redaction, quota and key-management policy where applicable; any differences require explicit review.
- Bound memory content and every query/result. Escape/render untrusted content as data, not trusted instructions. Do not persist raw secrets or unredacted payloads.
- Retrieval/search/status are read-only and must not trigger indexing, extraction, external calls, or writes. Candidate extraction and lifecycle changes are explicit, observable operations.
- Handle database lock/quota/corruption, interrupted updates, missing/expired evidence, stale revision, and authorization failures without leaking data or blocking ordinary task tools. Preserve last-known-good data on failed publication; return typed unavailable/degraded state rather than partial results represented as complete.
- Retention, deletion, backup, owner re-pairing and repository removal semantics must be explicit before implementation. Deletion must account for candidate records and derived FTS/index rows without deleting independently governed activity evidence.

## 10. Open decisions and gates

Before implementation, the design review must resolve: memory-card acceptance authority; precise owner/repository/worktree identity rules; integration boundary with retained evidence; reuse-vs-separate SQLite decision; NMem audit outcome; schema and version transitions; extraction trigger/model (if any); retrieval interface/ranking/limits; staleness/contradiction policy; retention/deletion; security review; frozen A/B protocol and numeric acceptance thresholds; and skill-draft storage/reviewer workflow.

A positive experiment on SQLite/FTS5 does not by itself authorize production integration. Any move to embeddings, graph databases, providers, automatic extraction, global memory integration, or cross-repository scope requires separate evidence and approval. No implementation is specified here.
