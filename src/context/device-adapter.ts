import { executePublicGateway } from './gateway.js';
import { CONFIG_DIR } from '../config.js';
import { ContextStore } from './store.js';
import { ContextService } from './service.js';
import { resolveRepository } from './repositories.js';
import { validateContextInput, contextError, WIKI_DISABLED } from './tool-contract.js';
import type { GraphOptions } from './graph.js';

export interface DeviceContextOptions {
  stateRoot?: string;
  deviceId: string;
  /** Trusted configured project lookup, never caller-provided filesystem mapping. */
  resolveProject?: (projectId: string) => Promise<string | undefined>;
}
export async function callDeviceContext(tool: string, input: unknown, options: DeviceContextOptions, guard: (path: string) => Promise<string>) {
  return executePublicGateway(async () => {
  let store: ContextStore | undefined;
  try {
    const args = validateContextInput(tool, input);
    if (tool === 'local_wiki') return WIKI_DISABLED;
    if (args.device_id !== options.deviceId) throw new Error('ACCESS_DENIED');
    if (!args.cwd && !args.project_id) throw new Error('SCOPE_REQUIRED');
    if (args.cwd && args.project_id) throw new Error('SCOPE_AMBIGUOUS');
    const cwd = args.cwd ?? await options.resolveProject?.(args.project_id);
    if (!cwd) throw new Error('ACCESS_DENIED');
    const resolution = await resolveRepository(cwd, guard);
    if (!resolution) throw new Error('REPOSITORY_NOT_FOUND');
    const write = tool === 'local_index' && args.action !== 'cancel';
    store = new ContextStore(options.stateRoot ?? CONFIG_DIR, { readOnly: !write });
    const owner = store.activeOwner();
    if (!owner) throw new Error('ACCESS_DENIED');
    const repo = write ? store.repository(owner, resolution.identity) : store.findRepository(owner, resolution.identity);
    if (!repo) throw new Error('INDEX_MISSING');
    const service = new ContextService(store);
    switch (tool) {
      case 'local_status':
        if (args.job_id && !service.status(owner, repo).active_jobs.some(job => job.job_ref === args.job_id)) throw new Error('ACCESS_DENIED');
        return service.status(owner, repo);
      case 'local_search': {
        const timestamp = (value: string | undefined) => {
          if (value === undefined) return undefined;
          const number = /^\d+$/.test(value) ? Number(value) : Date.parse(value);
          if (!Number.isSafeInteger(number)) throw new Error('BUDGET_EXCEEDED');
          return number;
        };
        return service.search(owner, repo, { ...args, query: args.query, since: timestamp(args.since), until: timestamp(args.until) });
      }
      case 'local_read': return service.read(owner, repo, { ...args, refs: args.refs });
      case 'local_graph':
        if (args.cursor !== undefined) throw new Error('CURSOR_INVALID');
        return service.graph(owner, repo, args as GraphOptions);
      case 'local_index':
        // Foreground-only jobs; don't silently claim unsupported orchestration semantics.
        if (args.budget_profile !== undefined || args.idempotency_key !== undefined) throw new Error('ACTION_UNSUPPORTED');
        switch (args.action) {
          case 'sync': return service.sync(owner, repo);
          case 'rebuild': return service.rebuild(owner, repo);
          case 'cancel': return service.cancel(owner, repo, args.job_id ?? '');
          case 'checkpoint': return service.checkpoint(owner, repo, { repository_root: resolution.root, worktree_ref: resolution.worktree, summary: args.summary, evidence_refs: args.evidence_refs });
        }
    }
    throw new Error('ACTION_UNSUPPORTED');
  } catch (error) { return contextError(error); }
  finally { try { store?.close(); } catch { /* Do not leak paths through close errors. */ } }
  });
}
