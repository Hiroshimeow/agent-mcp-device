---
name: palace-cli
description: Use Palace's local CLI to retrieve evidence-backed project or device knowledge, check prior technical decisions, inspect procedure candidates, and avoid repeating previously observed errors. Apply before tasks requiring historical context or reusable fixes; use the installed Palace plugin and never call a dedicated Palace MCP server or NeuralMemory MCP tools.
---

# Palace CLI — evidence-first recall

Palace is an optional, separately installed plugin. Its local **CLI**, not an MCP knowledge endpoint, is the operational interface. Use this Skill to decide *when* to consult Palace and how much context to load.

## Commands

Run on the device hosting the Palace database:

```bash
palace status
palace search "specific problem or error" --limit 3 --max-bytes 8000
palace search "project issue" --project-id PROJECT_ID --limit 3
palace read CARD_ID --max-bytes 16000
palace skills                         # validated procedures only
palace skills --include-candidates    # candidates are not approved instructions
```

If the executable is not on PATH but the MCP Device v12 source installation is present, run `node /path/to/agent-mcp-device-v12/dist/plugins/palace/cli.js` with the same arguments. When needed, pass `--runtime-dir /path/to/server/runtime` or `--data-root /path/to/palace/data`.

For agents on a different machine, either run a locally installed Palace CLI against that device's own Palace data or use an **existing authorized device shell tool** to invoke `palace` on the target machine. Do not introduce a Palace-specific MCP server.

## Workflow

1. State the current task and specific terms that discriminate it from unrelated sessions. Query up to three results initially.
2. Inspect each result's `status`, `scope`, `evidenceCount`, `version`, and `summary` before loading a full card.
3. Read only the most relevant card. Do not dump the whole database or every tool response into model context.
4. Treat `hypothesis` and `observed` as leads, **not validated facts**. The CLI's read-only snapshot does not reverify original source bytes; inspect the primary source before relying on a claim.
5. Use `palace skills` without `--include-candidates` when seeking a validated reusable procedure. Never execute an inactive candidate as if it were approved.
6. If evidence disagrees with the real environment, prefer direct observation. Report the mismatch and request correction through the authorized validation workflow. The read-only CLI does not edit memories.
7. Report precise provenance and keep the final answer compact. Avoid retrieving irrelevant cards.

## Boundaries

- Do not call NeuralMemory or legacy `knowledge.*` MCP tools for Palace operations.
- Never infer `validated` from a high similarity score, repeated claim, or successful shell exit alone.
- Do not expose confidential card bodies or logs beyond the scope of the current user request.
- Verify before stating token savings: compare completed-task correctness, actual model token usage, retries, and end-to-end cost against a no-Palace control under the same model and task conditions.
