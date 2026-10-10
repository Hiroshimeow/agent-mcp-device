# Human-Facing Wiki Contract — P4

Status: proposed P4 contract for independent review. No product implementation is authorized.

## 1. Role and authority

Wiki is a derived human-comprehension layer.

Authority order for current repository facts:
1. authorized current source;
2. deterministic P3 code graph with exact provenance;
3. generated wiki.

Historical facts remain grounded in 002 activity/checkpoint evidence.

A wiki page:
- may summarize, connect and visualize evidence;
- MUST NOT become evidence merely because it was generated;
- MUST carry source/evidence refs and freshness;
- may be stale/unknown and still readable if clearly labeled.

Wiki is not required for ordinary coding correctness.

## 2. Storage boundary

Reuse the existing scoped device-local context store.

Wiki-derived tables/blobs are logically separate from:
- retained event/history evidence;
- activity graph;
- P3 code graph;
- NMem.

Canonical P4 wiki storage may include:
- wiki generation metadata;
- page records;
- structured sections;
- diagram records;
- source manifests;
- page links;
- generation/update jobs;
- bounded provider usage/cost metadata.

It MUST NOT store provider credentials or raw provider secret headers.

Gateway does not persist wiki corpus, source bundles, generated page bodies or provider secrets.

## 3. Public tool surface

Enable only the already-reserved `local_wiki` name on devices advertising `wiki-v1` through the existing context capability/version channel.

Initial actions:
- `status`;
- `list`;
- `read`;
- `estimate`;
- `generate`;
- `update`;
- `lint`;
- `cancel`.

No second wiki MCP server/tool family is added.

Old devices preserve 002 behavior:
- wiki capability absent;
- generation/read actions return typed `WIKI_DISABLED`/`ACTION_UNSUPPORTED`;
- gateway never strips new fields/actions and falls back to another semantic.

G-SCHEMA must measure final action/schema growth and old-device behavior.

## 4. Read-side progressive disclosure

### status

Returns bounded metadata only:
- capability/enabled state;
- generation-enabled/provider-configured booleans;
- published wiki generation;
- page counts by freshness;
- active/recent wiki job summary;
- last lint state.

No provider/network call.
No source scan/index/rebuild.

### list

Returns compact cards:
- `wiki_ref`;
- page kind/title/summary;
- target/seed ref summary;
- wiki generation;
- `freshness=current|stale|unknown|missing`;
- source/evidence counts;
- section/diagram counts;
- updated time;
- optional lexical title/tag filter.

It returns no full page bodies and creates no wiki full-text/vector index.

### read

Input includes one scoped wiki/page ref and mode:
- `card` — default;
- `section` — one stable section id;
- `full` — explicit bounded full page.

`card` returns metadata + summary + section table-of-contents + freshness/source counts. The summary is explicitly derived wiki text; compactness never upgrades it above its evidence/freshness metadata.

`section` returns one section body + evidence refs + related diagrams for that section.

`full` returns rendered Markdown within explicit/owner response bounds and supports continuation.

No read action calls provider, syncs, indexes or refreshes source state.

Human UI may render a complete page independently; MCP agent access remains progressive.

## 5. Wiki target model

Generation is explicit-target driven.

Supported target kinds:
- `repository_overview`;
- `feature`;
- `module`;
- `symbol`.

A target binds:
- title/name;
- repo/worktree;
- seed code refs and/or allowed source paths;
- optional spec/test refs/paths;
- optional selected activity/checkpoint refs or history flag;
- requested sections/diagram purposes;
- source/budget profile.

P4 MUST NOT auto-create one page for every file/symbol/module merely because they exist.

## 6. Structured page model

Provider output is staged into a validated structured model before publication.

### WikiPage

Fields include:
- opaque `wiki_ref`;
- page kind/title/summary;
- repository/worktree;
- target refs;
- wiki generation;
- source manifest ref;
- provider/model profile id (non-secret);
- schema/template version;
- rendered content hash;
- freshness;
- published time;
- sections[];
- diagrams[];
- internal links[];
- warnings/gaps.

### WikiSection

Fields:
- stable section id;
- heading;
- Markdown body;
- evidence refs[];
- optional claims/gaps metadata.

### WikiDiagram

