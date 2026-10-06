import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContextStore } from '../../dist/context/store.js';
import * as importer from '../../dist/context/importer.js';
import { temporary } from './helpers.js';

test('JSONL import is source-preserving, redacted, idempotent and quarantines unresolved scope', t => {
  let store; t.after(() => store?.close()); const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('trusted'), repo = store.repository(owner, 'repo');
  const file = join(root, 'legacy.jsonl');
  const event = { id: 'event-1', owner_key: owner, repo_uuid: repo, text: 'diagnostic api_key=CANARY_IMPORT_SECRET' };
  const source = [JSON.stringify(event), '{broken', 'null', JSON.stringify({ ...event, id: 'event-2' }),
    JSON.stringify({ ...event, id: 'unknown-owner', owner_key: 'old-owner' }),
    JSON.stringify({ ...event, id: 'unknown-repo', repo_uuid: 'missing' }),
    JSON.stringify({ text: 'unattributed CANARY_UNSCOPED' }),
    JSON.stringify({ timestamp: '2025-01-01T00:00:00Z', toolName: 'read_file', arguments: { path: 'old.ts' }, output: { content: [] } })].join('\n');
  writeFileSync(file, source);
  assert.equal(typeof importer.importLegacy, 'function');
  const first = importer.importLegacy(store, file);
  assert.deepEqual(first, { imported: 1, duplicates: 1, malformed: 2, quarantined: 4 });
  const second = importer.importLegacy(store, file);
  assert.deepEqual(second, { imported: 0, duplicates: 2, malformed: 2, quarantined: 4 });
  assert.equal(readFileSync(file, 'utf8'), source);
  const db = store.repoDatabase(owner, repo);
  assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n, 1);
  assert.equal(db.prepare('SELECT text FROM evidence').get().text, store.redactPayload(event.text).text);
  assert.equal(db.prepare('SELECT content_hash FROM legacy_imports').get().content_hash, store.redactPayload(event.text).hash);
  assert.equal(store.registry.prepare('SELECT count(*) AS n FROM import_quarantine').get().n, 6);
  for (const path of store.databaseFiles()) assert.ok(!readFileSync(path).includes(Buffer.from('CANARY_IMPORT_SECRET')));
  assert.ok(!JSON.stringify(store.registry.prepare('SELECT * FROM import_quarantine').all()).includes('CANARY_UNSCOPED'));
});

test('legacy id wins over changed content, and excluded paths never persist payloads', t => {
  let store; t.after(() => store?.close()); const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('trusted'), repo = store.repository(owner, 'repo');
  const file = join(root, 'events.jsonl');
  writeFileSync(file, JSON.stringify({ id: 'one', owner_key: owner, repo_uuid: repo, text: 'original' }));
  importer.importLegacy(store, file);
  writeFileSync(file, [
    { id: 'one', owner_key: owner, repo_uuid: repo, text: 'changed' },
    { id: 'two', owner_key: owner, repo_uuid: repo, text: 'PRIVATE_ENV_CANARY', path: '.env' },
  ].map(JSON.stringify).join('\n'));
  assert.equal(importer.importLegacy(store, file).duplicates, 1);
  assert.deepEqual(store.repoDatabase(owner, repo).prepare('SELECT text FROM evidence ORDER BY rowid').all().map(r => r.text), ['original', '']);
});
