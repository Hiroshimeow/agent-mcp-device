import { createHash } from 'node:crypto';
import { ContextStore } from './store.js';
import { fold, utf8Prefix } from './text.js';
import { queryActivityGraph } from './graph.js';

export interface SearchOptions { query: string; limit?: number; max_bytes?: number; cursor?: string; source_types?: string[]; since?: number; until?: number; include_related?: boolean }
export interface ReadOptions { refs: string[]; max_bytes?: number; cursor?: string; ranges?: { ref: string; start: number; end?: number }[] }
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function budget(value: number | undefined, fallback: number, ceiling: number) {
  const cap = value ?? fallback;
  if (!Number.isInteger(cap) || cap < 1 || cap > ceiling) throw new Error('BUDGET_EXCEEDED');
  return cap;
}
function envelope(store: ContextStore, owner: string, repo: string) {
  const manifest = store.inspectManifest(owner, repo);
  const reasons = manifest.unknown_events ? ['unknown_after_restart'] : [];
  return { schema_version: 1, ok: true, scope: { repository_ref: repo },
    index: { generation: manifest.generation, indexed_through_event: manifest.indexed_through_event,
      pending_events: manifest.pending_events, freshness: manifest.generation === null ? 'missing' : manifest.pending_events ? 'stale' : 'current' },
    coverage: { complete: !reasons.length, reasons }, items: [] as Record<string, unknown>[],
    partial: false, next_cursor: null as string | null, warnings: [] as string[] };
}
function continuation(store: ContextStore, owner: string, repo: string, key: string, generation: number | null, cursor?: string, pinned = false) {
  // First-page keyset sentinel is the all-null tuple (last_match,
  // last_timestamp, last_ref), not bucket 0 / MAX_SAFE_INTEGER / ''. The
  // Outer WHERE (? IS NULL OR ...) guard bypasses the keyset predicate entirely,
  // including rows at timestamp bounds. Continuations carry the last row tuple.
  if (!cursor) return { generation, position: 0, offset: 0, last_match: null as number | null, last_timestamp: null as number | null, last_ref: null as string | null, expires_at: Date.now() + 600000 };
  const state = store.parseReadCursor(owner, repo, cursor);
  if (state.key !== key || !Number.isSafeInteger(state.position) || Number(state.position) < 0 ||
      !Number.isSafeInteger(state.offset) || Number(state.offset) < 0) throw new Error('CURSOR_INVALID');
  const validGeneration = pinned
    ? Number.isSafeInteger(state.generation) && Number(state.generation) >= 1 && generation !== null && Number(state.generation) <= generation
    : state.generation === generation;
  if (typeof state.expires_at !== 'number' || state.expires_at <= Date.now() || !validGeneration) throw new Error('CURSOR_STALE');
  if (pinned && !(state.last_match === null && state.last_timestamp === null && state.last_ref === null) &&
      (![0, 1].includes(Number(state.last_match)) || typeof state.last_match !== 'number' || !Number.isSafeInteger(state.last_timestamp) || typeof state.last_ref !== 'string' || !/^[a-f0-9]{48}$/.test(state.last_ref))) throw new Error('CURSOR_INVALID');
  return { generation: state.generation as number | null, position: Number(state.position), offset: Number(state.offset),
    last_match: state.last_match as number | null, last_timestamp: state.last_timestamp as number | null,
    last_ref: state.last_ref as string | null, expires_at: state.expires_at };
}

