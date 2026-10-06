# Feature Specification: MCP Device 1.0.10 Runtime and Compatibility Review

**Feature Branch**: `feat/mcp-device-1.0.10-integrate`

**Created**: 2026-10-04 | **Revised**: 2026-10-04

**Status**: PROPOSED — NOT READY FOR IMPLEMENTATION; owner decisions pending

**Input**: Existing feature amended after independent Astra and architecture reviews.
Preserve v1.0.9 behavior, reconcile existing candidates, simplify remote dispatch,
calibrate bounded resources, and independently gate changes. This revision cycle is
artifacts only, followed by read-only consistency analysis and human review stop.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trust reconciled candidates and comparable evidence (Priority: P1)

As a maintainer I can identify existing candidate changes and compare equivalent work
against baseline, without replacing useful implementations or accepting tracker claims.

**Why this priority**: Reconciliation and provenance precede product changes.

**Independent Test**: Baseline self-comparison detects planted differences and retains
raw failure/measurement identities without changing product behavior.

**Acceptance Scenarios**:

1. **Given** file lane accepted commits and dirty process work, **When** inventoried,
   **Then** code/evidence identity is captured and each increment is keep/revise/revert
   or pending, without equating lane DONE to final integration acceptance.
2. **Given** equivalent workloads, **When** measured on each target platform, **Then**
   warmups, repeats, raw samples, median/p95 where meaningful, latency/bytes and CPU/RSS
   availability are explicit and actual runtime identity is distinct from harness identity.
3. **Given** a correctness fix, architecture simplification or optimization, **When**
   judged, **Then** its separate evidence gate applies; a correctness fix needs no speed win.

---

### User Story 2 - Reliably read bounded process output (Priority: P1)

As a user I can start, read/retry/observe and interact with a process without unexpected
termination, silent gaps, unbounded resource ownership or changing legacy replay.

**Why this priority**: Output/lifetime errors break existing workflows.

**Independent Test**: Deterministic dual-stream/interactive children verify retries,
partial lines, final output, wait/lifetime separation and abandoned-resource cleanup.

**Acceptance Scenarios**:

1. **Given** multiple readers or a lost response, **When** the same explicit output range
   is requested within retention, **Then** reading is idempotent and does not alter others;
   expired ranges report a gap instead of claiming complete recovery.
2. **Given** legacy completed-session reads, **When** repeated, **Then** observed baseline
   replay remains unless owner-approved drift explicitly changes it.
3. **Given** wait expiry, root exit or descendant-held pipes, **When** state is returned,
   **Then** wait, lifetime, root exit, pipe closure, termination and output completion
   are distinct; cleanup has bounded deadlines rather than waiting forever for a client.
4. **Given** stdin/EOF/kill races or quota saturation, **When** requests resolve,
   **Then** accepted input order/count, EOF and descendant outcomes are observable;
   unavailable output is explicit and resources expire under approved policy.

---

### User Story 3 - Read, search and edit without hidden loss (Priority: P2)

As a user I retain established file/media/search/fuzzy workflows while candidate hot
paths provide bounded results, visible matches and deterministic edit semantics.

**Why this priority**: Smaller responses are not improvements if content is hidden.

**Independent Test**: Temporary resources exercise ordered multi-read, oversized matches,
context quotas, exact preflight, aliases and documented external-writer race limits.

**Acceptance Scenarios**:

1. **Given** bounded single/multiple-file reads, **When** a page is byte-limited,
   **Then** input order, per-file failure and precise continuation avoid skipped content.
2. **Given** capped search with large context, **When** rendered, **Then** actual matches
   retain reserved space through final encoding; omitted context and oversized matches
   are distinct, observable outcomes and ordering/consistency is declared.
3. **Given** exact edits, **When** absent/ambiguous/overlapping or snapshot-conflicting,
   **Then** preflight prevents unintended partial edits and participating mutations serialize.
4. **Given** an external writer, **When** it races a commit, **Then** the declared best-effort
   detection limits are not misrepresented as guaranteed cross-process atomic conflict detection.
5. **Given** batch/patch ideas, **When** evaluated, **Then** equivalent prototypes precede
   exploratory measurement and scope approval; fuzzy diagnostics are measured and retained.

---

### User Story 4 - Independently verify compatibility and resources (Priority: P2)

