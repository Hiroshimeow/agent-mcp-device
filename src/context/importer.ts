import { readFileSync, statSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { ContextStore } from './store.js';

/** Explicit trusted-local import. Missing scope is never inferred from the active pairing. */
export function importLegacy(store: ContextStore, sourceFile: string) {
  if (statSync(sourceFile).size > 64 * 1024 * 1024) throw new Error('BUDGET_EXCEEDED');
  const result = { imported: 0, duplicates: 0, malformed: 0, quarantined: 0 };
  const quarantine = (line: string, reason: string) => {
    const fingerprint = createHash('sha256').update(reason).update(store.redactPayload(line).text).digest('hex');
    store.registry.prepare('INSERT OR IGNORE INTO import_quarantine VALUES(?,?,?)').run(fingerprint, reason, Date.now());
  };
  for (const line of readFileSync(sourceFile, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { result.malformed++; quarantine(line, 'malformed'); continue; }
    if (!event || typeof event !== 'object' || Array.isArray(event) ||
        (typeof event.text !== 'string' && !(typeof event.toolName === 'string' && typeof event.timestamp === 'string' && event.output !== undefined))) {
      result.malformed++; quarantine(line, 'malformed'); continue;
    }
    const owner = event.owner_key, repo = event.repo_uuid;
    if (typeof owner !== 'string' || typeof repo !== 'string' || owner !== store.activeOwner() ||
        !store.registry.prepare('SELECT 1 FROM repositories WHERE owner_key=? AND repo_uuid=?').get(owner, repo)) {
      result.quarantined++; quarantine(line, 'unknown_scope'); continue;
    }
    const payload = typeof event.text === 'string' ? event.text : JSON.stringify({ toolName: event.toolName, arguments: event.arguments, output: event.output });
    const path = typeof event.path === 'string' ? event.path : event.arguments?.path;
    const safe = store.redactPayload(payload, { path: typeof path === 'string' ? path : undefined });
    // Deduplication hashes retained redacted text only, never the raw secret-bearing payload.
    const id = typeof event.id === 'string' || typeof event.id === 'number' ? store.redactPayload(String(event.id)).hash : safe.hash;
    const db = store.repoDatabase(owner, repo);
    store.quotaWrite(owner, repo, safe.retainedBytes * 4 + 65536, () => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = db.prepare('SELECT evidence_ref FROM legacy_imports WHERE legacy_id=? OR content_hash=? LIMIT 1').get(id, safe.hash);
      if (existing) {
        db.prepare('INSERT OR IGNORE INTO legacy_imports VALUES(?,?,?)').run(id, safe.hash, existing.evidence_ref);
        result.duplicates++;
      } else {
        const ref = randomBytes(24).toString('hex');
        db.prepare('INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES(?,?,?,?,?,?,?)')
          .run(ref, safe.text, safe.hash, safe.originalBytes, safe.retainedBytes, safe.state, Number(safe.partial));
        db.prepare('INSERT INTO events(invocation_id,accepted_at,payload_ref) VALUES(?,?,?)')
          .run(`legacy:${id}`, Number.isSafeInteger(event.accepted_at) ? event.accepted_at : Date.now(), ref);
        db.prepare('INSERT INTO legacy_imports VALUES(?,?,?)').run(id, safe.hash, ref);
        result.imported++;
      }
      store.commitRepository(db);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    });
  }
  return result;
}
