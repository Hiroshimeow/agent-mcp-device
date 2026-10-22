# MCP Device 1.0.12 acceptance record

Date: 2026-10-22. Candidate branch: `feat/v12-platform-20261022` in `E:\git-project\agent-mcp-device-v12`. Runtime implementation commit: `532f0f1369105b01354507a98e45a8c652f9e75b`; subsequent changes record documentation and evidence.

This record separates executed behavior, retained source provenance, known baseline fixture gaps and production observations. The candidate continues `@hcu-lab.me/mcp-device`; no second product, mechanical repository merge, release publication or production cutover is part of this work.

## Authority and source state

The complete handoff at `E:\test\MCP-DEVICE-V12-SPEC-HANDOFF-20261022` was read in order 00–09 before implementation. Decisions in 07 were treated as closed. The user's v12 instruction supersedes the earlier source-only P1 scope and the old repository note describing separate runtime products; it does not authorize modifying the original Gateway checkout or deploying production.

| Source | Branch | Frozen HEAD | State |
| --- | --- | --- | --- |
| `E:\git-project\agent-mcp-device` | `main` | `1df22e6bca3e4f5fa7bfd94f814c1b7409fd7848` | Clean; preserved |
| `E:\git-project\agent-mcp-gateway` | `develop` | `7a5a30b4a5f6226cf65b395ddfa0424677184592` | Clean; preserved |
| Palace v3.2 research donor | donor snapshot | `49ff6fafcb0fa574ed8b12ee17f16a2672e6621a` | Research only; observed mode differences |
| Palace v4.2 research donor | donor snapshot | `40cc5851541aa3072dbbf63ade3451752b17f25a` | Research only; clean |

The Gateway import is a reviewed dependency closure, with 457 original files: 450 unchanged imports, seven explicit adaptations, and seven separate support additions. It retains 34 Skill packages and their applicable license/notice files. Original hashes remain in `gateway-import-manifest.json`; UTF-8 text also has canonical LF hashes so a clean cross-platform checkout does not falsely fail provenance checks. Binary assets remain byte-exact. An actual LF-normalized mirror passed the verifier.

All new server testing is isolated on G6 loopback port 8104. Existing G6 port 8103 belongs to an audit process and is preserved. G8 8102 production and 8101 backup are outside the task. No G8 runtime access is claimed.

## Implemented vertical slices

1. **Shared execution core.** `src/device/core.ts` exposes the existing Gateway adapter and rich native dispatcher without account, transport, plugin or Palace ownership. Remote `start` and embedded `server` use the same Core through the platform wrapper. `device` aliases existing Device commands.
2. **Embedded control plane.** Retained account/OAuth/pairing, broker authorization/epochs, Skills and upstream management compose with an in-process local endpoint. Localhost is authenticated. `/operator` shares the listener and administrator policy. Local execution creates neither a self-WebSocket nor another Device MCP process.
3. **Generic plugins.** Versioned providers, augmenters, observers, fallbacks and pinned dependencies have explicit lifecycle and private data. Node workers, external JSONL executables and trusted cooperative in-process providers use the same host contract. Capability availability follows health and dependencies. Bundled provenance permits safe entry relocation and requires explicit migration for changed contracts/schemas.
4. **Palace.** A default enabled distribution plugin constructs durable scoped cards and inactive procedure candidates from bounded local evidence. Exact evidence, revisions, correction, deduplication and trusted validation replace the donor's unsupported success/learning assumptions. Core works with the plugin disabled or removed.
5. **Platform federation.** Search/list return compact account-scoped references without import. Selected read imports only through a compatible requester storage capability; a Device without Palace uses bounded session cache. Origin checks, version floors, scope denial and changed-revision failures prevent silently serving a known superseded result as usable knowledge.
6. **State operations.** Dry-run migration, complete stopped-state backup, verification, fresh-target restore and rollback preserve identity, accounts, OAuth, invitations, private plugin files and managed evidence. Ownership/WAL/nested-runtime/collision/path checks protect snapshot consistency.
7. **Distribution acceptance.** The normal npm lifecycle builds and packs the same product. Production-only isolated installations exercise the actual installed CLI and bundled assets, ordinary signup/pairing/OAuth, local execution, restore and token/identity continuity.

## Executable verification

Receipts live under `E:\test\mcp-device-v12-20261022`; selected summaries are retained with this spec. [The machine-readable acceptance receipt](acceptance-receipt.json) records the validated runtime commit, exact tarball, test counts and raw-receipt hashes. `device-parity.json` and `gateway-parity.json` are the per-family inventory. Their executable runners reject empty/no-op test results.

