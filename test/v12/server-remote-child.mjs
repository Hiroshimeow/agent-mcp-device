// Test-only remote Device process. It creates no server/listener and uses the
// shipping Core, identity and GatewayDeviceChannel against the leased 8104 app.
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Server as NetServer } from 'node:net';

NetServer.prototype.listen = function () { throw new Error('Remote Device fixtures must never listen.'); };
const [stateRoot, workspace, gatewayUrl, caPath, pluginMode = 'enabled'] = process.argv.slice(2);
if (gatewayUrl !== 'http://127.0.0.1:8104') throw new Error('Remote fixture may only connect to the leased G6 endpoint.');
process.env.MCP_DEVICE_CONFIG_DIR = stateRoot;
mkdirSync(workspace, { recursive: true });
const [{ createPlatformDeviceCore }, { GatewayDeviceIdentity }, { GatewayDeviceChannel }, { PluginHost }, { bundledPluginManifests }] = await Promise.all([
  import('../../dist/platform/device-runtime.js'),
  import('../../dist/device/gateway-identity.js'),
  import('../../dist/device/gateway-channel.js'),
  import('../../dist/platform/plugin-host.js'),
  import('../../dist/distribution.js')
]);
const identity = new GatewayDeviceIdentity(path.join(stateRoot, 'device-identity.json'));
const record = await identity.loadOrCreate();
const sourceRoot = path.join(stateRoot, 'knowledge-sources');
mkdirSync(sourceRoot, { recursive: true });
const seedHost = new PluginHost({ stateRoot, deviceId: record.deviceId });
for (const manifest of bundledPluginManifests()) await seedHost.install(manifest, {
  enabled: pluginMode !== 'disabled', settings: { autoIndex: false, discoverKnownSources: false }
});
await seedHost.close();
const core = await createPlatformDeviceCore({ deviceId: record.deviceId, stateRoot, allowedRoots: [workspace], projectRoots: [], sourceRoots: [sourceRoot] });
let channel;
core.onCapabilitiesChanged(() => channel?.updateCapabilities());
let advertised = null;
let invoked = 0;
let outerFrames = 0;
let outerPlaintext = false;
const send = message => process.send?.(message);

async function connect(pairingGrant) {
  await channel?.stop();
  channel = new GatewayDeviceChannel({
    gatewayUrl, identity, pairingGrant, securityProtocolFloor: 2,
    appCaPem: readFileSync(caPath, 'utf8'),
    capabilities: () => advertised ?? core.capabilities,
    runtimeState: () => ({ runtime_ready: true, runtime_reason: null, execution_runtime_generation: core.runtimeInstanceId }),
    adapter: { call: async (tool, args) => { invoked += 1; return core.invoke(tool, args); } }
  });
  await channel.start();
  channel.socket?.on('message', raw => {
    outerFrames += 1;
    const text = Buffer.from(raw).toString('utf8');
    if (text.includes('REMOTE_CORE_ACCEPTANCE') || text.includes('"tool_call"')) outerPlaintext = true;
  });
  return { protocolVersion: channel.protocolVersion, runtimeInstanceId: core.runtimeInstanceId };
}

process.on('message', async message => {
  try {
    let value;
    if (message.type === 'connect') value = await connect(message.pairingGrant);
    else if (message.type === 'stats') value = { invoked, outerFrames, outerPlaintext };
    else if (message.type === 'disconnect') { await channel?.stop(); channel = null; value = { disconnected: true }; }
    else if (message.type === 'invokeLocal') {
      if (!['knowledge.ingest', 'knowledge.search', 'knowledge.list', 'knowledge.read', 'knowledge.stat', 'knowledge.correct'].includes(message.capability)) throw new Error('Unsupported fixture seed operation.');
      value = await core.invoke(message.capability, message.arguments || {});
    }
    else if (message.type === 'capabilities') {
      if (!message.capabilities.every(name => core.capabilities.includes(name))) throw new Error('Fixture cannot add unauthorized Core capabilities.');
      advertised = message.capabilities;
      value = { sent: channel.updateCapabilities() };
    } else if (message.type === 'close') {
      await channel?.stop();
      await core.close();
      process.send?.({ id: message.id, ok: true }, () => process.exit(0));
      return;
    } else throw new Error('Unknown fixture command.');
    send({ id: message.id, ok: true, value });
  } catch (error) {
    send({ id: message.id, ok: false, error: String(error?.message || error) });
  }
});
send({ type: 'ready', deviceId: record.deviceId, publicKeyPem: record.publicKeyPem, runtimeInstanceId: core.runtimeInstanceId, capabilities: core.capabilities, sourceRoot, stateRoot });