As a reviewer I can reproduce drift, security failures, leaks and growth on both platforms.

**Why this priority**: Focused lane tests cannot establish integrated acceptance.

**Independent Test**: Comparator catches planted differences; seeded runner preserves
failures and records product resources before emergency harness cleanup.

**Acceptance Scenarios**:

1. **Given** baseline/candidate and mapped transport calls, **When** compared,
   **Then** process/file/search/restrictions/transport/media/truncation/spill/concurrency/
   Unicode/newline/errors have zero unexplained differences on Windows and Linux.
2. **Given** approved limits and stress tiers, **When** seeded faults/boundaries run,
   **Then** byte/count resources, abandoned leases and post-cleanup growth are assessed
   by the frozen calibrated procedure with missing evidence blocking acceptance.
3. **Given** historical failures, **When** reviewed, **Then** each is reproduced/disposed
   or remains a blocker; emergency cleanup does not count as product cleanup.

---

### User Story 5 - Accept increments and stop for authorization (Priority: P3)

As an integration owner I accept independently reviewed increments and their combination,
with rollback criteria and no implicit release permission.

**Why this priority**: Final acceptance depends on earlier evidence and chosen scope.

**Independent Test**: A gate blocks a planted mismatch, missing platform or self-review,
and accepts a proven correctness fix without requiring a performance improvement.

**Acceptance Scenarios**:

1. **Given** shared components and dependent candidates, **When** adopted,
   **Then** prerequisite acceptance precedes dependent integration and material changes
   invalidate affected evidence.
2. **Given** accepted increments, **When** combined, **Then** independent compatibility,
   adversarial review and final native Windows/Linux stress validate the combination.
3. **Given** an eligibility report or this revision, **When** complete,
   **Then** work stops for human review without implementation/release actions being inferred.

---

### User Story 6 - Use one tool behavior across retained transports (Priority: P1)

As a device operator I can use Gateway tools without a redundant copy of the device's
own MCP server, while inventory-confirmed external workflows remain protected according
to the unresolved OD-4 support decision.

**Why this priority**: Required architectural simplification must preserve behavior,
security and lifecycle rather than merely remove a process.

**Independent Test**: Compare Gateway with retained adapters selected by OD-4, using
historical stdio as migration comparator where needed; inspect remote startup tree.

**Acceptance Scenarios**:

1. **Given** remote device startup, **When** the accepted simplification runs,
   **Then** Gateway requests execute through the same canonical tool behavior used by
   the canonical dispatcher and no self-MCP-server child is spawned; stdio disposition
   follows explicit OD-4 rather than assumed permanent public support.
2. **Given** corresponding Gateway and OD-4-retained adapter inputs, **When** called concurrently,
   **Then** mapped schemas/results/errors/restrictions and request context match their
   respective baseline contracts; remote context cannot contaminate local calls.
3. **Given** readiness, shutdown, reconnect or update handoff, **When** exercised,
   **Then** lifecycle remains correct without assuming the removed child PID exists.
4. **Given** architecture measurements, **When** judged, **Then** process count, startup
   memory/time, call latency and serialization overhead are evidenced; simplification
   is not automatically labeled a performance win.

### Edge Cases

- Split Unicode/CRLF/huge single lines, tiny chunks and simultaneous stdout/stderr.
- Lost response, retry after retention expiry, completed replay, reconnect/restart.
- Root exited with inherited pipes held open; spawn failure/fast exit; stdin EOF/kill race.
- Abandoned readers, active never-closing sessions, disk full, deleted/tampered spill.
- Queue/metadata/request count and byte saturation; escaping/base64/envelope overhead.
- Dense context before last match, oversized match/path, changing search tree and continuation.
- Empty search/replace, overlapping/sequential batches, external commit race, hard links/junctions.
- Gateway mapped errors, unsupported routes, remote/local context leakage, readiness/update PID removal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Pin baseline `ee87d0f3057e01e8087db99615d14bd1b4c626d4`, capture
  candidate revisions/diff/untracked hashes, and reconcile existing lane code/evidence before replacement.
- **FR-002**: Preserve user-visible schemas/results/errors/security/workflows unless
  explicit baseline evidence and owner-approved drift/migration/rollback authorize change.
