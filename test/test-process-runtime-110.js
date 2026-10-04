import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  startProcess,
  readProcessOutput,
  interactWithProcess,
  forceTerminate,
} from '../dist/tools/improved-process-tools.js';
import { terminalManager } from '../dist/terminal-manager.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function text(result) {
  return result.content?.map(item => item.text || '').join('\n') || '';
}

function pidOf(result) {
  const match = text(result).match(/PID\s+(\d+)/i);
  assert(match, `missing PID in: ${text(result)}`);
  return Number(match[1]);
}

async function drainUntilComplete(pid, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let combined = '';
  let last = '';
  while (Date.now() < deadline) {
    const result = await readProcessOutput({ pid, timeout_ms: 500 });
    assert.equal(result.isError, undefined, text(result));
    last = text(result);
    combined += '\n' + last;
    if (last.includes('Process completed')) return { combined, last };
  }
  assert.fail(`process ${pid} did not complete in ${timeoutMs}ms`);
}

async function testInitialOutputIsConsumed() {
  const started = await startProcess({
    command: `node -e "console.log('INITIAL_ONCE')"`,
    timeout_ms: 2000,
  });
  const pid = pidOf(started);
  assert.match(text(started), /INITIAL_ONCE/);

  const reread = await readProcessOutput({ pid, timeout_ms: 100 });
  assert.doesNotMatch(text(reread), /INITIAL_ONCE/, 'first default read replayed start_process output');
}

async function testPartialLineSuffixOnly() {
  const started = await startProcess({
    command: `node -e "process.stdout.write('ABC'); setTimeout(()=>process.stdout.write('DEF\\n'),300); setTimeout(()=>process.exit(0),600)"`,
    timeout_ms: 500,
  });
  const pid = pidOf(started);
  assert.match(text(started), /ABC/);

  const suffixDeadline = Date.now() + 3000;
  let observedSuffix = '';
  while (Date.now() < suffixDeadline) {
    observedSuffix = text(await readProcessOutput({ pid, offset: -2, length: 2, timeout_ms: 50 }));
    if (/ABCDEF/.test(observedSuffix)) break;
    await sleep(25);
  }
  assert.match(observedSuffix, /ABCDEF/);
  const read = await readProcessOutput({ pid, timeout_ms: 500 });
  assert.match(text(read), /DEF/);
  assert.doesNotMatch(text(read), /ABCDEF|ABC/, 'partial-line append replayed already delivered prefix');
  await drainUntilComplete(pid);
}

async function testCompletedReadsDrainOnce() {
  const started = await startProcess({
    command: `node -e "setTimeout(()=>console.log('LATE_ONCE'),250)"`,
    timeout_ms: 50,
  });
  const pid = pidOf(started);
  assert.doesNotMatch(text(started), /LATE_ONCE/);

  const lateDeadline = Date.now() + 3000;
  let observedLate = '';
  while (Date.now() < lateDeadline) {
    observedLate = text(await readProcessOutput({ pid, offset: -2, length: 2, timeout_ms: 50 }));
    if (/LATE_ONCE/.test(observedLate)) break;
    await sleep(25);
  }
  assert.match(observedLate, /LATE_ONCE/);
  const first = await readProcessOutput({ pid, timeout_ms: 500 });
  assert.match(text(first), /LATE_ONCE/);

  const second = await readProcessOutput({ pid, timeout_ms: 100 });
  assert.doesNotMatch(text(second), /LATE_ONCE/, 'completed session replayed consumed output');
}

async function testObserverReadsDoNotConsume() {
  const started = await startProcess({
    command: `node -e "setTimeout(()=>{console.log('OBSERVE_A');console.log('OBSERVE_B')},200)"`,
    timeout_ms: 50,
  });
  const pid = pidOf(started);
  let observer;
  const deadline = Date.now() + 3000;
  do {
    observer = await readProcessOutput({ pid, offset: -3, length: 3, timeout_ms: 50 });
    const observed = text(observer);
    if (/OBSERVE_A/.test(observed) && /OBSERVE_B/.test(observed)) break;
    await sleep(50);
  } while (Date.now() < deadline);
  assert.match(text(observer), /OBSERVE_A/);
  assert.match(text(observer), /OBSERVE_B/);

  const drain = await readProcessOutput({ pid, timeout_ms: 500 });
  assert.match(text(drain), /OBSERVE_A/);
  assert.match(text(drain), /OBSERVE_B/);
}

