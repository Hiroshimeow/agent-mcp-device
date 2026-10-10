# AGENTS.md — MCP Device repository

Before changing code or making release/branch/worktree decisions, read the canonical [current system handoff](docs/handoff/2026-10-10/README.md), especially [source identities](docs/handoff/2026-10-10/01-current-state.md), [Spec Kit status](docs/handoff/2026-10-10/03-specs-handoffs.md), [worktree exclusions](docs/handoff/2026-10-10/05-worktrees.md), and [runbook](docs/handoff/2026-10-10/06-runbook.md).

- This handoff is a dated evidence snapshot, not permanent authority. Verify machine, repo root, Git HEAD, branch, untracked/ignored files, actual runtime and outstanding tasks before changing anything.
- Device and Gateway are separate repositories. Device GitHub main v1.0.11 does **not** mean Gateway develop has merged the Gateway Context patch.
- Gateway official development base at the recorded date: G8 `/home/ayumi/Workspace/git_project/agent-mcp-gateway-develop` (`develop@c5862aa`). Do not merge Context, alter service PM2 or load a stale clone merely because an older worktree has a similar name.
- No silent reset, stash/clean, forced worktree deletion, force-push, production reload, token/identity change or auto-promotion of experimental specs/skills.
- Keep docs, handoffs and test evidence traceable to exact source SHA, actual commands, and independent review; mark stale/untested material explicitly.