Fields:
- stable diagram id;
- purpose `architecture|flow|sequence`;
- Mermaid source;
- evidence refs[];
- validation state.

Rendered Markdown/HTML is derived from this structured model.

Unknown provider refs, wrong-scope refs and broken wiki refs fail validation/publication.

## 7. Content contract

A feature/module/symbol page may include, only when evidence exists:
- purpose/scope;
- specs/requirements;
- entry points;
- important files/symbols;
- architecture/components;
- code/control flow;
- data flow;
- sequence flow;
- invariants/security boundaries;
- tests;
- relevant recent changes;
- known gaps/unsupported dynamics;
- source/evidence refs.

A repository overview may summarize selected module/feature pages and top-level code graph structure but MUST NOT recursively ingest every generated wiki page as authority.

Rules:
- no empty boilerplate sections solely to satisfy a template;
- current-code claims require current source/code refs;
- historical/recent-change claims require activity/checkpoint refs with time/revision context;
- tests/build/deploy claims require current test/config/source refs;
- dynamic behavior not proven by P3 is labeled uncertain/unknown;
- provider-generated explanation cannot upgrade `unknown` to `verified`;
- source/raw evidence outranks wiki prose on conflict.

## 8. Source manifest

Each estimate/generation target produces a scoped source manifest.

Allowed source classes:
- P3 code refs/nodes/edges/generation metadata;
- guarded current source spans/files;
- authorized repository specs/tests/configuration;
- selected 002 activity/checkpoint evidence when requested.

Manifest records:
- repo/worktree;
- code generation/source manifest id;
- exact selected code/source/history/spec/test refs;
- source fingerprints where applicable;
- activity generation/event watermark when used;
- coverage/gaps;
- redaction/egress eligibility;
- total selected source bytes;
- manifest hash.

Previous wiki prose may be used only as update context with its original source manifest; it is never standalone authority.

NMem is not a wiki source for code facts.

## 9. Estimate/plan contract

`estimate` performs local source planning only.

It may:
- resolve explicit target refs;
- inspect already-published code/history/wiki metadata;
- perform bounded authorized source selection/hydration needed to size the plan;
- apply exclusions/redaction;
- calculate source bytes and deterministic token estimate;
- evaluate owner hard caps/provider-profile availability.

It MUST NOT:
- call any provider/network endpoint;
- start generation;
- create published pages;
- bypass filesystem/repo authorization.

Output includes:
- opaque scoped `plan_ref`;
- operation `generate|update`;
- targets;
- source manifest summary/hash;
- provider/model profile id (non-secret);
- estimated input bytes/tokens;
- output/page/diagram budget;
- retries/deadline/concurrency;
- cost estimate or `unknown`;
- warnings/gaps;
- expiry.

`plan_ref` binds source selection/budgets and is NOT proof of human approval.

## 10. Generate/update contract

`generate`/`update` require **both independent authorization gates** before any provider/network work:
1. owner-local wiki/provider/egress policy permits the operation; and
2. trusted execution context proves this operation is covered by an explicit user request.

They also require:
- provider profile configured/allowlisted;
- valid scoped `plan_ref`;
- plan not expired;
- source generation/fingerprints still compatible with plan;
- idempotency key.

### Explicit user-request provenance

The user-request gate is independent from all agent-mintable data.

It MUST NOT be established by MCP arguments, `plan_ref`, preview/content hashes, idempotency keys, agent-generated tokens, or an unrelated earlier wiki request.

Trusted provenance may come from an existing client/runtime execution-context signal outside the MCP argument surface. It must be bound narrowly enough to the current generate/update operation, repository/worktree, planned target set, and request/session scope to prevent stale, replayed, or unrelated authorization.

If the runtime cannot provide trustworthy user-request provenance, `generate`/`update` remain disabled/unsupported and return a typed denial before provider egress. P4 does not invent a general approval-token framework merely to bypass this fail-closed rule.

Bounded retry of the same already-authorized wiki job may remain within the original request scope and approved plan budget. A restart/interruption never creates fresh authorization and never auto-resumes provider work.

Before provider egress:
1. re-authorize scope;
2. revalidate manifest/currentness within plan rules;
3. materialize only selected redacted evidence;
4. enforce egress/source budget.

Provider receives:
- no arbitrary local tool access;
- no command execution;
- no filesystem browsing;
- no unrelated repo/home/state-root data.