async function testBackgroundReturnsAfterSpawn() {
  const start = performance.now();
  const started = await startProcess({
    command: `node -e "setTimeout(()=>console.log('BACKGROUND_DONE'),1200)"`,
    timeout_ms: 5000,
    background: true,
  });
  const elapsed = performance.now() - start;
  const pid = pidOf(started);

  assert(elapsed < 800, `background start blocked for ${Math.round(elapsed)}ms`);
  assert.match(text(started), /running|started/i);

  const done = await drainUntilComplete(pid, 4000);
  assert.match(done.combined, /BACKGROUND_DONE/);
}

async function testYieldDoesNotKillProcess() {
  const start = performance.now();
  const started = await startProcess({
    command: `node -e "setTimeout(()=>console.log('YIELD_DONE'),900)"`,
    timeout_ms: 5000,
    yield_ms: 100,
  });
  const elapsed = performance.now() - start;
  const pid = pidOf(started);

  assert(elapsed < 700, `yield_ms did not bound foreground wait: ${Math.round(elapsed)}ms`);
  const done = await drainUntilComplete(pid, 3500);
  assert.match(done.combined, /YIELD_DONE/);
}

async function testHotReadDoesNotJoinWholeHistory() {
  const started = await startProcess({
    command: `node -e "for(let i=0;i<20000;i++) console.log('H'+i); setTimeout(()=>console.log('TAIL_MARK'),500); setTimeout(()=>process.exit(0),1000)"`,
    timeout_ms: 100,
  });
  const pid = pidOf(started);
  await sleep(300);

  const session = terminalManager.getSession(pid);
  assert(session, 'expected active session');
  session.outputLines.join = () => {
    throw new Error('whole-history join invoked');
  };

  const read = await readProcessOutput({ pid, timeout_ms: 800, length: 1000 });
  assert.equal(read.isError, undefined, text(read));

  await forceTerminate({ pid });
}

async function testConcurrentDrainsDoNotDuplicate() {
  const started = await startProcess({
    command: `node -e "setTimeout(()=>console.log('CONCURRENT_ONCE'),250); setTimeout(()=>process.exit(0),700)"`,
    timeout_ms: 50,
  });
  const pid = pidOf(started);

  const [a, b] = await Promise.all([
    readProcessOutput({ pid, timeout_ms: 1000 }),
    readProcessOutput({ pid, timeout_ms: 1000 }),
  ]);
  const combined = text(a) + '\n' + text(b);
  assert.equal((combined.match(/CONCURRENT_ONCE/g) || []).length, 1, combined);
  await drainUntilComplete(pid);
}

async function testConcurrentInteractionsSerialize() {
  const script = [
    "const readline=require('readline')",
    "const rl=readline.createInterface({input:process.stdin})",
    "process.stdout.write('>>> ')",
    "rl.on('line',line=>setTimeout(()=>process.stdout.write('RESP_'+line+'\\n>>> '), line==='one'?200:0))",
  ].join(';');
  const started = await startProcess({ command: `node -e \"${script}\"`, timeout_ms: 2000 });
  const pid = pidOf(started);
  const [first, second] = await Promise.all([
    interactWithProcess({ pid, input: 'one', timeout_ms: 2000 }),
    interactWithProcess({ pid, input: 'two', timeout_ms: 2000 }),
  ]);
  assert.match(text(first), /RESP_one/);
  assert.doesNotMatch(text(first), /RESP_two/);
  assert.match(text(second), /RESP_two/);
  await forceTerminate({ pid });
}

async function testFastExitStdoutStderrComplete() {
  const outToken = 'FAST_STDOUT_TOKEN';
  const errToken = 'FAST_STDERR_TOKEN';
  const started = await startProcess({
    command: `node -e "process.stdout.write('${outToken}\\n');process.stderr.write('${errToken}\\n')"`,
    timeout_ms: 2000,
  });
  const pid = pidOf(started);
  const initial = text(started);
  const rest = text(await readProcessOutput({ pid, timeout_ms: 200 }));
  const combined = initial + '\n' + rest;
  assert.equal((combined.match(new RegExp(outToken, 'g')) || []).length, 1, combined);
  assert.equal((combined.match(new RegExp(errToken, 'g')) || []).length, 1, combined);
}

const tests = [
  testInitialOutputIsConsumed,
  testPartialLineSuffixOnly,
  testCompletedReadsDrainOnce,
  testObserverReadsDoNotConsume,
  testBackgroundReturnsAfterSpawn,
  testYieldDoesNotKillProcess,
  testHotReadDoesNotJoinWholeHistory,
  testConcurrentDrainsDoNotDuplicate,
  testConcurrentInteractionsSerialize,
  testFastExitStdoutStderrComplete,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${test.name}: ${error?.stack || error}`);
  }
}

if (failed) {
  console.error(`\n${failed}/${tests.length} process-runtime tests failed`);
  process.exit(1);
}
console.log(`\nPASS ${tests.length}/${tests.length} process-runtime tests`);
