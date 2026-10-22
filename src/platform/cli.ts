import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { CapabilityError, type PluginManifest } from './plugin-contract.js';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const usage = `MCP Device 1.0.12
  mcp-device start                         Existing Device-only runtime
  mcp-device device [start|status|...]      Alias for the Device-only commands
  mcp-device server [--runtime-dir DIR] [--host HOST] [--port PORT] [--public-url URL] [--skill-root DIR] [--allow-http-lan]
  mcp-device admin [--runtime-dir DIR] account|invite ...
  mcp-device plugins [--runtime-dir DIR] list|install|enable|disable|uninstall|purge|upgrade|configure ...
  mcp-device knowledge [--runtime-dir DIR] search|list|read|ingest|learn|correct|skills [JSON]
  mcp-device state backup|verify|restore|migrate [--source DIR] [--backup DIR] [--target DIR]
  mcp-device context ...                   Existing local Context commands
  mcp-device logs ...                      Existing P1 log search commands

Server state defaults to ~/.mcp-device/server. Device state defaults stay unchanged.
Server clients, including localhost, use the ordinary account/OAuth and Device pairing flow.
Install/upgrade takes a local plugin manifest JSON. Disable/uninstall retain plugin data.
Purge is a separate explicit operation for a disabled plugin. Admin passwords come from HCU_ADMIN_PASSWORD.
State migration defaults to a reviewable dry run; --apply writes only a new target after verified backups.
`;
interface Parsed { values: Record<string, string[]>; flags: Set<string>; positional: string[]; }
function parse(argv: string[]): Parsed {
  const values: Record<string, string[]> = {}, flags = new Set<string>(), positional: string[] = [];
  const valued = new Set(['runtime-dir', 'host', 'port', 'public-url', 'skill-root', 'project-root', 'source-root', 'config', 'source', 'backup', 'target', 'device-root', 'gateway-root']);
  const switches = new Set(['help', 'enable', 'apply', 'json', 'allow-http-lan']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (arg === '-h') { flags.add('help'); continue; }
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const equal = arg.indexOf('='), key = arg.slice(2, equal < 0 ? undefined : equal);
    if (switches.has(key) && equal < 0) { flags.add(key); continue; }
    if (!valued.has(key)) throw new CapabilityError('INVALID_ARGUMENT', 'Unknown option: --' + key);
    const value = equal < 0 ? argv[++i] : arg.slice(equal + 1);
    if (!value || value.startsWith('--')) throw new CapabilityError('INVALID_ARGUMENT', 'Missing value for --' + key);
    (values[key] ??= []).push(value);
  }
  return { values, flags, positional };
}
const one = (args: Parsed, key: string, fallback?: string): string | undefined => args.values[key]?.[args.values[key].length - 1] ?? fallback;
function stateRoot(args: Parsed, serverDefault = false): string {
  return path.resolve(one(args, 'runtime-dir', process.env.MCP_DEVICE_CONFIG_DIR || path.join(os.homedir(), '.mcp-device', ...(serverDefault ? ['server'] : [])))!);
}
function required(args: Parsed, key: string): string {
  const value = one(args, key); if (!value) throw new CapabilityError('INVALID_ARGUMENT', '--' + key + ' is required'); return path.resolve(value);
}
async function jsonFile(filename: string): Promise<any> {
  const text = await fs.readFile(path.resolve(filename), 'utf8');
  return JSON.parse(text.replace(/^\uFEFF/, ''));
}
const print = (value: unknown) => process.stdout.write(JSON.stringify(value, null, 2) + '\n');
const event = (value: unknown) => process.stdout.write(JSON.stringify(value) + '\n');

