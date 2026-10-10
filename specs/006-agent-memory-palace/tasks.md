# 006 — Active tasks only

All items **OPEN** on 2026-10-11. No implementation tasks in this list are DONE or implicitly authorized. Execute sequential phases P0→P6 with independent test evidence, **not** after assuming earlier specs 003–005 were built.

| Phase | Dependency | Exit criterion |
| --- | --- | --- |
| P0 Frozen baseline | Device 1.0.11 accepted source | Reproducible corpus, benchmarks, identity/security limits |
| P1 Session ingestion | P0 | Correct correlated, redacted, crash-safe events |
| P2 Search + log graph | P1 | Locate→read and supported bounded activity graph |
| P3 Wiki Palace | P2 | One chosen backend, grounded knowledge, bounded cost |
| P4 Cross-repo recall | P3 | New G8/G6 agent continues work with no user handoff |
| P5 Self-learning skills | P4 | Lazy-load, autonomous scheduled merge + rollback |
| P6 Gateway integration/release review | P2–P5 | Minimal safe integration, E2E/A-B proven |

## P0 — Pin truth before any feature code
- [ ] **T001** Verify G6 Device `main` HEAD and 1.0.11 acceptance; inventory actual installed Device/Gateway instances without modifying production.
- [ ] **T002** Inventory event schema/capture sources, missing session/turn IDs, CLI integrations, owner/repo scopes, retention and data gaps.
- [ ] **T003** Select agent clients for hooks (Pi/CDPA/Codex/ChatGPT only where supported); demonstrate real sample capture shape and limitations.
- [ ] **T004** Freeze replay corpus with prior successful and failed tool sessions, two repos/machines, ambiguous outcome, stale wiki and unauthorized data.
- [ ] **T005** Freeze A/B client/model/temperature, filesystem state, scoring rubric, counting of background Wiki/skill tokens, latency and no-memory controls.
- [ ] **T006** Record baseline correctness/tokens/calls/latency with memory disabled; save immutable per-fixture receipts and report `NOT_MEASURED` gaps.
- [ ] **T007** Audit candidate upstream ReMe/OpenViking/claude-mem/Hermes versions, license, security and actual integration surface; no premature selection.

## P1 — Capture tool/session logs
- [ ] **T008** Specify/validate versioned event contract: authenticated owner, device, repo, task, session, turn, tool call, parent, timestamps, refs, status, provenance and coverage.
- [ ] **T009** Design client session/turn adapter independent of current Device tool observer; avoid synthetic “verified” links from absent IDs.
- [ ] **T010** Design bounded redaction, secret exclusion, payload refs, retention and owner/repo permissions, compatible with v1.0.11 capture gates.
- [ ] **T011** Design deduplication, idempotent offset/import cursor, crash gap, queue limits, offline/cancel and last-good semantics.
- [ ] **T012** Implement and unit-test adapters only in separately authorized DEV task; avoid touching existing six `local_*` behavior.
- [ ] **T013** Test retry/replay, mixed-version devices, concurrent tasks, incomplete tool calls, missing transcript fields and access denial.
- [ ] **T014** Independent review of capture overhead, no secret duplication, no automatic reexecution, no cross-owner joins.

## P2 — FTS search and evidence-grounded activity graph
- [ ] **T015** Freeze search locator/read contract: compact cards, filters, authorized evidence refs, bounds, cursor and no-match/stale/errors.
- [ ] **T016** Specify owner-scoped FTS5 query fields for exact errors, tool, session/task, repo/device, file path and time.
- [ ] **T017** Map observed event graph nodes/edges; require provenance and explicit `observed` vs `inferred` labels.
- [ ] **T018** Plan CLI for `search`, `read`, `timeline`, `graph neighbors/path`; graph/node operations stay out of MCP catalog initially.
- [ ] **T019** Implement bounded index generation/rebuild and verified partial/stale behavior in authorized DEV lane.
- [ ] **T020** Test locate→read on each frozen fixture, exact negative results, cursor, redaction, crash/restart and permission checks.
- [ ] **T021** Verify no false causal edges and no mandatory code-source graph; record graph relation support/coverage, not just empty “0 false positives”.
- [ ] **T022** Verify known-file task uses no memory and <=2 recall calls for typical nontrivial task; compare tokens/latency to P0.

