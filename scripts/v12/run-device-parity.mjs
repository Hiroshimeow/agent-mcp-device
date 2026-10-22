#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(await fs.readFile(path.join(repoRoot, 'specs/008-v12-platform/device-parity.json'), 'utf8'));
const argv = process.argv.slice(2);
const argument = (name, fallback) => {
    const at = argv.indexOf(name);
    if (at < 0) return fallback;
    if (!argv[at + 1] || argv[at + 1].startsWith('--')) throw new Error('Missing value for ' + name);
    return argv[at + 1];
};
const group = argument('--group', 'port-free');
const baseline = path.resolve(argument('--baseline', manifest.baseline.path));
const candidate = path.resolve(argument('--candidate', repoRoot));
const dependencyRoots = {
    baseline: path.resolve(argument('--baseline-dependencies', path.join(baseline, 'node_modules'))),
    candidate: path.resolve(argument('--candidate-dependencies', path.join(candidate, 'node_modules')))
};
const outputRoot = path.resolve(argument('--output', path.join(os.tmpdir(), 'mcp-device-v12-parity-' + Date.now())));
const only = argument('--only', '');
if (!['', 'core', 'capabilities', 'plugins'].includes(only)) throw new Error('Invalid --only');
const targetMode = argument('--target', 'both');
if (!['baseline', 'candidate', 'both'].includes(targetMode)) throw new Error('Invalid --target');
const targets = [['baseline', baseline], ['candidate', candidate]].filter(([label]) => targetMode === 'both' || targetMode === label);
const requestedTest = argument('--test', '');
const selected = [...new Set(manifest.families.filter(item => item.group === group).flatMap(item => item.tests))]
    .filter(file => !requestedTest || file === requestedTest);