async function pluginCli(args: Parsed): Promise<void> {
  const { PluginHost } = await import('./plugin-host.js');
  const root = stateRoot(args), [action = 'list', target, extra] = args.positional;
  const host = new PluginHost({ stateRoot: root, deviceId: 'local-plugin-management' });
  let release: (() => Promise<void>) | undefined;
  await host.load();
  try {
    if (action === 'list') { print({ runtime_dir: root, plugins: host.list(), diagnostics: host.diagnostics() }); return; }
    if (!target) throw new CapabilityError('INVALID_ARGUMENT', 'Plugin id or manifest file is required');
    if (action === 'install' || action === 'upgrade') {
      const manifest = await jsonFile(target) as PluginManifest;
      manifest.entry = path.resolve(path.dirname(path.resolve(target)), manifest.entry);
      if (action === 'install') await host.install(manifest, { enabled: args.flags.has('enable') });
      else {
        // Migration must not race a running provider in a different process.
        const { acquireServerLease } = await import('./runtime-lease.js');
        release = await acquireServerLease(root); await host.upgrade(manifest);
      }
    } else if (action === 'configure') {
      if (!extra) throw new CapabilityError('INVALID_ARGUMENT', 'configure requires a settings JSON file');
      const settings = await jsonFile(extra);
      if (!settings || Array.isArray(settings) || typeof settings !== 'object') throw new CapabilityError('INVALID_ARGUMENT', 'Plugin settings must be an object');
      const record = host.list().find(item => item.manifest.id === target);
      if (record?.enabled) throw new CapabilityError('PLUGIN_STILL_ENABLED', 'Disable the plugin before changing its settings');
      await host.configure(target, settings);
    } else if (['enable', 'disable', 'uninstall'].includes(action)) {
      await host[action as 'enable' | 'disable' | 'uninstall'](target);
    } else if (action === 'purge') {
      const { acquireServerLease } = await import('./runtime-lease.js');
      release = await acquireServerLease(root); await host.purge(target);
    } else throw new CapabilityError('INVALID_ARGUMENT', 'Unknown plugins action: ' + action);
  } finally { await host.close(); await release?.(); }
  print({ ok: true, action, plugins: host.list() });
}

async function knowledgeCli(args: Parsed): Promise<void> {
  const root = stateRoot(args), [action = 'search', payload = '{}'] = args.positional;
  if (!['search', 'list', 'read', 'ingest', 'learn', 'correct', 'skills'].includes(action)) throw new CapabilityError('INVALID_ARGUMENT', 'Unknown knowledge action');
  const input = payload.startsWith('@') ? await jsonFile(payload.slice(1)) : JSON.parse(payload);
  const { acquireServerLease } = await import('./runtime-lease.js');
  const release = await acquireServerLease(root);
  let host: import('./plugin-host.js').PluginHost | undefined;
  try {
    const { GatewayDeviceIdentity } = await import('../device/gateway-identity.js');
    const { PluginHost } = await import('./plugin-host.js');
    const { bundledPluginManifests } = await import('../distribution.js');
    const record = await new GatewayDeviceIdentity(path.join(root, 'gateway-identity.json')).loadOrCreate();
    host = new PluginHost({ stateRoot: root, deviceId: record.deviceId, projectRoots: args.values['project-root']?.map(item => path.resolve(item)), sourceRoots: args.values['source-root']?.map(item => path.resolve(item)) ?? [path.join(root, 'logs')] });
    await host.ensureBundled(bundledPluginManifests()); await host.start(); print(await host.invoke('knowledge.' + action, input));
  } finally { await host?.close(); await release(); }
}

async function adminCli(args: Parsed): Promise<void> {
  const root = stateRoot(args, true);
  await fs.mkdir(root, { recursive: true });
  const child = spawn(process.execPath, [path.join(packageRoot, 'control-plane', 'scripts', 'admin.mjs'), ...args.positional], {
    stdio: 'inherit', windowsHide: true, env: { ...process.env, MCP_RUNTIME_DIR: root, MCP_GATEWAY_DB_PATH: path.join(root, 'gateway.sqlite') }
  });
  await new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('exit', code => { process.exitCode = code ?? 1; resolve(); }); });
}

