# Foundation implementation verification — T007–T015

Run: 2026-10-04T18:05Z, Windows x64, Node 22.22.2, SQLite 3.51.2.
Worktree: `E:/git-project/wt-mcp-device-111-context`.
Authorization: the current owner instruction extends Phase 1 authorization to Phase 2 only. No merge, publish, live capture, gateway registration or release authorization is inferred.

## Disposition

- T007–T010: implemented behavior tests (real temporary Git repositories/worktrees/clones, real SQLite databases, real Windows junction escape).
- T011: redaction/exclusion boundary implemented. DB evidence, hashes and explicit FTS materialization use retained redacted bytes. Capture append performs no automatic FTS sync.
- T012: registry, owner/repo/unscoped version-1 transactional migrations, WAL, foreign keys, busy timeout 5000, NORMAL process-crash profile. Random repo/ref identities, scoped HMAC/server-state cursors, generations with atomic publication pointer. Repo handles bounded to 16; repo count bounded to 256. Explicit allocation accounting includes active/sealed namespaces and shared overhead; accounting is a snapshot, not Phase 5 quota enforcement.
- T013: explicit guarded resolution, canonical Git common-directory identity shared by worktrees, distinct clone identity, separate nested repository, sealed previous owner and no automatic re-adoption.
- T014: status without creation of a missing repo store, watermark/pending/freshness, unknown-after-restart visibility, RAM gap count, scoped job ownership (one per repo/four per owner), no scheduler.
- **T015 independent-author review: BLOCKED / NOT PERFORMED.** These tests and this review were run by the implementation author. No Agent/reviewer invocation tool was available in this session. A different reviewer must inspect these hashes and rerun tests before the Phase 2 independent-review checkpoint is accepted.

## Verification

Commands:

```sh
npm ci --ignore-scripts
npm run build
node --test test/context/*.test.js
for f in test/context/*.test.js; do node "$f" || exit; done
git diff --check
```

- Build: PASS, 730 compiler files, no TypeScript errors, total TypeScript time 13.72 seconds; complete packaging build exit 0.
- Node test runner: **13 tests, 13 PASS, 0 FAIL** (includes frozen policy and platform probes).
- Each of seven `.test.js` files directly executed with Node: PASS. Do not use plain `node test/context/*.test.js` as a multi-file runner: Node treats extra expanded file arguments as script arguments; explicit iteration or `--test` is necessary.
- `git diff --check`: PASS.
- Expected Node experimental SQLite warning remains visible on stderr.
- Linux and exact Node 22.13 floor: NOT_MEASURED in this leg.

Raw outputs retained under `evidence/context/foundation/`.
Initial missing-module red run was observed before implementation. JSON-key canary failed behaviorally before quoted-key redaction correction; explicit accounting failed before implementation (`refreshAccounting` absent). First integrated run exposed Windows teardown order (remove before close); hooks now close before cleanup. These are not represented as passing samples.

## Scope limits / follow-on review

- Foundation stores evidence inline in SQLite rather than speculative external blob management. Later consumers must maintain the redaction-only boundary; direct database handles are internal, not adapter APIs.
- No capture wiring, importer, retrieval/indexer, CLI, scheduler, source parser, wiki provider, crash recovery rewrite, capture priority busy budgets or quota enforcement is claimed here. The 5000ms baseline busy timeout is not live-capture compliance; later capture must install its bounded 5/10ms acquisition policy.
- A cursor becomes explicitly stale on publication change rather than promising an unavailable historical view. Query identity must include normalized filters in later retrieval integration.
- Secret detection is deterministic pattern coverage, not a guarantee against arbitrary encoded secrets. Base64 runs, binary bytes, known credential paths, quoted/plain key/password assignments, bearer tokens, private keys and known key prefixes are tested. No raw-secret hash is retained.
- Windows HMAC file ACL uses current-user-only grant with inheritance removed; POSIX uses mode 0600. Key remains stable across re-pair. Key replacement and malicious state-root manipulation need later platform/security review. Trusted state-root configuration is not tool input.
- Source event lifecycle fields and graph tables are foundation schema only; this leg does not fabricate full live ToolEvent capture semantics or claim activity graph functionality.
- Snapshot accounting includes sealed stores and shared state. Accounting does not automatically run on status, enforce quota, evict content or claim perfect concurrent byte accuracy.
- `synchronous=NORMAL`: recent commits may be lost on power failure; no power-loss durability or secure erase claim.

## SHA-256 implementation/test hashes

```text
2ce4cdc4b7caa5b2ad1291b2d52746b1f35c70e748d8512cf8f4d22264c41d49  src/context/redact.ts
33dbbf6603440d645d0062aa3ce77335c1a1549efb766fb6594126aa5d357c2f  src/context/store.ts
8a8a01b49a209d385fb413c1a1d39c48fda29ee16416786a753b0a0548105a26  src/context/repositories.ts
0075f26511f0b316609f960515ae46676c12aadaea0d873951014621169ce496  src/context/service.ts
a3250ff8c4f2304743841182275b6130890ed6157e91a3a58406d4adeab29207  src/context/sqlite.d.ts
c50ce2a2024ee801438f5064121eb452309f144ea2537c32a8aa2f7ab883296d  src/context/migrations/index.ts
c768995998d7402f6bf9808fb7404eaf9c9c14a0613bae5dca6e955b6b2b7c5f  test/context/helpers.js
91937709804a032dc976c4235f89499f7bd3ead5e043f6ff44732e5c55cabf06  test/context/repositories.test.js
653f277fe6a20d2474e91f93e7393c30a7eadc0109a73e1599aaa57787a45531  test/context/access.test.js
2680719ee74fca61140761bedb22561a23b849bc80337765d3bb64e57e2296c9  test/context/redaction.test.js
e06244b713f31f14df5f872fe26667ae282e8ac92e34fada2169ba45cf490d47  test/context/store.test.js
90855a1f71d718daa68ab9d6bab705c4b121aac8ef08f2d359afd1a5017a1cd5  test/context/foundation-edge.test.js
5dee6616c8e7973b2480e12f5f78ebf27f26242cc96244e93cf9e176b091c803  evidence/context/foundation/build.log
ce5f79313da36f056eab343bae18e41b475a5addf9494904f937cb7e3cbe0fb1  evidence/context/foundation/tests.log
9cc03f5663892cd181e6ade6cab021ec3c229dcc9a4ed14ed71aa3ff079acf11  evidence/context/foundation/direct-node.log
```
