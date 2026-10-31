# v12 D1 bridge-only preflight and provenance recovery

Recorded 2026-10-29. Authorization: bridge readiness/provenance only; no new M365 submit/resume/send, source/repository write, Git mutation, benchmark/build/package or runtime operations. Source writer del_mvtmd6qq_gl9k and packet planner del_mvtmdmcz_n75e remain owners of their separate tasks. No live G6 8101-8104/G8 contact was made.

## Readiness

- Discovered owned online device named `fjp` using device_list_devices (current session message e0123dcd): device_id `lppduongnh66-1-7337f19f`, hostname `LPP00374779A`, agent_version `1.0.10`, online true, revoked false. This ID was selected from discovery, not presumed from history.
- Read local `C:/Users/admin/.pi/agent/skills/m365/SKILL.md` and all 216 lines of FJP `C:/Users/DuongNH66/Desktop/git/M365-Copilot2DOM/AGENTS.md` (first 200 via read_text_file; final 16 via bounded shell). Worker help confirms current interface.
- Launcher: `C:/Users/DuongNH66/.m365-copilot2dom/m365.cmd`.
- Doctor attempted exactly once through approved device_shell_execute, timeout_ms 28000. Result (message acaad885, 2026-10-29T14:12:29Z): exitCode 124, timedOut true, stdout empty, stderr `Command failed: powershell -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $M365=Join-Path $env:USERPROFILE '.m365-copilot2dom\m365.cmd'; & $M365 doctor"` followed by newline. No ready:true received. No authentication failure was established either. No retry/controller repair was attempted. Current M365 submission readiness is UNVERIFIED/BLOCKED, not ready. Historical doctorReady:true is not a fresh result.
- Local-state and device read/write access worked. No new M365 request was made. Source-stable future packet was not staged/submitted by this bridge task.

## Latest attributable v12 D1 review identity

- Exact turn: `183b8083-m365-worker-20261028-012828-16970c16`.
- Confirmed thread: https://m365.cloud.microsoft/chat/conversation/a39299d6-2bc1-486f-9d62-2f972057cae3
- Requested model alias `opus`; verified model label and completion label both `Opus 5.5`.
- Current FJP durable state reports COMPLETED; send_intent true, send_confirmed true, send_attempts 1. Historical caller handoff records admission accepted_new. No new acceptance occurred here.
- `worker recent` identifies this completed turn in the D1 thread, turn_started_at `2026-10-27T16:28:58.826936+00:00`, updated_at `2026-10-27T16:34:06.837741+00:00`, response_chars 13819. Current durable conversation listing contains newer unrelated threads; those are not v12 D1 reviews. Older same-thread failed turn `2e4a9646-m365-worker-20261026-214235-9da1aca3` is FAILED_BEFORE_SEND, recoverable false, and is not this response.
- Historical attachment workspace: `C:/Users/DuongNH66/d1-final-review-0014b394-e954-4881-82fd-1007533cba7a`.
- Prompt hash: `70b1f348bc23e2fad3ea159e131463f25cfbfd547d8bec24a6ad0ce0f4f15901`.
- Input hash: `4a79ae84020348d32f84f21639657f9f34dce1f46e842c2e0a7baf64f4a15f64`.
- Attachment `D1-current-source-tests-evidence.txt`, 919832 bytes, SHA-256 `f05d541839ecc8570b697b6ee42117e432af216fb694d54c7cceb5f0a689e656`. Current durable job state matches these identities.
- Historical caller handoff: `E:/git-project/agent-mcp-device-v12/evidence/v12-e2e-20261024-g6/D1-closure-20261028/d1-bridge-submission-20261028.json`; it binds historical source HEAD `18407ec562c4f2cc11ca3e8c1f69f362ee3f86c0`, not present/future source. Its stale fields (responsePath null, lastObservedState responding, responseTransfer unavailable) are historical observations superseded by completed state and this exact transfer, not contradictions silently rewritten.
- Verdict remains historical AMEND, not D1 PASS or release acceptance. Recovered review is not a fresh review of later fixes or the future source packet.

## Exact response and resolved discrepancy

