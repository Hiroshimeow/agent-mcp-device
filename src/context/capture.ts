import { randomBytes, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { requireFeatureAuthorized } from './authorization.js';
import type { ContextStore } from './store.js';
import type { ContextService } from './service.js';

/** Importing this module never enables capture. Revalidate every privileged write. */
export function executeLiveCapture<T>(action: () => T): T {
  try { requireFeatureAuthorized('FEATURE_LIVE_CAPTURE'); }
  catch (error) { liveObserver = undefined; throw error; }
  return action();
}

export const EXCLUDED_LOCAL_TOOLS = ['local_status', 'local_search', 'local_read', 'local_graph',
  'local_index', 'local_wiki', 'get_recent_tool_calls', 'track_ui_event'] as const;
const excluded = (tool: string) => tool.startsWith('local_') || EXCLUDED_LOCAL_TOOLS.some(name => name === tool);
export interface IntentRequest { tool: string; args?: Record<string, unknown>; invocationId?: string }
export interface OutcomeData { result?: unknown; status: 'succeeded' | 'failed' | 'cancelled'; error?: string; durationMs?: number }
export interface ObservedInvocation extends IntentRequest, OutcomeData {}
export interface IntentToken extends IntentRequest { ok: boolean; invocationId: string; eventId?: number; gap?: boolean; error?: string }
export interface ObservationOutcome { recorded: boolean; excluded?: boolean; eventId?: number; gapRecorded?: boolean; error?: string }
export interface CanonicalObserver {
  beginIntent(request: IntentRequest): Promise<IntentToken>;
  completeOutcome(token: IntentToken, outcome: OutcomeData): Promise<ObservationOutcome>;
  recordInvocation(invocation: ObservedInvocation): Promise<ObservationOutcome>;
  execute<T>(request: IntentRequest, action: () => T | Promise<T>): Promise<T>;
}

const activeCapture = new AsyncLocalStorage<boolean>();
let liveObserver: CanonicalObserver | undefined;
/** Explicit trusted-runtime installation only; importing never activates hooks. */
export function setLiveCaptureObserver(observer: CanonicalObserver | undefined): void {
  if (observer) executeLiveCapture(() => { liveObserver = observer; });
  else liveObserver = undefined;
}
export function isCapturingInvocation(): boolean { return activeCapture.getStore() === true; }
export async function observePublicInvocation<T>(request: IntentRequest, action: () => T | Promise<T>, observer = liveObserver): Promise<T> {
  if (!observer || isCapturingInvocation()) return action();
  return activeCapture.run(true, () => observer.execute(request, action));
}

/** One public invocation -> one durable intent -> one outcome. No execution retries.
 * Capture uses short SQLite lock budgets, the shared quota/fencing admission and
 * bounded redacted payloads. Failures remain in memory, never on the execution path. */
export function createCanonicalObserver(service: ContextService, store: ContextStore, owner: string, repo: string): CanonicalObserver {
  store.authorize(owner, repo);
  const completed = new WeakSet<IntentToken>();
  const bounded = <T>(action: () => T): T => {
    const db = store.repoDatabase(owner, repo), registry = store.registry;
    const connections = [registry, db, store.unscopedDatabase(owner)];
    const budgets = connections.map(connection => Number(connection.prepare('PRAGMA busy_timeout').get()?.timeout));
    try {
      for (const connection of connections) connection.exec('PRAGMA busy_timeout=25');
      return action();
    } finally {
      connections.forEach((connection, index) => connection.exec(`PRAGMA busy_timeout=${budgets[index]}`));
    }
  };
  const gap = (reason: string, error: unknown) => {
    service.recordGap(owner, repo, reason);
    return error instanceof Error ? error.message : String(error);
  };
  const observer: CanonicalObserver = {
    async beginIntent(request) {
      executeLiveCapture(() => service.requireFeatureAuthorized('FEATURE_LIVE_CAPTURE'));
      const token: IntentToken = { ...request, invocationId: request.invocationId ?? randomUUID(), ok: false };
      if (excluded(request.tool)) return token;
      return executeLiveCapture(() => {
        service.requireFeatureAuthorized('FEATURE_LIVE_CAPTURE');
        try {
          token.eventId = bounded(() => store.quotaWrite(owner, repo, 65536, () => {
            const db = store.repoDatabase(owner, repo);
            db.exec('BEGIN IMMEDIATE');
            try {
              const row = db.prepare("INSERT INTO events(invocation_id,accepted_at,execution_status) VALUES(?,?,'pending')").run(token.invocationId, Date.now());
              store.commitRepository(db);
              return Number(row.lastInsertRowid);
            } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
          }));
          token.ok = true;
        } catch (error) {
          token.gap = true;
          const message = error instanceof Error ? error.message : String(error);
          let reason = 'storage_unavailable';
          if (/busy|locked/i.test(message)) reason = 'busy';
          else if (/QUOTA/.test(message)) reason = 'quota';
          token.error = gap(reason, error);
        }
        return token;
      });
    },
    async completeOutcome(token, outcome) {
      executeLiveCapture(() => service.requireFeatureAuthorized('FEATURE_LIVE_CAPTURE'));
      if (excluded(token.tool)) return { recorded: false, excluded: true };
      if (!token.ok || token.eventId === undefined) return { recorded: false, gapRecorded: token.gap };
      if (completed.has(token)) return { recorded: true, eventId: token.eventId };
      const eventId = token.eventId;
      try {
        return executeLiveCapture(() => {
          service.requireFeatureAuthorized('FEATURE_LIVE_CAPTURE');
          return bounded(() => {
            const prior = store.repoDatabase(owner, repo).prepare('SELECT payload_ref FROM events WHERE event_id=? AND invocation_id=?').get(eventId, token.invocationId);
            if (prior?.payload_ref) { completed.add(token); return { recorded: true, eventId }; }
            const process = (outcome.result as { _meta?: { process?: Record<string, unknown> } } | undefined)?._meta?.process;
            // Poll duration is not source evidence. Identical canonical output/range
            // payloads reuse their redacted keyed hash, scoped to this repository.
            const canonicalRange = Boolean(process?.execution_id && process?.runtime_generation && process?.read_from !== undefined);
            const payload = canonicalRange
              ? { tool: token.tool, result: outcome.result, status: outcome.status }
              : { tool: token.tool, args: token.args ?? {}, ...outcome };
            const safe = store.redactPayload(JSON.stringify(payload), { maxBytes: 65536 });
            store.quotaWrite(owner, repo, safe.retainedBytes * 4 + 65536, () => {
              const db = store.repoDatabase(owner, repo);
              const existing = canonicalRange
                ? db.prepare("SELECT ref FROM evidence WHERE hash=? AND retention_state='available' LIMIT 1").get(safe.hash) : undefined;
              const ref = existing ? String(existing.ref) : randomBytes(24).toString('hex');
              db.exec('BEGIN IMMEDIATE');
              try {
                if (!existing) db.prepare('INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES(?,?,?,?,?,?,?)')
                  .run(ref, safe.text, safe.hash, safe.originalBytes, safe.retainedBytes, safe.state, Number(safe.partial));
                db.prepare('UPDATE events SET execution_status=?,recording_status=\'committed\',payload_ref=? WHERE event_id=? AND invocation_id=?')
                  .run(outcome.status, ref, eventId, token.invocationId);
                store.commitRepository(db);
              } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
            });
            completed.add(token);
            return { recorded: true, eventId };
          });
        });
      } catch (error) {
        const message = gap('outcome_failed', error);
        // Best effort metadata only. Never bypass revoked authorization.
        try { executeLiveCapture(() => bounded(() => {
          store.repoDatabase(owner, repo).prepare("UPDATE events SET execution_status=?,recording_status='degraded' WHERE event_id=?").run(outcome.status, eventId);
        })); } catch { /* The durable pending intent will become unknown after restart. */ }
        return { recorded: false, gapRecorded: true, error: message };
      }
    },
    async recordInvocation(invocation) {
      return observer.completeOutcome(await observer.beginIntent(invocation), invocation);
    },
    async execute(request, action) {
      const token = await observer.beginIntent(request), start = Date.now();
      // Revocation stops observation, not an already executed tool's result/error.
      const finish = async (outcome: OutcomeData) => {
        try { await observer.completeOutcome(token, outcome); }
        catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith('FEATURE_GATE_LOCKED')) throw error;
          service.recordGap(owner, repo, 'authorization_revoked');
        }
      };
      let result: unknown;
      try { result = await action(); }
      catch (error) {
        await finish({ status: 'failed', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - start });
        throw error;
      }
      const failed = result !== null && typeof result === 'object' && ('isError' in result && result.isError === true || 'exitCode' in result && result.exitCode !== 0);
      await finish({ result, status: failed ? 'failed' : 'succeeded', durationMs: Date.now() - start });
      return result as Awaited<ReturnType<typeof action>>;
    }
  };
  return observer;
}
