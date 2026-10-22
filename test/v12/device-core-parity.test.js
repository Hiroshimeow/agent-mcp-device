import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const thisFile = fileURLToPath(import.meta.url);
const candidateRepo = path.resolve(path.dirname(thisFile), '../..');

function resultShape(value) {
    if (Array.isArray(value)) return value.map(resultShape);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, resultShape(value[key])]));
    }
    return value === null ? 'null' : typeof value;
}
const textOf = result => (result?.content ?? []).filter(item => item.type === 'text').map(item => item.text).join('\n');

async function worker() {
    const repo = path.resolve(process.env.DEVICE_CORE_PARITY_REPO);
    const root = path.resolve(process.env.DEVICE_CORE_PARITY_ROOT);
    const mode = process.env.DEVICE_CORE_PARITY_MODE;
    assert.equal(path.resolve(process.env.MCP_DEVICE_CONFIG_DIR), path.join(root, 'config'));
    const fixture = path.join(root, 'fixtures');
    await fs.mkdir(fixture, { recursive: true });
    const load = rel => import(pathToFileURL(path.join(repo, 'dist', rel)).href);
    const { configManager } = await load('config-manager.js');
    await configManager.loadConfig();
    await configManager.setValue('allowedDirectories', [fixture]);
    await configManager.setValue('telemetryEnabled', false);
    const { GatewayToolAdapter, gatewayCapabilities } = await load('device/gateway-tool-adapter.js');
    const { dispatchToolCall } = await load('tool-dispatcher.js');
    const adapter = new GatewayToolAdapter(undefined, {
        allowedRoots: [fixture], context: { deviceId: 'parity-device', stateRoot: path.join(root, 'config') }
    });
    let core;
    if (mode === 'core') {
        const { createDeviceCore } = await load('device/core.js');
        core = await createDeviceCore({ deviceId: 'parity-device', stateRoot: path.join(root, 'config'), allowedRoots: [fixture] });
        assert.match(core.runtimeInstanceId, /^direct-in-process:[0-9a-f-]{36}$/);
        assert.deepEqual(core.capabilities, gatewayCapabilities());
        await assert.rejects(createDeviceCore({ deviceId: 'bad', stateRoot: path.join(root, 'wrong') }),
            error => error.code === 'CONFIG_ROOT_MISMATCH');
    }
    const native = (name, args) => mode === 'core' ? core.invokeNative(name, args) : dispatchToolCall(name, args, { isRemote: true });
    const broker = (name, args) => mode === 'core' ? core.invoke(name, args) : adapter.call(name, args);
    const normalize = input => String(input)
        .split(root).join('<ROOT>').split(root.replaceAll('\\', '/')).join('<ROOT>')
        .replace(/Runtime: \d+(?:\.\d+)?(?:ms|s)/g, 'Runtime: <TIME>')
        .replace(/search_\d+_[a-z0-9]+/gi, '<SEARCH>')
        .replace(/search_\d+/g, '<SEARCH>');
    const snapshot = { brokerCapabilities: gatewayCapabilities(), results: {}, sideEffects: {} };
    const record = (name, result) => {
        snapshot.results[name] = { shape: resultShape(result), text: normalize(textOf(result)), isError: result.isError === true };
        return result;
    };

    const file = path.join(fixture, 'native.txt');
    assert.notEqual((await native('write_file', { path: file, content: 'alpha\r\nbeta\r\nalpha\r\n', mode: 'rewrite' })).isError, true);
    record('selectedRead', await native('read_file', { path: file, offset: 1, length: 1 }));
    assert.match(snapshot.results.selectedRead.text, /beta/);
    await native('write_file', { path: file, content: 'gamma\r\n', mode: 'append' });
    assert.equal(await fs.readFile(file, 'utf8'), 'alpha\r\nbeta\r\nalpha\r\ngamma\r\n');
    record('batchEdit', await native('edit_block', {
        file_path: file, edits: [
            { old_string: 'alpha', new_string: 'ALPHA', expected_replacements: 2 },
            { old_string: 'beta', new_string: 'BETA', expected_replacements: 1 }
        ]
    }));
    const beforeReject = await fs.readFile(file);
    const rejected = record('batchAtomicFailure', await native('edit_block', {
        file_path: file, edits: [
            { old_string: 'BETA', new_string: 'changed', expected_replacements: 1 },
            { old_string: 'missing-exact-text', new_string: 'bad', expected_replacements: 1 }
        ]
    }));
    assert.equal(rejected.isError, true);
    assert.deepEqual(await fs.readFile(file), beforeReject);
    snapshot.sideEffects.textBytes = beforeReject.toString('base64');
    record('multipleRead', await native('read_multiple_files', { paths: [file, path.join(fixture, 'missing.txt')] }));

    const brokerFile = path.join(fixture, 'broker.txt');
    await broker('write_file', { path: brokerFile, content: 'one\ntwo\nthree\n' });
    record('brokerSelectedRead', await broker('read_text_file', { path: brokerFile, offset: 1, length: 1 }));
    const beforeDryRun = await fs.readFile(brokerFile);
    record('brokerDryRun', await broker('edit_file', { path: brokerFile, old_text: 'not-present', new_text: 'different', dry_run: true }));
    assert.deepEqual(await fs.readFile(brokerFile), beforeDryRun);
    await broker('edit_file', { path: brokerFile, old_text: 'two', new_text: 'TWO' });
    snapshot.sideEffects.brokerText = await fs.readFile(brokerFile, 'utf8');
    await assert.rejects(broker('read_text_file', { path: path.join(root, 'outside.txt') }));
    await assert.rejects(broker('read_process_output', { session_id: '01' }));

    const requireFromRepo = createRequire(path.join(repo, 'package.json'));
    const ExcelJS = requireFromRepo('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet One');
    sheet.addRows([['Name', 'Value'], ['kept', 12], ['last', 30]]);
    const excel = path.join(fixture, 'sample.xlsx');
    await workbook.xlsx.writeFile(excel);
    record('excelRangeRead', await native('read_file', { path: excel, range: "'Sheet One'!A1:B2" }));
    assert.match(snapshot.results.excelRangeRead.text, /kept/);
    record('excelRangeEdit', await native('edit_block', { file_path: excel, range: "'Sheet One'!B2:B2", content: [[99]] }));
    const changed = new ExcelJS.Workbook();
    await changed.xlsx.readFile(excel);
    assert.equal(changed.getWorksheet('Sheet One').getCell('B2').value, 99);
    assert.equal(changed.getWorksheet('Sheet One').getCell('B3').value, 30);
    snapshot.sideEffects.excel = [changed.getWorksheet('Sheet One').getCell('B2').value, changed.getWorksheet('Sheet One').getCell('B3').value];

    const PizZip = requireFromRepo('pizzip');
    const zip = new PizZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX original marker</w:t></w:r></w:p><w:p><w:r><w:t>Keep this paragraph</w:t></w:r></w:p></w:body></w:document>');
    const docx = path.join(fixture, 'sample.docx');
    await fs.writeFile(docx, zip.generate({ type: 'nodebuffer' }));
    record('docxRead', await native('read_file', { path: docx }));
    assert.match(snapshot.results.docxRead.text, /DOCX original marker/);
    record('docxEdit', await native('edit_block', { file_path: docx, old_string: 'DOCX original marker', new_string: 'DOCX verified marker', expected_replacements: 1 }));
    const reopened = new PizZip(await fs.readFile(docx));
    const xml = reopened.file('word/document.xml').asText();
    assert.match(xml, /DOCX verified marker/);
    assert.match(xml, /Keep this paragraph/);
    snapshot.sideEffects.docx = xml;

    const { PDFDocument, StandardFonts } = requireFromRepo('pdf-lib');
    const pdfDocument = await PDFDocument.create();
    const font = await pdfDocument.embedFont(StandardFonts.Helvetica);
    pdfDocument.addPage([300, 200]).drawText('PDF exact parity marker', { x: 20, y: 150, font, size: 12 });
    const pdf = path.join(fixture, 'sample.pdf');
    await fs.writeFile(pdf, await pdfDocument.save());
    record('pdfRead', await native('read_file', { path: pdf, offset: 0, length: 1 }));
    assert.match(snapshot.results.pdfRead.text, /PDF exact parity marker/);

    const searchRoot = path.join(fixture, 'search');
    await fs.mkdir(searchRoot, { recursive: true });
    await fs.writeFile(path.join(searchRoot, 'match.txt'), 'prefix\nneedle.parity literal\nsuffix\n');
    await fs.writeFile(path.join(searchRoot, 'skip.log'), 'needle.parity should be excluded\n');
    const started = await native('start_search', {
        path: searchRoot, pattern: 'needle.parity', searchType: 'content',
        filePattern: '*.txt', literalSearch: true, contextLines: 0, timeout_ms: 5000
    });
    assert.notEqual(started.isError, true);
    const session = textOf(started).match(/session: (\S+)/)?.[1];
    assert(session, textOf(started));
    let page;
    for (let i = 0; i < 60; i++) {
        page = await native('get_more_search_results', { sessionId: session, offset: 0, length: 10 });
        if (textOf(page).includes('Status: COMPLETED')) break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.match(textOf(page), /Status: COMPLETED/);
    assert.match(textOf(page), /match\.txt/);
    assert.doesNotMatch(textOf(page), /skip\.log/);
    record('searchPage', page);
    await native('stop_search', { sessionId: session });

    const script = path.join(fixture, 'child.cjs');
    await fs.writeFile(script, "process.stdout.write('process-first\\n'); setTimeout(() => { process.stdout.write('process-last\\n'); }, 75);");
    const command = 'node "' + script + '"';
    const processResult = await broker('start_process', { command, working_directory: fixture, timeout_ms: 1000 });
    assert.notEqual(processResult.isError, true);
    assert.match(String(processResult.session_id), /^[1-9]\d*$/);
    const output = await broker('read_process_output', { session_id: processResult.session_id, offset: 0, length: 50 });
    assert.match(textOf(output), /process-first/);
    assert.match(textOf(output), /process-last/);
    const outputAgain = await broker('read_process_output', { session_id: processResult.session_id, offset: 0, length: 50 });
    assert.match(textOf(outputAgain), /process-first/);
    snapshot.results.retainedProcess = {
        startedShape: resultShape(processResult),
        outputShape: resultShape(output),
        retainedFirst: textOf(outputAgain).includes('process-first'),
        retainedLast: textOf(outputAgain).includes('process-last')
    };
    const shell = await broker('shell_execute', { command, working_directory: fixture, timeout_ms: 3000 });
    assert.equal(shell.exitCode, 0);
    assert.equal(shell.timedOut, false);
    assert.match(shell.stdout, /process-first/);
    snapshot.results.shell = { shape: resultShape(shell), exitCode: shell.exitCode, stdout: shell.stdout, stderr: shell.stderr, timedOut: shell.timedOut };

    if (core) {
        await core.close();
        await core.close();
        assert.deepEqual(core.capabilities, []);
        await assert.rejects(core.invoke('read_text_file', { path: file }), error => error.code === 'DEVICE_NOT_READY');
        await assert.rejects(core.invokeNative('read_file', { path: file }), error => error.code === 'DEVICE_NOT_READY');
    }
    await fs.writeFile(process.env.DEVICE_CORE_PARITY_RECEIPT, JSON.stringify(snapshot, null, 2) + '\n');
}

async function runWorker(repo, root, mode) {
    const receipt = path.join(root, 'snapshot.json');
    await fs.mkdir(root, { recursive: true });
    const childEnv = {
        ...process.env,
        MCP_DEVICE_CONFIG_DIR: path.join(root, 'config'),
        MCP_DEVICE_REMOTE: 'false',
        MCP_DEVICE_DISABLE_TELEMETRY: 'true',
        DEVICE_CORE_PARITY_WORKER: '1',
        DEVICE_CORE_PARITY_REPO: repo,
        DEVICE_CORE_PARITY_ROOT: root,
        DEVICE_CORE_PARITY_MODE: mode,
        DEVICE_CORE_PARITY_RECEIPT: receipt,
        TMP: root, TEMP: root, TMPDIR: root
    };
    const outcome = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [thisFile], { cwd: root, env: childEnv, windowsHide: true });
        let stdout = '', stderr = '';
        const timer = setTimeout(() => { child.kill(); reject(new Error('Parity worker timed out')); }, 90000);
        child.stdout.on('data', data => { stdout += data; });
        child.stderr.on('data', data => { stderr += data; });
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    });
    await fs.writeFile(path.join(root, 'stdout.log'), outcome.stdout);
    await fs.writeFile(path.join(root, 'stderr.log'), outcome.stderr);
    assert.equal(outcome.code, 0, outcome.stderr + '\n' + outcome.stdout.slice(-6000));
    return JSON.parse(await fs.readFile(receipt, 'utf8'));
}

if (process.env.DEVICE_CORE_PARITY_WORKER === '1') {
    worker().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
} else {
    test('shared Device Core preserves native and broker behavior against original v11 dist', { timeout: 240000 }, async () => {
        const baseline = process.env.DEVICE_PARITY_BASELINE_REPO;
        assert(baseline, 'Set DEVICE_PARITY_BASELINE_REPO to the verified original checkout (never silently substitute candidate)');
        const outputRoot = process.env.DEVICE_PARITY_OUTPUT_ROOT
            ? path.resolve(process.env.DEVICE_PARITY_OUTPUT_ROOT)
            : await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-core-parity-'));
        const oldResult = await runWorker(path.resolve(baseline), path.join(outputRoot, 'v11'), 'legacy');
        const newResult = await runWorker(candidateRepo, path.join(outputRoot, 'v12'), 'core');
        assert.deepEqual(newResult, oldResult, 'Behavior/result-shape/side-effect difference against v11');
        console.log('Parity snapshots: ' + outputRoot);
    });
}