## P3 — One Wiki Palace, not a new framework
- [ ] **T023** Pin and audit ReMe prototype (Markdown, source refs, incremental digest, BM25 and CLI/API) on isolated sanitized data.
- [ ] **T024** Pin and audit OpenViking prototype on identical corpus (URI scopes, session ingestion, selective read, incremental update).
- [ ] **T025** Compare end-to-end recall correctness, Wiki contradictions/staleness, total LLM cost, offline portability, Windows/Linux and authorization. Pick **one** backend or report blocked.
- [ ] **T026** Define wiki adapter contract: pages/links, source evidence refs, revision, freshness, contradiction, delete and restore; prohibit two concurrent writers.
- [ ] **T027** Design background queue and dedupe keyed by changed session evidence, cost caps, task-end and idle scheduling, last-good publication.
- [ ] **T028** Integrate chosen Wiki via adapter only after P3 decision; no handwritten competing LLM Wiki subsystem.
- [ ] **T029** Verify false-positive memory, stale code change, failed tool outcome, bad user-supplied log instruction, quota and provider outage.
- [ ] **T030** Produce provenance audit and A/B sample demonstrating Wiki reuse vs native search without fabricated task success.

## P4 — Portable memory without manual guidance
- [ ] **T031** Specify repo lineage/global reusable vs repo-local owner-scoped memory namespaces; cross-repo refs cannot bypass raw evidence access.
- [ ] **T032** Design no-user-guide bootstrap hook: identity → small relevant locator or none, target <=250 estimated tokens, no full wiki dump.
- [ ] **T033** Implement/verify authorized G6-to-G8 sharing via the chosen backend workspace, preserving raw source device/revision identity.
- [ ] **T034** E2E: producer agent G6 completes task; fresh consumer agent in unrelated/new G8 repo recalls and correctly adapts validated solution without prior chat/manual `AGENTS.md`.
- [ ] **T035** E2E reverse direction and clone/worktree distinctions; missing owner, denied repo and offline Palace fail closed/use native tools.
- [ ] **T036** Demonstrate unrelated task/no-memory bypass and stale contradictory advice not selected as authoritative.

## P5 — Self-learning and scheduled automatic skill merge
- [ ] **T037** Define skill candidate from evidence/wiki, safe frontmatter, preconditions, tests, negative conditions and versioned provenance.
- [ ] **T038** Implement agent-owned skill creation/update without user approval dialogs, but with automated lint/sandbox/security/secret checks.
- [ ] **T039** Reuse existing lazy skill catalog: compact discovery; body/resources loaded only after chosen skill matches task.
- [ ] **T040** Define and implement curator once per frozen idle schedule, **only when inputs changed**, with bounded calls/tokens/time and distributed lock.
- [ ] **T041** Deduplicate/merge two overlapping agent skills; retain references/scripts and semantic applicability; leave user-owned/pinned/built-in skills unchanged.
- [ ] **T042** Versioned atomic publication, snapshot/rollback manifest and automated rollback on test failure or degraded outcomes.
- [ ] **T043** Validate bad-skill invalidation/restore, interrupted merge/resume, concurrent curators and no repeated idle LLM spending.
- [ ] **T044** Measure amortized background token cost vs reuse frequency; fail gate if overall cost worsens baseline.

## P6 — Minimal Gateway exposure and independent acceptance
- [ ] **T045** Decide if existing `shell_execute`/skills cover remote use. Add at most one minimal MCP facade only when P2–P5 show necessity.
- [ ] **T046** If Gateway code is required, start from latest **G8 `develop`**, reconcile specific seams, retain 24H/7D/30D/auth/WSS/skill catalog; NEVER merge old feature branch wholesale.
- [ ] **T047** Run preserved Device 1.0.11 Context acceptance (32 FR / 8 SC / 62 tasks), build, full Device Windows/Linux and Gateway targeted/full regressions.
- [ ] **T048** Run full cold agent/no-guide, historical failed-path retrieval, cross-owner denied, provider outage, wiki stale, skill rollback fixtures.
- [ ] **T049** Compute A/B correctness, *all* model tokens including background costs, call count, p50/p95 latency, CPU/RSS/IO and storage; freeze exact measurements.
- [ ] **T050** Independent review validates provenance, security, maintainability and measured utility; explicitly mark unmeasured gates `INCOMPLETE`.
- [ ] **T051** Only in a separately authorized release task: immutable build, backup SQLite/WAL and config, verify real catalog and compatibility, reload last with rollback and post-reconnect smoke.

## Definition of DONE

Every checked item must link to its source SHA, execution environment, exact command/harness, expected/actual output and durable evidence. **Spec/plan writing does not check implementation tasks.**

The task is not DONE if a fresh agent needs user guidance to find prior repo knowledge, wiki cannot link real evidence, skill merge needs manual per-skill approval, context size grows with total memory corpus, or background token costs are ignored.