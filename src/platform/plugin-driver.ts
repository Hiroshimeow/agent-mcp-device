import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { CapabilityError, type PluginContext, type PluginInstance, type PluginManifest, type PluginModule } from './plugin-contract.js';
import { createPluginServices, type DependencyInvoker } from './plugin-services.js';

export interface PluginDriver {
  start(): Promise<void>;
  invoke(capability: string, input: unknown, signal?: AbortSignal): Promise<unknown>;
  stop(): Promise<void>;
}
const boundedTimeout = (manifest: PluginManifest) => Math.min(120_000, Math.max(50, manifest.timeoutMs ?? 15_000));
const unavailable: DependencyInvoker = async () => { throw new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'Dependency services are unavailable'); };
const MAX_FRAME = 2 * 1024 * 1024;
interface PendingRequest {
  method: string;
  controller: AbortController;
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
  cleanup(): void;
}
interface HostCall { parentId: string; controller: AbortController; cleanup(): void; }

class ProcessDriver implements PluginDriver {
  private child?: ChildProcessWithoutNullStreams;
  private pending = new Map<string, PendingRequest>();
  private hostCalls = new Map<string, HostCall>();
  private buffer = '';
  private stopping = false;
  private closing = false;
  private stopRequest?: Promise<void>;
  private closed?: Promise<void>;
  private termination?: Promise<void>;
  constructor(private manifest: PluginManifest, private context: PluginContext, private fault: (error: Error) => void,
    private invokeDependency: DependencyInvoker = unavailable) {}
  async start(): Promise<void> {
    const executable = this.manifest.executable ?? process.execPath;
    const args = this.manifest.executable ? (this.manifest.args ?? []) : [fileURLToPath(new URL('./plugin-child.js', import.meta.url))];
    this.child = spawn(executable, args, { cwd: this.context.dataRoot, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
    this.closed = new Promise(resolve => this.child!.once('close', () => resolve()));
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (text: string) => {
      this.buffer += text;
      if (Buffer.byteLength(this.buffer) > MAX_FRAME) { this.fail(new CapabilityError('PLUGIN_OUTPUT_LIMIT', 'Plugin output exceeded frame budget')); return; }
      let end: number;
      while ((end = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          if (message?.type === 'host_call') { this.receiveHostCall(message); continue; }
          if (message?.type === 'host_cancel') {
            const call = this.hostCalls.get(message.id);
            if (call && call.parentId === message.parent_id) call.controller.abort();
            continue;
          }
          if (message?.type !== undefined && message.type !== 'response') throw new Error('Unexpected plugin frame type');
          const pending = this.pending.get(message?.id);
          if (!pending) continue;
          this.pending.delete(message.id); clearTimeout(pending.timer); pending.cleanup();
          if (message.error) {
            const error = new CapabilityError(String(message.error.code ?? 'PLUGIN_CALL_FAILED'), String(message.error.message));
            pending.reject(error);
            if (error.code.startsWith('PLUGIN_')) this.fail(error);
          } else pending.resolve(message.result);
        } catch { this.fail(new CapabilityError('PLUGIN_PROTOCOL_ERROR', 'Plugin emitted an invalid protocol frame')); return; }
      }
    });
    this.child.stderr.resume();
    this.child.on('error', error => this.fail(error));
    this.child.on('exit', (code, signal) => {
      if (!this.stopping) this.fail(new CapabilityError('PLUGIN_EXITED', `Plugin exited (${code ?? signal})`));
      else this.rejectAll(new CapabilityError('PLUGIN_STOPPED', 'Plugin stopped'));
    });
    const { services: _services, ...context } = this.context;
    await this.request('init', { entry: this.manifest.entry, context, schemaVersion: this.manifest.dataSchemaVersion, requires: this.manifest.requires ?? [] });
  }
  private sendHostResult(id: string, result?: unknown, error?: unknown): void {
    if (!this.child?.stdin.writable || this.stopping) return;
    const failure = error as (Error & { code?: string }) | undefined;
    let frame: string;
    try {
      frame = JSON.stringify(failure
        ? { type: 'host_result', id, error: { code: failure.code ?? 'CAPABILITY_CALL_FAILED', message: failure.message ?? String(failure) } }
        : { type: 'host_result', id, result }) + '\n';
      if (Buffer.byteLength(frame) > MAX_FRAME) throw new Error('Dependency result exceeded frame budget');
    } catch {
      frame = JSON.stringify({ type: 'host_result', id, error: { code: 'CAPABILITY_OUTPUT_LIMIT', message: 'Dependency result is not a bounded JSON value' } }) + '\n';
    }
    this.child.stdin.write(frame, error => { if (error) this.fail(error); });
  }
  private receiveHostCall(message: any): void {
    if (typeof message.id !== 'string' || !message.id || message.id.length > 128 || typeof message.parent_id !== 'string'
      || message.method !== 'capability.invoke' || typeof message.params?.name !== 'string' || this.hostCalls.has(message.id)) {
      this.fail(new CapabilityError('PLUGIN_PROTOCOL_ERROR', 'Invalid or duplicate dependency callback')); return;
    }
    const parent = this.pending.get(message.parent_id);
    if (!parent || parent.controller.signal.aborted || this.stopping) {
      this.sendHostResult(message.id, undefined, new CapabilityError('CAPABILITY_PARENT_EXPIRED', 'Dependency callback has no active parent request')); return;
    }
    if (this.hostCalls.size >= 64) {
      this.sendHostResult(message.id, undefined, new CapabilityError('CAPABILITY_CALL_LIMIT', 'Too many concurrent dependency callbacks')); return;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    parent.controller.signal.addEventListener('abort', abort, { once: true });
    const call: HostCall = { parentId: message.parent_id, controller, cleanup: () => {
      parent.controller.signal.removeEventListener('abort', abort); controller.abort();
    } };
    this.hostCalls.set(message.id, call);
    const services = createPluginServices(this.manifest.requires ?? [], this.invokeDependency, controller.signal);
    void services.invoke(message.params.name, message.params.input).then(
      result => { if (this.pending.has(call.parentId) && !controller.signal.aborted) this.sendHostResult(message.id, result); },
      error => { if (this.pending.has(call.parentId)) this.sendHostResult(message.id, undefined, error); }
    ).finally(() => { if (this.hostCalls.get(message.id) === call) this.hostCalls.delete(message.id); call.cleanup(); });
  }
  private rejectAll(error: Error): void {
    const requests = [...this.pending.values()]; this.pending.clear();
    // Settle ordinary callers before aborting callbacks: graceful child shutdown
    // must not race a CANCELLED response against the host's PLUGIN_STOPPED result.
    for (const pending of requests) { clearTimeout(pending.timer); pending.reject(error); pending.cleanup(); }
    const callbacks = [...this.hostCalls.values()]; this.hostCalls.clear();
    for (const call of callbacks) call.cleanup();
  }
  private terminate(): Promise<void> {
    if (this.termination) return this.termination;
    const attempt = this.terminateProcess(); this.termination = attempt;
    void attempt.catch(() => { if (this.termination === attempt) this.termination = undefined; });
    return attempt;
  }
  private async terminateProcess(): Promise<void> {
    const child = this.child;
    if (!child) return;
    if (child.pid && child.exitCode === null) {
      if (process.platform === 'win32') {
        const taskkill = path.join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows', 'System32', 'taskkill.exe');
        const fallback = () => { if (child.exitCode === null) { try { child.kill('SIGKILL'); } catch { /* close evidence remains mandatory */ } } };
        const killer = spawn(taskkill, ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        killer.once('error', fallback);
        killer.once('close', code => { if (code !== 0) fallback(); });
        killer.unref();
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      }
    }
    let timer: NodeJS.Timeout | undefined;
    try { await Promise.race([this.closed, new Promise<void>((_, reject) => { timer = setTimeout(() => reject(new CapabilityError('PLUGIN_TERMINATION_FAILED', 'Plugin process did not release its resources')), 5000); })]); }
    finally { if (timer) clearTimeout(timer); }
  }
  private fail(error: Error): void {
    if (this.stopping) return;
    this.stopping = true; this.rejectAll(error); void this.terminate().catch(() => {}); this.fault(error);
  }
  private request(method: string, params: unknown, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) return Promise.reject(new CapabilityError('CANCELLED', 'Plugin call cancelled'));
    if (this.closing && method !== 'stop') return Promise.reject(new CapabilityError('PLUGIN_STOPPED', 'Plugin is stopping'));
    if (!this.child?.stdin.writable || this.stopping) return Promise.reject(new CapabilityError('PLUGIN_UNAVAILABLE', 'Plugin process unavailable'));
    const id = randomUUID(), controller = new AbortController();
    const frame = JSON.stringify({ id, method, params }) + '\n';
    if (Buffer.byteLength(frame) > MAX_FRAME) return Promise.reject(new CapabilityError('PLUGIN_INPUT_LIMIT', 'Plugin request exceeds frame budget'));
    return new Promise((resolve, reject) => {
      const onAbort = () => this.fail(new CapabilityError('CANCELLED', 'Plugin call cancelled; isolated process stopped'));
      const timer = setTimeout(() => this.fail(new CapabilityError('PLUGIN_TIMEOUT', 'Plugin exceeded its execution deadline')), boundedTimeout(this.manifest));
      this.pending.set(id, { method, controller, resolve, reject, timer, cleanup: () => {
        signal?.removeEventListener('abort', onAbort); controller.abort();
      } });
      signal?.addEventListener('abort', onAbort, { once: true });
      this.child!.stdin.write(frame, error => { if (error) this.fail(error); });
    });
  }
  invoke(capability: string, input: unknown, signal?: AbortSignal): Promise<unknown> { return this.request('invoke', { capability, input }, signal); }
  stop(): Promise<void> {
    if (!this.stopRequest) {
      const attempt = this.stopProcess(); this.stopRequest = attempt;
      void attempt.catch(() => { if (this.stopRequest === attempt) this.stopRequest = undefined; });
    }
    return this.stopRequest;
  }
  private async stopProcess(): Promise<void> {
    if (this.stopping) { await this.terminate(); return; }
    this.closing = true;
    this.rejectAll(new CapabilityError('PLUGIN_STOPPED', 'Plugin stopped'));
    // This new lifecycle request retains its own deadline and failure path.
    try { await this.request('stop', {}); } catch { /* bounded stop, then terminate */ }
    this.stopping = true; this.rejectAll(new CapabilityError('PLUGIN_STOPPED', 'Plugin stopped')); await this.terminate();
  }
}

class CooperativeDriver implements PluginDriver {
  private instance?: PluginInstance;
  private stopping = false;
  private stopRequest?: Promise<void>;
  private controllers = new Set<AbortController>();
  constructor(private manifest: PluginManifest, private context: PluginContext, private fault: (error: Error) => void,
    private invokeDependency: DependencyInvoker = unavailable) {}
  private services(signal: AbortSignal) { return createPluginServices(this.manifest.requires ?? [], this.invokeDependency, signal); }
  private async bounded<T>(work: (signal: AbortSignal) => Promise<T> | T, outer?: AbortSignal): Promise<T> {
    if (outer?.aborted) throw new CapabilityError('CANCELLED', 'Plugin call cancelled');
    const controller = new AbortController(); this.controllers.add(controller);
    let timer: NodeJS.Timeout | undefined;
    let cancel: (() => void) | undefined;
    let onInnerAbort: (() => void) | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => {
          if (controller.signal.aborted) throw new CapabilityError('CANCELLED', 'Plugin call cancelled before execution');
          return work(controller.signal);
        }),
        new Promise<T>((_, reject) => {
          onInnerAbort = () => reject(new CapabilityError('CANCELLED', 'Plugin invocation scope ended'));
          controller.signal.addEventListener('abort', onInnerAbort, { once: true });
          timer = setTimeout(() => { reject(new CapabilityError('PLUGIN_TIMEOUT', 'Cooperative plugin deadline exceeded')); controller.abort(); }, boundedTimeout(this.manifest));
          cancel = () => controller.abort();
          outer?.addEventListener('abort', cancel, { once: true });
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      if (cancel) outer?.removeEventListener('abort', cancel);
      if (onInnerAbort) controller.signal.removeEventListener('abort', onInnerAbort);
      controller.abort(); this.controllers.delete(controller);
    }
  }
  async start(): Promise<void> {
    const mod = await import(pathToFileURL(this.manifest.entry).href + '?instance=' + randomUUID()) as PluginModule;
    if (this.context.previousSchemaVersion !== undefined && this.context.previousSchemaVersion !== this.manifest.dataSchemaVersion) {
      if (!mod.migrate) throw new CapabilityError('PLUGIN_MIGRATION_REQUIRED', 'Data schema changed without migration');
      await this.bounded(() => mod.migrate!({ dataRoot: this.context.dataRoot, fromVersion: this.context.previousSchemaVersion!, toVersion: this.manifest.dataSchemaVersion }));
    }
    this.instance = await this.bounded(signal => mod.createPlugin({ ...this.context, services: this.services(signal) }));
    await this.bounded(signal => this.instance!.start?.({ signal, services: this.services(signal) }));
  }
  async invoke(capability: string, input: unknown, signal?: AbortSignal): Promise<unknown> {
    if (!this.instance || this.stopping) throw new CapabilityError('PLUGIN_UNAVAILABLE', 'Plugin not initialized or stopping');
    try { return await this.bounded(inner => this.instance!.invoke(capability, input, { signal: inner, services: this.services(inner) }), signal); }
    catch (error) { const code = (error as CapabilityError).code; if (!code || code.startsWith('PLUGIN_')) this.fault(error as Error); throw error; }
  }
  stop(): Promise<void> {
    if (!this.stopRequest) {
      const instance = this.instance; this.stopping = true;
      for (const controller of this.controllers) controller.abort();
      const attempt = (async () => {
        if (instance) await this.bounded(signal => instance.stop?.({ signal, services: this.services(signal) }));
        this.instance = undefined;
      })();
      this.stopRequest = attempt;
      void attempt.catch(() => { if (this.stopRequest === attempt) this.stopRequest = undefined; });
    }
    return this.stopRequest;
  }
}

export function createPluginDriver(manifest: PluginManifest, context: PluginContext, fault: (error: Error) => void,
  invokeDependency: DependencyInvoker = unavailable): PluginDriver {
  return manifest.isolation === 'process'
    ? new ProcessDriver(manifest, context, fault, invokeDependency)
    : new CooperativeDriver(manifest, context, fault, invokeDependency);
}
