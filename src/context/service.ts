import { randomBytes, createHash } from 'node:crypto';
import { requireFeatureAuthorized, GATE_ERROR, type GatedFeature } from './authorization.js';
export { isFeatureAuthorized, SOC_PUBLIC_KEY } from './authorization.js';
import { queryActivityGraph, type GraphOptions } from './graph.js';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { sync } from './indexer.js';
import { ContextStore } from './store.js';
import { search, readEvidence, type SearchOptions, type ReadOptions } from './search.js';

export const FEATURE_LIVE_CAPTURE = false;
export const FEATURE_PUBLIC_GATEWAY = false;
export interface ContextServiceOptions {
  FEATURE_LIVE_CAPTURE?: boolean;
  FEATURE_PUBLIC_GATEWAY?: boolean;
}

interface Job { job_ref: string; owner: string; repo: string; action: 'sync' | 'rebuild'; started_at: number }
interface Gap { count: number; reasons: Set<string> }
const GAP_REASONS = new Set(['storage_unavailable', 'busy', 'quota', 'outcome_failed']);

/** Explicit foreground ownership only; no timers, scheduler, sync or source scans. */
export class ContextService {
  private readonly jobs = new Map<string, Job>();
  private readonly gaps = new Map<string, Gap>();
  constructor(private readonly store: ContextStore, private readonly options: ContextServiceOptions = {}) {
    for (const feature of ['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'] as const) {
      if (options[feature] === true) this.initializeFeature(feature);
    }
  }

  /** All future Phase 7/8 tool initialization must pass this fail-closed boundary.
   * No capture hooks, public routes or MCP tools are enabled by this change. */
  initializeFeature(feature: GatedFeature): void {
    this.requireFeatureAuthorized(feature);
  }

  requireFeatureAuthorized(feature: GatedFeature): void {
    if (this.options[feature] !== true) throw new Error(GATE_ERROR);
    requireFeatureAuthorized(feature);
  }

  /** Revalidate synchronously immediately before the side effect. Revocation
   * takes effect on the next call; this is not cancellation of in-flight work. */
  executeFeature<T>(feature: GatedFeature, action: () => T): T {
    this.requireFeatureAuthorized(feature);
    return action();
  }

  graph(owner: string, repo: string, input: GraphOptions) { return queryActivityGraph(this.store, owner, repo, input); }

  search(owner: string, repo: string, input: SearchOptions) { return search(this.store, owner, repo, input); }
  read(owner: string, repo: string, input: ReadOptions) { return readEvidence(this.store, owner, repo, input); }

  sync(owner: string, repo: string) {
    this.store.authorize(owner, repo);
    this.store.reconcileQuota();
    const job = this.startJob(owner, repo, 'sync');
    try {
      const result = sync(this.store, owner, repo);
      return { ...this.status(owner, repo), indexed: result.indexed };
    } finally { this.finishJob(owner, repo, job); }
  }

  rebuild(owner: string, repo: string) {
    const job = this.startJob(owner, repo, 'rebuild');
    try {
      const result = sync(this.store, owner, repo, { rebuild: true });
      return { ...this.status(owner, repo), indexed: result.indexed };
    } finally { this.finishJob(owner, repo, job); }
  }