export function search(store: ContextStore, owner: string, repo: string, input: SearchOptions) {
  store.authorize(owner, repo);
  const query = input.query?.trim().normalize('NFC');
  if (!query || Buffer.byteLength(query) > 4096) throw new Error('BUDGET_EXCEEDED');
  const limit = budget(input.limit, 8, 50), cap = budget(input.max_bytes, 65536, 131072);
  const sources = input.source_types ?? ['history', 'checkpoint', 'activity'];
  if (!Array.isArray(sources) || !sources.length || sources.some(s => !['history', 'checkpoint', 'activity'].includes(s))) throw new Error('ACTION_UNSUPPORTED');
  for (const time of [input.since, input.until]) if (time !== undefined && !Number.isSafeInteger(time)) throw new Error('BUDGET_EXCEEDED');
  const result = envelope(store, owner, repo);
  let generation = result.index.generation;
  if (generation === null) throw new Error('INDEX_MISSING');
  if (input.include_related !== undefined && typeof input.include_related !== 'boolean') throw new Error('ACTION_UNSUPPORTED');
  const key = digest(['search', query, limit, sources, input.since, input.until, input.include_related]);
  const state = continuation(store, owner, repo, key, generation, input.cursor, true);
  generation = state.generation!;
  result.index.generation = generation;
  const token = (row?: Record<string, unknown>) => store.signReadCursor(owner, repo,
    { key, generation, position: 0, offset: 0, last_match: row?.score ?? state.last_match,
      last_timestamp: row?.timestamp ?? state.last_timestamp,
      last_ref: row?.ref ?? state.last_ref, expires_at: state.expires_at });
  // Quote individual Unicode tokens; no user FTS operators or SQL are accepted.
  const terms = fold(query).match(/[\p{L}\p{N}_]+/gu)?.slice(0, 64) ?? [];
  const fts = terms.map(term => `"${term.replace(/"/g, '""')}"`).join(' OR ');
  const ftsClause = terms.length ? 'UNION ALL SELECT ref,1 AS score FROM evidence_fts WHERE evidence_fts MATCH ?' : '';
  return store.withReadDatabase(owner, repo, db => {
    // Search ranks by discrete relevance buckets: 0 = exact substring, 1 = FTS
    // token match, then timestamp DESC and ref ASC as stable tie-breakers.
    // This deterministic ordering completely insulates keyset pagination from
    // dynamic BM25 score shifts as corpus statistics change across generations.
    // Current retention availability overrides pinned generation membership:
    // purged evidence is never returned.
    // Group each document before applying the keyset: filtering match rows first
    // could resurrect an exact match as an FTS-only match on the next page.
    // Bind order: substring, optional FTS, generation twice, each source, time
    // bounds, then exactly seven keyset arguments in this SQL placeholder order:
    // [last_match, last_match, last_match, last_timestamp,
    //  last_match, last_timestamp, last_ref], followed by limit.
    // All seven keyset arguments are null on the first page.
    // Total placeholders = 13 + sources.length + (terms.length ? 1 : 0).
    const rows = db.prepare(`WITH matches AS (
      SELECT ref,0 AS score FROM evidence WHERE instr(lower(text),lower(?))>0
      ${ftsClause}
    ), ranked AS (
      SELECT d.ref,d.source_kind,d.timestamp,p.text,p.partial,p.redaction_state,min(m.score) AS score
      FROM matches m JOIN search_documents d ON d.ref=m.ref JOIN evidence p ON p.ref=d.ref
      WHERE d.first_indexed_generation<=? AND (d.deleted_generation IS NULL OR d.deleted_generation>?) AND p.retention_state='available'
      AND d.source_kind IN (${sources.map(() => '?').join(',')}) AND d.timestamp>=? AND d.timestamp<=?
      GROUP BY d.ref
    ) SELECT * FROM ranked
      WHERE (? IS NULL OR score>? OR (score=? AND timestamp<?) OR (score=? AND timestamp=? AND ref>?))
      ORDER BY score ASC,timestamp DESC,ref ASC LIMIT ?`)
      .all(query, ...(terms.length ? [fts] : []), generation, generation, ...sources, input.since ?? 0, input.until ?? Number.MAX_SAFE_INTEGER,
        state.last_match, state.last_match, state.last_match, state.last_timestamp,
        state.last_match, state.last_timestamp, state.last_ref, limit + 1);
    let count = 0;
    for (const row of rows.slice(0, limit)) {
      const item = { ref: row.ref, source_kind: row.source_kind, evidence_class: row.source_kind === 'checkpoint' ? 'reported' : 'observed', timestamp: row.timestamp,
        label: 'Retained evidence', snippet: utf8Prefix(String(row.text), 512), match_reason: Number(row.score) === 0 ? 'exact' : 'fts',
        redaction_state: row.redaction_state, truncated: Boolean(row.partial) || Buffer.byteLength(String(row.text)) > 512 };
      const related = input.include_related ? queryActivityGraph(store, owner, repo, {
        refs: [String(row.ref)], action: 'related', generation, max_nodes: 20, max_edges: 50, max_visited: 20, wall_ms: 10,
      }) : undefined;
      result.items.push(related ? { ...item, related_refs: [...new Set(related.nodes.filter(n => n.kind === 'event' && n.evidence_ref !== row.ref).map(n => n.evidence_ref))],
        related_partial: related.partial, related_examined_edges: related.examined_edges } : item); count++;
      result.partial = rows.length > count; result.next_cursor = result.partial ? token(rows[count - 1]) : null;
      if (bytes(result) > cap) {
        result.items.pop(); count--; result.partial = true; result.next_cursor = token(rows[count - 1]); break;
      }
    }
    if (bytes(result) > cap || (rows.length && count === 0)) throw new Error('BUDGET_EXCEEDED');
    if (result.partial) result.warnings = ['response_budget_or_limit'];
    if (bytes(result) > cap) throw new Error('BUDGET_EXCEEDED');
    return result;
  });
}

