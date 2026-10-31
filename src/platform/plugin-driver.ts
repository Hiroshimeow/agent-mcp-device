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
  deadlineAt: number;
  stderrSequence: number;
  cleanup(): void;
}
interface CancellingRequest { timer: NodeJS.Timeout; stderrSequence: number; }
interface HostCall { parentId: string; controller: AbortController; cleanup(): void; }

class ProcessDriver implements PluginDriver {
  private child?: ChildProcessWithoutNullStreams;
  private pending = new Map<string, PendingRequest>();
  private cancelling = new Map<string, CancellingRequest>();
  private cancelAcks = new Map<string, string>();
  private hostCalls = new Map<string, HostCall>();
  private buffer = '';
  private stderrTail = '';
  private stderrSequence = 0;
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
          if (!pending) {
            const responseId=String(message?.id??'');
            const acknowledgedTarget=this.cancelAcks.get(responseId);
            if(acknowledgedTarget){
              // A cooperative cancel acknowledgement proves only that the child
              // received the signal. The original work remains supervised until
              // its own response arrives or the bounded cancellation grace ends.
              this.cancelAcks.delete(responseId);
              continue;
            }
            if(this.cancelling.has(responseId)){
              const cancelling=this.cancelling.get(responseId);
              if(cancelling)clearTimeout(cancelling.timer);
              this.cancelling.delete(responseId);
              for(const [cancelId,targetId] of this.cancelAcks)if(targetId===responseId)this.cancelAcks.delete(cancelId);
              if(cancelling&&String(message.error?.code??'').startsWith('PLUGIN_')){
                this.settlePluginFault(cancelling,new CapabilityError(String(message.error.code),String(message.error.message)));
              }
            }
            continue;
          }
          this.pending.delete(message.id); clearTimeout(pending.timer); pending.cleanup();
          if (message.error) {
            const error = new CapabilityError(String(message.error.code ?? 'PLUGIN_CALL_FAILED'), String(message.error.message));
            if (error.code.startsWith('PLUGIN_')) this.settlePluginFault(pending,error);
            else pending.reject(error);
          } else pending.resolve(message.result);
        } catch { this.fail(new CapabilityError('PLUGIN_PROTOCOL_ERROR', 'Plugin emitted an invalid protocol frame')); return; }
      }
    });
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data',(text:string)=>{this.stderrSequence++;this.stderrTail=(this.stderrTail+text).slice(-4096);});
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
    for(const cancelling of this.cancelling.values())clearTimeout(cancelling.timer);this.cancelling.clear();this.cancelAcks.clear();
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
  private settlePluginFault(pending:{stderrSequence:number;reject?(error:Error):void},error:CapabilityError):void {
    const stderr=this.child?.stderr;
    let settled=false,deadline:NodeJS.Timeout|undefined,quiet:NodeJS.Timeout|undefined;
    const finish=()=>{
      if(settled)return;settled=true;
      if(deadline)clearTimeout(deadline);if(quiet)clearTimeout(quiet);
      stderr?.off('data',onData);
      const diagnostic=this.diagnostic(error);
      pending.reject?.(diagnostic);
      this.fail(error);
    };
    const settleAfterQuiet=()=>{
      if(quiet)clearTimeout(quiet);
      // stdout and stderr are independent pipes. Give stderr a short quiet
      // period after the fault frame so diagnostics emitted immediately before
      // the thrown error are not lost on either Windows or POSIX scheduling.
      quiet=setTimeout(finish,40);
    };
    const onData=()=>settleAfterQuiet();
    stderr?.on('data',onData);
    if(this.stderrSequence>pending.stderrSequence)settleAfterQuiet();
    // Bound the diagnostic wait so a silent/broken stderr pipe cannot delay
    // plugin fault containment indefinitely.
    deadline=setTimeout(finish,1000);
  }
  private diagnostic(error:Error):Error {
    if(!this.stderrTail.trim())return error;
    const message=error.message+'\n[plugin stderr tail]\n'+this.stderrTail.trim();
    const code=(error as CapabilityError).code;
    return code?new CapabilityError(code,message):new Error(message);
  }
  private fail(error: Error): void {
    if (this.stopping) return;
    const diagnostic=this.diagnostic(error);
    this.stopping = true; this.rejectAll(diagnostic); void this.terminate().catch(() => {}); this.fault(diagnostic);
  }
  private request(method: string, params: unknown, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) return Promise.reject(new CapabilityError('CANCELLED', 'Plugin call cancelled'));
    if (this.closing && method !== 'stop') return Promise.reject(new CapabilityError('PLUGIN_STOPPED', 'Plugin is stopping'));
    if (!this.child?.stdin.writable || this.stopping) return Promise.reject(new CapabilityError('PLUGIN_UNAVAILABLE', 'Plugin process unavailable'));
    const id = randomUUID(), controller = new AbortController();
    const frame = JSON.stringify({ id, method, params }) + '\n';
    if (Buffer.byteLength(frame) > MAX_FRAME) return Promise.reject(new CapabilityError('PLUGIN_INPUT_LIMIT', 'Plugin request exceeds frame budget'));
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        const active=this.pending.get(id);if(!active)return;
        this.pending.delete(id);clearTimeout(active.timer);
        active.reject(new CapabilityError('CANCELLED','Plugin call cancelled'));
        active.cleanup();
        if(!this.child?.stdin.writable||this.stopping)return;
        if(this.cancelling.size>=64){this.fail(new CapabilityError('PLUGIN_CALL_LIMIT','Too many incomplete cancelled requests'));return;}
        // A cancelled request must not make the process deadline stricter than the
        // request's original execution deadline. This prevents a queued cancel
        // from killing unrelated work that was already running in the child.
        const graceMs=Math.max(1,active.deadlineAt-Date.now());
        const grace=setTimeout(()=>{
          this.cancelling.delete(id);
          this.fail(new CapabilityError('PLUGIN_TIMEOUT','Plugin did not finish cancelled work before the grace deadline'));
        },graceMs);
        this.cancelling.set(id,{timer:grace,stderrSequence:active.stderrSequence});
        const cancelId=randomUUID();this.cancelAcks.set(cancelId,id);
        const cancelFrame=JSON.stringify({id:cancelId,method:'cancel',params:{id}})+'\n';
        this.child.stdin.write(cancelFrame,error=>{if(error)this.fail(error);});
      };
      const timeoutMs=boundedTimeout(this.manifest),deadlineAt=Date.now()+timeoutMs;
      const timer = setTimeout(() => this.fail(new CapabilityError('PLUGIN_TIMEOUT', 'Plugin exceeded its execution deadline')), timeoutMs);
      this.pending.set(id, { method, controller, resolve, reject, timer, deadlineAt, stderrSequence:this.stderrSequence, cleanup: () => {
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