async function serverCli(args: Parsed): Promise<void> {
  if (args.positional.length && !(args.positional.length === 1 && args.positional[0] === 'start')) throw new CapabilityError('INVALID_ARGUMENT', 'server accepts only start; use Ctrl-C or the service manager to stop');
  const root = stateRoot(args, true), port = Number(one(args, 'port', '8104'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new CapabilityError('INVALID_ARGUMENT', 'Invalid server port');
  const { acquireServerLease } = await import('./runtime-lease.js');
  const release = await acquireServerLease(root);
  process.env.MCP_DEVICE_CONFIG_DIR = root;
  let core: Awaited<ReturnType<typeof import('./device-runtime.js').createPlatformDeviceCore>> | undefined;
  let runtime: any;
  try {
    const config = one(args, 'config') ? await jsonFile(one(args, 'config')!) : {};
    if (!config || typeof config !== 'object' || Array.isArray(config) || (config.env && (typeof config.env !== 'object' || Array.isArray(config.env)))) throw new CapabilityError('INVALID_ARGUMENT', 'Server config must be a JSON object with an optional env object');
    const publicUrl = one(args, 'public-url');
    const allowHttpLan = args.flags.has('allow-http-lan');
    if (allowHttpLan) {
      if (!publicUrl) throw new CapabilityError('INVALID_ARGUMENT', '--allow-http-lan requires --public-url http://<lan-host>:<port>');
      let url: URL;
      try { url = new URL(publicUrl); } catch { throw new CapabilityError('INVALID_ARGUMENT', '--public-url must be a valid absolute URL'); }
      if (url.protocol !== 'http:') throw new CapabilityError('INVALID_ARGUMENT', '--allow-http-lan is only for an explicit http:// LAN public URL');
    }
    const configuredSkillRoot = one(args, 'skill-root', process.env.MCP_SKILL_ROOT);
    const legacySharedSkillRoot = path.join(os.homedir(), '.mcp-device', 'skills');
    const skillRoot = configuredSkillRoot
      ? path.resolve(configuredSkillRoot)
      : await fs.stat(legacySharedSkillRoot).then(stat => stat.isDirectory() ? legacySharedSkillRoot : undefined).catch(() => undefined);
    const { GatewayDeviceIdentity } = await import('../device/gateway-identity.js');
    const identity = new GatewayDeviceIdentity(path.join(root, 'gateway-identity.json'));
    const record = await identity.loadOrCreate();
    const { createPlatformDeviceCore } = await import('./device-runtime.js');
    core = await createPlatformDeviceCore({ deviceId: record.deviceId, stateRoot: root, projectRoots: args.values['project-root']?.map(item => path.resolve(item)), sourceRoots: args.values['source-root']?.map(item => path.resolve(item)) });
    const { createPlatformTools } = await import('./knowledge-mcp.js');
    const { startServerRuntime } = await import(pathToFileURL(path.join(packageRoot, 'control-plane', 'scripts', 'authenticated-mcp-wrapper.mjs')).href);
    const configPath = typeof config.configPath === 'string' ? path.resolve(path.dirname(path.resolve(one(args, 'config')!)), config.configPath) : undefined;
    runtime = await startServerRuntime({ core, identity, stateRoot: root, packageRoot, port, host: one(args, 'host', '127.0.0.1'), publicUrl, allowHttpLan, skillRoot, env: config.env ?? {}, configPath, extraTools: await createPlatformTools(root),
      deviceName: 'localhost',
      onPairing: (pairing: unknown) => event({ event: 'device_pairing_required', pairing }) });
    event({ event: 'server_ready', version: '1.0.12', url: runtime.baseUrl, device_id: record.deviceId, runtime_dir: root, local_runtime: 'shared-device-core', authentication: 'account-oauth-and-pairing' });
    await new Promise<void>(resolve => {
      // A process manager may use Node's private parent/child IPC channel to stop
      // gracefully on Windows, where kill(SIGTERM) otherwise terminates abruptly.
      const message = (value: unknown) => { if ((value as { type?: string })?.type === 'mcp-device:shutdown') stop(); };
      const stop = () => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); process.removeListener('message', message); process.removeListener('disconnect', stop); resolve(); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      if (process.send) { process.on('message', message); process.once('disconnect', stop); }
      runtime.server.once('close', stop);
    });
  } finally { if (runtime) await runtime.close(); else await core?.close(); await release(); if (process.connected) process.disconnect(); }
}

async function stateCli(args: Parsed): Promise<void> {
  // The implementation is imported only for explicit state-management commands.
  const modulePath = new URL('./state-backup.js', import.meta.url).href;
  const state = await import(modulePath);
  const [action] = args.positional;
  if (action === 'backup') print(await state.createStateBackup({ sourceRoot: required(args, 'source'), backupRoot: required(args, 'backup') }));
  else if (action === 'verify') print(await state.verifyStateBackup({ backupRoot: required(args, 'backup') }));
  else if (action === 'restore') print(await state.restoreStateBackup({ backupRoot: required(args, 'backup'), targetRoot: required(args, 'target') }));
  else if (action === 'migrate') {
    const options = { deviceRoot: required(args, 'device-root'), gatewayRoot: required(args, 'gateway-root'), targetRoot: required(args, 'target'), backupRoot: required(args, 'backup') };
    const plan = await state.planLegacyMigration(options);
    print(args.flags.has('apply') ? await state.applyLegacyMigration({ plan }) : plan);
  } else throw new CapabilityError('INVALID_ARGUMENT', 'Use state backup, verify, restore or migrate');
}

export async function runPlatformCli(command: string, argv: string[]): Promise<void> {
  try {
    const args = parse(argv);
    if (command === 'help' || args.flags.has('help')) { process.stdout.write(usage); return; }
    if (command === 'server') await serverCli(args);
    else if (command === 'plugins') await pluginCli(args);
    else if (command === 'knowledge') await knowledgeCli(args);
    else if (command === 'admin') await adminCli(args);
    else if (command === 'state') await stateCli(args);
    else throw new CapabilityError('INVALID_ARGUMENT', 'Unknown platform command');
  } catch (error) { process.stderr.write(JSON.stringify({ ok: false, code: (error as CapabilityError).code ?? 'COMMAND_FAILED', error: (error as Error).message }) + '\n'); process.exitCode = 1; }
}