export function readEvidence(store: ContextStore, owner: string, repo: string, input: ReadOptions) {
  store.authorize(owner, repo);
  if (!Array.isArray(input.refs) || input.refs.length < 1 || input.refs.length > 20 || input.refs.some(ref => typeof ref !== 'string' || ref.length > 128)) throw new Error('BUDGET_EXCEEDED');
  const cap = budget(input.max_bytes, 262144, 1048576), result = envelope(store, owner, repo);
  const ranges = input.ranges ?? [];
  if (!Array.isArray(ranges) || ranges.length > 20 || new Set(ranges.map(range => range.ref)).size !== ranges.length || ranges.some(range => !input.refs.includes(range.ref) || !Number.isSafeInteger(range.start) || range.start < 0 || (range.end !== undefined && (!Number.isSafeInteger(range.end) || range.end < range.start)))) throw new Error('ACTION_UNSUPPORTED');
  const key = digest(ranges.length ? ['read', input.refs, ranges] : ['read', input.refs]);
  const state = continuation(store, owner, repo, key, result.index.generation, input.cursor);
  const token = (position: number, offset: number) => store.signReadCursor(owner, repo,
    { key, generation: result.index.generation, position, offset, expires_at: state.expires_at });
  return store.withReadDatabase(owner, repo, db => {
    for (let i = state.position; i < input.refs.length; i++) {
      const ref = input.refs[i], row = db.prepare('SELECT * FROM evidence WHERE ref=?').get(ref);
      const range = ranges.find(range => range.ref === ref);
      const start = i === state.position && state.offset > 0 ? state.offset : range?.start ?? 0;
      const error = !row ? 'REF_NOT_FOUND' : ['expired', 'purged'].includes(String(row.retention_state)) ? 'EVIDENCE_EXPIRED' : null;
      if (error) {
        result.items.push({ ref, error }); result.partial = i + 1 < input.refs.length; result.next_cursor = result.partial ? token(i + 1, 0) : null;
        if (bytes(result) > cap) { result.items.pop(); result.partial = true; result.next_cursor = token(i, 0); break; }
        continue;
      }
      const text = String(row!.text), total = Buffer.byteLength(text);
      const endLimit = Math.min(range?.end ?? total, total);
      const buffer = Buffer.from(text);
      const boundary = (offset: number) => offset === total || (buffer[offset] & 0xc0) !== 0x80;
      if (start > total || start > endLimit || !boundary(start) || !boundary(endLimit)) throw new Error(range ? 'ACTION_UNSUPPORTED' : 'CURSOR_INVALID');
      const remaining = buffer.subarray(start, endLimit).toString('utf8');
      const isCheckpoint = Boolean(db.prepare("SELECT 1 FROM activity_nodes WHERE kind='checkpoint' AND evidence_ref=?").get(ref));
      const item: Record<string, unknown> = { ref, source_kind: isCheckpoint ? 'checkpoint' : 'history', evidence_class: isCheckpoint ? 'reported' : 'observed', content: '', hash: row!.hash,
        captured_range: { start, end: start }, total_bytes: total, redaction_state: row!.redaction_state,
        retention_state: row!.partial ? 'partial' : row!.retention_state, truncated: Boolean(row!.partial) };
      result.items.push(item);
      const fit = (length: number) => {
        const content = utf8Prefix(remaining, length), end = start + Buffer.byteLength(content);
        item.content = content; item.captured_range = { start, end }; item.truncated = Boolean(row!.partial) || start > 0 || end < total;
        result.partial = end < endLimit || i + 1 < input.refs.length;
        result.next_cursor = null;
        if (end < endLimit) result.next_cursor = token(i, end);
        else if (i + 1 < input.refs.length) result.next_cursor = token(i + 1, 0);
        return bytes(result) <= cap;
      };
      let low = 0, high = Buffer.byteLength(remaining);
      while (low < high) { const mid = Math.ceil((low + high) / 2); if (fit(mid)) low = mid; else high = mid - 1; }
      const fits = fit(low);
      if (!fits || (endLimit > start && !String(item.content).length)) {
        result.items.pop(); result.partial = true; result.next_cursor = token(i, start); break;
      }
      if (start + Buffer.byteLength(String(item.content)) < endLimit) break;
    }
    if (bytes(result) > cap || !result.items.length) throw new Error('BUDGET_EXCEEDED');
    return result;
  });
}