  checkpoint(owner: string, repo: string, input: { repository_root: string; worktree_ref: string; summary?: string; evidence_refs?: string[] }) {
    this.store.authorize(owner, repo);
    const refs = input.evidence_refs ?? [];
    if (refs.length > 20 || (input.summary !== undefined && (typeof input.summary !== 'string' || Buffer.byteLength(input.summary) > 4096))) throw new Error('BUDGET_EXCEEDED');
    for (const ref of refs) this.store.read(owner, repo, ref);
    const git = (...args: string[]) => execFileSync('git', ['-C', input.repository_root, ...args], {
      encoding: 'utf8', timeout: 5000, maxBuffer: 65536, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined },
    }).trim();
    const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
    const identity = createHash('sha256').update(realpathSync(common)).digest('hex');
    const worktree = createHash('sha256').update(realpathSync(git('rev-parse', '--show-toplevel'))).digest('hex');
    if (this.store.findRepository(owner, identity) !== repo || worktree !== input.worktree_ref) throw new Error('ACCESS_DENIED');
    const status = git('status', '--porcelain=v1', '-z');
    const checkpoint = {
      observed: { head: git('rev-parse', 'HEAD'), worktree_ref: worktree, dirty: status.length > 0,
        changed_paths: status.split('\0').filter(Boolean).map(line => this.store.redactPayload(line.slice(3)).text).slice(0, 256) },
      reported: { summary: this.store.redactPayload(input.summary ?? '').text, evidence_refs: refs },
    };
    const ref = this.store.append(owner, repo, JSON.stringify(checkpoint), { checkpoint: true });
    const retained = JSON.parse(String(this.store.read(owner, repo, ref).text)) as typeof checkpoint;
    return { ...this.status(owner, repo), checkpoint: { ref, ...retained } };
  }

  /** Trusted local admin seam, intentionally absent from CLI/MCP agent action dispatch. */
  cleanup(owner: string, repo: string, input: { before: number; localAdmin: boolean }) {
    if ([...this.jobs.values()].some(job => job.owner === owner && job.repo === repo)) throw new Error('BUSY');
    return this.store.cleanup(owner, repo, input);
  }

  captureGap(owner: string, repo: string, reason: string): void {
    this.store.authorize(owner, repo);
    this.recordGap(owner, repo, reason);
  }

  /** Trusted observer scope only; works even when the storage connection is down. */
  recordGap(owner: string, repo: string, reason: string): void {
    for (const key of this.gaps.keys()) if (!key.startsWith(`${owner}:`)) this.gaps.delete(key);
    const gap = this.gaps.get(`${owner}:${repo}`) ?? { count: 0, reasons: new Set<string>() };
    gap.count++;
    gap.reasons.add(GAP_REASONS.has(reason) ? reason : 'storage_unavailable');
    this.gaps.set(`${owner}:${repo}`, gap);
  }

  status(owner: string, repo: string) {
    this.store.authorize(owner, repo);
    const manifest = this.store.inspectManifest(owner, repo);
    const gap = this.gaps.get(`${owner}:${repo}`);
    const reasons = [...(gap?.reasons ?? [])];
    if (manifest.unknown_events > 0) reasons.push('unknown_after_restart');
    const quotaGaps = this.store.quotaGaps(owner);
    if (quotaGaps > 0) reasons.push('quota');
    return {
      schema_version: 1, ok: true, scope: { repository_ref: repo },
      index: { generation: manifest.generation, indexed_through_event: manifest.indexed_through_event,
        pending_events: manifest.pending_events, fts_documents: manifest.fts_documents, freshness: manifest.generation === null ? 'missing' : manifest.pending_events ? 'stale' : 'current' },
      coverage: { complete: reasons.length === 0, reasons },
      capture_health: { capture_healthy: reasons.length === 0, in_memory_gaps: gap?.count ?? 0, unknown_after_restart: manifest.unknown_events, quota_gaps: quotaGaps },
      active_jobs: [...this.jobs.values()].filter(job => job.owner === owner && job.repo === repo)
        .map(({ job_ref, action, started_at }) => ({ job_ref, action, started_at })),
      storage: { available: true, accounted_bytes: this.store.accountedBytes(), accounting: 'last_explicit_refresh', quota_enforced: true },
      wiki_enabled: false,
    };
  }

  startJob(owner: string, repo: string, action: 'sync' | 'rebuild'): string {
    this.store.authorize(owner, repo);
    if (action !== 'sync' && action !== 'rebuild') throw new Error('ACTION_UNSUPPORTED');
    // Re-pair cannot leave sealed-owner jobs consuming the active owner's limits.
    for (const [id, job] of this.jobs) if (job.owner !== owner) this.jobs.delete(id);
    const jobs = [...this.jobs.values()];
    if (jobs.some(job => job.repo === repo) || jobs.length >= 4) throw new Error('BUSY');
    const id = randomBytes(24).toString('hex');
    this.jobs.set(id, { job_ref: id, owner, repo, action, started_at: Date.now() }); return id;
  }

  /** Foreground work completes before another request can run; cancel only releases a scoped pending job. */
  cancel(owner: string, repo: string, id: string) {
    this.finishJob(owner, repo, id);
    return { job_ref: id, state: 'cancelled' as const };
  }

  finishJob(owner: string, repo: string, id: string): void {
    this.store.authorize(owner, repo);
    const job = this.jobs.get(id);
    if (!job || job.owner !== owner || job.repo !== repo) throw new Error('ACCESS_DENIED');
    this.jobs.delete(id);
  }
}
