# Palace v12 provider: source basis and behavior contract

Status: Palace runtime and final licensed installed-package acceptance pass on Windows and Linux; production observation/deployment remains NOT_RUN. User authorization: 2026-10-22 MCP Device v12 handoff and locked decisions 07. Base Device HEAD 1df22e6bca3e4f5fa7bfd94f814c1b7409fd7848. Worktree E:/git-project/agent-mcp-device-v12, feat/v12-platform-20261022. G6 only; no production operation.

## Research basis

Read the complete 00-09 handoff in order and the two 2026-10-22 independent audits under E:/test/mcp. Donor v4.2 HEAD 40cc5851541aa3072dbbf63ade3451752b17f25a is clean. Donor v3.2 HEAD 49ff6fafcb0fa574ed8b12ee17f16a2672e6621a has mode-only Windows differences; git -c core.fileMode=false status --porcelain returned no entries. No donor code is copied. Older audit recommendations for a new product or bypassed localhost pairing are superseded by locked handoff 07.

Retain Device P1 exact-byte source verification and incremental index. A bounded, read-only observation enumeration API is the only P1 addition. Cards, revisions, derivations, source checkpoints, import history and Skills belong to the Palace plugin data root, not Core/account identity state. Default reads return cards; explicit evidence reads use verified original sources or plugin-managed evidence.

## Defects the implementation must prevent

Python donor palace.py learn_v11 accepts nonexistent evidence refs as corroboration. extract_experience_from_trajectory allows a caller success claim to override exit 99. _invalidate_dependent_lessons leaves Schema-2 Skills/current projections active. search lacks a project filter. Ingestion assumes growing files are append-only and consumes incomplete tails. Text such as 'verified outcome' affects trust ranking. Compact-result code permits the first item to exceed the byte budget. ops.py backup excludes Palace-owned episode/correction JSONL files.

Inspected prior receipts (historical evidence, not tests run in this slice): E:/test/palace-audit-20261022-0831/cognition-v4-probe-final/result.json, backup-4.2.0.json, isolation-4.2.0.json. These directly show fabricated promotion, stale recommendations after correction, loss of exact verification after restore, and same-account cross-project search leakage.

## Unified model

A card has stable original identity, integer version, canonical content hash, concise summary, bounded body, explicit scope and epistemic status, original and serving device IDs, original evidence identities, derivation parents and provenance chain. Imported copies never become new evidence. Version hashes exclude serving device/import timestamps. Source-byte integrity is distinct from truth, observed tool completion and task postcondition verification.

Evidence-backed cards from arbitrary logs remain observed/hypothesis. Learning can create candidates from real existing evidence. Automatic activation requires a trusted locally configured validation policy, exit zero, an independently checked postcondition, and preserved receipts. The default policy keeps candidates inactive. Tests execute a real Node child process and inspect the fixture output; deployed validation modules are trusted code responsible for executing the relevant recipe and checking its outcome; caller verdicts, fabricated refs and source text cannot activate Skills. Skill lists disclose compact metadata; full bodies are returned only on selected read. No AGENTS.md edits.

Corrections create a new immutable version and withdraw all transitively dependent current cards/Skills. Historical versions remain available in storage. All search/Skill outputs share that current status. Imported corrections update original identities without incrementing corroboration. Backup is handled by platform over the complete stopped plugin data root; internal evidence uses relative paths under that root.

## Negative fixtures

- Missing evidence refs: reject learning; no corroboration or activation.
- Claimed success with failed execution or failed postcondition: no active Skill.
- Repeated B -> A -> C -> A imports: original ID/evidence retained, no additional corroboration.
- Correction of source -> procedure -> Skill: transitive withdrawal, history retained.
- Same error in separate project scopes: no cross-project retrieval or implicit supersession.
- search/list: no import side effects; import is a separate platform-triggered capability.
- Source append/incomplete tail/rewrite/delete/invalid UTF-8: preserve P1 semantics and mark stale honestly.
- First preview larger than response budget: entire result stays bounded.
- Restore plugin data to a different root: managed evidence still verifies.
- Restart: cards, cursors and correction state persist.

## Evaluation

Use realistic held-out retrieval tasks with distractors, stale facts, project collisions, copied evidence and paraphrases. Measure retrieval precision, stale-result errors, end-to-end response bytes, p50/p95, index cost and storage. A deterministic fixture is not proof of general agent learning or token savings. All new evidence must record exact command, expected/actual result and source state.

## Implemented slice and operating limits

