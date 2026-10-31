---
name: palace-cli
description: Use Palace's local CLI to retrieve evidence-backed project or device knowledge, check prior technical decisions, inspect procedure candidates, and avoid repeating previously observed errors. Apply before broad workspace/archive/log inspection when a task mentions an incident, error code, failed behavior, regression, upgrade/cancellation/schema/SQLite/runtime/Skill problem that may have happened before, or asks for historical context or a reusable fix. Do not recall for self-contained formatting/limits or clearly novel work without a history signal. Use the installed Palace CLI and never call a dedicated Palace MCP server or NeuralMemory MCP tools.
---

# Palace CLI — evidence-first recall

Palace is an optional plugin, enabled by default with MCP Device or installed separately as `@hcu-lab.me/palace`. Its local **CLI**, not an MCP knowledge endpoint, is the operational interface.

## Availability first

Always begin with:

```bash
palace status
```

If `palace` is not on `PATH`, report that Palace is not installed. Do not run a source-checkout file as a substitute. If status reports `PALACE_DISABLED`, `PALACE_UNINSTALLED`, `PALACE_FAULTED`, `PALACE_UPGRADE_REQUIRED`, or another limitation, report its remediation and do not use Palace for the task.

## Retrieval commands

Run on the device hosting the Palace database:

```bash
palace search "specific problem or error" --limit 3 --max-bytes 8000
palace search "project issue" --project-id PROJECT_ID --limit 3
palace read CARD_ID --max-bytes 16000
palace skills                         # validated procedures only
palace skills --include-candidates    # candidates are not approved instructions
```

When needed, pass `--runtime-dir /path/to/device/runtime` or an explicitly reviewed `--data-root /path/to/palace/data`. Without an explicit runtime, Palace resolves the active Device/server runtime and refuses ambiguous roots. For agents on another machine, use an **existing authorized Device shell tool** to run `palace` on the target machine. Do not introduce a Palace-specific MCP server.

## Workflow

1. Run `palace status` and obey the returned runtime/plugin state.
2. For an incident/error/failure/regression/repair that may have happened before, run one bounded `palace search` on the exact code or distinguishing symptom **before** broad workspace/archive/log inspection. If nothing relevant is returned, or only stale/out-of-scope material appears, abstain and continue normal investigation; do not keep searching Palace.
3. Inspect each result's `status`, `scope`, `evidenceCount`, `version`, and `summary`. If an exact `validated` procedure matches the current preconditions, read only that card and avoid a broad archive scan that merely rediscovers the same procedure. Verify the current target/postcondition independently, and inspect only the specific original evidence needed for any claim that is not already established by the validated procedure.
4. Treat `hypothesis` and `observed` as leads, not validated facts. A read-only snapshot does not reverify original source bytes; inspect primary evidence before relying on a claim.
5. Use `palace skills` without `--include-candidates` for reusable procedures. `activationPolicy: candidate_only` means this runtime cannot validate new candidates; it does not invalidate previously recorded validations. Never treat a candidate as an approved procedure.
6. Keep every Palace/read/process-output chunk at or below 16 KiB. Use `--max-bytes`, bounded result counts, exact line/range reads, or multiple small chunks; never request an entire large log or process transcript just to find one fact.
7. If evidence disagrees with the real environment, prefer direct observation and report the mismatch.
8. Report precise provenance and keep the final answer compact.

## Mutation and validation boundary

Palace knowledge operations (`status/search/read/skills`) do not mutate knowledge, checkpoint the database, or change durable SQLite main/WAL bytes while the runtime is active. SQLite may create or update shared-memory (SHM) read marks during read-only WAL recovery; this is not a promise of zero filesystem writes. `palace skill install|repair|remove|adopt` changes only the agent Skill installation and ownership ledger; it does not mutate Palace knowledge. Corrections and new procedures use the authorized `mcp-device knowledge correct|learn --runtime-dir DIR` workflow while that runtime is stopped under its exclusive lease. Never stop a runtime unless the user explicitly requests it. Never claim that a candidate is validated without a trusted execution receipt and independent postcondition.

## Boundaries

- Do not call NeuralMemory or legacy `knowledge.*` MCP tools for Palace operations.
- Never infer `validated` from similarity, repetition, model text, or a successful shell exit alone.
- Do not expose confidential card bodies or logs beyond the current request's scope.
- Verify token savings with completed-task correctness and actual provider token/billing telemetry against a no-Palace control under the same model and task conditions.
