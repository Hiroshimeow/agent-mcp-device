# D0 npm same-prefix co-install experiment

Date: 2026-10-24
Host: G6 Windows
Scope: isolated prefix only; no live runtime/deployment changed.

Artifacts:
- MCP Device 1.0.12: e494d7be162390b1aaf2359112e103b1cbcad13885c71b21c9a5b948c3d8343b
- Palace 1.0.12: db27ab6c60cbb14eb65ffd25424ed9bd867868061c332dba0d1353b9590133a6

Isolated prefix:
E:\test\mcp-device-v12-e2e-20261024-g6\review-coinstall-device-first-2\prefix

Observed sequence:
1. npm global install MCP Device into isolated prefix: exit 0.
2. Device installed palace, palace.cmd and palace.ps1 in the prefix.
3. Device Skill postinstall created both isolated-home Skill targets as junctions.
4. npm global install standalone Palace into the SAME prefix: exit 1.
5. npm error: EEXIST on prefix\palace.ps1; npm advised removal or --force.
6. No --force was used.
7. Existing Device palace command remained executable; palace --help exited 0.

Interpretation:
- Same-prefix dual ownership of the palace binary is a reproduced collision, not a theoretical concern.
- D0 consensus preserves the Device default palace command and treats same-prefix installation of both root packages as unsupported.
- Standalone Palace remains independently installable in a standalone/separate prefix; that lifecycle and clean-failure/no-partial-takeover behavior remain D1 acceptance work.
- The npm allow-scripts warning from this run is NOT evidence that Device postinstall was blocked; the Skill targets prove it ran.