src/plugins/palace/plugin.ts adapts the generic platform contract; no Core branch loads Palace. Default distribution discovery merges the runtime log root with a small fixed catalog of local coding-session directories. Explicit direct-provider roots stay strict for isolated tests. Settings can disable known-source discovery and can set indexBudget.maxRecords/maxFiles/maxBytes/intervalMs within hard limits. Project README/AGENTS/Skill documents are read only; Git history uses a bounded local git log command.

P1 observations are enumerated without mutation; each chosen record must pass P1 exact-byte verification before construction. Cards and evidence live in durable SQLite. Whitespace/case-normalized duplicate observations consolidate only inside the same scope and status, retaining distinct original evidence IDs without raising trust. Repeated explicit Fix:/Solution: claims generate inactive procedure candidates automatically. A configured trusted local validation module may activate a candidate only through the executed-receipt/postcondition path. No AGENTS file is written.

Retrieval applies scope before bounded FTS candidate selection, then weights meaningful lexical coverage and abstains when the evidence overlap is too weak. It has no embedding/model semantic engine. Candidate and full Skill read budgets are enforced. search/list never import; selected read is the platform's lazy-import trigger. Complete hash-bearing cards are returned or the read raises BUDGET_TOO_SMALL.

Automatic source re-verification rotates through at most 64 evidence entries per ingest. A selected local card read or stat rechecks its exact evidence immediately, so a selected federation read detects changed/deleted origin evidence without waiting for background ingest. The index byte budget bounds index/extraction work; exact source hash re-verification additionally reads the original record and is bounded by record count. Imported remote evidence remains a remote reference, not a new local verification. Broad semantic paraphrases and large-corpus throughput still need further evaluation.

Platform activity capture is deliberately bounded and best effort: it retains four immutable JSONL segments, normally at most 2 MiB per segment, and admits at most 256 pending writes. Saturation or an I/O failure may drop an observation without changing the actual native tool result. Receipts retain status, exit code and selected path metadata; they do not retain command text or raw output and do not prove task postconditions. Retained segment paths stay stable. Once retention prunes a segment, its original exact evidence becomes unavailable; selected read/stat then marks dependent knowledge stale and propagates correction. Backing up retained state cannot recreate already pruned external evidence.

## Executed acceptance evidence, 2026-10-22

Source compiled by root build05 (TypeScript exit 0). Node Windows v22.22.2; WSL Ubuntu-22.04 Node v22.21.0. All fixtures use new temporary roots; no real home or G8 state.

Windows command:
C:/Program Files/nodejs/node.exe --test test/v12/palace-provider.test.js test/v12/palace-process.test.js test/v12/palace-benchmark.test.js test/v12/palace-task-replay.test.js test/v12/state-backup.test.js

Result: 23/23 PASS, 3.774 seconds. Receipt: E:/test/mcp-device-v12-20261022/palace-all-win.log.
The same compiled provider/process/backup tests under WSL passed 21/21 in 5.084 seconds, exit 0: E:/test/mcp-device-v12-20261022/palace-final-wsl.log.

The process regression specifically performs knowledge.read on a missing local ID, then ingest and remote import through the real child-process driver. Expected uppercase domain errors carry codes and leave the provider available; uncoded unexpected exceptions retain generic fault behavior.

Final retrieval benchmark command:
MCP_V12_PALACE_BENCHMARK_OUTPUT=E:/test/mcp-device-v12-20261022/palace-benchmark-final.json node --test test/v12/palace-benchmark.test.js

The corpus has 121 records, including 108 distractors across three project scopes. The original 12 requests became a regression set after exposing common-word noise. Before the fix: top1 11/12, no-answer abstention 0/3 and precision among the three returned items 33.3%. The saved baseline is palace-benchmark-baseline.json.

After the bounded lexical filter: regression top1 and hit@3 12/12; 12 relevant items among 14 returned (85.7% precision among results, maximum three per request). Strict P@3 counting empty positions is 33.3%, because most requests return one useful item. Three no-answer requests abstain; scope leaks, stale-result errors and byte-budget errors are all zero. Six additional paraphrases frozen after implementation and not used for tuning achieve top1/hit@3 5/6 (83.3%). The socket/address ownership paraphrase abstains: a concrete lexical semantic limit, retained without tuning on the new cases.

Final isolated measurements: 651 ms index time; 72 search samples; p50 0.733 ms and p95 1.636 ms; mean preview 880 bytes versus mean project raw corpus 5,524 bytes; checkpointed plugin state 987,136 bytes; zero model calls. Earlier concurrent runs were slower; these are fixture measurements, not production latency promises. Receipt: palace-benchmark-final.json and palace-benchmark-final.log in the evidence directory.