if (!selected.length && only !== 'core') throw new Error('Unknown or empty group: ' + group);
if (argv.includes('--list')) {
    console.log(JSON.stringify({ group, tests: selected, classification: 'SOURCE_ACCEPTED', freshStatus: 'NOT_RUN' }, null, 2));
    process.exit(0);
}
// Socket/lifecycle/manual groups are deliberately not runnable by accident.
// Their fixtures need a separately reviewed lane because 8103 is occupied and
// 8101/8102 are protected. This script never binds a server or changes identity.
const permittedGroups = new Set(['port-free', 'context', 'log-palace', 'contract-static']);
if (!permittedGroups.has(group)) throw new Error('Group requires a dedicated reviewed harness: ' + group);
for (const [, target] of targets) {
    await fs.access(path.join(target, 'dist/tool-dispatcher.js'));
    await fs.access(path.join(target, 'node_modules'));
}
await fs.mkdir(outputRoot, { recursive: true });
const forbiddenRoots = [baseline, candidate].map(item => item.toLowerCase() + path.sep);
if (forbiddenRoots.some(root => (outputRoot.toLowerCase() + path.sep).startsWith(root))) {
    throw new Error('Parity output must be outside source checkouts');
}
const receipts = {
    schemaVersion: 1, startedAt: new Date().toISOString(), node: process.version,
    machine: os.hostname(), platform: process.platform, group, targetMode, only, requestedTest,
    baseline: { path: baseline, expectedSha: manifest.baseline.sha, dependencies: dependencyRoots.baseline },
    candidate: { path: candidate, dependencies: dependencyRoots.candidate }, results: [],
    productionVerified: false, socketsAllowed: false
};
for (const [label, target] of [['baseline', baseline], ['candidate', candidate]]) {
    let head = spawnSync('git', ['-C', target, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true });
    if (head.status !== 0 && process.platform === 'linux') {
        // A Windows-created linked worktree stores an absolute drive path.
        // Resolve its existing metadata on WSL without editing either Git tree.
        const pointer = await fs.readFile(path.join(target, '.git'), 'utf8').catch(() => '');
        const match = pointer.trim().match(/^gitdir: ([A-Za-z]):[\\/](.+)$/);
        if (match) {
            const gitDir = '/mnt/' + match[1].toLowerCase() + '/' + match[2].replaceAll('\\', '/');
            head = spawnSync('git', ['--git-dir', gitDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
            receipts[label].gitMetadata = gitDir;
        }
    }
    if (head.status !== 0) throw new Error('Cannot inspect ' + label + ' Git HEAD: ' + head.stderr);
    receipts[label].sha = head.stdout.trim();
    receipts[label].distFingerprint = {};
    for (const rel of ['version.js', 'tool-dispatcher.js', 'device/gateway-tool-adapter.js', 'context/device-adapter.js', 'log-palace/store.js']) {
        try { receipts[label].distFingerprint[rel] = createHash('sha256').update(await fs.readFile(path.join(target, 'dist', rel))).digest('hex'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; receipts[label].distFingerprint[rel] = 'MISSING'; }
    }
}
if (receipts.baseline.sha !== manifest.baseline.sha) throw new Error('Baseline SHA differs from frozen manifest');
const receiptPath = path.join(outputRoot, 'device-parity-receipt.json');
async function saveReceipt() {
    await fs.writeFile(receiptPath, JSON.stringify(receipts, null, 2) + '\n');
}
await saveReceipt();

const guardFile = path.join(outputRoot, 'port-free-guard.mjs');
await fs.writeFile(guardFile, [
    "import net from 'node:net';",
    "import os from 'node:os';",
    "if (process.env.DEVICE_PARITY_HOME) os.homedir = () => process.env.DEVICE_PARITY_HOME;",
    "import { syncBuiltinESMExports } from 'node:module';",
    "const denied = () => { throw Object.assign(new Error('PARITY_PORT_FREE_GUARD: socket operation is outside this fixture group'), { code: 'PARITY_PORT_FREE_GUARD' }); };",
    'net.Server.prototype.listen = denied;',
    'net.Socket.prototype.connect = denied;',
    'syncBuiltinESMExports();',
    ''
].join('\n'));

async function linkDirectory(source, target) {
    try { await fs.symlink(source, target, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
        if (error.code !== 'EEXIST' || path.resolve(await fs.realpath(target)).toLowerCase() !== path.resolve(await fs.realpath(source)).toLowerCase()) throw error;
    }
}
const staged = new Map();
async function stage(target, label) {
    if (staged.has(label)) return staged.get(label);
    const root = path.join(outputRoot, 'workspaces', label);
    await fs.mkdir(root, { recursive: true });
    await fs.cp(path.join(target, 'test'), path.join(root, 'test'), {
        recursive: true,
        filter: source => !source.split(path.sep).some(piece => ['test_output', 'node_modules'].includes(piece))
    });
    await fs.copyFile(path.join(target, 'package.json'), path.join(root, 'package.json'));
    // Resolve installed-relative fixtures against their isolated installation;
    // symlinking dist would resolve authorization's config path back to source.
    for (const name of ['dist', 'config']) {
        try { await fs.cp(path.join(target, name), path.join(root, name), { recursive: true }); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const name of ['node_modules', 'src', 'scripts', 'specs']) {
        const source = name === 'node_modules' ? dependencyRoots[label] : path.join(target, name);
        try { await fs.access(source); await linkDirectory(source, path.join(root, name)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    staged.set(label, root);
    return root;
}
function stopOwnChild(child) {
    if (process.platform === 'win32' && child.pid) {
        spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else child.kill('SIGKILL');
}
async function run(label, root, file, extraEnv = {}, timeoutMs = 180000) {
    // Keep SQLite filenames below Windows' path limit after repository hashes.
    const id = label.slice(0, 1) + '-' + createHash('sha256').update(file).digest('hex').slice(0, 12);
    const sandbox = path.join(outputRoot, 'runs', id);
    await fs.mkdir(sandbox, { recursive: true });
    const stdoutPath = path.join(sandbox, 'stdout.log'), stderrPath = path.join(sandbox, 'stderr.log');
    const out = createWriteStream(stdoutPath), err = createWriteStream(stderrPath);
    let args = file.includes('/context/') || file.includes('/log-palace/') || file.includes('/v12/')
        ? ['--test', file] : [file];
    // Several accepted v11 suites compare a URL with a Windows filesystem path.
    // Calling the exported runner makes their assertions execute on every OS;
    // the original suite files remain unchanged, and the marker prevents a
    // zero-assertion exit from being counted as acceptance evidence.
    const source = await fs.readFile(path.join(root, file), 'utf8');
    const guardedEntrypoint = source.includes('if (import.meta.url === `file://${process.argv[1]}`)');
    const executionMarker = 'PARITY_SUITE_EXECUTED:' + file;
    if (guardedEntrypoint) {
        const wrapper = path.join(sandbox, 'invoke-exported-suite.mjs');
        await fs.writeFile(wrapper, [
            'const suite = await import(' + JSON.stringify(pathToFileURL(path.join(root, file)).href) + ');',
            "if (typeof suite.default !== 'function') throw new Error('PARITY_MISSING_EXPORTED_RUNNER');",
            'const outcome = await suite.default();',
            "if (outcome === false) throw new Error('PARITY_SUITE_RETURNED_FALSE');",
            'console.log(' + JSON.stringify(executionMarker) + ');',
            'process.exit(0);',
            ''
        ].join('\n'));
        args = [wrapper];
    }
    const startedAt = new Date().toISOString(), start = performance.now();
    const env = { ...process.env, ...extraEnv };
    for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
    env.PATH = path.dirname(process.execPath) + path.delimiter + (process.env.PATH ?? process.env.Path ?? '');
    const result = await new Promise(resolve => {
        const child = spawn(process.execPath, args, {
            cwd: root, windowsHide: true,
            env: {
                ...env,
                MCP_DEVICE_CONFIG_DIR: path.join(sandbox, 'config'),
                DEVICE_PARITY_HOME: root.startsWith(path.join(outputRoot, 'workspaces')) ? root : path.join(sandbox, 'home'),
                MCP_DEVICE_REMOTE: 'false', MCP_DEVICE_DISABLE_TELEMETRY: 'true',
                TMP: sandbox, TEMP: sandbox, TMPDIR: sandbox,
                NODE_OPTIONS: '--import ' + pathToFileURL(guardFile).href
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; stopOwnChild(child); }, timeoutMs);
        child.stdout.pipe(out); child.stderr.pipe(err);
        child.on('error', error => {
            clearTimeout(timer); out.end(); err.end();
            resolve({ exitCode: null, status: 'FAIL', error: error.message, timedOut });
        });
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            resolve({ exitCode: code, signal, status: code === 0 && !timedOut ? 'PASS' : 'FAIL', timedOut });
        });
    });
    await Promise.all([new Promise(resolve => out.closed ? resolve() : out.on('close', resolve)), new Promise(resolve => err.closed ? resolve() : err.on('close', resolve))]);
    if (guardedEntrypoint && result.status === 'PASS'
        && !(await fs.readFile(stdoutPath, 'utf8')).includes(executionMarker)) {
        result.status = 'FAIL';
        result.error = 'PARITY_NO_EXECUTION_RECEIPT';
    }
    const item = { label, test: file, entrypointMode: guardedEntrypoint ? 'EXPORTED_RUNNER' : 'DIRECT',
        command: [process.execPath, ...args], cwd: root, startedAt,
        durationMs: Math.round(performance.now() - start), ...result, stdoutPath, stderrPath };
    receipts.results.push(item);
    await saveReceipt();
    console.log(item.status + ' ' + label + ' ' + file + ' (' + item.durationMs + ' ms)');
    return item;
}

if (!only) {
    for (const [label, target] of targets) {
        const root = await stage(target, label);
        for (const file of selected) await run(label, root, file);
    }
}
if ((!only && !requestedTest && group === 'port-free' && targetMode === 'both') || only === 'core') {
    const baselineFixture = await stage(baseline, 'baseline');
    const candidateFixture = await stage(candidate, 'candidate');
    await run('comparator', candidateFixture, 'test/v12/device-core-parity.test.js', {
        DEVICE_PARITY_BASELINE_REPO: baselineFixture,
        DEVICE_PARITY_OUTPUT_ROOT: path.join(outputRoot, 'core-comparator')
    }, 240000);
}
if (only === 'capabilities') await run('candidate', await stage(candidate, 'candidate'), 'test/v12/device-capabilities.test.js');
if (only === 'plugins') {
    const root = await stage(candidate, 'candidate');
    for (const file of ['test/v12/plugin-host.test.js', 'test/v12/plugin-services.test.js', 'test/v12/plugin-bundles.test.js']) await run('candidate', root, file);
}
receipts.completedAt = new Date().toISOString();
receipts.summary = {
    passed: receipts.results.filter(item => item.status === 'PASS').length,
    failed: receipts.results.filter(item => item.status === 'FAIL').length,
    notRunFamilies: manifest.families.filter(item => !item.tests.some(file => receipts.results.some(result => result.test === file))).map(item => item.id),
    parityMeaning: 'Only the listed executed suites, targets and fingerprints are evidenced. Core behavioral comparison is present only when its explicit comparator result is listed. No production or unlisted-platform acceptance.'
};
await saveReceipt();
console.log('Receipt: ' + receiptPath);
if (receipts.summary.failed) process.exitCode = 1;