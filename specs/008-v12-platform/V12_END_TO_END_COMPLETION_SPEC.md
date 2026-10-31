# MCP Device v12 (1.0.12) + Palace CLI/Skill — End-to-End Completion SPEC

**Spec ID:** MCP-V12-E2E-20261024
**Status:** EXECUTION SPEC / NOT YET ACCEPTED
**Owner model:** ONE implementing agent, with independent M365 Opus 5.5 reviews at decision gates.
**Updated:** 2026-10-24 (Asia/Tokyo)
**Language:** Vietnamese; technical contracts and machine-readable receipts in English.
**Product:** Continue @hcu-lab.me/mcp-device. No replacement product or CDPA project.

## 0. ĐỊNH NGHĨA "HOÀN THIỆN"

V12 được chấp nhận khi và CHỈ KHI: (1) Device/Gateway parity và production behavior không kém v11; (2) Palace là plugin **phân phối/cài đặt độc lập**, có thể disable/uninstall/reinstall mà không ảnh hưởng Device Core, nhưng được auto-install/enable theo default distribution policy; (3) CLI là API chính của Palace, agent học cách dùng qua Palace Skill, không cần Palace MCP service; (4) CLI retrieval và cơ chế learning/validation hoạt động chính xác trên dữ liệu thật, không phá single-writer hoặc provenance; (5) actual LLM usage A/B có kết quả, không suy từ byte/card count; (6) tarball cold-install/upgrade/rollback Win+Linux và stress/soak đủ bằng chứng; (7) rollout G8 không phá OAuth, pairings, 8101/8102, Cloudflare và các Device v11; (8) toàn bộ evidence được lưu, không còn blocker Severity-1/2 chưa xử lý.

Các trạng thái cuối được phép: **RELEASE_READY**, **RELEASE_BLOCKED_WITH_EVIDENCE**, **ROLLED_BACK**. Không tự báo DONE chỉ vì test compile, fixture PASS, Card count tăng hoặc Opus đồng ý bằng lời.

## 1. SOURCE-OF-TRUTH / HIỆN TRẠNG GHI NHẬN

### 1.1 Repositories / machines

- Authoritative implementation worktree: G6 Windows, E:\git-project\agent-mcp-device-v12, branch feat/v12-platform-20261022.
- Observed HEAD on G6 and G8: 1e454c1, feat(v12): CLI-first Palace and dual loopback MCP listener.
- G6 **DIRTY WIP exists and is relevant**; DO NOT reset, stash, delete or overwrite:
  - Modified package.json and test/v12/server-package-cold.test.mjs.
  - Untracked scripts/v12/build-palace-package.mjs, scripts/v12/install-palace-skill.cjs, test/v12/palace-distribution.test.mjs.
  - Additional untracked .tmp/ and nul; inspect ownership before doing anything, do not delete casually.
- G8 Linux production checkout: /home/ayumi/Workspace/git_project/agent-mcp-device-v12. At observed check, clean HEAD 1e454c1.
- G8 production process: mcp-device-v12-8102. Two listeners from same server process: 127.0.0.1:8101/mcp (G8 local) and 127.0.0.1:8102/mcp (Cloudflare origin), public https://device.hcu-lab.me/mcp. Both preserve account/OAuth; localhost is NOT auth bypass.
- Existing remote Device processes remain mostly 1.0.10/1.0.11; compatibility with v12 Gateway is intentional. Do not force upgrades of them.
- Preserve old v11 source baselines: E:\git-project\agent-mcp-device (1df22e6) and E:\git-project\agent-mcp-gateway (7a5a30b). Preserve independent local test/audit port 8103 on G6.
- G8 legacy v11 service is already stopped; never start/replace production instance without documented port owners, gate, and rollback.
- FJP Windows is for M365 review: C:\Users\DuongNH66\Desktop\git\M365-Copilot2DOM and machine launcher %USERPROFILE%\.m365-copilot2dom\m365.cmd. Use Opus 5.5; not Sonnet impersonating Opus. Do not modify CDPA.

### 1.2 Existing implementation — do not rewrite

