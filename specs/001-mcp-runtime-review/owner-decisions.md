# Round 4 Canonical Decision Dependency Matrix

Execution delegation has now been supplied by the operator; see
[execution authorization](execution-authorization.md). AUTH-D is AUTHORIZED-DELEGATED;
AUTH-A/R are delegated conditional on prerequisite gates, AUTH-N remains environment-conditional.
Technical OD decisions are delegated evidence-based choices, not interactive human pauses.
Table PENDING entries below denote policy/evidence not yet resolved, not lack of delegation.
OD-4 default B is provisional pending inventory; GOV-1 remains UNRATIFIED. This is the SOLE decision-to-task matrix; tasks reference these IDs,
not duplicate ranges. Direct requirements below propagate transitively through explicit
Depends lists. A pending approval-recording task may collect evidence but cannot claim approval.

Every approval later needs human identity/date, scope, rationale, chosen option, evidence,
policy version and expiry. No numeric discovery maxima are invented here.

| ID | Class / question and options | Directly blocks task IDs | Does NOT block | Required evidence | Status |
| --- | --- | --- | --- | --- | --- |
| AUTH-D | Authorization: approve bounded capture/materialization/dependency restore/build/oracle/calibration; or defer. Must specify wall time/evidence bytes/files/processes/cleanup duration, roots/hosts/routes/archive retention. | T002–T018 | Document revision; product decisions are not approved by it | execution-authorization.md initial bounded envelope; native test scope | AUTHORIZED-DELEGATED |
| AUTH-A | Authorization: permit isolated architecture source/test/build trials, with safety envelope; or defer | T020–T029 | Discovery; optional delivery | Seam inventory and bounded trial scope | PENDING |
| AUTH-R | Authorization: permit isolated core/domain/combination source/test/build work with bounded run/evidence envelope; or defer | T030–T062 | Discovery and architecture-only work | Accepted parent identities and scoped trial plan | PENDING |
| AUTH-N | Authorization: specific real Gateway/device/host credentials/routes permitted, or defer those calls | Any task actually contacting real Gateway/device: T017,T028,T037,T043,T046,T049,T055,T058,T061 when such calls occur | Offline/local native fixtures | Explicit owned target/allowed route/credential handling; absence is NOT_MEASURED | PENDING |
| OD-1 | Activation: approved finite per-instance accounting scope/saturation/drift or explicit limited exception; no broker assumed | Activation T032,T036,T037,T040–T049,T054; T030 requests approval before core work | Original oracle/discovery and architecture-only extraction | Calibration/route matrix/legacy impact | PENDING |
| OD-2 | Activation: process retention/max age/pipe escalation/overflow approved policy, or more discovery | Process source/activation T036–T038; T034 requests approval before domain composition | File-only operation leases (OD-1), architecture, optional scope | Process/disk/descendant recovery evidence | PENDING |
| OD-3A | Acceptance: calibrated sampling/protected-cost/statistical/stress procedure, or more discovery | Acceptance execution T028,T029,T033,T037,T038,T043,T046,T049,T053,T055,T058,T061,T062; T019 only requests approval | T002–T018 discovery MVP under AUTH-D only | Baseline calibration/raw/noise/required confidence and bounded effort | PENDING |
| OD-3B | Acceptance: required native/authorized route coverage and explicitly excluded claims | Acceptance execution T028,T029,T033,T037,T043,T046,T049,T055,T058,T061,T062; T019 only requests approval | Discovery oracle; optional scope | Native Windows/Linux runner/route inventory; missing required target blocks | PENDING |
| OD-3C-E | Optional exploration authorization/scope: bounded prototype allowed or deferred | Exploration execution in T050–T053 only; requesting/recording deferral does not require exploration approval | All required architecture/core/domain work | Frozen semantics/oracle and exploratory budget | PENDING |
| OD-3C-D | Optional delivery activation: chosen restricted semantics or defer after measurements | Delivery branch T054,T055 only; T055 unchanged-V1 deferral branch exempt | Required candidate acceptance; prototype not delivery | Equivalence and exploratory measurements | PENDING |
| OD-4 | Product support: A public stdio preserve/gate; B internal/dev migration preservation, no permanent promise; C retireable after migration proof | T020,T022–T029,T044–T049,T057–T062; T019 only requests choice | Baseline/original historical stdio comparator | Bins/README/users/callers/inspector/distribution evidence; no option selected | PENDING |
| GOV-1 | Governance: ratify proposed constitution or amend; no date until actual adoption | No task grants this automatically; T019/T062 record actual status | Explicit bounded execution authorization may be considered separately by human | Complete proposed principles and review | PENDING |

AUTH-D safety envelope ≠ OD-1/2 product activation ≠ OD-3A/B acceptance profile.
T018 certifies harness/provenance/sensitivity/bounded discovery only, never statistical
approval. OD-3C has two records to separate exploration permission from delivery approval.
Optional deferral still records T050 exploration disposition, T053 final disposition and
T055 final-scope pointing to unchanged COMBINED_V1. It skips implementation tasks T051/T052/
T054 and optional gate/recomposition portions of T055, not those record outputs. T053 needs
neither measurements nor OD-3C-D approval when exploration was deferred; T057 always consumes
T055. Future record-only tasks may be completed when their outputs exist; skipped implementation
tasks remain unchecked with explicit NOT_SELECTED disposition. All tasks remain unchecked now.
All actual real-device access also needs AUTH-N, independently of required-route choice.
If final required real-device evidence cannot be obtained, acceptance blocks rather than
silently shrinking OD-3B. Consumer gates inherit relevant OD requirements from parent tasks;
there is no competing phase-level approval list.
