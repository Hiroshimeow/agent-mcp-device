<!--
Sync Impact Report
Version: 1.0.0 (incorrectly labeled ratified) -> 2.0.0-proposed.
MAJOR rationale: redefine decision classes and aggregate-bounds governance; remove
cycle-specific operational restrictions, without implying prior human ratification.
Modified principles: I compatibility; II evidence/decision classes; III boundedness;
V gated candidate reconciliation. IV cross-platform acceptance retained.
Added principle: VI Architecture Simplicity and Canonical Behavior.
Removed section: Review Workflow and Release Restrictions (temporary instructions).
Replacement section: Development and Acceptance Workflow (durable gates).
Deferred: TODO(RATIFICATION_DATE): no human ratification has occurred.
Remove this scratch impact report before a future authorized commit.
-->
# MCP Device Constitution

**Status**: PROPOSED / UNRATIFIED. Normative rules below are the proposed review standard,
not evidence of human adoption or authorization to implement.

## Core Principles

### I. Compatibility and Security Before Change
Candidates MUST be compared against a pinned external baseline. For the current feature
that is v1.0.9 commit `ee87d0f3057e01e8087db99615d14bd1b4c626d4`.
Existing schemas, results, errors, security, and workflows MUST be preserved unless
baseline evidence, impact, migration/rollback, and explicit owner approval authorize drift.
Legacy/stateful/media/fuzzy workflows MUST NOT be deleted on intuition.

### II. Evidence and Distinct Decision Classes
Correctness/security fixes, architecture simplifications, and performance optimizations
MUST have separate acceptance criteria. Correctness fixes MUST NOT require a speed win.
Performance claims MUST use comparable workloads, calibrated repeated measurements,
raw provenance and median/p95 where statistically meaningful, with KEEP/REVERT/INCONCLUSIVE.
Unavailable metrics, failed samples, and incomplete platform evidence MUST be explicit.
Unratified numeric proposals MUST NOT be represented as product policy.

### III. Aggregate Boundedness and Observable Semantics
Every execution route, including legacy and Gateway/stdio adapters, MUST participate in
shared runtime accounting. A boundedness guarantee MUST NOT be claimed until finite
byte/count/admission/retention limits are calibrated, approved, and enforced for all
covered routes. Legacy-limit behavior changes require explicit drift approval; a temporary
exception MUST enumerate excluded guarantees, risks, and expiry and cannot count as full
bounded acceptance. No opt-in path may bypass aggregate accounting.
Process output, metadata, queues, waiters, memory, spill and payload resources MUST have
bounded ownership and termination/expiry rules. Gaps, failures, truncation and recovery
MUST be observable; bounds MUST NOT silently lose data or hide real matches behind context.

### IV. Windows and Linux Acceptance
Native Windows and Linux are equally required acceptance targets. Process trees,
paths/restrictions, Unicode/newlines, media, transport and cleanup MUST be tested on both.
Missing platform evidence is a blocker, never a pass. Exceptions require explicit owner
approval and independent review and MUST NOT be generalized into platform parity claims.

### V. Independent Candidate Reconciliation and Gates
Existing candidates MUST first be captured and reconciled, then independently verified,
classified keep/revise/revert, and integrated incrementally only after acceptance.
Lane DONE is evidence, not final integration acceptance. Shared changes MUST be gated
before dependent adoption. Reviewers MUST differ from authors. Historical failures MUST
be reproduced/disposed or remain blockers; short passes and emergency harness cleanup
MUST NOT erase product cleanup failures. Final combined compatibility, adversarial review,
seeded stress, leak and growth checks MUST precede release eligibility.

### VI. Architecture Simplicity and Canonical Behavior
Tool business behavior MUST have one canonical dispatcher/registry with transport adapters,
not duplicate implementations. Redundant internal self-proxy hops MUST be justified by a
real isolation/contract need or removed through a compatibility-gated migration. External
MCP support MUST remain a supported adapter. New abstractions/files MUST have a concrete
reason existing candidates/modules cannot be adapted with less risk. Simplicity MUST NOT
silently remove isolation, authorization, lifecycle or observability guarantees.

## Runtime and Security Constraints

Authorization and remote/local execution context MUST be explicit, isolated per request,
and enforced before execution and spill recovery. Transport adapters may map public
schemas but MUST NOT duplicate business logic or weaken restrictions. Resource policies
MUST distinguish externally constrained ceilings, observed baseline limits, calibrated
proposals, acceptance-tier workloads, and owner decisions. Data retention and cleanup
MUST not depend on a client eventually draining output.

## Development and Acceptance Workflow

Freeze baseline contracts and candidate provenance before alteration. Calibrate and
approve route coverage and policy before activation. Tests and independent equivalence
precede adoption; exploratory prototypes are not production acceptance. Every increment
MUST record its decision class, evidence, blockers and rollback trigger. Any material change
invalidates dependent evidence. Eligibility reports do not themselves authorize release.

## Governance

Human ratification MUST explicitly record approval and an actual ISO adoption date.
Until then this document remains proposed. Amendments MUST describe rationale, evidence,
compatibility impact, migration, exceptions and owner approval. MAJOR changes redefine/
remove principles; MINOR adds material guidance; PATCH clarifies without semantic change.
All design and acceptance reviews MUST assess each principle and report unresolved gates,
not mark proposals accepted because artifacts exist. Product and constitution versions
are independent. Temporary cycle commands and permissions belong to the user request,
not durable governance.

**Version**: 2.0.0-proposed | **Ratified**: TODO(RATIFICATION_DATE): UNRATIFIED — pending human approval | **Last Amended**: 2026-10-04
