# D3 blocked release/rollback review template

**NOT_READY_FOR_SUBMISSION — PREPARATION ONLY — RELEASE_BLOCKED_WITH_EVIDENCE**

New D3 turn/model/response/verdict: PENDING/null. No SHIP request is being sent. [P01–P16](PREREQUISITES.md) are closure criteria, not permission. [inputs.json](inputs.json) provides absolute paths/full SHA256/lengths for bounded existing citations.

## Existing evidence must not be promoted

- `d1-source-manifest` identifies the 263-file reviewed milestone, not a complete release input freeze. Same HEAD does not mean same dirty bytes. Current source/tests are exclusively owned by `del_mvrbs779_bgcp`.
- `d1-review-summary` and `d1-review-provenance`: completed Opus 5.5 AMEND, retained MF-6 30.1605 ms >20 ms, open P1 N1/N2, A1–A6/P2 disposition pending. Local summary is not exact remote response. Missing logs in the prior review attachment were not independently inspected merely because indexed here.
- `historical-device-package`/`historical-palace-package`, `candidate-build`, `candidate-audit`, `candidate-windows`, `candidate-linux`: older immutable pair and existing package receipts only. They do not cover new source. AB v1e uses the distinct `ab-device-package`/`ab-palace-package` pair. No new candidate is supplied.
- `soak-receipt`, `soak-owner`, `soak-raw-progress`: historical isolated synthetic 81,395 checks over 86,460.608 seconds, not fresh reviewed source, representative fleet traffic or full v11 comparative/auth/reconnect acceptance. Terminal receipt supersedes historical in-progress notes only for that old job; do not copy its PASS to a new candidate.
- `agent-disposition`: historical functional success but clean isolation/adherence NOT_PASS; no current tarball real-agent/Skill-hash acceptance.
- `downstream-research`: fixed-8104 fixture guards cannot be isolated by a mere environment override. Linux loopback-only namespace and explicit Windows fixture adaptation/VM are proposals, readiness unproven. Real baseline Git identity and complete candidate overlay/build manifests remain required. No fixture, WSL, Docker, clone/worktree or port operation was done here.

## Required release binding worksheet — all PENDING

| Binding | Required evidence |
| --- | --- |
| Reviewed source | Base HEAD plus complete tracked/untracked/deleted/mode/build-input overlay SHA; independent D1 PASS and findings disposition |
| Device + standalone Palace | One new immutable tested pair, SHA256/bytes, payload/install/dependency closure, licenses/SBOM, Skill/catalog hashes |
| OS/filesystem matrix | Actual tarball cold install/upgrade/fault/rollback Windows NTFS/Linux/WSL ext4 + /mnt/c; real assertions/skips; root install and consumer types/trust-boundary receipts |
| v11 parity | Genuine Device baseline 1df22e6bca3e4f5fa7bfd94f814c1b7409fd7848; separate Gateway baseline 7a5a30b; auth/ACL/pairing/native/Context/logs/client compatibility with material diffs dispositioned |
| CLI/Skill | >=1,000 reads during real ingest, single writer, integrity/resources, real clean agent discovery/invocation/evidence/runtime-resolution and installed Skill hash |
| S4/S5 and D2 | Genuine procedure quality/contradiction evidence, sealed-authorized heldout actual-usage results, independent D2 review; historical savings remain NOT_PROVEN |
| Stress/soak/rollback | Equivalent bounded v11/v12 workload, comparative correctness/errors/latency/resources/WAL, >=24h on exact new bits, stopped disposable identity/card/ACL-preserving rollback |
| G8 preflight | Later authorized sanitized actual process/config/ports/auth/OAuth/pairing/clients/Cloudflare/Skill baseline, safe snapshot and verified rollback runbook |
| Independent D3 | Exact attachment manifest, completed genuine model/state/turn/response and SHIP/BLOCK decision after gates; no verbal waiver for missing evidence |
| Production/final | Separate controlled update authorization, S1–S7 + D3 prerequisites, >=24h postconditions/probation, S9 commits/docs/manifests; no implicit publish/tag/push |

## Questions for a later authorized independent reviewer

1. Do all required results bind the exact same reviewed source and new package pair, without inheriting older-source passes or skip-only files?
2. Does rollback demonstrably preserve identity, pairings, ACLs and evidence with stopped-state/single-writer semantics, including interruption and WAL recovery?
3. Do authenticated local/public-style endpoints preserve one backend and older clients without bypass or unrelated Gateway Context work?
4. Are stress/soak representative, comparative and timestamp-backed on exact artifacts? Are production ownership, safe backup, stop conditions and probation proven before update?
5. Issue SHIP/BLOCK only with complete immutable evidence. This packet's present disposition is BLOCKED; D3 pre-update would not itself prove S8/S9.