Provider output is staged, parsed, linted and source-ref validated before publication.

Source drift after estimate:
- typed `WIKI_PLAN_STALE`/equivalent;
- no silent re-plan;
- no hidden second provider call.

Update operates only on explicitly selected page refs/targets or explicit stale-set in the plan. No automatic repository-wide regeneration.

## 11. Provider profile and egress

Provider profiles are owner-local configuration outside the wiki corpus.

MCP args never contain:
- API key;
- secret header;
- arbitrary endpoint override;
- credential path.

The provider profile may expose safe metadata:
- profile id;
- endpoint class/name;
- model id;
- pricing-known flag;
- max owner caps.

Outbound endpoint must be locally allowlisted.

Pre-egress filter rejects/excludes:
- `.env`;
- credential stores;
- private keys/cert secrets;
- excluded paths;
- state DB/root paths;
- owner/device secrets;
- unrelated repositories/home data;
- known secret canaries.

If required evidence is blocked by egress policy, generation either:
- omits/marks the affected section uncertain; or
- fails the target as insufficient coverage.

It MUST NOT silently send blocked evidence.

## 12. Trigger/side-effect discipline

Provider/network calls are allowed only for explicit:
- `generate`;
- `update`.

Zero provider calls from:
- startup;
- `status`;
- `list`;
- `read`;
- `lint`;
- `estimate`;
- local_search/NAVIGATE;
- history/code sync/rebuild;
- idle/background maintenance.

A tool arg or plan ref never claims human consent.

Provider egress always requires both owner-local egress policy and trusted explicit-user-request provenance. A client/UI confirmation may be the source of that trusted runtime provenance, but it is not optional policy decoration. If no trustworthy provenance channel exists, provider generation/update stays disabled/unsupported. No self-issued MCP field, `plan_ref`, preview hash or agent token can substitute for this gate.

## 13. Job lifecycle and last-good publication

Generation/update may run as a bounded scoped wiki job.

WikiJob records:
- job ref;
- operation;
- plan ref;
- target/page refs;
- provider/model profile id;
- idempotency key;
- state/progress;
- attempt/retry count;
- deadline;
- usage/cost-known;
- staged generation id;
- errors/warnings.

States:
`queued|running|validating|published|failed|cancelled|interrupted`.

Rules:
- provider/model work never occurs under long DB write transaction;
- staged outputs are invisible to normal reads until published;
- timeout/rate-limit/empty/invalid response does not replace last-good;
- retries are bounded by approved plan;
- cancellation stops wiki job only;
- process restart/interruption does not auto-resume or auto-call provider;
- a later explicit action is required to retry/resume via a new/valid plan as policy defines.

## 14. Generation and staleness

Wiki generation is distinct from code/activity generations.

Each published page/source manifest stores:
- code generation/source manifest used;
- activity generation/watermark if used;
- exact source refs/fingerprints;
- provider/model id;
- template/schema version;
- page content hash.

Freshness values:
- `current`;
- `stale`;
- `unknown`;
- `missing`.

Conservative rule:
- known change to a referenced authority generation/source without page dependency revalidation => stale;
- inability to prove current without new scanning => unknown;
- ordinary status/list/read never scan/reindex just to upgrade freshness;
- explicit lint/estimate/update may perform bounded revalidation.

Over-staling is acceptable.
Silent stale-as-current is not.

Last-good stale page remains readable with its state visible.

## 15. Diagrams

P4 supports derived Mermaid for:
- architecture/component relationships;
- code/control/data flow;
- sequence flow.

Every diagram:
- is marked derived;
- has source/evidence refs;
- is generated only from evidence available in the page manifest;
- cannot turn unsupported P3 dynamic calls into a deterministic sequence;
- forbids external click/link/script/HTML behavior;
- passes bounded local syntax/structure validation before publication.

Diagram failure may fail only that diagram/section if the page remains truthful and the gap is reported; owner policy may require whole-page failure.

No remote diagram renderer is required.

A new Mermaid parser/renderer dependency, if implementation chooses one, requires package/license/size review and must not trigger provider/network work.

## 16. Lint

`lint` is local-only and provider-free.

Default lint is structural/page-local and MUST NOT silently hydrate or scan broad repository source. Optional source-currentness revalidation, when explicitly requested, is bounded to the page source manifest and reports checked refs/bytes/work counts.