### Baseline and candidate parity

| Family | Evidence |
| --- | --- |
| Native Device behavior | Actual old-versus-Core comparator on Windows and WSL: text/CRLF append, exact and atomic edit, XLSX/DOCX/PDF, search, shell, process retention, allowed roots and closed-Core behavior |
| Context compatibility | 84 tests in 18 suites per baseline/candidate on Windows and WSL |
| Existing P1 log indexing | 39 tests per baseline/candidate on Windows and WSL |
| Gateway projects/resources/prompts/workspaces | 56 candidate and 56 baseline behavioral assertions |
| Gateway admin/usage/releases/SDK/catalog/Skills behavior | 63 candidate and 63 baseline assertions |
| Gateway compatibility | 13 candidate behavior assertions; 16 baseline assertions, with three old standalone package/docs layout checks explicitly retired |
| Additional Gateway forget/offline-access/security cases | Seven candidate and seven baseline assertions |
| Earlier retained Gateway security/contract coverage | 45 passed |
| Earlier Skills/STDIO/upstream/catalog coverage | 62 passed, one Windows symlink-privilege skip |

The original Windows direct-entry guards could finish without invoking exported test suites because drive paths were compared to malformed file URLs. Those no-op exits are invalid acceptance. The v12 runner invokes the actual suites and requires assertion-bearing receipts. A stale native fixture expects `4 edits` while both original and candidate return `4 edit(s)`; that shared baseline fixture mismatch is recorded, not hidden. The original Windows allowed-root drive assumption and symlink privilege limitations are also separated from product failures; Linux runs exercise the real path/symlink checks.

### New platform checks

The combined port-free suite covers plugin lifecycle/dependencies/external JSONL IPC, version compatibility, cancellation, bundle relocation and upgrade rollback, platform Core availability, authenticated context isolation, knowledge correction/revocation, evidence refresh/retention, backup/migration, CLI ownership and retrieval/task-replay benchmarks.

| Final gate | Executed result | Receipt under the evidence root |
| --- | --- | --- |
| Windows platform, Node 22.22.2 | 77/77, zero failures/cancellations/skips; 34.042 s | `platform-final-win-04.log` and `.exit` |
| Linux platform, Node 22.21.0 | 77/77, zero failures/cancellations/skips; 20.780 s | `wsl-build13/platform-all.log`, `summary.json`, `build-snapshot.json` |
| Windows process/dependency repeat gate | Three sequential runs, each 10/10; 5.412 / 5.427 / 5.033 s | `services-stress13/receipt.json` |
| Extended Device startup/shutdown/update fixture | PASS on both OS; concurrent failed cleanup, retry, retained ownership, unarmed update handoff, failed-signal survival | `startup-final-win.log`; `wsl-build13/nochild-runner.log` |
| Final Linux old-versus-Core comparator | PASS on the frozen build13 snapshot | `wsl-build13/core-runner.log` |
| Server factory/broker/upstream cleanup | 14/14 | `gateway-final-unit.log` |
| Authenticated server end to end | 18/18, zero failures/cancellations/skips; 57.958 s; one G6 loopback listener and actual shared/remote Cores | `server-e2e-final02-win.log` |
| Installed final package, Windows | 1/1 cold flow, zero failures/cancellations/skips; 10.449 s | `cold-server-final-win.log` and `.exit` |
| Installed final package, Linux | 1/1 cold flow, zero failures/cancellations/skips; 11.789 s | `cold-linux03/server-package-cold.log`, `server-package-cold-receipt.json`, `install-receipt.json` |

The final shutdown regressions cover process termination refusal, cooperative stop rejection, pinned dependency cancellation, and cleanup errors through the host, platform wrapper, server factory, CLI and Device-only update/signal paths. A failed close remains observable, retains owned resources and state leases, and does not arm package replacement or force a successful exit. Normal close and an actual later retry are tested separately. The private RuntimeOwner acknowledgement means accepted; takeover still has to prove that ownership was released.

Earlier red receipts remain available. The Windows failures exposed a real orphaned plugin and swallowed cleanup paths; they were fixed and rerun, not converted into skips. Earlier 73/74, 74/74 and 75/75 receipts belong to their recorded source snapshots. Package01, final, and final02 are superseded by the licensed final03 artifact below.

### Final artifact

