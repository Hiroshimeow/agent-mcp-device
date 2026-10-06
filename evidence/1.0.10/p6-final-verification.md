# 1.0.10/P6-final verification

Verified code commit: `8b5034b75a763ace7a3c1f5d22c7bace43005bdf`

Commit message: `1.0.10/P6-final: match systemd serialization in test-linux-device-service`

The subsequent evidence-only commit is the final delivery commit; obtain its full SHA with `git log -1 --format=%H -- evidence/1.0.10/p6-final-verification.md`. Its own SHA cannot be embedded in the commit without changing that SHA.

## Verification commands and results

- `node test/test-linux-device-service.js`: exit 0; `Linux MCP Device service tests passed`. Repeated after the final clean build. Raw output: `p6-final-linux-service.txt`.
- `node test/run-all-tests.js`: exit 0; total 66, passed 66, failed 0. Raw stdout/stderr (including original ANSI codes): `p6-final-suite.txt`.
- `git diff --exit-code 25718d3 HEAD -- src package.json package-lock.json`: exit 0; empty output captured in `p6-final-production-diff.txt`.
- `git diff f2a5eeb HEAD -- test .gitignore > evidence/1.0.10/x1.patch`: exit 0. `x1.patch` contains the actual raw Git diff, without wrappers or prose. A Node byte-for-byte comparison against `execFileSync('git', ['diff', 'f2a5eeb', 'HEAD', '--', 'test', '.gitignore'])` passed.
- `rm -rf dist && npm run build && npm pack`: exit 0. Raw outputs: `p6-final-build.txt`, `p6-final-pack.txt`.
- `tar -tzf hcu-lab.me-mcp-device-1.0.10.tgz`: exit 0. Complete listing: `p6-final-tarball-files.txt`.
- `grep -c resource-accounting evidence/1.0.10/p6-final-tarball-files.txt`: 0 matches (grep exit 1 is the expected no-match result); explicit `test "$matches" = 0` exited 0.

## SHA-256

| Artifact | SHA-256 |
| --- | --- |
| `evidence/1.0.10/x1.patch` | `123ad9ebf0e6fba56306dd698a884c6459e1a7ed4a2b00841d15f07be164b406` |
| `hcu-lab.me-mcp-device-1.0.10.tgz` | `c8368f4ab716d2019c996b020159de08d645efc2ca0e023878bf1ba9cbea73ee` |

The tarball is retained locally and excluded from Git by `*.tgz`. The evidence commit changes neither `test`, `.gitignore`, nor production files, so the raw patch and production-baseline comparison remain valid at the final commit.