Checks include:
- page/source ref existence/scope;
- wrong-generation/stale refs;
- broken internal wiki links;
- source-manifest consistency;
- required section evidence refs;
- unknown/foreign provider refs;
- placeholder/empty generated sections;
- prohibited secret markers/content;
- redaction leaks;
- diagram syntax/unsafe directives;
- historical/current authority mixing;
- unsupported `verified` wording when evidence is only reported/derived;
- page/generation content hashes.

Lint can return warnings/errors but does not auto-fix via provider.

## 17. Cost and budgets

Owner-local config supplies hard ceilings. A plan/request may only tighten them.

Budget dimensions:
- source refs/files/spans;
- source bytes/egress bytes;
- estimated provider input tokens;
- max provider output tokens;
- page/diagram count;
- attempts/retries;
- deadline;
- concurrency;
- local artifact quota.

P4 does not freeze arbitrary numeric defaults without measurement.

Token estimate for local planning may use the existing deterministic UTF-8-bytes/4 convention and MUST label it estimate, not provider billing.

After provider call, retain provider-reported usage classes when available:
- input;
- output;
- cached;
- reasoning/other documented classes.

Cost is calculated only from owner-configured prices for the exact provider/model/usage class.
Unknown price/usage => `cost_known=false`.

Report model/network latency separately from local planning/store/lint latency.

## 18. Export/manual edits

P4 v1 does not add MCP export or arbitrary page-write actions.

Canonical generated wiki remains device-local.

Optional future local-owner CLI/UI export/edit may be added later, but:
- it must use existing path guards;
- export must be explicit;
- it must not silently write repo `docs/`;
- human override/conflict semantics require their own reviewed contract.

This avoids adding repo mutation and arbitrary generated-content write paths to P4 v1.

## 19. Retrieval/token-efficiency rules

Wiki is optional for agent reasoning.

- P2 NAVIGATE may expose wiki availability/freshness card only.
- ordinary code tasks do not auto-call wiki.
- `list`/default `read=card` are compact metadata.
- section/full bodies require explicit selection.
- wiki does not add a full-text/vector index in P4 v1.
- main-agent token accounting for wiki reads remains part of P2 benchmark traces.

Acceptance:
- S1/S5 fixture traces retain zero automatic wiki-provider calls and zero unnecessary wiki body reads;
- P2 correctness/token/call gates remain unchanged;
- wiki generation provider tokens/cost are measured separately from the main agent retrieval context.

## 20. Acceptance gates

### Authority/grounding
- every generated section has valid scoped evidence refs or is explicitly marked as gap/uncertain;
- current-code claims cannot be grounded only in prior wiki/history summary;
- recent-change claims require activity/checkpoint refs;
- source/raw evidence wins conflicts;
- stale/unknown state is visible.

### No hidden provider
- provider calls from status/list/read/lint/estimate/search/NAVIGATE/sync/idle = 0.

### Egress/security
- wrong repo/source ref denied;
- cross-repo manifest denied;
- excluded-path/secret canaries absent from provider request and persisted page;
- provider endpoint/profile override via MCP denied;
- provider secret absent from args/logs/store/output;
- gateway corpus marker absent.

### Source consistency
- source change between estimate and generate => stale-plan conflict before provider/publish as appropriate;
- source change during generation before publish => conflict; last-good retained;
- no silent re-plan/retry outside approved budget.

### Publication
- invalid/empty provider output does not replace last-good;
- bad refs/broken links/prohibited diagrams fail lint/publication;
- interrupted job no auto-resume;
- cancel affects wiki job only.

### Progressive access
- list/read-card contain no full page body;
- section mode returns only selected bounded section;
- full mode requires explicit request/bounds/continuation.

### Cost
- estimate performs zero network calls;
- unknown pricing remains unknown;
- raw provider usage/attempts retained when available;
- retries/deadline/concurrency obey plan/owner ceilings.

### Diagrams
- evidence refs exist;
- syntax/safety validation passes;
- unsupported dynamic flow is not rendered as proven sequence.

### Schema
- only `local_wiki` is enabled; no extra wiki MCP tools;
- old-device behavior remains typed;
- G-SCHEMA target is measured before rollout.
