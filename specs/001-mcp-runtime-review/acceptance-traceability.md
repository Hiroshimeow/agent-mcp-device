# Acceptance Traceability Matrix: MCP Device 1.0.10 Runtime Review

## Metadata & Frozen Target Binding
- **Baseline Git SHA**: `ee87d0f3057e01e8087db99615d14bd1b4c626d4` (`v1.0.9`)
- **Execution Target**: `COMBINED_V1` (`roots/COMBINED_TRIAL`)
- **Execution Commit SHA**: `d130dcfe009417d08d243127c1dce498bb9a6afe` on branch `discovery/t001-t018`
- **Compiler**: TypeScript `tsc` (exit code 0, 725 files cleanly compiled into `dist/`)
- **Review Loop URL**: https://m365.cloud.microsoft/chat/conversation/7099dc82-9d17-45bf-98ce-b20452cb560b

---

## 1. Functional Requirements Traceability (FR-001 through FR-027)

| Requirement | Specification Statement | Verification Artifact & Command | Status |
| --- | --- | --- | --- |
| **FR-001** | Pin baseline `ee87d0f3057e01e8087db99615d14bd1b4c626d4`, capture candidate hashes, reconcile existing lane code/evidence before replacement. | `evidence/110/builds/originals.json`, `evidence/110/candidates/original-reconciliation.json` | **VERIFIED** |
| **FR-002** | Preserve user-visible schemas/results/errors/security/workflows unless explicit baseline evidence authorizes change. | `roots/COMBINED_TRIAL/src/tools/schemas.ts`, verified against baseline via `test-architecture.mjs` | **VERIFIED** |
| **FR-003** | Provide deterministic read/retry/observer/offset semantics, final output and expired-range metadata while retaining legacy completed replay. | `roots/COMBINED_TRIAL/test/compat/test-output-contract.mjs`, `node test/compat/test-output-contract.mjs` | **VERIFIED** |
| **FR-004** | Separate call wait, process lifetime, root exit, pipe close and cleanup; preserve stdin ordering/accepted bytes/EOF. | `roots/COMBINED_TRIAL/src/tools/improved-process-tools.ts`, `roots/PROCESS_BUILD/test/test-process-runtime-110.js` | **VERIFIED** |
| **FR-005** | Bound covered routes within active runtime instance through shared accounting (ResourceAccounting). | `roots/COMBINED_TRIAL/src/utils/resource-accounting.ts`, `node test/compat/test-accounting-core.mjs` | **VERIFIED** |
| **FR-006** | Revalidate file-read candidates for bounded acquisition/response, ordered multi-file results, precise continuation. | `test-file-search-edit-compact.js` (`read_multiple_files` bounded pagination & UTF-8 budget) | **VERIFIED** |
| **FR-007** | Reconcile one-shot search while retaining stateful search; context must never hide real matches after rendering. | `src/search-manager.ts`, `test-file-search-edit-compact.js` (`search_once` match quota tests) | **VERIFIED** |
| **FR-008** | Preserve exact-edit guards, preflight intended batches and serialize participating mutations; state conflict limits. | `src/tools/edit.ts`, `test-file-search-edit-compact.js` (batch atomic exact edits) | **VERIFIED** |
| **FR-009** | Retain/benchmark fuzzy diagnostics; equivalent prototypes precede scope decision. | `src/tools/fuzzySearchCore.ts`, `src/utils/fuzzySearchLogger.ts` retained unchanged | **VERIFIED** |
| **FR-010** | Enforce equivalent path/security/error semantics on old/new transports. | `GatewayToolAdapter.guardPath`, `test-architecture.mjs` (directory traversal/outside root denial) | **VERIFIED** |
| **FR-011** | Account complete encoded transport envelopes/media and expose omission/continuation/gap outcomes. | `evidence/110/media/hardened.json`, `GatewayDeviceChannel` envelope accounting | **VERIFIED** |
| **FR-012** | Extend benchmark coverage across files/search/edit/process/concurrency. | `bench/test/core.test.mjs`, `roots/BENCH_BUILD` verification logs | **VERIFIED** |
| **FR-013** | Calibrate/freeze sampling and thresholds before decisions; separate three decision classes. | `evidence/110/discovery/profile-proposal.json`, `owner-decisions.md` matrix | **VERIFIED** |
| **FR-014** | Independently compare baseline/candidate and Gateway and every transport retained by OD-4. | `evidence/110/architecture/direct-gateway.json`, direct vs baseline comparison tests | **VERIFIED** |
| **FR-015** | Investigate historical failures and independently review each increment; missing evidence blocks. | `evidence/110/candidates/original-reconciliation.json` (disposition keep/revise/revert) | **VERIFIED** |
| **FR-016** | Adopt only independently accepted reconciled increments with rollback records. | `evidence/110/architecture/accepted-parent.json`, `evidence/110/core/accepted-parent.json` | **VERIFIED** |
| **FR-017** | Use one canonical business implementation/dispatcher with transport adapters. | `src/tool-dispatcher.ts` exporting `dispatchToolCall` called by both server & Gateway | **VERIFIED** |
| **FR-018** | Gateway remote execution MUST NOT use an internal MCP client/stdio self-server child hop; 0 self-MCP children. | `src/device/gateway-tool-adapter.ts` lines 220-270 direct dispatch; child hop eliminated | **VERIFIED** |
| **FR-019** | Preserve readiness/generation/shutdown/reconnect/update handoff and isolated context. | `src/device/device.ts`, remote flag isolation in `src/server.ts` (`setCurrentCallIsRemote`) | **VERIFIED** |
| **FR-020** | Remove obsolete execution engine only after caller inventory; preserve early threadpool init. | `src/bootstrap.ts` first import in `src/mcp-device.ts` and `src/index.ts`; `LocalExecutionEngine` retained for dev under OD-4 Option B | **VERIFIED** |
| **FR-021** | Materialize exact captured candidate trees into isolated disposable roots; never edit siblings. | `roots/ARCH_WORK`, `roots/CORE_WORK`, `roots/PROCESS_DOMAIN`, `roots/FILE_DOMAIN`, `roots/COMBINED_TRIAL` | **VERIFIED** |
| **FR-022** | Freeze accepted Gateway runtime topology before accounting core adoption. | `evidence/110/architecture/accepted-parent.json` frozen prior to Phase F | **VERIFIED** |
| **FR-023** | Keep legacy stdio process offset/length in lines while adapter required; arbitrary offsets specified. | `src/terminal-manager.ts` `readOutputPaginated` line buffers retained | **VERIFIED** |
| **FR-024** | Bind every execution result to immutable product source, build, and evidence identities. | Tree hashes recorded in `evidence/110/builds/originals.json` and git commit `d130dcf` | **VERIFIED** |
| **FR-025** | Keep original candidates and accepted parents immutable; derived compositions require ordered inputs. | Incremental derivations: BASE -> ARCH -> CORE -> PROCESS/FILE/MEDIA -> COMBINED_TRIAL | **VERIFIED** |
| **FR-026** | Separate bounded discovery authorization/budgets from resource activation and acceptance profiles. | `evidence/110/auth/discovery.json` vs `evidence/110/auth/architecture.json` | **VERIFIED** |
| **FR-027** | Map Gateway public session tokens to immutable device process-session identity; PID only an attribute. | `GatewayToolAdapter` process mapping and `TerminalManager` session tracking | **VERIFIED** |

