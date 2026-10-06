# Checkpoint 3 — revised review packet

Code Commit X_final: `a95a7dce03fc8e80bab99af8f90597213f527fd3`.
Evidence Commit Y_final: the separate commit adding this packet and `checkpoint3-*` evidence (identify with `git log -1 --format=%H -- evidence/context/checkpoint3-review-packet.md`). No self-referential commit hash is embedded in its own tracked contents.

## E1 — baseline and ancestry

Raw `git merge-base --is-ancestor 2cb91fc 6652abf; echo $?` returned **0**. `git rev-parse 6652abf^` returned `2cb91fca03b3a57f144541d515146b9d00bcd216`. Thus `6652abf` is the documentation commit capturing Opus's Checkpoint 2 sign-off immediately following `2cb91fc`, and is a direct descendant of `2cb91fc`, not a conflicting code baseline. The complete `git log --oneline 2cb91fc..HEAD` at X_final is retained in `checkpoint3-raw-evidence.txt`.

## E2 — every event and teardown

`beginIntent` and `completeOutcome` synchronously invoke `executeLiveCapture(() => service.requireFeatureAuthorized('FEATURE_LIVE_CAPTURE'))` before exclusions, invalid-token checks or duplicate-result shortcuts. `executeLiveCapture` calls the pinned `requireFeatureAuthorized` and on denial clears `liveObserver = undefined` before rethrowing. Normal durable write blocks also revalidate. No revoked write or degraded metadata write bypasses the gate.

Ten tests cover beginIntent, completeOutcome, excluded tools, duplicate outcomes and invalid tokens for both revoked signed digest and expired approval. They start from a valid installed observer, assert rejection, compare all event/evidence rows unchanged, then call the public hook and verify it executes without the detached observer. The existing revocation-during-execution test also passes: already executed tool results/errors remain intact; capture stops and reports an in-memory gap, not a durable unauthorized record.

## E3 — all six public tools

Exact registration/capability and dispatch excerpts, including the six-name schema contract, are in `checkpoint3-raw-evidence.txt`:

```ts
export function gatewayCapabilities(): string[] {
    return [...GATEWAY_CAPABILITIES, ...(isFeatureAuthorized('FEATURE_PUBLIC_GATEWAY') ? CONTEXT_TOOL_NAMES : [])];
}

async call(tool: string, args: any = {}): Promise<any> {
    if (tool.startsWith('local_')) {
        return executePublicGateway(() => this.context
            ? callDeviceContext(tool, args, this.context, requested => this.guardPath(requested))
            : Promise.resolve({ ok: false, error: { code: 'DEVICE_UNSUPPORTED' } }));
    }
```

This shared branch covers `local_status`, `local_search`, `local_read`, `local_graph`, `local_index`, `local_wiki`; none is dispatched outside `executePublicGateway`. `callDeviceContext` now independently gates its exported entry, preventing direct adapter bypass. `contextToolCatalog` and `callContextTool` each run inside `executePublicGateway`.

Both requested raw `git grep -nE` commands are preserved verbatim with outputs. Static registration/dispatch assertions and behavioral locked-call tests for all six tools enforce these boundaries. Existing broker tests exercise lanes, permissions, unsupported devices, schemas and zero forwarding on denial.

Tools appear in ListTools only while `isFeatureAuthorized('FEATURE_PUBLIC_GATEWAY')` is true. Specifically, `gatewayCapabilities()` filters all six out when locked; device hello/reconnect advertises those filtered capabilities. The explicit approval-gated catalog seam fails closed on a locked ListTools request (it does not return an ungated catalog). Broker dispatch to an unapproved/old device lacking context_version/capability returns `DEVICE_UNSUPPORTED`. A directly invoked locked gate throws `FEATURE_GATE_LOCKED`; those are distinct layers, not contradictory error promises. These are implemented registration seams and SDK fixture evidence, not proof of deployed hosted account registration.

## E4 — trust and production boundary

Production code pins `SOC_PUBLIC_KEY`. Automated tests and benchmarks use `approvalFixture` / throwaway key swap via `syncBuiltinESMExports` in their test process only, never the production signing key. The pure signature test also validates a throwaway key explicitly while proving the same artifact fails the default production pin. Installed-config reads are redirected only by isolated test-process builtin substitution. No environment key, caller config or caller key can authorize production.

**Phase 7/8 implemented and gated; production enablement pending SOC confirmation of fingerprint 45fa563f...d0d6a7c4 and private key custody.**

## E5 — API and evidence chain

Removed `configDirectory?` from both public authorization functions and the internal checker. All production reads are anchored to `CONFIG_DIRECTORY` derived from the installed module. Tests formerly using the exported path parameter now redirect installed-config reads in the isolated process. Negative caller-directory tests remain.

Exact `moduleConfig` body (test/context/pinned-gates.test.js):

