# Executed command record. Run from E:/git-project/agent-mcp-device-v12.
# Isolated outputs only; never overwrite root dist or frozen release candidates.
$r='.tmp/d1-resume-20261028-0040'
node node_modules/typescript/bin/tsc --outDir "$r/dist" --pretty false
# tsc-baseline.log exit0 and tsc-final.log exit0; both current source.
# Tests/assets mirrored under $r before execution.
# Diagnostic instrumented only a temporary installed-layout copy, not source/dist.
Push-Location $r
try {
 node diagnose-probe.mjs # diagnostic.log exit0, 200 fresh processes/arm; NOT ACCEPTANCE
} finally {Pop-Location}
node --test test/v12/defender-context.test.mjs
# Before guard: defender-red.log exit1, 2pass/1fail, Missing expected exception.
# After guard: defender-green.log exit0, 3pass/0fail.
node --input-type=module -e "import {observeDefender} from './test/v12/helpers/defender-context.mjs'; console.log(JSON.stringify(observeDefender(),null,2))"
# defender-live-precondition.json exit0, AV/realtime true, monitoring false; exclusions UNKNOWN.
Push-Location $r
try {
 $tests=@('d1-closure-regressions.test.mjs','d1-opus-regressions.test.mjs','plugin-host.test.js','plugin-services.test.js','palace-provider.test.js','palace-cli-contract.test.mjs','palace-owner-policy.test.mjs','palace-managed-data-root.test.mjs','palace-wal-recovery.test.mjs','device-cold-local.test.mjs','device-capabilities.test.js','platform-core.test.js','platform-cli.test.js','defender-context.test.mjs') | ForEach-Object {"test/v12/$_"}
 node --test --test-concurrency=1 @tests # functional-final.log exit0, 82pass/1skip
 node --test --test-concurrency=1 --test-skip-pattern='actual Palace CLI process probe' test/v12/d1-opus-round2-regressions.test.mjs test/v12/palace-skill-review2.test.mjs test/v12/plugin-cancellation-isolation.test.mjs test/v12/palace-skill-probe.test.mjs
 # nonperformance-final.log exit0, 22pass/1skip. Benchmark intentionally NOT RERUN;
 # --test-skip-pattern deselects it (Node does not include that case in counts).
 node --test --test-concurrency=1 --test-name-pattern='registry stale-lock|temporarily absent|original request deadline' test/v12/d0-architecture-regressions.test.mjs test/v12/palace-skill-review2.test.mjs test/v12/plugin-cancellation-isolation.test.mjs
 # lock-cancel-final.log exit0, 3 matched tests +1 empty filtered-file subtest, NOT4 assertion tests.
} finally {Pop-Location}
git diff --check # diff-check.log exit0
node --check test/v12/d1-opus-round2-regressions.test.mjs # exit0
# Prior failing acceptance benchmark is RETAINED, NOT rerun after diagnostic:
# .tmp/d1-closure-20261027-234656/final-installed-probe-receipt.json
# normal p95 362.1103ms, skip331.9498ms, delta30.1605ms >20ms FAIL.
# Prior red-green/full command record: .tmp/d1-closure-20261027-234656/verification-commands.ps1
