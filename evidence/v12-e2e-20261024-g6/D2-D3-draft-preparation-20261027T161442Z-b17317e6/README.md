# D2/D3 bounded draft packet

**NOT_READY_FOR_SUBMISSION — PREPARATION ONLY — RELEASE_BLOCKED_WITH_EVIDENCE**

Recovered the interrupted preparation run in this same isolated directory. Its two partial files were inspected; the old `.out` contained intentions, not completion. `authorization-and-identity.json` is retained unchanged as the interrupted-run inventory. `resume-identity.json` records the new inspection. No source/test/source-manifest writes, package builds, tests, workloads, devices, M365 submissions, sealing or production operations were performed by this preparation attempt.

## Start here

- [Evidence index](EVIDENCE_INDEX.md) and [absolute-path byte/hash bindings](inputs.json): bounded existing-input index; raw evidence stays in place.
- [Gate matrix](gate-matrix.json): all D0–D3/S0–S9, with current disposition separate from historical claims.
- [Unresolved prerequisites](PREREQUISITES.md): P01–P16, owners and closure criteria; none authorizes execution.
- [D2 blocked template](D2_DRAFT.md) and [D3 blocked template](D3_DRAFT.md): review questions and missing bindings, not send-ready prompts.
- [Terminal handoff](HANDOFF.md), [packet manifest](packet-manifest.json), [hash/consistency receipt](verification.json), [read-only verifier](verify-packet.ps1).

## Binding and chronology rules

1. Observed repository: `E:/git-project/agent-mcp-device-v12`, HEAD `18407ec562c4f2cc11ca3e8c1f69f362ee3f86c0`, branch `feat/v12-platform-20261022`. It is dirty WIP, not immutable HEAD-only source. Source/tests belong exclusively to `del_mvrbs779_bgcp`; this packet does not compare or freeze that owner's moving source.
2. D1-reviewed snapshot is identified by source-manifest SHA256 `4ecfc0343e767ac34651de7d06fb68e09a16e3720e854348febdfce8429701b2` (263 entries). This is not a complete release/build manifest and not a new candidate. Local functional 82 pass/1 skip and nonperformance 22 pass/1 skip are existing snapshot receipts, not fresh execution here; overlapping counts are never summed.
3. Completed D1 turn `183b8083-m365-worker-20261028-012828-16970c16` is **AMEND**, Opus 5.5 per local provenance. The local note is a summary, NOT an exact copy of remote response bytes. Remote response hash/length are reported provenance only; this packet does not claim to hash that remote file or inspect the exclusive bridge directory. Full A1–A6/P2 finding text still requires authorized response retrieval.
4. MF-6 retained final FAIL: normal p95 362.1103 ms minus skip p95 331.9498 ms = **30.1605 ms >20 ms**, 200 processes/arm. Earlier 18.5645 ms is superseded; instrumented stage diagnostics are not acceptance. Defender exclusions were UNKNOWN. Reviewer-proposed future >=400-pair paired-p95 estimator requires confirmation; it is neither registered nor executed here and cannot erase this failure. New P1 N1 (`processBirth` spawning PowerShell twice for active Windows reads) and P1 N2 (schemaless WAL causing permanent `PALACE_SCHEMA_UNSUPPORTED`) remain open.
5. `HISTORICAL_20261026` package pair (`historical-device-package`/`historical-palace-package`, hashes 8307…/609a…) and `AB_V1E_OLDER_ARTIFACTS` (`ab-device-package`/`ab-palace-package`, bf575…/60a905…) are distinct. Exact full hashes and absolute paths are in `inputs.json`; neither pair is the reviewed/current source candidate. No new Device/Palace package, Skill/catalog freeze or stopped benchmark snapshot exists in this packet.
6. Historical **S5 FAIL / savings NOT_PROVEN**, treatment +27.75%, is retained. S7 historical 81,395-check >=24h isolated synthetic soak is not this source or full comparative/auth/reconnect acceptance. Procedure mechanics and two engineering red/green logs from one incident cannot prove independent real-world traces. Historical agent functional success with isolation/adherence NOT_PASS cannot close S3.
7. Fresh evidence here is restricted to filesystem existence, SHA256, byte lengths and document consistency. Hash integrity is not product acceptance, semantic verification of every raw event, independent review or privacy clearance. All A/B v2 drafts remain unsealed; seeds, holdouts, registrations, future review turns and execution authorization remain absent.

The packet contains private absolute paths and an inherited local inventory. It is not a sanitized external attachment bundle. No automatic submission, scheduler or follow-up action is created.
