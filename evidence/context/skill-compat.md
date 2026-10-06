# Phase 4 portable skill compatibility

## Measured environment

- Windows x64; Node v22.22.2.
- `codex --version`: codex-cli 0.156.1.
- `code --version`: VS Code 1.140.0, commit 07f806f999227108933c2e30515b26eecc1fda74, x64.
- Installed Pi package metadata: @earendil-works/pi-coding-agent 1.0.2; @jmfederico/pi-web 1.202610.1.
- Portable source location: `skills/mcp-device-context/SKILL.md`; included in npm package files.
- Existing executable registration: `mcp-device` -> `dist/mcp-device.js`; local commands under `mcp-device context`. No new installation machinery.

## Verified

Automated skill contract tests verify frontmatter/content, search-first/selective-sync behavior, denial/sealed namespace rules, and documented command/flag membership. Executable integration tests run the existing entry point with temporary local state while the gateway is unavailable. Build and all context tests are recorded in `phase4-validation.md`.

## Explicit discovery limitations (T030)

Interactive manual skill loading in approved Codex/Pi/VS Code sessions is **NOT_MEASURED**. Installed executable/package versions alone do not establish discovery or invocation compatibility. No approval list of client versions was supplied; no interactive client UI was launched or client configuration modified by this work.

Clients may explicitly open/read the portable source as instructions. Client-specific skill installation/search locations and automatic invocation remain unverified and are not advertised. To complete T030, an owner should approve exact client versions and record an interactive explicit-load session for each, including actual source/search location and resulting command invocation. This document is not universal auto-discovery evidence.
