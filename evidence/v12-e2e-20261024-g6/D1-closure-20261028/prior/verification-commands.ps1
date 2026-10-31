# Recorded commands for this session, not a new rollout authorization.
# Run from E:/git-project/agent-mcp-device-v12. Compiled output is isolated.
$run='.tmp/d1-closure-20261027-234656'
# Baseline compile before new lifecycle tests; exit 0.
node node_modules/typescript/bin/tsc --outDir "$run/dist" --listEmittedFiles false --pretty false
# Mirror tests/assets to use the unique compiled output. Root dist is never replaced.
Copy-Item package.json "$run/package.json"
Copy-Item skills "$run/skills" -Recurse -Force
Copy-Item scripts "$run/scripts" -Recurse -Force
Copy-Item test/v12/* "$run/test/v12" -Recurse -Force
Push-Location $run
try {
  # Executed before production edits: red-lifecycle.log (0 pass / 4 fail).
  # After plugin-host.ts + Palace CLI remediation edits and isolated recompile:
  # green-lifecycle.log (4 pass / 0 fail).
  node --test --test-concurrency=1 test/v12/d1-closure-regressions.test.mjs

  # Benchmark assertion-first: red-installed-probe.log rejected development-checkout.
  # After fixture change to installed package layout, 200 per arm:
  # green-installed-probe.log + installed-probe-receipt.json (18.5645ms).
  # Final matrix rerun: final-reviewer-matrix.log + final-installed-probe-receipt.json
  # (30.1605ms; FAIL, threshold remains 20ms).
  $env:MCP_V12_PROBE_RECEIPT=(Join-Path $PWD 'installed-probe-receipt.json')
  node --test --test-concurrency=1 --test-name-pattern='actual Palace CLI process probe' test/v12/d1-opus-round2-regressions.test.mjs
  Remove-Item Env:MCP_V12_PROBE_RECEIPT

  # New coverage: wal-green.log, 6 pass; cold-final.log, 3 pass.
  node --test --test-concurrency=1 test/v12/palace-wal-recovery.test.mjs
  node --test --test-concurrency=1 test/v12/device-cold-local.test.mjs

  # Final functional batch: final-focused-green.log, 79 pass / 1 skip.
  # The verified-v11 acceptance test is deliberately NOT bypassed; its precondition
  # failure remains in final-focused.log and the A/B run remains unauthorized.
  $tests=@('d1-closure-regressions.test.mjs','d1-opus-regressions.test.mjs','plugin-host.test.js','plugin-services.test.js','palace-provider.test.js','palace-cli-contract.test.mjs','palace-owner-policy.test.mjs','palace-managed-data-root.test.mjs','palace-wal-recovery.test.mjs','device-cold-local.test.mjs','device-capabilities.test.js','platform-core.test.js','platform-cli.test.js') | ForEach-Object {"test/v12/$_"}
  node --test --test-concurrency=1 @tests

  # Final matrix: 16 pass / 1 fail (performance) / 1 skip (symlink privilege).
  $env:MCP_V12_PROBE_RECEIPT=(Join-Path $PWD 'final-installed-probe-receipt.json')
  node --test --test-concurrency=1 test/v12/d1-opus-round2-regressions.test.mjs test/v12/palace-skill-review2.test.mjs test/v12/plugin-cancellation-isolation.test.mjs
  Remove-Item Env:MCP_V12_PROBE_RECEIPT

  # Final extra targeted checks: final-lock-cancel.log, 3 matching tests pass;
  # Node also reports an empty filtered file as a passing file subtest (4 total).
  node --test --test-concurrency=1 --test-name-pattern='registry stale-lock|temporarily absent|original request deadline' test/v12/d0-architecture-regressions.test.mjs test/v12/palace-skill-review2.test.mjs test/v12/plugin-cancellation-isolation.test.mjs
} finally {Pop-Location}
# Final compile actually executed before final tests: tsc-final.log, exit 0.
# git diff --check: exit 0. Root/frozen artifacts not overwritten.