Remote durable file:
`C:/Users/DuongNH66/AppData/Local/m365-copilot2dom/jobs/183b8083-m365-worker-20261028-012828-16970c16/response.md`

Exact transferred local file, external temp only:
`C:/Users/admin/AppData/Local/Temp/v12-d1-bridge-del_mvtmebut_fjan/response.remote-exact.md`

Remote and transferred local identity: 13883 bytes, SHA-256 `e901a780bb44e8f345c81a78edaee3fe37af712bb38178d9b971defceb2eafd8`.

Existing repository extraction:
`E:/git-project/agent-mcp-device-v12/evidence/v12-e2e-20261024-g6/D1-review-fixes-20261028/review-response-extracted.md`
13882 bytes, SHA-256 `5043be6f052e26f46448152d3b836b2a819e0173863c4e4019f188999febb794`.

Fresh byte comparison proves the existing extraction is an exact prefix of the exact remote file; the sole additional remote byte is final LF (0A). Independently on FJP, hashing remote bytes without their final byte returns the extraction hash. This establishes byte difference, not an invented substantive review difference or an unproven cause in the historical tool renderer. Existing extraction and provenance/disposition files were left unchanged.

Read references:
- `E:/git-project/agent-mcp-device-v12/evidence/v12-e2e-20261024-g6/D1-review-fixes-20261028/REVIEW-DISPOSITION.md`.
- `E:/git-project/agent-mcp-device-v12/evidence/v12-e2e-20261024-g6/D1-review-fixes-20261028/review-extraction.json`.
- Historical extraction source `C:/Users/admin/AppData/Local/Temp/acp-delegate/del_mvqvpu3w_1qdu.session.jsonl`, message `4364116c`, timestamp `2026-10-27T16:36:54.483Z`.

## Working transfer/staging mechanism

Catalog discovery exposed approved device_read_text_file, device_write_file and device_shell_execute. No dedicated binary upload/download API was found; external tool search returned no items. No historical giant base64 transfer was retried.

Actual successful download: FJP device_shell_execute created five isolated temp base64 chunk files from source bytes (3072-byte raw chunks, final 1595 bytes), plus per-chunk offset/length/SHA-256 manifest. Approved device_read_text_file read each bounded chunk. Local decoding from the saved tool transcript verified every chunk and whole-file SHA-256 before writing the exact external-temp copy. Each full chunk is only 4096 base64 characters. See `transfer-manifest.json` and `transfer-receipt.json` alongside this handoff; all five chunks remain available.

FJP current isolated staging root:
`C:/Users/DuongNH66/AppData/Local/Temp/v12-d1-bridge-del_mvtmebut_fjan`
(short alias returned by FJP: `C:/Users/DUONGN~1/AppData/Local/Temp/v12-d1-bridge-del_mvtmebut_fjan`).

Upload-side probe: device_write_file wrote only `staging-preflight.txt` in that temp root, with UTF-8 Japanese marker and LF newlines. FJP device_shell_execute measured 92 bytes and SHA-256 `2f6632cbae3d2177f2fad0f6cd83bca3f8071387d8dd5d91e5299abb2bdb72d0`, exactly matching locally encoded requested content. Thus bounded write_file staging works. For larger future files, stage bounded ASCII base64 chunk files via write_file, reconstruct only in the caller temp workspace via device shell, then verify per-chunk and whole-file lengths/hashes before use. That larger upload reconstruction is a viable mechanism, not a claimed completed future-packet upload. A future submission requires explicit authorization and a successful fresh doctor ready:true; do not infer permission from this report.

## Local external-temp evidence

All under `C:/Users/admin/AppData/Local/Temp/v12-d1-bridge-del_mvtmebut_fjan/`:
- `BRIDGE-HANDOFF.md` (this report).
- `response.remote-exact.md` (verified exact response).
- `transfer-manifest.json`, `transfer-receipt.json`, `0000.b64` through `0004.b64` (byte-level transfer evidence).
- `bridge-tool-evidence.json` (original discovery, doctor error, recent/state/hash and transfer-tool discovery results with session message identities).

Full current tool transcript: `C:/Users/admin/AppData/Local/Temp/acp-delegate/del_mvtmebut_fjan.session.jsonl`.
