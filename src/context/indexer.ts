import { createHash } from 'node:crypto';
import { ContextStore } from './store.js';
import { fold } from './text.js';
import { materializeActivity } from './graph.js';

/** Incremental materialization of committed evidence, never filesystem discovery. */
export function sync(store: ContextStore, owner: string, repo: string, options: { max_events?: number; rebuild?: boolean } = {}) {
  const cap = options.max_events ?? 1000;
  if (!Number.isInteger(cap) || cap < 1 || cap > 10000) throw new Error('BUDGET_EXCEEDED');
  const db = store.repoDatabase(owner, repo);
  const currentManifest = store.manifest(owner, repo);
  if (!options.rebuild && currentManifest.pending_events === 0 && currentManifest.generation !== null) return { ...currentManifest, indexed: 0 };
  const allocation = Number(db.prepare(`SELECT coalesce(sum(retained_bytes),0) AS n FROM
    (SELECT p.retained_bytes FROM events e LEFT JOIN evidence p ON p.ref=e.payload_ref
     WHERE e.event_id>? ORDER BY e.event_id LIMIT ?)`)
    .get(options.rebuild ? 0 : currentManifest.indexed_through_event, cap)?.n) * 4 + cap * 1024 + 65536;
  return store.quotaWrite(owner, repo, allocation, () => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = store.manifest(owner, repo);
    if (options.rebuild && Number(db.prepare('SELECT count(*) AS n FROM events').get()?.n) > cap) throw new Error('BUDGET_EXCEEDED');
    const events = db.prepare(`SELECT e.event_id,e.accepted_at,e.payload_ref,p.text,p.retention_state FROM events e
      LEFT JOIN evidence p ON p.ref=e.payload_ref WHERE e.event_id>? ORDER BY e.event_id LIMIT ?`).all(options.rebuild ? 0 : current.indexed_through_event, cap);
    if (!options.rebuild && !events.length && current.generation !== null) { store.commitRepository(db); return { ...current, indexed: 0 }; }
    const generation = Number(db.prepare("INSERT INTO generations(status,created_at) VALUES('shadow',?)").run(Date.now()).lastInsertRowid);
    db.exec('CREATE INDEX IF NOT EXISTS activity_source ON activity_edges(source,edge_id); CREATE INDEX IF NOT EXISTS activity_target ON activity_edges(target,edge_id);');
    if (options.rebuild) db.exec('DELETE FROM evidence_fts');
    for (const event of events) {
      if (event.payload_ref === null || event.text === null || event.retention_state !== 'available') continue;
      // A replay refreshes derived data but preserves original membership and tombstones.
      db.prepare(`INSERT INTO search_documents(ref,source_kind,timestamp,first_indexed_generation,last_indexed_generation)
        VALUES(?,?,?,?,?) ON CONFLICT(ref) DO UPDATE SET last_indexed_generation=excluded.last_indexed_generation`)
        .run(event.payload_ref, db.prepare("SELECT 1 FROM activity_nodes WHERE kind='checkpoint' AND evidence_ref=?").get(event.payload_ref) ? 'checkpoint' : 'history', event.accepted_at, generation, generation);
      db.prepare('DELETE FROM evidence_fts WHERE ref=?').run(event.payload_ref);
      materializeActivity(db, String(event.payload_ref), String(event.text));
      // FTS receives folded redacted content only; evidence retains display text.
      db.prepare('INSERT INTO evidence_fts(ref,text) VALUES(?,?)').run(event.payload_ref, fold(String(event.text)));
    }
    const through = events.length ? Number(events[events.length - 1].event_id) : current.indexed_through_event;
    const digest = createHash('sha256').update(`${current.manifest_hash ?? ''}:${generation}:${through}`).digest('hex');
    db.prepare("UPDATE generations SET status='published',indexed_through_event=?,manifest_hash=? WHERE generation_id=?").run(through, digest, generation);
    db.prepare('UPDATE manifest SET generation=? WHERE singleton=1').run(generation);
    store.commitRepository(db); return { ...store.manifest(owner, repo), indexed: events.length };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  });
}