- Product: `@hcu-lab.me/mcp-device@1.0.12`.
- Tarball: `E:\test\mcp-device-v12-20261022\package-final03\hcu-lab.me-mcp-device-1.0.12.tgz`.
- SHA256: `134e46e6487fc6900c2c4fd94b4184a034784936ba7d2626630c69ca82a043a0`.
- Size: 2,121,956 bytes; 738 packaged files.
- Normal npm prepack/prepare/build completed successfully. `license-repack.json` verifies that all 737 files from the tested final02 payload have identical bytes and modes; the sole addition is the exact original Gateway MIT notice. Runtime code is unchanged.
- Gateway and all retained Skill license/notice files are included. The package whitelist excludes control-plane tests, runtime databases, accounts, identities and private keys. The only TLS private key in the source closure is a synthetic test fixture outside the package whitelist.
- Fresh production-dependency installs use this exact local tarball; no global install, npm publication or service replacement is performed.

The cold fixture uses the actual installed CLI and bundled Palace with no preseeded registry. It exercises administrator/operator policy, ordinary invite signup, normal localhost pairing, DCR/PKCE/OAuth, a native file operation, default offline indexing, verified backup, deletion of only its synthetic original state, restore to a new root, refresh-token/identity continuity and a previously issued knowledge reference. Both cold receipts passed against the final licensed tarball. A final read-only check found no remaining test listener on port 8104 on either Windows or Linux. These are isolated candidate acceptance results; the release and production boundary below remains unchanged.

## Benchmark interpretation

The retriever is lexical and uses no model calls. The twelve initial cases became a tuned regression set; they are not an independent generalization claim. After tuning, top-one/hit-at-three reached 12/12, returned-result precision was 12/14 (85.7%), and no-answer cases were 3/3. Strict precision at three, counting unused positions, was 33.3%.

A separate six-query paraphrase holdout written after implementation achieved 5/6 (83.3%). The socket/address-ownership paraphrase abstained. That is a documented semantic-recall limit, not a reason to claim complete retrieval coverage. The recorded small-corpus run indexed 121 records in about 651 ms, used 987,136 bytes of storage, and returned previews averaging about 880 bytes; search p50/p95 were about 0.733/1.636 ms. These are local fixture measurements, not production capacity limits.

Task replay used real Node execution and independent ledger postconditions: both policies succeeded on all three tasks; repeated errors fell from three to zero, tool executions from nine to three plus two retrieval calls, and measured time from about 1.525 s to 0.537 s. Visible response bytes increased from 630 to 3,352. There is no general token-saving or productivity claim. Exact corpus/method/results are described in `palace-design.md` and the benchmark JSON receipts.

## Material limits and release boundary

- Preserved source and isolated acceptance do not establish production observation. No feature is newly called production-verified based only on this work.
- Actual Context execution retains its signed feature gate. The real Core denial and all six successful routing contracts were tested separately; no approval artifact was forged.
- Historical listener-bound HTTP-upstream/negative transport and some deployment/update scenarios are explicitly NOT_RUN where the retained fixtures cannot obey the port/state boundary. Existing source provenance and current behavioral tests remain separate evidence.
- Trusted cooperative in-process plugins cannot provide hard preemption of blocking code. Process isolation is the supported path for providers requiring stronger crash/deadline isolation; it is not an operating-system security sandbox.
- The retriever's independent holdout miss, bounded provider fan-out/cache/response budgets and external-source retention limits remain visible. No full replication, global synchronous revocation database or automatic AGENTS editing is introduced.
- User-managed external plugin code and externally referenced original evidence remain external to a state snapshot. Managed private data/evidence and distribution-owned plugin relocation have separate tests.
- Source acceptance does not authorize npm publication, tagging, production service changes or cutover to G8. Those actions require the separate concrete release decision.

## Reproduction entry points

```text
npm ci
npm run build
npm run test:v12
npm run test:parity -- --list --group port-free
npm run test:parity -- --group port-free --output <new-isolated-evidence-dir>
node control-plane/verify-parity.mjs --source
node control-plane/verify-parity.mjs --run server-unit
node --test test/v12/server-e2e.test.mjs
```

Server tests require an exclusive G6 8104 lease. `MCP_V12_COLD_PACKAGE_ROOT` enables `test/v12/server-package-cold.test.mjs` against an isolated production-dependency tarball installation. Use Node 22 from the recorded runtime; the unrelated Node executable on the machine's default PATH is not the acceptance runtime.

See [platform guide](../../docs/v12-platform.md), [plugin contract](plugin-contract.md), [Palace design](palace-design.md), [state migration](state-migration.md) and [independent review](platform-review.md).
