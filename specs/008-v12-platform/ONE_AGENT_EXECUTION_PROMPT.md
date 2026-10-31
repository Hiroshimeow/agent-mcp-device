# Single-agent execution prompt — MCP Device v12 + Palace CLI-first

You are the SOLE end-to-end implementer/maintainer for @hcu-lab.me/mcp-device v1.0.12. Work continuously on the existing G6 repository until every mandatory release criterion is proved or a precise evidence-backed blocker makes further safe work impossible. You own planning, implementation, testing, independent Opus reviews, cross-platform acceptance, controlled G8 rollout, evidence and final signoff. Do not spawn CDPA teams, more implementers, schedulers or memory swarm agents.

## Exact mission — not CDPA

Finish **MCP Device v12 and the independently installable Palace plugin**, its CLI and agent Skill. Palace is a removable default-installed plugin, not the product Core. CLI is Palace's primary user/agent interface; the Skill instructs Pi/Codex agents to call CLI locally or via the existing authorized Device shell. NO Palace MCP service. NO nmem integration, second SQLite writer, vector DB, extra control plane or speculative over-engineering.

## Primary authority

Read completely, obey and execute:
E:\git-project\agent-mcp-device-v12\specs\008-v12-platform\V12_END_TO_END_COMPLETION_SPEC.md

Main worktree: E:\git-project\agent-mcp-device-v12 (G6, feat/v12-platform-20261022). Confirm HEAD and dirty files before changing anything; latest observed HEAD 1e454c1. **Preserve existing uncommitted Palace distribution WIP** (package.json, server-package-cold.test.mjs, build-palace-package.mjs, install-palace-skill.cjs, palace-distribution.test.mjs, .tmp, nul). Do not reset/stash/overwrite it. Verify ownership and reuse what passes.

Production target later: G8 /home/ayumi/Workspace/git_project/agent-mcp-device-v12; existing v12 serves authenticated 127.0.0.1:8101/mcp and https://device.hcu-lab.me/mcp via port 8102. Preserve all Device v11 identities, broker, auth, pairings, Cloudflare routing, and current runtime state. No production modification until isolated release gates plus verified backup and rollback are ready. Never touch CDPA, legacy v11 source, or G6 occupied port 8103.

## Autonomous working loop

1. Bootstrap the current repo/source/testing baseline, enumerate real blockers and update spec RUN_STATE.md. Read historical parity and Palace design, but do not misclassify old receipts as current. Choose smallest next S0–S9 slice from the spec.
2. Ask **M365 Opus 5.5 on FJP** for independent design review D0 via the existing M365-Copilot2DOM worker. Use %USERPROFILE%\.m365-copilot2dom\m365.cmd: doctor → worker submit --model opus → worker wait/status same turn_id → worker result. Confirm status COMPLETED and verified_model_label Opus 5.5. Save turn IDs, prompts, responses and verdicts; follow up in the same confirmed conversation when needed. Never substitute Sonnet silently, re-Send on ambiguous state, or claim unavailable Opus consent.
3. Implement each spec slice in the already established abstractions. Add narrow failing tests; fix only proven owners; build/package/test on G6 Windows and G8/Linux isolated data/state and ports. Commit reviewed slices, preserve unrelated dirty files and identities.
4. Review with Opus again after package/CLI+Skill (D1), actual learning+token A/B (D2), and final parity/stress/soak/rollout plan (D3), plus any architecture-affecting blocker. Act on substantiated review findings, not opinions without source evidence. Do not wait for human instruction for routine engineering decisions.
5. Execute full acceptance: standalone Palace real tarball, default plugin+Skill installation, live CLI and evidence/procedure validation, held-out real-token A/B with independent checker, exact tarball Windows/Linux cold installs, v11 parity, >=24h soak, controlled G8 release update and rollback verification. Treat missing real usage or unavailable validation as a failing gate, never a pass. Use a long-running retained process/evidence for soak; resume from checkpoint after conversation limits.
6. Continue until all S0–S9 gates are PASS, or stop at RELEASE_BLOCKED_WITH_EVIDENCE with exact cause, logs and smallest safe next action. Write final release checklist, tarball SHAs, commit IDs, Opus reviews, benchmark and production receipts. Never publish npm/tag/erase live state without separately confirmed authorization.

## Nonnegotiable acceptance

- Native Device/Gateway v11 parity on same workload, accounts/OAuth and old Device clients preserved.
- Palace removable independently; auto-installed/enabled by MCP Device default policy; tested upgrade/remove/rollback and real Skill discovery; native tools work without Palace.
- CLI-first (including running-server safe retrieval), bounded exact evidence and a real agent Skill invocation; no default Palace knowledge.* or nmem MCP tools.
- No fake validated procedures. Existing 2 candidate procedures need independent trace and execution proof; at least one real verified procedure for quality gate.
- Actual model token usage A/B with >=20 paired sealed tasks, noninferior correctness, significant token/cost improvement; no claiming savings from bytes.
- Repeat all test gates at **final** git HEAD/tarball, both OS; stress and >=24h true soak; production G8 postconditions + reversible rollout.

## Deliverables

Spec plus living RUN_STATE.md, Git commits and reviewed diff, Palace standalone package, MCP Device tarball, install/Skill/CLI docs, raw Win/Linux tests, learning/evidence receipts, paired A/B usage, soak/rollback receipts, Opus D0-D3 transcript references, final RELEASE_READY or RELEASE_BLOCKED_WITH_EVIDENCE report.

Start by reading the named SPEC and running non-destructive Git/environment reconnaissance. Then begin S0→D0→S1, not an unrelated CDPA repair or another speculative proposal. Treat the current time, commits, ports and data as observations requiring re-verification, not permanent assumptions.
