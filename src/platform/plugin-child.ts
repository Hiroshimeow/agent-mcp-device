import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import { CapabilityError, type CapabilityRequirement, type PluginContext, type PluginInstance, type PluginModule } from './plugin-contract.js';
import { createPluginServices } from './plugin-services.js';

// Generic JSON-lines adapter; non-Node sidecars implement the same request/callback frames.
let instance: PluginInstance | undefined;
let initializing = false;
let requirements: CapabilityRequirement[] = [];
const controllers = new Map<string, AbortController>();
const hostPending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void; cleanup(): void }>();
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + '\n');
console.log = (...args: unknown[]) => console.error(...args);
const servicesFor = (parentId: string, signal: AbortSignal) => createPluginServices(requirements, (name, input, options) => {
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const abort = () => {
      if (!hostPending.delete(id)) return;
      send({ type: 'host_cancel', id, parent_id: parentId });
      reject(new CapabilityError('CANCELLED', 'Dependency callback cancelled'));
    };
    options.signal.addEventListener('abort', abort, { once: true });
    hostPending.set(id, { resolve, reject, cleanup: () => options.signal.removeEventListener('abort', abort) });
    send({ type: 'host_call', id, parent_id: parentId, method: 'capability.invoke', params: { name, input } });
  });
}, signal);
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on('line', async (line) => {
  let request: { id: string; method: string; type?: string; params?: any; result?: unknown; error?: { code?: string; message?: string } };
  try {
    if (Buffer.byteLength(line) > 2 * 1024 * 1024) throw new Error('Plugin request exceeds frame budget');
    request = JSON.parse(line);
    if (!request || typeof request.id !== 'string') throw new Error('Invalid request id');
    if (request.type === 'host_result') {
      const pending = hostPending.get(request.id);
      if (pending) {
        hostPending.delete(request.id); pending.cleanup();
        if (request.error) pending.reject(new CapabilityError(request.error.code ?? 'CAPABILITY_CALL_FAILED', request.error.message ?? 'Dependency failed'));
        else pending.resolve(request.result);
      }
      return;
    }
    if (request.type !== undefined || typeof request.method !== 'string') throw new Error('Invalid request frame');
  } catch (error) { send({ id: null, error: { code: 'PLUGIN_PROTOCOL_ERROR', message: String(error) } }); return; }
  const { id, method, params } = request;
  const controller = new AbortController();
  if (controllers.has(id)) { send({ id, error: { code: 'PLUGIN_PROTOCOL_ERROR', message: 'Duplicate request id' } }); return; }
  controllers.set(id, controller);
  const invocation = { signal: controller.signal, services: servicesFor(id, controller.signal) };
  try {
    if (method === 'init') {
      if (instance || initializing) throw new Error('Plugin already initialized');
      initializing = true; requirements = params.requires ?? [];
      const mod = await import(pathToFileURL(params.entry).href) as PluginModule;
      const context = { ...params.context, services: servicesFor(id, controller.signal) } as PluginContext;
      if (context.previousSchemaVersion !== undefined && context.previousSchemaVersion !== params.schemaVersion) {
        if (!mod.migrate) throw new Error('Plugin data schema changed without a migration hook');
        await mod.migrate({ dataRoot: context.dataRoot, fromVersion: context.previousSchemaVersion, toVersion: params.schemaVersion });
      }
      instance = await mod.createPlugin(context);
      if (!instance || typeof instance.invoke !== 'function') throw new Error('Plugin does not implement invoke');
      await instance.start?.({ signal: controller.signal, services: servicesFor(id, controller.signal) });
      send({ id, result: { ready: true } });
    } else if (method === 'invoke') {
      if (!instance) throw new Error('Plugin not initialized');
      send({ id, result: await instance.invoke(params.capability, params.input, invocation) });
    } else if (method === 'cancel') {
      controllers.get(params.id)?.abort(); send({ id, result: { cancelled: true } });
    } else if (method === 'stop') {
      for (const [otherId, other] of controllers) if (otherId !== id) other.abort();
      await instance?.stop?.(invocation); instance = undefined;
      send({ id, result: { stopped: true } });
      lines.close(); process.stdin.destroy();
    } else throw new Error('Unknown plugin protocol method');
  } catch (error) {
    const e = error as Error & { code?: string };
    send({ id, error: { code: e.code ?? 'PLUGIN_CALL_FAILED', message: e.message ?? String(error) } });
  } finally {
    controller.abort(); controllers.delete(id);
    if (method === 'init') initializing = false;
  }
});