- **FR-003**: Provide deterministic read/retry/observer/offset semantics, final output and
  expired-range metadata while retaining observed legacy completed replay.
- **FR-004**: Separate call wait, process lifetime, root exit, pipe close and cleanup;
  preserve stdin ordering/accepted bytes/EOF, spawn confirmation, exit codes and tree outcomes.
- **FR-005**: Bound covered routes within each active runtime instance through shared ownership
  accounting, not a machine-wide broker unless explicitly authorized, including
  output/metadata/records/waiters/queues/input/spill/concurrency counts and bytes; approved
  expiry must not depend on eventual drain. Do not activate unapproved legacy-limit drift.
- **FR-006**: Revalidate existing file-read candidates for bounded acquisition/response,
  ordered multi-file results, precise continuation and retained specialized media handlers.
- **FR-007**: Reconcile one-shot search while retaining stateful/document search; define
  ordering, consistency and continuation; context must never hide real matches after rendering.
- **FR-008**: Preserve exact-edit guards, preflight intended batches and serialize
  participating canonical-resource mutations; state actual external-writer conflict limitations.
- **FR-009**: Retain/benchmark fuzzy diagnostics; equivalent batch/patch prototypes and
  exploratory measurements precede scope decision and production acceptance.
- **FR-010**: Enforce equivalent path/security/error semantics on old/new transports,
  including spill recovery, search traversal, aliases and concurrent mutations.
- **FR-011**: Account complete encoded transport envelopes/media and expose omission,
  continuation, expiry, gap and error outcomes without claiming unavailable data complete.
- **FR-012**: Extend existing benchmark coverage across files/search/edit/process/background/
  concurrency and startup/remote dispatch with repeated raw Windows/Linux comparisons.
- **FR-013**: Calibrate/freeze sampling and thresholds before decisions; record metric
  attribution/availability, failed samples and equivalent work; separate three decision classes.
- **FR-014**: Independently compare baseline/candidate and Gateway and every transport retained by OD-4; historical stdio may remain a migration comparator,
  plus seeded stress, fault/boundary tests, leak and memory-growth checks on both platforms.
- **FR-015**: Investigate historical failures and independently review each increment and
  the final combination; missing evidence remains blocked.
- **FR-016**: Adopt only independently accepted reconciled increments with rollback records;
  eligibility does not authorize release. This revision ends at analysis/human review.
- **FR-017**: Use one canonical business implementation/dispatcher with transport adapters;
  preserve inventory-confirmed baseline-supported transports under OD-4, not assumed permanent stdio support.
- **FR-018**: After gated migration, Gateway remote execution MUST NOT use an internal MCP
  client/stdio self-server round trip; remote startup spawns zero self-MCP-server children.
- **FR-019**: Preserve readiness/generation/shutdown/reconnect/update handoff and isolated
  per-request context/authorization across direct Gateway and each OD-4-retained adapter.
- **FR-020**: Remove obsolete execution-engine code only after full caller/bootstrap inventory,
  compatible replacement and independent lifecycle evidence. Preserve early threadpool initialization,
  config/remote-feature/logging/PDF/error policy, runtime directory and environment assumptions.
- **FR-021**: Materialize exact captured candidate trees into separately authorized isolated
  disposable roots and verify tree/file hashes before editing candidate-only files; never edit siblings.
- **FR-022**: Freeze the accepted final Gateway runtime topology before accounting-core adoption;
  primitive tests, route adoption gates and final all-covered-route enforcement are separate evidence.
- **FR-023**: Keep legacy stdio process offset/length in lines while that adapter is required;
  internal per-stream text byte ranges, global raw audit ranges and Gateway approved mappings
  are separate. Arbitrary offsets/invalid UTF-8/tiny pages have exact specified outcomes.
- **FR-024**: Bind every execution result to immutable product source, oracle overlay,
  dependency composition, locked dependency restore, compiled build and evidence identities;
  source changes invalidate builds and affected gates before further runtime evidence.
- **FR-025**: Keep original candidates and accepted parents immutable; derived compositions
  require exact ordered inputs, conflict review, new build and inherited gate revalidation.
- **FR-026**: Separate bounded discovery authorization/budgets from resource activation
  and calibrated acceptance profiles; no approval may be inferred from a harness MVP pass.