The executable task replay uses a real Node child process, ledger state and an independent idempotency postcondition. It automatically learns and validates one recurring source-backed candidate, then applies it to three new task IDs. Both policies complete 3/3 tasks. No-Palace baseline performs nine executions with three repeated errors; Palace performs three executions plus two retrieval calls with zero repeated errors. Replay elapsed time is 1.525 seconds versus 0.537 seconds, excluding one separately reported training validation. Agent-visible bytes increase from 630 to 3,352 because the small fixture exposes retrieval/evidence overhead. This is a deterministic policy comparison, not LLM productivity or token-saving evidence. Receipt: E:/test/mcp-device-v12-20261022/palace-task-replay-win.json.

## Post-review integration acceptance

After full build10, all 38 owned router/Palace/process/backup cases passed on Windows and WSL. The Windows cases are captured inside E:/test/mcp-device-v12-20261022/platform-final-win-build10.log; that wider run was 73/74 because of a separate generic dependency-cancellation race subsequently repaired by the Device agent. The owned subset did not fail. The same 38 tests passed under Ubuntu Node 22.21.0 in 5.098 seconds, with zero failures/skips, in palace-review-final-wsl.log.

New integration cases prove that retained immutable JSONL activity segments remain discoverable and preserve exact evidence through rollover; a selected federation read detects a source rewrite or deletion through origin stat without background ingest; and lazy import propagates the stale revision and withdraws a dependent procedure. Router regressions prevent known correction/revocation from being converted into old-body stale success, including the next offline read. Complete stopped-state backup also rejects nested runtime coordination markers.

WSL used the copied build10 dist/test snapshot at E:/test/mcp-device-v12-20261022/palace-review-snapshot-build10, whose source-state.json records the source/compiled hashes. Its command was:
 /usr/bin/node --test test/v12/palace-provider.test.js test/v12/palace-process.test.js test/v12/palace-platform-integration.test.js test/v12/knowledge-router.test.js test/v12/knowledge-correction-guards.test.js test/v12/state-backup.test.js

The build11 WSL platform suite passed 74/74 with zero failures/skips in 22.575 seconds; receipt: E:/test/mcp-device-v12-20261022/wsl-build11/platform-all.log and its build-snapshot.json. Later isolated-process cleanup fixes passed E:/test/mcp-device-v12-20261022/platform-final-win-03.log: 75/75, zero failures/skips/cancellations, 24.566 seconds. The earlier EBUSY failure remains preserved in platform-final-win-02.log. Final review then identified CLI lease ordering, cooperative stop rejection and Device-only shutdown propagation fixes. All are now implemented and pass the final 77-case platform suite on both OS. Windows receipt: E:/test/mcp-device-v12-20261022/platform-final-win-04.log/.exit, 77/77, zero failures/cancellations/skips, exit 0, 34.042 seconds. Windows extended startup/cleanup receipt: startup-final-win.log/.exit, exit 0. Linux receipts under wsl-build13: platform-all.log (77/77, zero failures/cancellations/skips, 20.780 seconds), core-runner.log, nochild-runner.log and build-snapshot.json. The full Linux orchestration took 55.54 seconds. These final runtime receipts close the cleanup findings. Final licensed-package cold acceptance also passes on both OS: cold-server-final-win.log/.exit, 1/1 PASS, exit 0, 10.449 seconds; cold-linux03/server-package-cold.log and server-package-cold-receipt.json, 1/1 PASS, exit 0, 11.789 seconds. Both fixtures prove default Palace loading, retained pairing/OAuth after restore and exact evidence after restore.

The independent review and parent-wide acceptance state are recorded in platform-review.md. These results establish the implemented vertical slice and its negative invariants. They do not by themselves authorize production deployment or claim universal task-learning effectiveness.

## Final distribution identity

Runtime commit: 532f0f1369105b01354507a98e45a8c652f9e75b. Tested licensed artifact: E:/test/mcp-device-v12-20261022/package-final03/hcu-lab.me-mcp-device-1.0.12.tgz. SHA-256: 134e46e6487fc6900c2c4fd94b4184a034784936ba7d2626630c69ca82a043a0; 2,121,956 bytes; 738 files. E:/test/mcp-device-v12-20261022/license-repack.json verifies all 737 prior entries are unchanged in bytes and mode, with only the Gateway MIT notice added.

The final source server rerun passes 18/18 in 57.958 seconds (E:/test/mcp-device-v12-20261022/server-e2e-final02-win.log/.exit). Imported-source provenance passes for all 457 files (specs/008-v12-platform/server-provenance-test.log). Final 8104 listeners are cleared on both OS. Production-unobserved/NOT_RUN entries remain in the acceptance matrices; no production operation or general LLM productivity claim follows from this isolated evidence.
