# MCP Device 1.0.12 implementation record

## Authority and preserved baseline

The user authorized isolated implementation on 2026-10-22 after the complete
`E:\test\MCP-DEVICE-V12-SPEC-HANDOFF-20261022` handoff was read in order 00–09.
The decisions in 07 are closed. This increment continues the existing package.

Verified source baselines:

| Responsibility | Original checkout | Branch | Commit | Working tree |
| --- | --- | --- | --- | --- |
| Device | E:\git-project\agent-mcp-device | main | 1df22e6bca3e4f5fa7bfd94f814c1b7409fd7848 | clean |
| Control plane | E:\git-project\agent-mcp-gateway | develop | 7a5a30b4a5f6226cf65b395ddfa0424677184592 | clean |

Candidate: `E:\git-project\agent-mcp-device-v12`, branch
`feat/v12-platform-20261022`. Existing ignored state in both original checkouts
is not imported as source or modified. Current source acceptance is distinct
from production observation. No capability is newly classified as
PRODUCTION_VERIFIED merely because its source or historical tests exist.

## Executable inventory before source movement

`device-parity.json` and `gateway-parity.json` map behavior families to source
owners, commands, expected effects, known baseline limitations and evidence
classification. Tests compare results, side effects, persisted state and errors;
schema equality alone is not an acceptance gate.

Notable baseline facts: the root Device runner omits Context and Log Palace
subdirectories; Gateway read_text_file ignores head/tail; Gateway has no
published local_* entries at its pinned SHA; native rich file and edit tools
must remain independently available. These are recorded, not silently
misrepresented as stronger behavior.

## Isolation

- G8 8102 production and 8101 backup are outside this work.
- G6 8103 is occupied by a pre-existing Python audit runtime; leave it intact.
- New server tests use 127.0.0.1:8104 with separate identity, account, plugin,
  configuration and evidence roots under E:\test\mcp-device-v12-20261022.
- Node C:\Program Files\nodejs\node.exe is 22.22.2. The unrelated Hermes Node
  26 on PATH is not the baseline execution environment.
- Do not copy private keys, account databases or live configuration into Git.
- Production cutover, release tags and publishing are not authorized here.

## Vertical slices and ownership

1. Freeze executable parity inventory and run isolated old/new fixtures.
2. Introduce a transport-neutral DeviceCore using the existing native handlers
   and GatewayToolAdapter. Preserve start; add device and server commands.
3. Reuse the explicit Gateway runtime import closure with its account, OAuth,
   pairing, broker, Skills and upstream responsibilities. One authenticated
   server embeds the same Core; local dispatch retains normal owner checks.
4. Add a generic capability registry with per-Device lifecycle, dependencies,
   composition, fault handling and private plugin state. Process-isolate the
   SQLite Palace provider; a trusted unrelated example runs in process.
5. Construct scoped, versioned Knowledge Cards above the accepted P1 evidence
   index, with exact reads, provenance, correction and tested learning rules.
6. Implement platform knowledge routing and bounded session cache. Search/list
   never import. Selected read imports only through a local store capability.
7. Verify migration/backup/restore, cold package installation, Windows and Linux
   behavior, and measured retrieval quality before any release recommendation.

## Evidence rules

Receipts identify commit/source hashes, environment, command, expected/actual
result and PASS/FAIL/NOT_RUN. Old reports remain historical evidence. Unit
fixtures, integration scenarios and production observations are distinguished.
No claim of learning, task completion improvement or token savings is made from
row counts or shorter snippets alone.