- src/device/core.ts: shared native Device execution; mcp-device start / device behavior.
- src/platform/ and control-plane/: embedded Gateway, auth, OAuth, PKCE, permissions, pairings, broker, transport, plugin lifecycle, lease/migration.
- src/distribution.ts: bundled-by-default Palace manifest, process isolation through generic PluginHost.
- src/plugins/palace/{index,plugin,store,retrieval,sources,types,cli}.ts: evidence-indexed Palace provider; one serialized writer inside plugin; SQLite data under runtime/plugins/palace/data; CLI supports status, search, read, skills via read-only snapshot while server runs.
- skills/palace-cli/SKILL.md: progressive disclosure/agent instruction, already present.
- Default MCP catalog excludes Palace knowledge.* and nmem tools. A legacy explicit opt-in may exist for compatibility; do not re-advertise knowledge.* by default or build a Palace MCP server.
- G8 last observed Palace counts: 4,507 cards, 4,983 evidence, two procedure hypotheses, zero validated procedures. Counts are NOT effectiveness metrics.
- Existing isolated acceptance: specs/008-v12-platform/ACCEPTANCE.md and receipt; prior 77/77 Win+Linux, server E2E 18/18, native parity and cold tarball tests apply to older source snapshots. Repeat final release gates on exact final HEAD + tarball.
- Previous accepted candidate tarball: E:\test\mcp-device-v12-20261022\package-final03\hcu-lab.me-mcp-device-1.0.12.tgz, SHA-256 134e46e6487fc6900c2c4fd94b4184a034784936ba7d2626630c69ca82a043a0. Historical baseline only, NOT final deliverable after 1e454c1/WIP.
- Current WIP build-palace-package.mjs attempts @hcu-lab.me/palace with dependencies:{} and files closure; installer attempts symlink/junction then copy into .agents/skills and .pi/agent/skills. These are **unverified WIP**; verify real cold package/module graph, Windows permissions, upgrades, and cleanup before accepting.

### 1.3 Mandatory documents to read (in order)

