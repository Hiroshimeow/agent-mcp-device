# D1 independent implementation review — MCP Device v12 + Palace
Continue the SAME verified Opus 5.5 conversation used for D0. This is D1 only: S1-S3 implementation/lifecycle/single-writer review. Do not declare release-ready and do not review S5/S7 as if completed.

MANDATORY SOLUTION QUALITY POLICY:
1 correct behavior/acceptance; 2 mature/proven existing techniques; 3 reference parity; 4 reliability/latency/UX/maintainability; 5 reuse; 6 simplicity only after the above; 7 implementation/token/time cost last. KISS means simplest implementation fully satisfying target behavior.

ATTACHMENT: D1-source-pack-full.txt, byte-verified against G6:
- attachment bytes 440867
- SHA-256 ce98566f2923f09b42aafb8233ecedc2846e6a80c6d314ca3910695de9c4996a
- HEAD remains 1e454c1cdcbe3265892f751034fa389432d65405, dirty WIP deliberately preserved, no commit/publish/deploy.
- exact current artifacts:
  Device 1.0.12 cd20147d602e9b498d6a76e6847263908940f6ded04ef04ceb74b1b402ac1970
  Palace 1.0.12 033df49857fe43f0158446a8afb9e336477a4d4d5014a37c064771b1fa3482dc

CURRENT EXECUTED EVIDENCE (same source/artifacts):
- Windows G6 Node 22 platform: 160/160 pass, 0 skip/fail.
- Windows cold-package server suite: 42/42 pass, 0 skip/fail; account/OAuth/PKCE/pairing/cross-owner denial/remote Cores/knowledge federation/loopback auth.
- Linux Ubuntu-22.04 WSL on G6: same artifact hashes; platform 160/160 pass, 0 skip/fail; Device and standalone Palace cold install; both Skill targets owned-pristine.
- Skill focused matrix: 54/54 pass.
- Live current artifacts: 1000/1000 Palace CLI calls while PluginHost writer appended 151 records, 0 errors, SQLite integrity ok; p50 282.5 ms, p95 479.9 ms, p99 651.5 ms.
- Real current-artifact Codex agent E2E: discovered and read installed Palace Skill from the cold Device package, ran palace status/search/read/skills, read original source traces, and correctly refused to claim a validated procedure where the selected card was only observed. No Palace MCP service.
- parity receipt currently states no candidate-native regression in executed families; full D2/D3 parity disposition remains later.
- Standalone is same implementation, LICENSE present, recursive declaration/runtime closure enforced, no mcp-device dependency.
- D0 architecture is already PASS / NO MATERIAL D0 DISAGREEMENT.

IMPORTANT: the source pack includes current fixes and tests, including coordination-lock.ts, process-identity.ts and d1-opus-regressions.test.mjs. Do not assume their correctness because test names say D1/Opus. Read implementation and challenge the tests.

REVIEW TASKS:
A) Hunt concrete P0/P1/P2 defects in package/Skill lifecycle: copy default, multi-owner ledger, aliases, user edits, foreign links, relocation, interrupted publish, lock recovery, PID reuse, privileged install, opt-out, package removal/reinstall, same-prefix bin collision policy.
B) Review PluginHost lifecycle and process isolation: registry token/recovery lock, stale/reused PID, upgrade intent/rollback, provenance, bundled version repin, tombstone semantics, cancel acknowledgement vs unresponsive work, cleanup ownership, single writer.
C) Review Palace Store/CLI: schema check must make zero byte changes even with WAL/SHM; non-Palace DB must not be adopted; canonical search parity; runtime-root defaults; disabled/uninstalled/faulted/upgrade-required remediation; read-only concurrent CLI; output byte budget.
D) Review standalone package closure: public .d.ts closure, runtime imports, computed imports, plugin manifest, LICENSE, Skill install, no hidden Device runtime dependency; default Device package and standalone prefix behavior.
E) Review evidence quality. Identify tests that are tautological/no-op, evidence that doesn't prove its claim, or untested OS edge cases. Distinguish blockers from hardening.
F) D1 verdict must be one of PASS / AMEND / BLOCK. If AMEND/BLOCK, give exact source-grounded findings and minimum regression tests. If PASS, explicitly state what remains for D2/D3 and do not call release ready.

Be independent. Challenge both the implementer and your prior D0 opinions. Do not optimize for fewer changes. Do not invent a heavier subsystem if existing correct primitives cover the failure mode.