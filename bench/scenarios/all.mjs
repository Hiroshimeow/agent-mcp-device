import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256, textOf } from '../lib/core.mjs';

function parsePid(text) {
  const match = String(text).match(/PID\s+(\d+)/i);
  if (!match) throw new Error(`Unable to parse PID from: ${String(text).slice(0, 500)}`);
  return Number(match[1]);
}

function parseSearchSession(text) {
  const match = String(text).match(/session:\s*([^\s]+)/i);
  if (!match) throw new Error(`Unable to parse search session from: ${String(text).slice(0, 500)}`);
  return match[1];
}

function canonicalReadBody(text) {
  return String(text)
    .replace(/^\[Reading[^\n]*\]\r?\n\r?\n/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n/g, '\n');
}

async function waitForPidGone(call, client, pid, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  let sessions = '';
  do {
    sessions = await listSessions(call, client);
    if (!sessions.includes(`PID: ${pid}`)) return sessions;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  return sessions;
}

function helperCommand(helper, mode, args = []) {
  const quoted = [helper, mode, ...args].map((value) => `"${String(value).replaceAll('"', '\\"')}"`);
  return `node ${quoted.join(' ')}`;
}

async function listSessions(call, client) {
  return textOf(await call(client, 'list_sessions', {}));
}

async function terminatePid(call, client, pid) {
  if (!pid) return;
  await call(client, 'force_terminate', { pid }).catch(() => {});
}

async function pollSearch(call, client, sessionId, assertions, expectedNeedle, maxPolls = 80) {
  const started = Date.now();
  let firstResultMs = null;
  let latest = '';
  for (let i = 0; i < maxPolls; i++) {
    const result = await call(client, 'get_more_search_results', { sessionId, offset: 0, length: 5000 });
    latest = textOf(result);
    if (firstResultMs == null && latest.includes(expectedNeedle)) firstResultMs = Date.now() - started;
    if (/Search completed/i.test(latest) || /COMPLETED/i.test(latest)) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assertions.includes('search includes expected marker', latest, expectedNeedle);
  assertions.ok('search reaches completed state', /Search completed|COMPLETED/i.test(latest), { expected: true, actual: latest.slice(0, 500) });
  return { firstResultMs, completionMs: Date.now() - started, latest };
}

export function createScenarios({ fixtures, profile, projectRoot }) {
  const scenarios = [];

  scenarios.push({
    name: 'process.short_completed',
    async run({ client, call, assertions }) {
      const marker = `SHORT_${Date.now()}`;
      const result = await call(client, 'start_process', {
        command: helperCommand(fixtures.procHelper, 'short', [marker]),
        timeout_ms: 2000,
        working_directory: fixtures.root,
      });
      const text = textOf(result);
      assertions.includes('short process output marker', text, marker);
      assertions.match('short process pid returned', text, /PID\s+\d+/i);
      return { metrics: { initial_output_bytes: Buffer.byteLength(text) } };
    },
  });

  scenarios.push({
    name: 'process.incremental_offset0',
    async run({ client, call, assertions }) {
      let pid = null;
      try {
        const markers = ['INC_A', 'INC_B', 'INC_C'];
        const started = await call(client, 'start_process', { command: helperCommand(fixtures.procHelper, 'incremental', markers), timeout_ms: 80, working_directory: fixtures.root });
        pid = parsePid(textOf(started));
        const pieces = [textOf(started)];
        for (let i = 0; i < 4; i++) {
          const out = await call(client, 'read_process_output', { pid, offset: 0, length: 100, timeout_ms: 700 });
          pieces.push(textOf(out));
          if (/Process completed/i.test(textOf(out))) break;
        }
        const joined = pieces.join('\n');
        for (const marker of markers) assertions.includes(`incremental marker ${marker}`, joined, marker);
        const laterReads = pieces.slice(1).join('\n');
        const overlap = markers.filter((marker) => pieces[0].includes(marker) && laterReads.includes(marker)).length;
        return { metrics: { overlap_markers_start_vs_reads: overlap, read_calls: pieces.length - 1 } };
      } finally {
        await terminatePid(call, client, pid);
      }
    },
  });

  scenarios.push({
    name: 'process.completed_repeat_offset0',
    async run({ client, call, assertions }) {
      const marker = `REPEAT_${Date.now()}`;
      const started = await call(client, 'start_process', { command: helperCommand(fixtures.procHelper, 'short', [marker]), timeout_ms: 2000, working_directory: fixtures.root });
      const pid = parsePid(textOf(started));
      const first = textOf(await call(client, 'read_process_output', { pid, offset: 0, length: 100, timeout_ms: 50 }));
      const second = textOf(await call(client, 'read_process_output', { pid, offset: 0, length: 100, timeout_ms: 50 }));
      const firstHas = first.includes(marker);
      const secondHas = second.includes(marker);
      assertions.ok('completed repeat returns readable session', /Process completed|Reading|output/i.test(first + second), { expected: true, actual: (first + second).slice(0, 500) });
      return { metrics: { first_contains_marker: Number(firstHas), second_contains_marker: Number(secondHas), repeated_retained_output: Number(firstHas && secondHas) } };
    },
  });

  scenarios.push({
    name: 'process.absolute_and_tail',
    async run({ client, call, assertions }) {
      const markers = Array.from({ length: 12 }, (_, i) => `ABS_${String(i).padStart(2, '0')}`);
      const started = await call(client, 'start_process', { command: helperCommand(fixtures.procHelper, 'lines', markers), timeout_ms: 2000, working_directory: fixtures.root });
      const pid = parsePid(textOf(started));
      const abs1 = textOf(await call(client, 'read_process_output', { pid, offset: 3, length: 4, timeout_ms: 50 }));
      const abs2 = textOf(await call(client, 'read_process_output', { pid, offset: 3, length: 4, timeout_ms: 50 }));
      const tail = textOf(await call(client, 'read_process_output', { pid, offset: -3, length: 3, timeout_ms: 50 }));
      assertions.equal('absolute repeated read stable', abs2, abs1);
      assertions.includes('tail contains last marker', tail, markers.at(-1));
      return { metrics: { absolute_bytes: Buffer.byteLength(abs1), tail_bytes: Buffer.byteLength(tail) } };
    },
  });

  scenarios.push({
    name: 'process.large_stdout_stderr',
    profiles: ['standard', 'stress'],
    async run({ client, call, assertions }) {
      let pid = null;
      const lines = profile === 'stress' ? 50000 : 5000;
      try {
        const started = await call(client, 'start_process', { command: helperCommand(fixtures.procHelper, 'large', [lines]), timeout_ms: 3000, working_directory: fixtures.root }, { timeout: 120000 });
        pid = parsePid(textOf(started));
        const tail = textOf(await call(client, 'read_process_output', { pid, offset: -100, length: 100, timeout_ms: 100 }, { timeout: 120000 }));
        assertions.match('large output contains terminal marker', tail, new RegExp(`(?:OUT_|ERR_)${String(lines - 1).padStart(6, '0')}`));
        return { metrics: { emitted_lines: lines, approx_emitted_bytes: lines * 76, tail_bytes: Buffer.byteLength(tail) } };
      } finally {
        await terminatePid(call, client, pid);
      }
    },
  });

  scenarios.push({
    name: 'process.background_and_no_output',
    async run({ client, call, assertions }) {
      let pid = null;
      try {
        const startedAt = Date.now();
        const started = await call(client, 'start_process', { command: helperCommand(fixtures.procHelper, 'background', ['BG_READY']), timeout_ms: 100, working_directory: fixtures.root });
        const startMs = Date.now() - startedAt;
        pid = parsePid(textOf(started));
        let observed = textOf(started);
        if (!observed.includes('BG_READY')) {
          observed += '\n' + textOf(await call(client, 'read_process_output', { pid, offset: 0, length: 20, timeout_ms: 1000 }));
        }
        assertions.includes('background start observes ready marker', observed, 'BG_READY');
        const beforeNoOutput = Date.now();
        const idle = textOf(await call(client, 'read_process_output', { pid, offset: 0, length: 10, timeout_ms: 200 }));
        const noOutputMs = Date.now() - beforeNoOutput;
        assertions.ok('no-output read returns boundedly', noOutputMs < 1500, { expected: '<1500ms', actual: noOutputMs });
        return { metrics: { start_return_ms: startMs, no_new_output_read_ms: noOutputMs, idle_response_bytes: Buffer.byteLength(idle) } };
      } finally {
        await terminatePid(call, client, pid);
        const sessions = await waitForPidGone(call, client, pid);
        assertions.ok('background MCP session cleaned up', !sessions.includes(`PID: ${pid}`), { expected: false, actual: sessions.includes(`PID: ${pid}`) });
        await new Promise((resolve) => setTimeout(resolve, 150));
        const leaked = fixtures.ownedProcessPids();
        fixtures.cleanupOwnedProcesses();
        assertions.equal('background OS child leak count', leaked.length, 0);
      }
    },
  });

  scenarios.push({
    name: 'process.concurrent_sessions',
    async run({ client, call, assertions }) {
      const count = profile === 'stress' ? 32 : 8;
      const pids = [];
      try {
        const starts = await Promise.all(Array.from({ length: count }, (_, i) =>
          call(client, 'start_process', {
            command: helperCommand(fixtures.procHelper, 'background', [`CONC_${i}`]),
            timeout_ms: 60,
            working_directory: fixtures.root,
          })
        ));
        for (let i = 0; i < starts.length; i++) {
          const pid = parsePid(textOf(starts[i]));
          pids.push(pid);
          let observed = textOf(starts[i]);
          for (let attempt = 0; attempt < 5 && !observed.includes(`CONC_${i}`); attempt++) {
            observed += '\n' + textOf(await call(client, 'read_process_output', { pid, offset: 0, length: 20, timeout_ms: 1000 }));
          }
          assertions.includes(`concurrent marker ${i}`, observed, `CONC_${i}`);
        }
        assertions.equal('concurrent pid uniqueness', new Set(pids).size, count);
        return { metrics: { concurrent_sessions: count } };
      } finally {
        await Promise.all(pids.map((pid) => terminatePid(call, client, pid)));
        for (const pid of pids) {
          const sessions = await waitForPidGone(call, client, pid);
          assertions.ok(`concurrent MCP pid ${pid} cleaned`, !sessions.includes(`PID: ${pid}`), { expected: false, actual: sessions.includes(`PID: ${pid}`) });
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
        const leaked = fixtures.ownedProcessPids();
        fixtures.cleanupOwnedProcesses();
        assertions.equal('concurrent OS child leak count', leaked.length, 0);
      }
    },
  });

  scenarios.push({
    name: 'files.read_small',
    async run({ client, call, assertions }) {
      const f = fixtures.files['small.txt'];
      const result = await call(client, 'read_file', { path: f.path, offset: 0, length: 10000 });
      const body = canonicalReadBody(textOf(result));
      assertions.equal('small file hash', sha256(body), sha256(f.content.replace(/\n$/, '')));
      return { metrics: { file_bytes: f.bytes } };
    },
  });

  scenarios.push({
    name: 'files.read_medium_window',
    async run({ client, call, assertions }) {
      const f = fixtures.files['medium.txt'];
      const result = await call(client, 'read_file', { path: f.path, offset: 100, length: 100 });
      const body = textOf(result);
      assertions.includes('medium window marker', body, 'FILE:medium.txt');
      assertions.ok('medium bounded response', Buffer.byteLength(body) < f.bytes, { expected: '< file size', actual: Buffer.byteLength(body) });
      return { metrics: { file_bytes: f.bytes, returned_bytes: Buffer.byteLength(body) } };
    },
  });

  scenarios.push({
    name: 'files.read_large_window_tail',
    async run({ client, call, assertions }) {
      const f = fixtures.files['large.txt'];
      const head = textOf(await call(client, 'read_file', { path: f.path, offset: 0, length: 100 }));
      const tail = textOf(await call(client, 'read_file', { path: f.path, offset: -100 }));
      assertions.includes('large head marker', head, 'FILE:large.txt');
      assertions.includes('large tail marker', tail, 'FILE:large.txt');
      return { metrics: { file_bytes: f.bytes, head_bytes: Buffer.byteLength(head), tail_bytes: Buffer.byteLength(tail) } };
    },
  });

  scenarios.push({
    name: 'files.read_large_response',
    async run({ client, call, assertions }) {
      const f = fixtures.files['medium.txt'];
      const result = await call(client, 'read_file', { path: f.path, offset: 0, length: 100000 });
      const body = canonicalReadBody(textOf(result));
      assertions.equal('large response hash', sha256(body), sha256(f.content.replace(/\n$/, '')));
      return { metrics: { returned_bytes: Buffer.byteLength(body) } };
    },
  });

  scenarios.push({
    name: 'files.read_multiple',
    async run({ client, call, assertions }) {
      const group = profile === 'stress' ? fixtures.fanoutSmall : fixtures.fanoutSmall.slice(0, 4);
      const result = await call(client, 'read_multiple_files', { paths: group.map((x) => x.path) }, { timeout: 120000 });
      const body = textOf(result);
      for (const item of group) assertions.includes(`multiple includes ${path.basename(item.path)}`, body, path.basename(item.path));
      const positions = group.map((item) => body.indexOf(path.basename(item.path)));
      assertions.ok('multiple preserves path order', positions.every((x, i) => i === 0 || x > positions[i - 1]), { expected: true, actual: positions });
      return { metrics: { fanout: group.length } };
    },
  });

  for (const spec of [
    ['search.filename_hit', 'files', 'unique-target-file.bench', 'unique-target-file.bench'],
    ['search.filename_miss', 'files', 'missing-file-xyz.bench', 'No matches'],
    ['search.content_sparse', 'content', 'NEEDLE_SPARSE_918273', 'NEEDLE_SPARSE_918273'],
    ['search.content_dense', 'content', 'NEEDLE_DENSE_445566', 'NEEDLE_DENSE_445566'],
  ]) {
    scenarios.push({
      name: spec[0],
      async run({ client, call, assertions }) {
        let sessionId = null;
        try {
          const before = Date.now();
          const started = await call(client, 'start_search', {
            path: fixtures.searchDir,
            pattern: spec[2],
            searchType: spec[1],
            maxResults: 5000,
            literalSearch: true,
            timeout_ms: 30000,
            earlyTermination: false,
          }, { timeout: 120000 });
          const startMs = Date.now() - before;
          const startedText = textOf(started);
          sessionId = parseSearchSession(startedText);
          if (spec[3] === 'No matches') {
            let latest = startedText;
            for (let i = 0; i < 80 && !/completed/i.test(latest); i++) {
              latest = textOf(await call(client, 'get_more_search_results', { sessionId, offset: 0, length: 5000 }));
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
            assertions.match('search miss completes', latest, /No matches|completed/i);
            return { metrics: { start_call_ms: startMs, completion_ms: Date.now() - before } };
          }
          const polled = await pollSearch(call, client, sessionId, assertions, spec[3]);
          return { metrics: { start_call_ms: startMs, first_results_ms: polled.firstResultMs, completion_ms: polled.completionMs } };
        } finally {
          if (sessionId) await call(client, 'stop_search', { sessionId }).catch(() => {});
          const listed = textOf(await call(client, 'list_searches', {}));
          assertions.ok('search session not actively running after cleanup', !listed.includes(sessionId ?? '__none__') || /COMPLETED/.test(listed), { expected: true, actual: listed.slice(0, 500) });
        }
      },
    });
  }

  scenarios.push({
    name: 'edit.small_exact',
    async run({ client, call, assertions, sampleIndex }) {
      const file = await fixtures.freshEditCopy(`small-${sampleIndex}-${Date.now()}`);
      const old = 'alpha ORIGINAL_TOKEN omega';
      const replacement = 'alpha UPDATED_TOKEN omega';
      await call(client, 'edit_block', { file_path: file, old_string: old, new_string: replacement, expected_replacements: 1 });
      const content = await fs.readFile(file, 'utf8');
      assertions.includes('small edit replacement present', content, replacement);
      assertions.ok('small edit target removed', !content.includes(old), { expected: false, actual: content.includes(old) });
      return { metrics: { file_bytes: Buffer.byteLength(content) } };
    },
  });

  scenarios.push({
    name: 'edit.multiple_exact',
    async run({ client, call, assertions, sampleIndex }) {
      const file = await fixtures.freshEditCopy(`multi-${sampleIndex}-${Date.now()}`);
      await call(client, 'edit_block', { file_path: file, old_string: 'ORIGINAL_TOKEN', new_string: 'MULTI_TOKEN', expected_replacements: 2 });
      const content = await fs.readFile(file, 'utf8');
      assertions.equal('multi replacement count', (content.match(/MULTI_TOKEN/g) ?? []).length, 2);
      assertions.equal('original replacement count zero', (content.match(/ORIGINAL_TOKEN/g) ?? []).length, 0);
      return { metrics: { file_bytes: Buffer.byteLength(content) } };
    },
  });

  scenarios.push({
    name: 'edit.expected_count_mismatch',
    async run({ client, assertions, sampleIndex }) {
      const file = await fixtures.freshEditCopy(`mismatch-${sampleIndex}-${Date.now()}`);
      const result = await client.callTool({
        name: 'edit_block',
        arguments: { file_path: file, old_string: 'ORIGINAL_TOKEN', new_string: 'BAD_TOKEN', expected_replacements: 3 },
      }, undefined, { timeout: 120000 });
      const body = textOf(result);
      assertions.match('mismatch reports replacement count error', body, /expected|replacement|occurrence|found/i);
      const content = await fs.readFile(file, 'utf8');
      assertions.equal('mismatch leaves file unchanged', content, fixtures.editBase);
      return { response_bytes: Buffer.byteLength(JSON.stringify(result)), metrics: { file_bytes: Buffer.byteLength(content) } };
    },
  });

  return scenarios.filter((scenario) => !scenario.profiles || scenario.profiles.includes(profile));
}