1. This SPEC completely, then the accompanying ONE_AGENT_EXECUTION_PROMPT.md.
2. specs/008-v12-platform/{PLAN.md,ACCEPTANCE.md,acceptance-receipt.json,plugin-contract.md,palace-design.md,state-migration.md,platform-review.md}.
3. docs/v12-platform.md and docs/v12-tasks-123.md.
4. src/platform/plugin-{contract,host,driver}.ts, src/platform/cli.ts, src/distribution.ts, src/plugins/palace/*, skills/palace-cli/SKILL.md, package.json, scripts/v12/*, test/v12/* relevant to each slice.
5. Runtime truth, previous receipts and Git diff. Do not treat documentation as stronger than source/live evidence.

## 2. ARCHITECTURAL CONTRACTS (FROZEN UNLESS EVIDENCE FORCES CHANGE)

### 2.1 Device/Gateway

- One @hcu-lab.me/mcp-device package and stable Device commands. Preserve Device v11 file/edit/process/search/rich-file behavior and Gateway account/permission/OAuth, pairing, admin/operator and project/Skills behavior.
- G8 local 8101 + Cloudflare 8102 use same authenticated v12 backend. No second broker, account DB, paired identity, or privileged unauthenticated local bypass.
- Remove nmem from v12 MCP runtime/catalog, NOT automatically erase external NeuralMemory data/services; no nmem in Palace dependencies.
- Plugin failure must not crash/disable native Device tools; no hidden Core dependency on Palace.

### 2.2 Palace product boundary

- Palace is an **independently installable/removable plugin artifact/package**, default installed and enabled by MCP Device distribution. Distinguish package installation, PluginHost registration/enabled state, CLI binary and agent Skill installation; lifecycle must be testable separately.
- One canonical implementation of store/retrieval/evidence/learning; DO NOT fork Palace engine into main package versus standalone package. Build adapters/packaging may reference the same compiled sources.
- Preserve generic PluginHost lifecycle and process isolation. Never create Palace MCP server, a second custom control plane, vector DB, new scheduler, streaming memory replication or auto-learning swarm.
- CLI-first: tool discovery at startup should not consume Palace tool schemas; agents explicitly load Skill and invoke CLI on the device hosting Palace data (locally or via existing authorized shell tool on remote Device).
- Keep original evidence, provenance, scope, version and correction chain; previews may be short but original source must remain auditable. Candidates are never promoted because a model says "success".

### 2.3 CLI and single-writer

- Minimum stable commands already implemented: palace status; palace search QUERY; palace read ID; palace skills; --include-candidates; --runtime-dir / --data-root; bounded --limit / --max-bytes.
- Explicitly define deterministic JSON stdout, JSON error stderr, exit codes, budget/scope semantics, unavailable/source-changed/stale behavior. Implement exhaustive negative tests.
- When Palace plugin is running, read-only CLI may read a consistent SQLite WAL snapshot without obtaining server lease or creating another provider writer.
- If CLI needs live ingest/learn/correct (to satisfy agent learning workflow), choose **one minimal owner-safe path** after inspecting existing host/control mechanics: route mutation to the EXISTING running Palace writer through a bounded local control path; OR only support mutating CLI when runtime is stopped under the existing exclusive lease and document this limitation if sufficient for acceptance. NO second concurrent writer. Make the chosen interface/test contract explicit and obtain Opus review first. Don't bolt on HTTP/MCP service solely for Palace.
- palace read must never silently claim refreshed/verifiable evidence when it only read a snapshot. Expose verified flag/reason and a minimal bounded exact-evidence validation path if primary-evidence verification is required for learning.
- Guard corrupt DB, wrong schema, WAL contention, huge queries, path traversal in referenced assets, stale/withdrawn evidence, project scope, missing plugin, CLI launching with a live server, cross-platform file paths.

### 2.4 Skill

- SKILL.md is an instruction/discovery layer, not an execution engine. It must guide when to search, when to abstain, how to read exact evidence and verify postconditions, and how to invoke CLI via existing Device shell remotely.
- Native discovery/install for documented supported agent environments (.agents/skills and Pi path; Codex only at verified supported location). No promise every AI client automatically imports an MCP-hosted Skill.
- Do not overwrite a user-managed same-name Skill. Owned copies must have safe ownership/update/uninstall rules; distinguish symlink/junction from copied fallback. Broken symlinks after npm package upgrade/uninstall are defects.
- Disabled/uninstalled Palace must not leave active agent guidance claiming Palace is callable. Define opt-out/skip-install and --ignore-scripts behavior explicitly and test recovery.

## 3. SINGLE-AGENT EXECUTION PROTOCOL

- ONE code owner executes all implementation, tests, review coordination, commits and handoff. DO NOT spawn CDPA roles/teams, a second implementer, agent swarm or independent scheduler.
- Use **M365 Opus 5.5 on FJP** as *independent adversarial reviewer*, not code owner. Review at gates D0 (design), D1 (package+CLI), D2 (learning+benchmarks), D3 (release/rollback), and whenever a blocker changes architecture. Ask concrete verdicts PASS/AMEND/BLOCK with evidence and alternatives. Send only diffs/results relevant to the decision.
- M365 integration: run machine-global m365.cmd doctor; use worker submit --workspace EXISTING_DIRECTORY --prompt-file FILE --model opus; save turn_id; worker wait/status same id; worker result --turn-id ID --path-only; read durable response.md and state.json. Require actual verified_model_label Opus 5.5 and status COMPLETED. Maintain same conversation_url for follow-ups when confirmed. Never duplicate Send, silently switch to Sonnet, or treat an unreturned/FAILED_BEFORE_SEND/blocked turn as a review.
- Preserve M365 review prompts, returned responses, exact turn_id/conversation_id, disagreements and implementer resolution under evidence directory. If M365 unavailable, perform isolated non-destructive work; mark mandatory review gate REVIEW_PENDING rather than invent consensus.
- No blind loops. Each failure: reproduce, classify by exact owner, add minimal failing test, patch ONLY owner, re-run targeted + regression; max 2 blind retries, then switch to investigation/record blocker. Avoid feature creep and speculative gates.
- Checkpoints after each slice: Git commit where appropriate (user/unrelated dirt stays preserved), updated RUN_STATE.md with current branch/HEAD, files changed, exact next command, failing gate, evidence path and Opus turn. Ensure recovery after conversation/session limit without re-planning from zero.
- No secrets (OAuth tokens, pairing codes, cookie databases, email contents, private file bodies, env secrets) in tracked files or Opus attachments. Sanitize/redact receipts. Always verify command output instead of trusting a model's summary.

## 4. EXECUTION SLICES — FOLLOW ORDER, BUT PARALLELIZE TESTING ONLY IF SAFE

### S0 — Freeze baseline, inspect G6 dirty WIP, measure G8 production (read-only)
Tasks:
- Record G6 branch/HEAD, git status porcelain, dirty diffs and untracked provenance. Identify all owners; DO NOT overwrite another actor's ongoing work. Confirm correct Windows Node 22.x (22.22.2 prior baseline) and Linux Node 22.x. Preserve original v11 checkouts and existing artifacts.
- Read test runner and acceptance ledger. Check G8 PM2 process PID/cmd, listener owner, Cloudflare /healthz + OAuth issuer, device list, account auth and Palace status. Record clock/timezone and a sanitized before snapshot.
- Build feature-parity inventory with release blockers; distinguish OBSERVED, TESTED_OLD_HEAD, WIP, NOT_PROVEN, N/A. Verify no unexpected nmem / knowledge.* advertised in default tools/list.
- Identify tests that actually run assertions (do not accept exit 0 with 0 tests) and correct port/state isolation.
Deliver: evidence/00-baseline.md, environment.json (redacted), initial RUN_STATE.md, initial Opus D0 question.
PASS: frozen, reproducible baseline; conflicts/dirty work named; test isolation agreed. FAIL: unknown repo identity or auth/account production context.

### S1 — Independent Palace package & default lifecycle
Tasks:
- Continue, inspect and test existing G6 WIP scripts; do not rewrite first. Resolve package graph recursively: no imports escape tarball; all runtime dependencies present; Node 22; actual npm pack and fresh production-only install on Windows and Linux.
- Define artifact @hcu-lab.me/palace and version compatibility with @hcu-lab.me/mcp-device@1.0.12. One implementation; default install/enable via existing generic PluginHost, no new registry. Main package may carry an offline/default-distribution Palace artifact so fresh install does not require a published external registry. External install/remove must remain possible.
- Choose lowest-complexity distribution mechanism after D0 Opus review. Verify standalone install *without MCP Device package dependency* and main package default installation from same bits. Check PluginHost installation provenance, idempotent upgrade, disable/uninstall/reinstall, error/timeout, rollback and preservation of Palace data.
- Existing Skill postinstall: verify safe symlink/junction & copy fallback, user-owned preservation, path relocation on upgrade, cleanup ownership markers; avoid deleting user-owned edits; skip-scripts/opt-out fallbacks.
- Run test/v12/palace-distribution.test.mjs and package-cold tests with actual tarball. Add only missing tests for observed gaps.
PASS: independent tarball install + CLI executable + manifest load, default installation from main package, clean uninstall/disable with core healthy, reinstallation idempotent and persisted evidence intact; package file integrity hashes recorded, zero hidden missing imports on two OS.
FAIL: only imported source-tree works, package requires unpublished dependency without an offline strategy, attempts to clobber user Skill, package/plugin uninstall breaks native Device, second writer.

### S2 — CLI live usability, evidence, scope and mutation policy
Tasks:
- Exercise CLI status/search/read/skills against isolated running Palace writer while indexer is active, not just mocked tables. At least 1,000 bounded concurrent/sequential read calls during ingest; verify no SQLITE_BUSY/lock errors and no resource leak.
- Compare CLI search/read with canonical Palace provider outputs on fixture and real corpus: scope, statuses, result order, max bytes, evidence IDs, hash/verifiability. Include empty/corrupt/missing/stale/superseded/wrong-project cases.
- Establish minimum viable learning/correction access through CLI or existing generic plugin host without an extra writer or MCP knowledge tools. If live write unavailable, quantify functional limitation and select smallest honest path after Opus review. Test real correction, retraction of derived procedures, version history.
- Document CLI contract and machine-parsable errors. Agent needing remote Palace can invoke existing authorized Device shell (G8 example), not a Palace network service.
PASS: CLI performs real retrieval with bounded output and safe evidence semantics when server active; no concurrent writers; learning/correction policy is explicit, supported, tested.
FAIL: lease conflict, stale silently treated validated, false evidenceVerified, project scope spill, out-of-scope writes.

### S3 — Native Palace Skill + agent E2E
Tasks:
- Verify actual Skill installation/discovery/cleanup on G6 Windows, G8 Linux and the agent runtime used for tests (Pi and any supported Codex path verified from installation). Test package install, upgrade, manual custom same-name Skill, opt-out, copy fallback, uninstall and re-enable.
- Make Skill progressive-disclosure: short catalogue/instruction, 2–3 result previews, exact evidence on demand, when NOT to recall, abstain policy; no misleading claim that the Skill is automatically loaded by arbitrary remote MCP clients.
- Use a real agent session (Pi or equivalent) to solve at least one targeted task with explicit Skill available, log whether it actually calls CLI, whether it cites verified source and whether it follows validated-only procedure rules. No fake CLI outputs.
PASS: install→discover→invoke CLI→read/evidence→answer works from real agent with original data; disabled plugin returns actionable limitation; no MCP Palace service.
FAIL: only a SKILL.md file exists without discovery proof, stale path after upgrade or agent fabricates validation.

### S4 — Validate existing 2 Palace procedure candidates on REAL traces
Tasks:
- Freeze a held-out split BEFORE changing retrieval/learning. Start with exactly existing two candidates, collect actual v11→v12 code/workflow traces. Do not create a new summarization swarm.
- Each promoted procedure must have ≥2 independent resolvable source traces, precise steps/preconditions/postconditions, independent execution with machine-verifiable outcome, third-party/Opus evidence review (Opus opinion alone is not postcondition), and a negative/contradictory case check.
- Check corrections/withdrawals and dependency chain. If original two candidates fail, they STAY unvalidated; search for a truly validated procedure via existing provider with measured proof, or mark quality NOT_PROVEN. Do NOT promote a weak candidate merely to show >0 validated.
- Run same-corpus ripgrep/grep lexical baseline against ≥20 *pre-labeled* real-world queries across positive, paraphrase, unrelated, stale and no-answer families; report recall@5, precision@k, abstain and failure family. Improvements only problem-first.
PASS: ≥1 genuinely validated and reproducible procedure with trace+postcondition/evidence, no known contradictory held-out case; retrieval recall@5 at least lexical baseline and no unacceptable false-confidence.
FAIL: any unsupported validation, data leakage, source ID not resolvable, false activation; evidence unavailable ⇒ release quality gate not satisfied.

### S5 — Real model token A/B and end-to-end productivity
Design before running:
- Pre-register ≥20 paired held-out tasks (target 24–30); groups: repeated known errors, genuinely new issues, no-answer/stale knowledge, non-memory Device work. Avoid tasks used during curation/index tuning.
- Same exact LLM model/version/temperature/tool budget, fresh isolated sessions/workspaces per paired arm, identical user goal and independently defined correctness checks. Control A = no Palace Skill/CLI; Treatment B = Palace Skill + CLI. Order randomized/counterbalanced; avoid cross-arm cache/history leakage.
- Capture actual provider input, output, cached tokens, total billed usage when available, tool calls, error retries, response bytes, elapsed time, monetary cost if rate known, and exact pass/fail postcondition. M365 web answers without authoritative usage telemetry DO NOT count as token measurement.
- Report per-task delta and paired bootstrap 95% CI, success difference, abstain error, p50/p95 latency. Negative cases must demonstrate refusal to fabricate memory.
PASS: treatment success non-inferior (zero critical regressions), no unsupported validated facts, median total tokens and/or billed cost meaningfully lower (target ≥10%) with paired CI excluding zero, on real usage numbers; reproducible corpus and measurement code.
FAIL: only estimates by UTF-8 bytes/card count, unsupported model usage, treatment worse correctness, cherry-picked cases. Failed gate → classify retrieval/error family, one targeted change and re-run sealed holdout; don't endlessly tune on same heldout.

### S6 — v11 ↔ v12 functional parity + Win/Linux release artifacts
Tasks:
- Build exact candidate artifacts once (main Device and standalone Palace) with recorded SHA-256; use same bits for Win and Linux. Install into NEW disposable home/runtime roots (no production identities).
- Re-run native Device comparator, Context, P1 logs, Gateway account/auth/PKCE/OAuth/permissions/pairing, projects/resources/prompts/skills, file/process/search/rich-file, update/reconnect, shutdown/error/lease retention and backup/restore/correction.
- Test default tools/list excludes knowledge.* / nmem tools; only explicit documented legacy compatibility is allowed. Exercise local 8101 and public-style 8102 using isolated ephemeral listener ports; both reject unauthenticated requests, same authorized tools and ACLs.
- Test upgrade from actual 1.0.11 state, plugin disable/uninstall, package rollback, corrupted runtime, unexpected plugin crash, power/signal restart, WAL integrity, stale plugin manifest. Verify old Device clients still connect and identity persists.
- Run on actual G6 Windows Node 22 and G8/Linux isolated (or separate WSL Linux with explicit identity), no no-op tests, no port collisions; record genuine test count/skip.
PASS: zero material regressions in documented parity families vs v11; Win/Linux cold install and upgrade from release tarballs PASS; single-writer and no orphan processes; replayed auth/identity intact.
FAIL: unexplained behavior diff, missing artifact closure, uncontrolled production state, lost pairing, access bypass.

### S7 — Stress, soak, and rollback proof
Tasks:
- Create bounded, reproducible workload based on observed v11 traffic; run comparative v11 baseline and v12 candidate in isolated environments with equivalent work/data. Stress at roughly 2x observed peak while respecting safety caps.
- Measure tool success/failure by type, p50/p95/p99 latency, RSS/heap and FD/handles, worker count, SQLite WAL size/checkpoints, CPU, reconnect rates, persisted state consistency, and correct results. Record machine specs.
- Soak ≥24h continuous under realistic read/write/index cycles plus reconnection and restart injection, with process owner health checks and exact start/end timestamps. Prefer existing retained process facility; no new scheduler or agent. If job cannot finish within one chat, persist status/receipt and resume in same single-owner run, never claim the soak is complete early.
- Test rollback by cleanly stopping a disposable v12 fixture, restoring exact snapshot, restarting old package and verifying identities/cards/ACLs; include failure-injection during upgrade. Production rollback only via approved existing runbook.
PASS: 0 loss/corruption/orphan/double-writer, no unbounded memory/WAL growth, no auth regressions, measured p95 and error rate non-inferior to v11 within stated workload variance, ≥24h timestamp-backed soak receipt.
FAIL: hidden PM2 restart loops, leak or unexplained p95 degradation, interrupted/shortened soak mislabeled PASS.

### S8 — G8 controlled production verification and rollout
Prerequisites: S1–S7 PASSED with Opus D3 review; snapshot taken with existing safe lease/backup semantics (do NOT copy a running SQLite DB/WAL naively).
Tasks:
- Record current PM2 process, config hashes (redacted), port owners, OAuth issuer, accounts/pairings, device IDs/versions, Palace counts and original Skill paths, Cloudflare routing and legacy v11 service stopped. Keep a validated rollback bundle with process command/config/state and last-known-good tarball.
- Deploy EXACT tested tarball into a versioned install; never npm install from mutable branch directly into live runtime. Gracefully stop/restart ONE production v12 instance, retaining shared identity/database/Device broker and both listener endpoints.
- Verify auth on localhost 8101, Cloudflare 8102, same catalog, zero nmem/knowledge.* exposed by default, existing v11 remote Device g6/g8/fjp/a5/r28/docker reconnected without re-pairing; z99 allowed offline. Verify Palace CLI search/read/Skill live and process isolation.
- Observe telemetry for ≥24h or keep prod status PROBATION until complete; compare to preflight and acceptance metrics, check no orphan plugin/worker. Roll back on regression under existing ownership/backup discipline.
PASS: production postconditions and monitoring passed; original v11 client behavior preserved; rollback demonstrated. FAIL: production rollback/stop, record root cause and leave old healthy.
NB: User previously authorized v12 running on 8101/8102; this is a **controlled version update**, not a proposal to add third production port.

### S9 — Final signoff/deliverables
- Clean reviewed Git commits (preserve unrelated/untracked user work; do not force reset), reproducible build scripts, one Device release tarball + one Palace tarball, package SHA256 manifest and SBOM/licenses. No npm publish/tag/remote destructive cleanup without separate explicit authorization.
- docs: architecture, install/upgrade/uninstall/disable/rollback, CLI commands & JSON schema, Skill use, how other machines access Palace through existing Device, test/benchmark reproducibility.
- evidence directory: 00-baseline, D0–D3 Opus reviews, package-install, CLI live/read/write, skill-E2E, learning validations/negatives, A/B per task and summary, parity Win/Linux, soak, rollback, production screenshots or sanitized logs, release-checklist.json and RUN_STATE.md.
- State every gate as PASS/FAIL/NOT_RUN/BLOCKED; link exact logs, command, OS, node version, commit, tarball hash, expected vs actual. No selective omission.
- Final verdict RELEASE_READY only if ALL mandatory gates satisfy criteria and no high-severity known blocker; otherwise RELEASE_BLOCKED_WITH_EVIDENCE with smallest next action. Do not call it released/published unless package registry/tag actually shows that fact.

## 5. MINIMAL TEST MATRIX (MUST BE REPRODUCIBLE)

| Family | Required cases | Evidence |
| --- | --- | --- |
| Plugin package | Pack→install, imports, start/stop, disable/uninstall/reinstall, failed install, failed upgrade rollback, config/DB intact | Tarball hash, logs |
| Skill installation | Pi + shared agent directory, user-owned collision, symlink/junction failure, copy fallback, upgrade stale link, disable/uninstall, opt-out | Actual files and real agent use |
| Palace CLI | status/search/read/skills, corrupt/missing DB, project scope, budgets, stale/corrected, 1k live reads, same writer | JSON receipts and CLI exit |
| Learning | Two current candidates, ≥2 independent traces each, validated postcondition, negative contradiction, rollback/correction | Evidence hashes + checker |
| Agent benchmark | ≥20 held-out paired tasks, source-of-token counts, correctness, retry, abstain, CI | Per-task raw usage |
| Native parity | v11 vs v12 tool behavior/errors and admin/ACL, localhost auth and Cloudflare auth, Device 1.0.10/1.0.11 compatibility | Diff/allowlist and assertion counts |
| Production | Cloudflare /mcp, local 8101, remote paired Devices, concurrent index, restart, 24h soak, rollback | Signed/timestamped runtime receipts |

## 6. STOP / ROLLBACK CONDITIONS

STOP immediately if the target source identity differs, current G6 WIP is being mutated by another owner, a task requires guessed account credentials, an MCP localhost auth bypass appears, a Device loses pairing, Palace spawns second SQLite writer, evidence hashes no longer match, a production state change lacks a verified rollback, or a model's successful text is being treated as a verified postcondition.

Do NOT fix these by starting a new CDPA team, spawning more reviewers, creating an MCP Palace endpoint, changing unrelated machines, erasing v11 services/state, resetting working trees, suppressing failing tests or fabricating historical data. Mark BLOCKED with precise owner, evidence and next safe action.

## 7. OPUS REVIEW CONTRACT (ONE IMPLEMENTER, REVIEWER ONLY)

**D0** before architectural package/IPC decision: ask whether the proposed package dependency/manifest resolution and Skill lifecycle preserve removable plugin and one source. Require minimal alternative and concrete tests.

**D1** after implementation S1–S3: provide diffs, test logs, byte closure and regression counts, ask Opus to hunt packaging/lifecycle/single-writer bugs; resolve findings in same repo and rerun.

**D2** after S4–S5: provide masked held-out design/results, evidence provenance, usage receipts, failure cases; require independent critique of hallucinated validation, leaked benchmark data, statistical confidence and insufficient sample size.

**D3** before release update: provide exact HEAD, immutable tarball hashes, Win/Linux parity, 24h soak, rollback and G8 state; demand SHIP/BLOCK verdict with blockers. Preserve Opus response, then make **evidence-based final decision**; Opus is not an oracle.

Use M365 Worker only; never equate M365 web token estimates with provider token usage. Prefer same confirmed conversation for related follow-ups. If M365 is unavailable, record REVIEW_PENDING and do not forge signoff.

## 8. ACCEPTANCE STATE MACHINE / COMPLETION HANDOFF

Start at S0. After each slice, record one row in RUN_STATE.md with: gate, start/end UTC timestamps, repo/HEAD, OS+Node, artifacts SHA, commands+exit codes, assertion count, Opus turn/consensus, PASS/FAIL/BLOCKED/NOT_RUN, unresolved regressions and next exact command.

Treat runtime data, old sources and user WIP as preserved inputs. After an interrupted session, read RUN_STATE.md and evidence first, verify Git/state before any retry. Keep one implementation owner, one durable task, no parallel agents or repetitive new plans.

**STOP when genuinely complete** with the expected artifacts and final verdict; do not promise endless background autonomy without an active supported execution session.

## 9. FINAL REPORT FORMAT (MANDATORY)

- VERSION / git HEAD / branch / clean-vs-dirty inventory / package artifact SHA and path.
- S0–S9 gate table with exact PASS/FAIL/BLOCKED/NOT_RUN and evidence links.
- Two installation demos: standalone Palace + default MCP Device with Skill; uninstall/disable keeping Core healthy.
- One live CLI/evidence demo and at least one independently validated procedure (unless properly BLOCKED).
- Paired A/B table with **actual billed/input/output tokens** and correctness/CI; state if savings NOT_PROVEN.
- Win/Linux baseline parity; stress/soak duration and comparison; production postconditions and rollback status.
- Opus D0–D3 turn IDs and actual verdicts; critical disagreement disposition.
- Exact remaining blockers and next safe action (if any). No release claim without proof.
