import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export const SCHEMA_VERSION = 1;
export const BENCHMARK_SUITE_VERSION = '1.0.0';
export const FIXTURE_SEED = 'mcp-device-1.0.9-neutral-baseline-v1';

function finiteNumbers(values) {
  return values.filter((value) => Number.isFinite(value)).map(Number);
}

export function percentile(values, p) {
  const nums = finiteNumbers(values).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  if (p <= 0) return nums[0];
  if (p >= 1) return nums.at(-1);
  const index = Math.max(0, Math.ceil(p * nums.length) - 1);
  return nums[index];
}

export function median(values) {
  const nums = finiteNumbers(values).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

export function summarizeValues(values) {
  const nums = finiteNumbers(values);
  if (nums.length === 0) return null;
  return {
    count: nums.length,
    min: Math.min(...nums),
    median: median(nums),
    p95: percentile(nums, 0.95),
    max: Math.max(...nums),
  };
}

export function responseBytes(result) {
  return Buffer.byteLength(JSON.stringify(result ?? null), 'utf8');
}

export function textOf(result) {
  return (result?.content ?? [])
    .filter((item) => item?.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createAssertionCollector() {
  const items = [];
  const push = (name, pass, expected, actual) => {
    items.push({ name, pass, expected, actual });
    if (!pass) {
      const error = new Error(`${name}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`);
      error.assertions = [...items];
      throw error;
    }
  };
  return {
    items,
    equal(name, actual, expected) {
      push(name, Object.is(actual, expected), expected, actual);
    },
    ok(name, condition, detail = {}) {
      push(name, Boolean(condition), detail.expected ?? true, detail.actual ?? Boolean(condition));
    },
    includes(name, actual, expectedSubstring) {
      push(name, String(actual).includes(expectedSubstring), `contains ${JSON.stringify(expectedSubstring)}`, String(actual).slice(0, 500));
    },
    match(name, actual, regex) {
      push(name, regex.test(String(actual)), regex.toString(), String(actual).slice(0, 500));
    },
  };
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readJsonl(file) {
  let body = '';
  try {
    body = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return body
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${file}:${index + 1}: ${error.message}`);
      }
    });
}

export async function writeJsonl(file, rows) {
  await ensureDir(path.dirname(file));
  const body = rows.length > 0 ? rows.map((row) => JSON.stringify(row)).join('\n') + '\n' : '';
  await fs.writeFile(file, body, 'utf8');
}

export async function assertCleanOutputIdentity(outDir, environment, profile) {
  const entries = await fs.readdir(outDir, { withFileTypes: true }).catch(() => []);
  const profileFiles = entries
    .filter((entry) => entry.isFile() && /^raw\.(standard|stress)\.jsonl$/.test(entry.name))
    .map((entry) => entry.name);

  for (const file of profileFiles) {
    const rows = await readJsonl(path.join(outDir, file));
    const first = rows[0];
    if (!first) continue;
    if (first.harness_commit !== environment.harness_commit || first.baseline_commit !== environment.baseline_commit) {
      throw new Error(
        `Refusing mixed benchmark evidence in ${outDir}: ${file} belongs to harness ${first.harness_commit ?? 'unknown'} / baseline ${first.baseline_commit ?? 'unknown'}, current harness is ${environment.harness_commit} / baseline ${environment.baseline_commit}. Use a new immutable run directory.`
      );
    }
    if (file === `raw.${profile}.jsonl`) {
      throw new Error(
        `Refusing to overwrite existing ${file} in ${outDir}. Preserve the historical run and use a new immutable run directory.`
      );
    }
  }
}

export async function consolidateRawFiles(outDir) {
  await ensureDir(outDir);
  const entries = await fs.readdir(outDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /^raw\.[^.]+\.jsonl$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const rows = [];
  for (const file of files) {
    rows.push(...await readJsonl(path.join(outDir, file)));
  }
  const destination = path.join(outDir, 'raw.jsonl');
  await writeJsonl(destination, rows);
  return destination;
}

function summarizeMetrics(rows) {
  const keys = new Set();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.metrics ?? {})) {
      if (Number.isFinite(value)) keys.add(key);
    }
  }
  return Object.fromEntries(
    [...keys].sort().map((key) => [
      key,
      summarizeValues(rows.map((row) => row.metrics?.[key]).filter(Number.isFinite)),
    ])
  );
}

export async function summarizeRaw(rawPath) {
  const rows = await readJsonl(rawPath);
  const scenarioKeys = [...new Set(rows.filter((row) => row.scenario).map((row) => JSON.stringify([row.profile ?? 'unknown', row.scenario])))].sort();
  const scenarios = {};
  for (const key of scenarioKeys) {
    const [profile, scenario] = JSON.parse(key);
    const all = rows.filter((row) => (row.profile ?? 'unknown') === profile && row.scenario === scenario);
    const summaryKey = `${profile}::${scenario}`;
    const measured = all.filter((row) => !row.warmup);
    const effective = measured.map((row) => {
      if (row.scenario?.endsWith('.resource') && !Number.isInteger(row.resource_pid)) {
        return { ...row, valid: false, invalid_reason: 'legacy resource evidence lacks server PID attribution; rerun required' };
      }
      return row;
    });
    const valid = effective.filter((row) => row.valid);
    scenarios[summaryKey] = {
      profile,
      scenario,
      warmup_count: all.length - measured.length,
      measured_count: measured.length,
      valid_count: valid.length,
      invalid_count: measured.length - valid.length,
      elapsed_ms: summarizeValues(valid.map((row) => row.elapsed_ms)),
      response_bytes: summarizeValues(valid.map((row) => row.response_bytes)),
      cpu_user_us: summarizeValues(valid.map((row) => row.cpu_user_us)),
      cpu_system_us: summarizeValues(valid.map((row) => row.cpu_system_us)),
      rss_peak_bytes: summarizeValues(valid.map((row) => row.rss_peak_bytes)),
      metrics: summarizeMetrics(valid),
      invalid_reasons: effective
        .filter((row) => !row.valid)
        .map((row) => row.invalid_reason || row.error || 'unspecified'),
    };
  }
  return {
    schema_version: SCHEMA_VERSION,
    benchmark_suite_version: BENCHMARK_SUITE_VERSION,
    generated_at: new Date().toISOString(),
    raw_path: rawPath,
    sample_count: rows.length,
    measured_count: rows.filter((row) => !row.warmup).length,
    invalid_count: rows.filter((row) => !row.warmup && (!row.valid || (row.scenario?.endsWith('.resource') && !Number.isInteger(row.resource_pid)))).length,
    environments: [...new Set(rows.map((row) => JSON.stringify({
      host_label: row.host_label,
      platform: row.platform,
      arch: row.arch,
      node_version: row.node_version,
      npm_version: row.npm_version,
      cpu_model: row.cpu_model,
      cpu_count: row.cpu_count,
      total_memory_bytes: row.total_memory_bytes,
      baseline_commit: row.baseline_commit,
      harness_commit: row.harness_commit,
      package_version: row.package_version,
      git_dirty: row.git_dirty,
    })))].map(JSON.parse),
    scenarios,
  };
}

export async function writeSummary(outDir) {
  const rawPath = await consolidateRawFiles(outDir);
  const summary = await summarizeRaw(rawPath);
  const summaryPath = path.join(outDir, 'summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  return { rawPath, summaryPath, summary };
}

function execText(command, args, cwd) {
  try {
    return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

export async function captureEnvironment(projectRoot, hostLabel) {
  const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const cpus = os.cpus();
  const baselineCommit = execText('git', ['rev-parse', 'v1.0.9^{}'], projectRoot)
    ?? execText('git', ['rev-parse', 'ee87d0f3057e01e8087db99615d14bd1b4c626d4'], projectRoot);
  const harnessCommit = execText('git', ['rev-parse', 'HEAD'], projectRoot);
  const dirtyOutput = execText('git', ['status', '--porcelain', '--untracked-files=all'], projectRoot);
  return {
    baseline_commit: baselineCommit,
    harness_commit: harnessCommit,
    package_version: packageJson.version,
    git_dirty: Boolean(dirtyOutput),
    host_label: hostLabel,
    hostname: os.hostname(),
    platform: process.platform,
    os_release: os.release(),
    arch: process.arch,
    node_version: process.version,
    npm_version: process.platform === 'win32'
      ? execText('cmd.exe', ['/d', '/s', '/c', 'npm.cmd --version'], projectRoot)
      : execText('npm', ['--version'], projectRoot),
    cpu_model: cpus[0]?.model ?? null,
    cpu_count: cpus.length,
    total_memory_bytes: os.totalmem(),
  };
}

export function makeBaseSample(environment, profile, scenario, parameters, warmup, sampleIndex) {
  return {
    schema_version: SCHEMA_VERSION,
    benchmark_suite_version: BENCHMARK_SUITE_VERSION,
    ...environment,
    fixture_seed: FIXTURE_SEED,
    profile,
    scenario,
    parameters,
    warmup,
    sample_index: sampleIndex,
    start_timestamp: new Date().toISOString(),
    elapsed_ms: null,
    response_bytes: null,
    cpu_user_us: null,
    cpu_system_us: null,
    rss_before_bytes: null,
    rss_after_bytes: null,
    rss_peak_bytes: null,
    instrumented: false,
    assertions: [],
    valid: false,
    error: null,
    invalid_reason: null,
  };
}

export async function runMeasuredSample({
  environment,
  profile,
  scenario,
  parameters = {},
  warmup,
  sampleIndex,
  instrumented = false,
  resourceProbe = null,
  fn,
}) {
  const record = makeBaseSample(environment, profile, scenario, parameters, warmup, sampleIndex);
  record.instrumented = instrumented;
  const assertions = createAssertionCollector();
  let responseByteTotal = 0;
  let resourceBefore = null;
  let resourceAfter = null;
  const startEpoch = Date.now();
  const start = performance.now();

  const call = async (client, name, args, options = undefined) => {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: options?.timeout ?? 120000 });
    responseByteTotal += responseBytes(result);
    if (result?.isError) {
      throw new Error(`${name} returned isError=true: ${textOf(result).slice(0, 1000)}`);
    }
    return result;
  };

  try {
    if (resourceProbe) resourceBefore = await resourceProbe.point(startEpoch);
    const extra = await fn({ assertions, call, textOf });
    record.elapsed_ms = performance.now() - start;
    record.response_bytes = responseByteTotal;
    record.assertions = assertions.items;
    if (extra?.metrics) record.metrics = extra.metrics;
    if (extra?.notes) record.notes = extra.notes;
    if (extra?.response_bytes !== undefined) record.response_bytes = extra.response_bytes;
    if (resourceProbe) {
      resourceAfter = await resourceProbe.point(Date.now(), { settle: true });
      const resource = resourceProbe.diff(resourceBefore, resourceAfter);
      Object.assign(record, resource);
    }
    record.valid = true;
  } catch (error) {
    record.elapsed_ms = performance.now() - start;
    record.response_bytes = responseByteTotal;
    record.assertions = error?.assertions ?? assertions.items;
    record.error = error instanceof Error ? error.stack ?? error.message : String(error);
    record.invalid_reason = error instanceof Error ? error.message : String(error);
    record.valid = false;
  }

  return record;
}

export async function createResourceProbe(file) {
  async function samples() {
    const rows = await readJsonl(file);
    const serverPid = rows.find((row) => Number.isInteger(row.pid))?.pid ?? null;
    return serverPid == null ? rows : rows.filter((row) => row.pid === serverPid);
  }
  return {
    async point(epochMs, options = {}) {
      if (options.settle) await new Promise((resolve) => setTimeout(resolve, 125));
      const rows = await samples();
      if (rows.length === 0) return null;
      let best = rows[0];
      let bestDistance = Math.abs((best.epoch_ms ?? 0) - epochMs);
      for (const row of rows) {
        const distance = Math.abs((row.epoch_ms ?? 0) - epochMs);
        if (distance < bestDistance) {
          best = row;
          bestDistance = distance;
        }
      }
      return { ...best, probe_epoch_ms: epochMs, samples: rows };
    },
    diff(before, after) {
      if (!before || !after) return {};
      const lo = before.probe_epoch_ms ?? before.epoch_ms ?? 0;
      const hi = after.probe_epoch_ms ?? after.epoch_ms ?? Number.MAX_SAFE_INTEGER;
      const interval = (after.samples ?? []).filter((row) => (row.epoch_ms ?? 0) >= lo && (row.epoch_ms ?? 0) <= hi);
      const rssValues = [before.rss_bytes, ...interval.map((row) => row.rss_bytes), after.rss_bytes].filter(Number.isFinite);
      return {
        resource_pid: after.pid ?? before.pid ?? null,
        cpu_user_us: Math.max(0, (after.cpu_user_us ?? 0) - (before.cpu_user_us ?? 0)),
        cpu_system_us: Math.max(0, (after.cpu_system_us ?? 0) - (before.cpu_system_us ?? 0)),
        rss_before_bytes: before.rss_bytes ?? null,
        rss_after_bytes: after.rss_bytes ?? null,
        rss_peak_bytes: rssValues.length ? Math.max(...rssValues) : null,
      };
    },
  };
}

function formatMetric(summary, digits = 2) {
  if (!summary) return 'NOT_MEASURED';
  const fmt = (value) => Number.isFinite(value) ? Number(value).toFixed(digits) : 'n/a';
  return `median ${fmt(summary.median)}, p95 ${fmt(summary.p95)}, max ${fmt(summary.max)}`;
}

export async function writeBaselineReport(resultsRoot, options = {}) {
  const versionRoot = path.resolve(resultsRoot);
  const entries = await fs.readdir(versionRoot, { withFileTypes: true }).catch(() => []);
  const hostDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const summaries = [];
  for (const host of hostDirs) {
    const file = path.join(versionRoot, host, 'summary.json');
    try {
      summaries.push({ host, summary: JSON.parse(await fs.readFile(file, 'utf8')) });
    } catch {
      // Ignore directories that are not completed result sets.
    }
  }

  const lines = [
    '# MCP Device v1.0.9 benchmark baseline',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This report is generated from raw JSONL. Timings are descriptive baseline evidence, not absolute pass/fail thresholds.',
    'Cross-host Windows/Linux timing differences are not interpreted as implementation improvements because hardware and Node versions differ.',
    '',
    '## Result sets',
    '',
  ];

  if (summaries.length === 0) {
    lines.push('- No completed result sets.');
  } else {
    for (const { host, summary } of summaries) {
      if (!summary.scenarios && summary.device_id) {
        lines.push(`- **${host}**: remote @md evidence, baseline \`${summary.baseline_commit ?? 'unknown'}\`, package \`${summary.package_version ?? 'unknown'}\`, device \`${summary.device_id}\`, valid matrices ${summary.valid_matrix_count ?? 0}/${summary.matrix_count ?? 0}.`);
        continue;
      }
      const envs = summary.environments ?? [];
      if (envs.length === 0) {
        lines.push(`- **${host}**: no environment metadata recorded.`);
        continue;
      }
      for (const [index, env] of envs.entries()) {
        lines.push(`- **${host} env ${index + 1}**: baseline \`${env.baseline_commit ?? 'unknown'}\`, harness \`${env.harness_commit ?? 'unknown'}\`, package \`${env.package_version ?? 'unknown'}\`, ${env.platform ?? 'unknown'}/${env.arch ?? 'unknown'}, Node ${env.node_version ?? 'unknown'}, npm ${env.npm_version ?? 'unknown'}, git_dirty=${env.git_dirty ?? 'unknown'}.`);
      }
      lines.push(`  Samples ${summary.sample_count}, invalid measured ${summary.invalid_count}.`);
    }
  }

  for (const { host, summary } of summaries) {
    lines.push('', `## ${host}`, '');
    if (!summary.scenarios && summary.device_id) {
      lines.push(`- Actual @md remote matrix: ${summary.valid_matrix_count ?? 0}/${summary.matrix_count ?? 0} valid.`);
      lines.push(`- Tool calls: expected ${summary.expected_tool_call_delta ?? 'unknown'}, observed ${summary.observed_tool_call_delta ?? 'unknown'}; failures ${summary.failure_delta ?? 'unknown'}.`);
      lines.push(`- Transport bytes: request ${summary.request_bytes_delta ?? 'NOT_MEASURED'}, response ${summary.response_bytes_delta ?? 'NOT_MEASURED'}.`);
      lines.push(`- End-to-end latency: ${summary.remote_e2e_latency_status ?? 'NOT_MEASURED'}; CPU/RSS: ${summary.cpu_rss_status ?? 'NOT_MEASURED'}.`);
      if (summary.unsupported_remote_tools?.length) lines.push(`- Unsupported remote tools: ${summary.unsupported_remote_tools.join(', ')}.`);
      continue;
    }
    lines.push('| Profile | Scenario | Samples valid/total | Elapsed ms | Response bytes | CPU user us | RSS peak bytes |');
    lines.push('|---|---|---:|---|---|---|---|');
    for (const [name, scenario] of Object.entries(summary.scenarios ?? {})) {
      lines.push(`| ${scenario.profile ?? 'unknown'} | ${scenario.scenario ?? name} | ${scenario.valid_count}/${scenario.measured_count} | ${formatMetric(scenario.elapsed_ms)} | ${formatMetric(scenario.response_bytes, 0)} | ${formatMetric(scenario.cpu_user_us, 0)} | ${formatMetric(scenario.rss_peak_bytes, 0)} |`);
    }

    const invalid = Object.entries(summary.scenarios ?? {})
      .flatMap(([name, scenario]) => [...new Set(scenario.invalid_reasons ?? [])].map((reason) => ({ name, reason })));
    lines.push('', '### Correctness / invalid evidence', '');
    if (invalid.length === 0) {
      lines.push('- No measured sample was invalid.');
    } else {
      for (const item of invalid) lines.push(`- \`${item.name}\`: ${item.reason}`);
    }

    const repeated = Object.values(summary.scenarios ?? {}).find((scenario) => scenario.scenario === 'process.completed_repeat_offset0')?.metrics?.repeated_retained_output;
    if (repeated) {
      lines.push('', '### Observed baseline behavior', '');
      lines.push(`- Completed-session repeated \`offset=0\` retained-output observation: ${formatMetric(repeated, 0)}.`);
    }
    if (invalid.some((item) => /OS child leak count/i.test(item.reason))) {
      lines.push('- Windows process termination left benchmark-owned child processes after the MCP session disappeared in at least one measured sample. The harness recorded the sample invalid, then killed only children whose command line contained the isolated benchmark fixture root.');
    }
  }

  lines.push(
    '',
    '## Baseline semantics and falsification notes',
    '',
    '- Completed-session repeated `offset=0` reads are benchmarked as the observed v1.0.9 behavior; repeated retained output is not treated as a harness failure.',
    '- Active `offset=0` reads are measured separately from absolute/tail reads because no-new-output reads can wait for their timeout.',
    '- Large-output scenarios check correctness and bounded retention; faster-but-missing output is invalid evidence.',
    '- File, search, and edit scenarios assert content/marker identity every sample. Invalid samples remain in raw data and are excluded only from latency distributions.',
    '- The harness makes no assumption that a future 1.0.10 implementation is faster. A same-host candidate may legitimately tie or lose to this baseline.',
    '',
    '## Not measured / limitations',
    '',
    '- Actual @md end-to-end client latency is NOT_MEASURED unless a trusted connector duration field is added to remote evidence.',
    '- Remote CPU/RSS is NOT_MEASURED unless a non-invasive service snapshot is available.',
    '- Search and read_multiple_files are not exposed by the current remote @md surface; Linux source runs must exercise them through the real stdio MCP server.',
    '- Cross-host g6 versus g8 absolute timing is descriptive only.',
    '',
    '## Reproduction',
    '',
    'See `bench/README.md`. Each result directory contains `raw.jsonl` and `summary.json`; profile-specific raw files are retained alongside the consolidated raw file.',
  );

  if (options.extraLines?.length) lines.push('', ...options.extraLines);
  const destination = path.join(versionRoot, 'BASELINE.md');
  await fs.writeFile(destination, lines.join('\n') + '\n', 'utf8');
  return destination;
}
