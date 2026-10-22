import path from 'node:path';
import { createDeviceCore, type DeviceCore, type DeviceCoreOptions } from '../device/core.js';
import { bundledPluginManifests } from '../distribution.js';
import { PluginHost } from './plugin-host.js';
import { ActivityJournal } from './activity-journal.js';
import { compatible, CapabilityError, type Capability } from './plugin-contract.js';

export interface PlatformDeviceCore extends DeviceCore {
  readonly plugins: PluginHost;
  readonly capabilityContracts: Capability[];
  onCapabilitiesChanged(listener: () => void): () => void;
}
export async function createPlatformDeviceCore(options: DeviceCoreOptions & { projectRoots?: string[]; sourceRoots?: string[]; bundledPlugins?: boolean; exposeKnowledgeMcp?: boolean }): Promise<PlatformDeviceCore> {
  const core = await createDeviceCore(options);
  const activity = new ActivityJournal(core.stateRoot, core.deviceId, core.runtimeInstanceId);
  const plugins = new PluginHost({ stateRoot: core.stateRoot, deviceId: core.deviceId, projectRoots: options.projectRoots ?? options.allowedRoots ?? [], sourceRoots: options.sourceRoots ?? [path.join(core.stateRoot, 'logs')] });
  try { if (options.bundledPlugins !== false) await plugins.ensureBundled(bundledPluginManifests()); await plugins.start(); }
  catch (error) { process.stderr.write(`[plugins] Native Device Core remains available: ${(error as Error).message}\n`); }
  let closed = false;
  let closeRequest: Promise<void> | undefined;
  const pluginContracts = () => plugins.list().filter(record => record.installed && record.enabled && record.state === 'enabled').flatMap(record => record.manifest.capabilities).filter(capability => plugins.capabilities().includes(capability.name) && ['provider', 'fallback'].includes(capability.role ?? 'provider'));
  const advertised = () => pluginContracts().filter(capability => !capability.name.startsWith('knowledge.') ? true : options.exposeKnowledgeMcp !== false && compatible(capability.version, '^1.0.0'));
  const contracts = (): Capability[] => closed ? [] : [...core.capabilities.map(name => ({ name, version: '1.0.0' })), { name: 'platform.capabilities', version: '1.0.0' }, { name: 'platform.invoke', version: '1.0.0' }, ...pluginContracts()];
  return {
    deviceId: core.deviceId, stateRoot: core.stateRoot, runtimeInstanceId: core.runtimeInstanceId, plugins,
    get capabilities() { return closed ? [] : [...new Set([...core.capabilities, 'platform.capabilities', 'platform.invoke', ...advertised().map(capability => capability.name)])]; },
    get capabilityContracts() { return contracts().filter(capability => options.exposeKnowledgeMcp !== false || !capability.name.startsWith('knowledge.')); },
    onCapabilitiesChanged: listener => plugins.onCapabilitiesChanged(listener),
    async invoke(tool, args = {}) {
      if (closed) throw Object.assign(new Error('Device runtime is closed'), { code: 'DEVICE_NOT_READY' });
      if (tool === 'platform.capabilities') return { deviceId: core.deviceId, contracts: contracts().filter(capability => options.exposeKnowledgeMcp !== false || !capability.name.startsWith('knowledge.')) };
      if (tool === 'platform.invoke') {
        const request = args as { name?: unknown; version?: unknown; input?: unknown };
        if (typeof request.name !== 'string' || request.name.length > 96 || (request.version !== undefined && (typeof request.version !== 'string' || request.version.length > 64))) throw new CapabilityError('INVALID_ARGUMENT', 'A capability name and optional compatible contract version are required');
        return plugins.invoke(request.name, request.input ?? {}, { version: request.version as string | undefined });
      }
      if (plugins.capabilities().includes(tool)) return plugins.invoke(tool, args, { version: tool.startsWith('knowledge.') ? '^1.0.0' : undefined });
      try { const result = await core.invoke(tool, args); activity.record(tool, args, result); return result; }
      catch (error) { activity.record(tool, args, undefined, error); throw error; }
    },
    async invokeNative(tool, args = {}) {
      try { const result = await core.invokeNative(tool, args); activity.record(tool, args, result); return result; }
      catch (error) { activity.record(tool, args, undefined, error); throw error; }
    },
    close() {
      closed = true;
      if (!closeRequest) closeRequest = (async () => {
        const failures: unknown[] = [];
        for (const close of [() => plugins.close(), () => activity.close(), () => core.close()]) {
          try { await close(); } catch (error) { failures.push(error); }
        }
        if (failures.length) throw failures[0];
      })().catch(error => { closeRequest = undefined; throw error; });
      // A failed cleanup stays observable. Retrying performs real cleanup again;
      // disabling invocation alone is never evidence that resources were freed.
      return closeRequest;
    }
  };
}
