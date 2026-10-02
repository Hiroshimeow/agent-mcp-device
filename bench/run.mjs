import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  captureEnvironment,
  createResourceProbe,
  ensureDir,
  runMeasuredSample,
  writeBaselineReport,
  writeJsonl,
  writeSummary,
} from './lib/core.mjs';
import { createFixtures } from './lib/fixtures.mjs';
import { createMcpClient } from './lib/mcp-stdio.mjs';
import { createScenarios } from './scenarios/all.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.dirname(__dirname);

function parseArgs(argv) {
  const args = {
    profile: 'standard',
    out: null,
    host: process.env.COMPUTERNAME || process.env.HOSTNAME || 'local',
    scenario: null,
    warmups: null,
    iterations: null,
    summarizeOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--profile') args.profile = argv[++i];
    else if (value === '--out') args.out = argv[++i];
    else if (value === '--host') args.host = argv[++i];
    else if (value === '--scenario') args.scenario = argv[++i];
    else if (value === '--warmups') args.warmups = Number(argv[++i]);
    else if (value === '--iterations') args.iterations = Number(argv[++i]);
    else if (value === '--summarize-only') args.summarizeOnly = true;
    else if (value === '--help' || value === '-h') {
      console.log('node bench/run.mjs --profile standard|stress --out <dir> [--host label] [--scenario substring] [--warmups N] [--iterations N]');
      console.log('node bench/run.mjs --out <dir> --summarize-only');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (!args.out) throw new Error('--out is required');
  if (!['standard', 'stress'].includes(args.profile)) throw new Error('--profile must be standard or stress');
  return args;
}

async function configureClient(client, fixtureRoot) {
  const call = async (name, args) => client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
  for (const [key, value] of [
    ['allowedDirectories', [fixtureRoot]],
    ['fileReadLineLimit', 250000],
    ['fileWriteLineLimit', 250000],
  ]) {
    const result = await call('set_config_value', { key, value, origin: 'llm' });
    if (result?.isError) throw new Error(`Failed to set benchmark config ${key}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.out);
  await ensureDir(outDir);

  if (args.summarizeOnly) {
    const { summaryPath, summary } = await writeSummary(outDir);
    const baselineRoot = path.dirname(outDir);
    const baseline = await writeBaselineReport(baselineRoot);
    console.log(JSON.stringify({ summaryPath, baseline, sample_count: summary.sample_count }, null, 2));
    return;
  }

  const environment = await captureEnvironment(PROJECT_ROOT, args.host);
  const fixtures = await createFixtures();
  const resourceFile = path.join(fixtures.root, `resources-${args.profile}.jsonl`);
  const mcp = await createMcpClient(PROJECT_ROOT, { resourceFile });
  const rawPath = path.join(outDir, `raw.${args.profile}.jsonl`);
  const rows = [];
  const defaults = args.profile === 'standard'
    ? { warmups: 3, iterations: 20 }
    : { warmups: 1, iterations: 5 };
  const warmups = Number.isFinite(args.warmups) ? args.warmups : defaults.warmups;
  const iterations = Number.isFinite(args.iterations) ? args.iterations : defaults.iterations;

  try {
    await configureClient(mcp.client, fixtures.root);
    let scenarios = createScenarios({ fixtures, profile: args.profile, projectRoot: PROJECT_ROOT });
    if (args.scenario) scenarios = scenarios.filter((scenario) => scenario.name.includes(args.scenario));
    if (scenarios.length === 0) throw new Error('No scenarios selected');

    for (const scenario of scenarios) {
      console.log(`[${args.profile}] ${scenario.name}`);
      for (let i = 0; i < warmups + iterations; i++) {
        const warmup = i < warmups;
        const sampleIndex = warmup ? i : i - warmups;
        const record = await runMeasuredSample({
          environment,
          profile: args.profile,
          scenario: scenario.name,
          parameters: { warmups, iterations },
          warmup,
          sampleIndex,
          fn: ({ assertions, call, textOf }) => scenario.run({
            client: mcp.client,
            assertions,
            call,
            textOf,
            sampleIndex,
          }),
        });
        rows.push(record);
        await writeJsonl(rawPath, rows);
        const status = record.valid ? 'ok' : 'INVALID';
        console.log(`  ${warmup ? 'warmup' : 'sample'} ${sampleIndex}: ${status} ${record.elapsed_ms?.toFixed(2)}ms`);
      }
    }

    // Separate resource-instrumented pass: scenarios use unique .resource names
    // so sampler overhead never contaminates primary latency distributions.
    const resourceProbe = await createResourceProbe(resourceFile);
    for (const scenario of scenarios.filter((item) =>
      ['process.large_stdout_stderr', 'files.read_large_window_tail', 'edit.multiple_exact'].includes(item.name)
    )) {
      const record = await runMeasuredSample({
        environment,
        profile: args.profile,
        scenario: `${scenario.name}.resource`,
        parameters: { source_scenario: scenario.name },
        warmup: false,
        sampleIndex: 0,
        instrumented: true,
        resourceProbe,
        fn: ({ assertions, call, textOf }) => scenario.run({
          client: mcp.client,
          assertions,
          call,
          textOf,
          sampleIndex: 0,
        }),
      });
      rows.push(record);
      await writeJsonl(rawPath, rows);
    }
  } finally {
    await mcp.close();
    await fixtures.cleanup();
  }

  const { rawPath: consolidated, summaryPath, summary } = await writeSummary(outDir);
  const baseline = await writeBaselineReport(path.dirname(outDir));
  console.log(JSON.stringify({
    profile: args.profile,
    rawPath,
    consolidated,
    summaryPath,
    baseline,
    samples: rows.length,
    invalid_measured: summary.invalid_count,
    server_stderr_tail: mcp.getStderr().slice(-2000),
  }, null, 2));
  if (summary.invalid_count > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
