# D0 Opus 5.5 review consensus — 2026-10-24

## Verdict

**D0 ARCHITECTURE: PASS — NO MATERIAL D0 DISAGREEMENT**

Overall release verdict remains **RELEASE_BLOCKED_WITH_EVIDENCE**. D0 sign-off is architecture-only and does not satisfy D1–D3, S1–S9, token A/B, parity, soak, rollback, or deployment gates.

Reviewer: M365 **Opus 5.5** on FJP, review-only. Product runtime was not changed on FJP.
Conversation: https://m365.cloud.microsoft/chat/conversation/a39299d6-2bc1-486f-9d62-2f972057cae3

## Durable turns

1. `2e4a9646-m365-worker-20261024-204724-e130ec0b` — initial adversarial D0; BLOCK/AMEND findings.
2. `2e4a9646-m365-worker-20261024-205806-2ae0d903` — corrected live-mutation and token-gate assumptions.
3. `2e4a9646-m365-worker-20261024-210240-c810909d` — source-level review; new concrete defects.
4. `2e4a9646-m365-worker-20261024-211244-cd24b7d4` — byte-exact critical source pack; conditional design pass.
5. `2e4a9646-m365-worker-20261024-212145-e2a2b3ec` — account/catalog correction; architecture PASS.
6. `2e4a9646-m365-worker-20261024-212628-17acf0e4` — final correction; **PASS, NO MATERIAL D0 DISAGREEMENT**.

Each round has `D0-opus-round-N-{prompt,response,state}.*` in this directory. State files verify `model=opus` and `verified_model_label=Opus 5.5`.

## Agreed architecture

- MCP Device remains the product. Palace remains an optional default-enabled PluginHost plugin, isolated in one writer process. No Palace MCP server, no second writer, no new scheduler/control plane.
- Palace CLI remains read-only while runtime is active. Stopped-runtime mutation through `mcp-device knowledge` under the existing server lease is accepted by D0 as the explicit SPEC alternative. S2 decides whether real agent workflow requires a live owner-routed mutation path.
- Do not expose `knowledge.*` by default. Internal `platform.invoke` proves the existing writer route exists, but is not a default public agent write API.
- Account isolation is broker/router enforced: a Device has one current owner; cross-account dispatch is denied before Core invocation. Palace SQLite is Device-local runtime state and may exist before pairing. Deliberate Device ownership transfer transfers device-local state; federation references remain scoped to the current authenticated owner.
- Reuse existing PluginHost lifecycle, backup/rollback, process isolation, RuntimeOwner/runtime lease and capability routing. Do not duplicate registries or IPC.
- Skill ownership is package/user-home state, not per-runtime state. Use a conservative multi-owner ownership record, installed-baseline hashes, staged replacement/recovery and user-byte preservation. Copy is the preferred default; links require relocation/reconcile proof.
- Device keeps the stable `palace` command for default CLI-first UX. Standalone Palace also owns `palace` in a standalone/separate npm prefix. Same-prefix co-install of two root packages is explicitly unsupported and must fail cleanly; `--force` is unsupported.
- Standalone Palace may register a manual PluginHost source from another prefix; manual provenance must not be reclaimed by `ensureBundled`.
- Same-source standalone assembly is valid; no independent daemon or independent version cadence is required.

## Implementation blockers before D1

1. Skill ownership/reconcile: multi-owner record, three-way installed hashes, staged replacement, recovery, user-edit/foreign-path preservation, scripts-disabled repair.
2. Palace CLI must be runtime-aware and return state-coded actionable limitations for disabled/uninstalled/faulted/upgrade-required state.
3. `plugins` and `knowledge` defaults must use the server runtime root `~/.mcp-device/server`.
4. PalaceStore must reject wrong/non-empty schema before WAL pragma or DDL; wrong-schema open must make zero byte/state changes.
5. CLI/provider retrieval must share one canonical search pipeline; current CLI can drop relevant cards before ranking when >300 match.
6. ProcessDriver cancellation: cooperative cancel frame → bounded grace → hard kill/fault only if unresponsive.
7. Plugin registry stale-lock recovery: tokenized lock + recovery lock + token-matched release, reusing runtime-lease technique.
8. Plugin upgrade provenance must be set by command: external manifest → manual; explicit bundled upgrade → distribution.
9. Bundled version-only repin/recovery path must not leave Palace faulted after ordinary Device update; schema/contract changes remain explicit upgrade.
10. Standalone package must add LICENSE, recursive import-closure acceptance and a PluginHost manifest.
11. Packaging conflict obligations: same-prefix collision fails with no partial takeover; separate-prefix install/remove/upgrade; Palace status identifies package/version/path; manual registration tested.
12. SKILL.md: run status first, no source-checkout fallback, clear unavailable limitation, candidate-only honesty; Skill never stops runtime itself.

## Evidence deferred to later gates

- D1/S2/S3: real agent Skill discovery/use, stopped-runtime mutation workflow sufficiency, trusted validation runner, log-derived automatic-learning safety, default-catalog negative path to hidden knowledge, scripts-disabled repair, relink semantics regression.
- D2/S6: full fault matrix, exact upgrade/rollback crash recovery, lease races, complete v11 parity disposition.
- D3/S5/S7+: provider-reported paired token A/B, 24h timestamped soak, rollback/deployment approval and production/fleet execution.

## Additional npm evidence

On G6, exact test artifacts were installed into one isolated global prefix. Device install exited 0 and owned `palace/palace.cmd/palace.ps1`; installing standalone Palace second failed with npm `EEXIST` on `palace.ps1`. The failed standalone install did not justify `--force`. Device's Skill postinstall did run in that experiment despite an allow-scripts warning.

This evidence supports packaging option A: preserve stable Device `palace` UX, allow standalone/separate-prefix lifecycle, and explicitly reject same-prefix dual ownership.
