import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** Bounded platform observations. A receipt describes execution, never validation of a claim. */
export class ActivityJournal {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private closed = false;
  private filename: string;
  private segmentTime = 0;
  private readonly directory: string;
  constructor(stateRoot: string, private deviceId: string, private runtimeId: string, private maxBytes = 2 * 1024 * 1024) {
    this.directory = path.join(stateRoot, 'logs');
    this.filename = this.nextSegment();
  }
  private nextSegment(): string {
    this.segmentTime = Math.max(Date.now(), this.segmentTime + 1);
    return path.join(this.directory, `device-activity-${this.segmentTime}-${randomUUID()}.jsonl`);
  }
  record(tool: string, args: unknown, result?: any, error?: unknown): void {
    if (this.closed || this.pending >= 256 || tool.startsWith('knowledge.')) return;
    const input = args && typeof args === 'object' ? args as Record<string, unknown> : {};
    const paths: Record<string, string> = {};
    for (const name of ['path', 'file_path', 'working_directory', 'cwd']) if (typeof input[name] === 'string') paths[name] = (input[name] as string).slice(0, 1024);
    let value = result?.structuredContent ?? result;
    const text = value?.content?.find?.((part: any) => part.type === 'text')?.text;
    if (typeof text === 'string' && text.length < 64 * 1024) { try { value = JSON.parse(text); } catch { /* no raw output is persisted */ } }
    const exitCode = typeof value?.exitCode === 'number' ? value.exitCode : typeof value?.exit_code === 'number' ? value.exit_code : null;
    const failed = Boolean(error || result?.isError || value?.isError || value?.success === false || value?.timedOut || (exitCode !== null && exitCode !== 0));
    const running = !failed && exitCode === null && Boolean(value?.sessionId || value?.session_id);
    const status = failed ? 'failed' : running ? 'running' : 'completed';
    const receipt = {
      version: 1, event_id: randomUUID(), timestamp: new Date().toISOString(), device_id: this.deviceId,
      session_id: this.runtimeId, toolName: tool.slice(0, 96), arguments: paths,
      output: `Device tool ${tool.slice(0, 96)} ${status}${exitCode === null ? '' : ' with exit code ' + exitCode}.`,
      status, exit_code: exitCode,
      ...(error ? { error: { code: String((error as { code?: unknown }).code ?? 'TOOL_CALL_FAILED').slice(0, 96) } } : {})
    };
    const frame = JSON.stringify(receipt) + '\n';
    this.pending++;
    this.tail = this.tail.then(async () => {
      await fs.mkdir(this.directory, { recursive: true });
      let size = await fs.stat(this.filename).then(stat => stat.size, () => 0);
      if (size > 0 && size + Buffer.byteLength(frame) > this.maxBytes) { this.filename = this.nextSegment(); size = 0; }
      await fs.appendFile(this.filename, frame, { mode: 0o600 });
      if (size === 0) {
        // Stable paths keep exact-source references valid until intentional
        // retention pruning. Every segment remains discoverable as JSONL.
        const segments = (await fs.readdir(this.directory)).filter(name => /^device-activity-\d+-[0-9a-f-]+\.jsonl$/.test(name) && name !== path.basename(this.filename)).sort().reverse();
        for (const name of segments.slice(3)) await fs.rm(path.join(this.directory, name), { force: true });
      }
    }).catch(() => { /* Observation failure never changes the underlying tool result. */ }).finally(() => { this.pending--; });
  }
  async close(): Promise<void> { this.closed = true; await this.tail; }
}