- **FR-027**: Map Gateway public session tokens to immutable device process-session identity,
  with PID only an attribute; old session tokens must never resolve to a reused PID's new process.

### Key Entities *(include if feature involves data)*

- **Candidate increment**: provenance, existing code/evidence, keep/revise/revert disposition,
  decision class, prerequisites, rollback and independent acceptance.
- **Process output/session**: immutable identity, absolute logical ranges, retention/gaps,
  root/pipe/input/termination state and cleanup owner; no required reader registry.
- **Resource policy/lease**: covered routes, byte/count limits, classification/evidence,
  owner approval, maximum age, saturation/expiry behavior and release ownership.
- **Resource operation/search result**: authorized canonical identity, snapshot/race limits,
  ordered results/matches/context, continuation and mutation outcome.
- **Canonical tool and request context**: tool schema/handler, transport mapping, isolated
  authorization/config/telemetry context and lifecycle state.
- **Evidence/gate**: raw provenance, calibrated analysis, decision class, independent
  reviewer, both-platform results and unresolved blockers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero unexplained baseline/candidate or mapped Gateway/OD-4-retained-transport differences
  across all required categories on native Windows and Linux.
- **SC-002**: Every selected increment has raw evidence and a separate correctness,
  architecture or performance decision; no fix is rejected solely for lacking a speed win.
- **SC-003**: Every activated byte/count/age limit has below/equal/above and fault coverage;
  zero silent gaps, context-hidden matches or unauthorized recovery.
- **SC-004**: Final combined candidate completes owner-approved seeded sustained/stress
  tiers on both platforms with zero unexplained failures/leaked owned resources and no
  unexplained growth under the frozen calibrated procedure.
- **SC-005**: Every historical failure family is reproduced/disposed or explicitly blocks
  acceptance; missing platform/route evidence never counts as pass.
- **SC-006**: Every baseline workflow and requirement maps to an independently validated
  increment or explicit approved deferral.
- **SC-007**: Accepted remote startup has zero self-MCP-server children, preserves required
  startup guarantees and OD-4-confirmed surfaces, with process-count/memory/call cost evidence.

## Assumptions

- File lane commits 2968280 and 6a5f43f are accepted lane inputs with durable DONE evidence,
  not final combined acceptance. Dirty process and incomplete bench/compat/review/stress
  evidence require reconciliation. Existing work is not an unimplemented blank slate.
- Explicit per-stream text offsets and separate global raw audit offsets define idempotent reading, subject
  to candidate verification; legacy implicit reads remain an adapter.
- All covered execution routes within each runtime instance share accounting. Legacy-limit drift cannot be activated until
  owner approval; no unbounded route is silently excluded from a full guarantee.
- Existing numeric proposals (256 KiB response, 1/32 MiB retention, 64 MiB spill/session,
  16 processes, 4 workers, 64 queue entries, 10%/5%, 5/30 samples and 10000/60-minute stress)
  are not ratified policy. Classification/calibration is required before activation.
- Local/Gateway schemas differ intentionally; equivalence compares documented mapping,
  not naive identical tool names. Unsupported routes must retain explicit errors.
- This request authorizes a complete document revision even with owner decisions pending;
  it overrides generic template wait-to-resolve behavior for this revision only. No
  implementation readiness or owner choice is inferred from completing plan/tasks.

### Owner Review Decisions (unresolved)

All decisions are PENDING in [owner-decisions.md](owner-decisions.md): OD-1 enforcement/
legacy drift; OD-2 process expiry/escalation; OD-3A statistics/stress; OD-3B required routes;
OD-3C optional exploration/delivery; OD-4 stdio support status; GOV-1 ratification.
The split is explicitly requested, not compressed into a global activation blocker.
Architecture does not depend on optional batch/patch approval. No decision is inferred.

Round-3 evidence: Gateway access policy currently caps input/output serialized JSON at
48 KiB; underlying network ceiling still needs discovery, safe per-tool budgets may be
lower. Existing 256 KiB proposal does not apply as a Gateway cap. Candidate-only files
are absent here; future materialization precedes edits. Evidence MVP changes no product
semantics. Final accounting guarantee waits for frozen topology and every route adoption.
Legacy line reads, Gateway public sessions and new internal byte ranges use explicit
adapters. Best-effort conflicts and weak search consistency remain review proposals.
