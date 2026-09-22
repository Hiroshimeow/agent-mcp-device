import assert from 'assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// Self-sandbox even when this file is run directly instead of through
// test/run-all-tests.js. No test may touch the user's real ~/.mcp-device.
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-device-green-hardening-'));
process.env.MCP_DEVICE_CONFIG_DIR = sandbox;
process.env.DESKTOP_COMMANDER_CONFIG_DIR = sandbox;

const { CONFIG_DIR, CONFIG_FILE, TOOL_CALL_FILE } = await import('../dist/config.js');
const { configManager } = await import('../dist/config-manager.js');
const { TextFileHandler } = await import('../dist/utils/files/text.js');
const { TerminalManager } = await import('../dist/terminal-manager.js');
const { trackToolCall } = await import('../dist/utils/trackTools.js');
const { handleReadFile } = await import('../dist/handlers/filesystem-handlers.js');

try {
  // 1) Corrupt config must be preserved, not silently replaced.
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, '{"defaultShell":', 'utf8');
  const config = await configManager.getConfig();
  assert(config.defaultShell, 'safe in-memory defaults should remain available');
  await assert.rejects(() => fs.stat(CONFIG_FILE), /ENOENT/);
  const corruptCopies = (await fs.readdir(CONFIG_DIR)).filter(name => /^config\.corrupt-.*\.json$/.test(name));
  assert.equal(corruptCopies.length, 1);
  assert.equal(await fs.readFile(path.join(CONFIG_DIR, corruptCopies[0]), 'utf8'), '{"defaultShell":');

  // A later explicit user-driven save recreates canonical JSON atomically.
  await configManager.setValue('defaultShell', 'test-shell');
  const saved = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
  assert.equal(saved.defaultShell, 'test-shell');

  // 2) UTF-16LE BOM reads preserve line semantics and hide the BOM.
  const filesDir = path.join(CONFIG_DIR, 'green-hardening-files');
  await fs.mkdir(filesDir, { recursive: true });
  const utf16Path = path.join(filesDir, 'utf16.txt');
  const utf16Text = 'alpha\r\nbeta\r\ngamma\r\n';
  await fs.writeFile(
    utf16Path,
    Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(utf16Text, 'utf16le')])
  );
  const handler = new TextFileHandler();
  const utf16Full = await handler.read(utf16Path, { offset: 0, length: 10 });
  assert(String(utf16Full.content).includes('alpha'));
  assert(String(utf16Full.content).includes('gamma'));
  assert(!String(utf16Full.content).includes('\ufeff'));
  const utf16Slice = await handler.read(utf16Path, { offset: 1, length: 1 });
  assert(String(utf16Slice.content).includes('beta'));
  const utf16Tail = await handler.read(utf16Path, { offset: -1, length: 1 });
  assert(String(utf16Tail.content).includes('gamma'));
  const utf16Info = await handler.getInfo(utf16Path);
  assert.equal(utf16Info.metadata?.lineCount, 3);

  // 3) Early-break reads must release the underlying file handle immediately.
  const earlyPath = path.join(filesDir, 'early-break.txt');
  const renamedPath = path.join(filesDir, 'early-break-renamed.txt');
  await fs.writeFile(earlyPath, Array.from({ length: 500 }, (_, i) => 'line-' + i).join('\n'), 'utf8');
  await handler.read(earlyPath, { offset: 0, length: 1 });
  await fs.rename(earlyPath, renamedPath);
  await fs.rm(renamedPath);

  // 4) Invalid shell must return a tool error without an unhandled ChildProcess error.
  const terminals = new TerminalManager();
  const invalidShell = process.platform === 'win32'
    ? 'C:\\definitely-not-real\\missing-shell.exe'
    : '/definitely-not-real/missing-shell';
  const shellResult = await terminals.executeCommand('echo never-runs', 500, invalidShell, false, filesDir);
  assert(shellResult.pid === -1 || /Process error|Failed to get process ID|ENOENT/i.test(shellResult.output));
  await new Promise(resolve => setTimeout(resolve, 50));

  // A late ChildProcess error after a background session is returned must not
  // silently retire that still-live session.
  const realShell = process.platform === 'win32'
    ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : (process.env.SHELL || '/bin/sh');
  const background = await terminals.executeCommand(
    process.platform === 'win32' ? 'Start-Sleep -Seconds 30' : 'sleep 30',
    100,
    realShell,
    false,
    filesDir
  );
  assert(background.pid > 0 && background.isBlocked === true);
  const liveSession = terminals.sessions.get(background.pid);
  assert(liveSession, 'background session must remain registered');
  liveSession.process.emit('error', new Error('synthetic late error'));
  assert(terminals.sessions.has(background.pid), 'late error must not retire a live session');
  terminals.forceTerminate(background.pid);

  // 5) Remote inherited read_file URL support must fail closed before any fetch.
  process.env.MCP_DEVICE_REMOTE = 'true';
  const urlResult = await handleReadFile({ path: 'https://example.invalid/private', isUrl: true });
  assert(/REMOTE_URL_READ_DISABLED/.test(String(urlResult.content?.[0]?.text || '')));

  // 6) Remote tool-call logs must never persist raw secrets/contents.
  const secret = 'SECRET_TEST_VALUE';
  await trackToolCall('write_file', {
    path: path.join(filesDir, 'secret.txt'),
    content: secret,
    Authorization: 'Bearer ' + secret
  });
  const toolLog = await fs.readFile(TOOL_CALL_FILE, 'utf8');
  assert(!toolLog.includes(secret));
  assert(/Args: count=/.test(toolLog));

  console.log('Green hardening regressions passed');
} finally {
  await fs.rm(sandbox, { recursive: true, force: true });
}

process.exit(0);