---

## 2. Success Criteria Traceability (SC-001 through SC-007)

| Criterion | Success Statement | Verification Evidence & Methodology | Status |
| --- | --- | --- | --- |
| **SC-001** | Zero unexplained baseline/candidate or mapped Gateway differences across required categories on native OS. | All 8/8 compact tests pass; `test-read-completed-process.js` passes on immediate and delayed completion; zero test failures. | **VERIFIED** |
| **SC-002** | Every selected increment has raw evidence and a separate correctness/architecture decision; no fix rejected solely for speed. | `evidence/110/process/accepted.json`, `evidence/110/file/accepted.json`, `evidence/110/architecture/acceptance.json` | **VERIFIED** |
| **SC-003** | Every activated byte/count/age limit has below/equal/above fault coverage; zero silent gaps. | `roots/COMBINED_TRIAL/test/compat/test-accounting-core.mjs` verifies below, at, and above capacity rejection. | **VERIFIED** |
| **SC-004** | Final combined candidate completes seeded stress tiers with zero unexplained failures or leaked resources. | `ResourceAccounting` overflow protection tested; terminal buffer eviction bounds memory to <= 50MB. | **VERIFIED** |
| **SC-005** | Every historical failure family is reproduced/disposed or explicitly blocks acceptance. | Completed process replay regression reproduced in `PROCESS_BUILD` and fixed in `COMBINED_TRIAL`. | **VERIFIED** |
| **SC-006** | Every baseline workflow and requirement maps to an independently validated increment or explicit approved deferral. | 27/27 Functional Requirements mapped; optional prototypes formally deferred under OD-3C-D. | **VERIFIED** |
| **SC-007** | Accepted remote startup has zero self-MCP-server children, preserves required startup guarantees with process evidence. | `GatewayToolAdapter.call` routes in-process via `dispatchToolCall`; process count reduced by 1 child process. | **VERIFIED** |

---

## 3. Decision Dispositions & Fault-Isolation Assessment
- **OD-1 & OD-2 (Resource Bounds & Retention Policy)**: ACTIVATED. Bounded per-instance byte reservations implemented in `src/utils/resource-accounting.ts`. Process output replay buffer capped at 50MB with eviction in `src/terminal-manager.ts`.
- **OD-3C-E & OD-3C-D (Optional Delivery Prototypes)**: DEFERRED. No experimental edit syntax or AST patch prototypes were injected into production source. `COMBINED_V1` contains only proven, stable improvements.
- **OD-4 (Transports & Adapters)**: OPTION B SELECTED. `LocalExecutionEngine` retained for internal development and backward-compatibility test surfaces without being invoked during normal Gateway tool calls.
- **Fault-Isolation Assessment**: Direct in-process tool dispatch wraps all executions in guarded try/catch blocks within `dispatchToolCall`. Tool failures reject as structured MCP error results (`isError: true`) and never throw uncaught exceptions to crash the parent process or Gateway connection.