```js
function moduleConfig(t, f) {
  const installed = fileURLToPath(new URL('../../config/', import.meta.url));
  const originals = { statSync: fs.statSync, readFileSync: fs.readFileSync };
  for (const name of Object.keys(originals)) fs[name] = (path, ...args) => {
    const mapped = typeof path === 'string' && path.startsWith(installed) ? join(f.config, path.slice(installed.length)) : path;
    return originals[name](mapped, ...args);
  };
  syncBuiltinESMExports();
  t.after(() => { Object.assign(fs, originals); syncBuiltinESMExports(); });
}
```

`src/device/gateway-*` is the existing device-management communication channel. Phase 8 public context integration is in `src/context/device-adapter.ts` and `src/context/gateway.ts`; `gateway-tool-adapter.ts` bridges the channel to those gated entries.

`docs/context.md` now states approvals are not bound to a device ID, config-folder writers can modify/remove revocations, and expires_at is milliseconds. It replaces stale UUID-gap wording with the verified 48-hex behavior.

Exact package files excerpt:

```json
"files": [
  "dist",
  "config/revoked-approvals.json",
  "skills/mcp-device-context"
]
```

After committing X_final, reran `npm run build`, `node --test test/context/*.test.js`, and `node test/run-all-tests.js`, all exit 0. Raw final logs are retained, not hand-reconstructed. `checkpoint3-footers.txt` provides ANSI-stripped excerpts; the regression runner is not a TAP emitter despite its retained `.tap` filename.

Context TAP footer:

```text
1..198
# tests 198
# suites 0
# pass 198
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 31030.8324
```

Regression runner footer: Total tests 66; Passed 66; Failed 0; all 66 modules completed successfully. Build includes the TypeScript check; `git diff --check` is clean.

SHA-256 of exact final raw bytes:

- context TAP: `2d56cf2f7a6b4b68cae998b18ab647bf6a73622d993cac4a156d77283fd9e21a`
- regression runner: `33a18b960926ad8f3ab943b346a71d23a88b271e49520a0c19b8792eaddd58a5`

Full manifest: `checkpoint3-artifacts.sha256`. Evidence generation script: `generate-checkpoint3-evidence.mjs`. Red targeted evidence is retained separately; it demonstrates missing detachment/short-circuit checks and direct-adapter denial before the fixes.

## Residual answers

- New events create 48-hex refs. Existing migrations/store retain support for legacy string/UUID refs; no historical ref rewriting is claimed. Observer read/graph regression passes.
- Schema budget: 4,475 UTF-8 bytes / 4 = 1,118.75 estimated tokens using the specified RFC token estimation formula, below the 10,000 budget; this is an estimate, not model-tokenizer precision.
- Historical benchmark evidence below precedes X_final. The H1 rerun now verifies unchanged X_final source: Windows 15/15 valid, capture median 3035.22 ms versus historical 3142.51 ms (zero observed degradation); WSL2 Ubuntu/Linux 15/15 valid, capture median 2162.98 ms. Windows full context rerun: 198/198 passed. Corrected Linux context rerun: 194 passed / 3 sharp-related native dependency failures caused by Windows-installed node_modules on the WSL mount; this is not a full Linux suite pass. See `checkpoint3-h1-xfinal-evidence.md`, selected `phase9-*-xfinal*` raw artifacts and `checkpoint3-h1-provenance.txt` for attached git rev-parse/diff-stat outputs. Both platforms use the same physical host; p95 equals max for n=3, not an SLA.

| Workload | Windows median/p95/max ms | WSL2/Linux median/p95/max ms |
| --- | --- | --- |
| capture | 3142.51 / 4365.31 / 4365.31 | 3271.39 / 3304.28 / 3304.28 |
| sync | 86.83 / 90.76 / 90.76 | 41.62 / 45.77 / 45.77 |
| search | 222.09 / 229.54 / 229.54 | 150.40 / 157.07 / 157.07 |
| activity | 2614.86 / 2701.33 / 2701.33 | 1239.80 / 1430.08 / 1430.08 |
| contention | 109.86 / 129.78 / 129.78 | 30.60 / 37.63 / 37.63 |

- WIKI_DISABLED returns static `{ ok: false, code: 'WIKI_DISABLED', enabled: false, implementation_feature: '003-manual-repo-wiki' }` before store opening or device forwarding. Validation/authorization and payload-free operational telemetry still occur; no store/provider/domain gateway side effects occur.

H1 provenance: `git rev-parse f58b95a^` returns `a95a7dce03fc8e80bab99af8f90597213f527fd3`; `git diff --stat a95a7dc f58b95a` contains only evidence/ and .gitattributes. All 210 tracked source/test/harness/package inputs remain byte-identical before/after the H1 rerun. The follow-up evidence commit is identified externally as Y_final2; no self-referential hash is embedded here.

Request: final independent sign-off for Checkpoint 3 / Phase 9 against X_final and its separately committed H1 evidence. Linux native dependency failures remain explicitly documented; no unconditional Linux full-suite pass is claimed. No merge, publication, tag or production enablement is authorized by these results.
