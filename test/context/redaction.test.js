import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importLegacy } from '../../dist/context/importer.js';
import { sync } from '../../dist/context/indexer.js';
import { redact } from '../../dist/context/redact.js';
import { ContextStore } from '../../dist/context/store.js';
import { utf8Prefix } from '../../dist/context/text.js';
import { temporary } from './helpers.js';
const canaries = ['sk-canarysecret1234567890abcdef', 'bearer-canary-987654321', 'password-canary-1234', 'PRIVATECANARY'];
const input = `api_key=${canaries[0]}\nAuthorization: Bearer ${canaries[1]}\npassword="${canaries[2]}"\n-----BEGIN RSA PRIVATE KEY-----\n${canaries[3]}\n-----END RSA PRIVATE KEY-----\nretained sentence; safe payload`;
test('secrets are replaced before SQLite, WAL and FTS persistence; hash is retained bytes', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const safe = store.redactPayload(input);
  for (const secret of canaries) assert.ok(!safe.text.includes(secret));
  for (const cls of ['api_key', 'bearer', 'password', 'private_key']) assert.match(safe.text, new RegExp(`\\[REDACTED:${cls}:[a-f0-9]{16}\\]`));
  assert.equal(safe.hash, createHash('sha256').update(safe.text).digest('hex'));
  const owner = store.activateOwner('trusted-pairing'), repo = store.repository(owner, 'identity');
  const ref = store.append(owner, repo, input);
  const stored = store.read(owner, repo, ref);
  assert.equal(stored.text, safe.text);
  assert.ok(stored.text.includes('[REDACTED:api_key:'));
  assert.ok(stored.text.includes('safe payload'));
  for (const secret of canaries) assert.ok(!stored.text.includes(secret));
  const db = store.repoDatabase(owner, repo);
  const row = db.prepare('SELECT hash FROM evidence WHERE ref=?').get(ref);
  assert.equal(stored.hash, row.hash);
  assert.equal(row.hash, createHash('sha256').update(stored.text).digest('hex'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence_fts').get().n, 0); // capture never silently syncs
  sync(store, owner, repo);
  assert.equal(db.prepare("SELECT count(*) AS n FROM evidence_fts WHERE evidence_fts MATCH 'retained'").get().n, 1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM evidence_fts WHERE evidence_fts MATCH 'payload'").get().n, 1);
  const tokenBody = 'canarysecret1234567890abcdef';
  assert.equal(db.prepare('SELECT count(*) AS n FROM evidence_fts WHERE evidence_fts MATCH ?').get(tokenBody).n, 0);
  db.exec("CREATE VIRTUAL TABLE temp.vocab USING fts5vocab(main, evidence_fts, 'row')");
  assert.equal(db.prepare("SELECT count(*) AS n FROM temp.vocab WHERE term='payload'").get().n, 1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM temp.vocab WHERE term LIKE '%canarysecret%'").get().n, 0);
  const shadows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'evidence_fts_*'").all();
  assert.deepEqual(shadows.map(row => row.name).sort(), [
    'evidence_fts_data', 'evidence_fts_idx', 'evidence_fts_content', 'evidence_fts_docsize', 'evidence_fts_config',
  ].sort());
  const files = store.databaseFiles();
  assert.ok(files.some(file => file.endsWith('repo.sqlite')), 'main DB is scanned');
  assert.ok(files.some(file => file.endsWith('repo.sqlite-wal')), 'live WAL is scanned');
  assert.ok(files.some(file => file.endsWith('repo.sqlite-shm')), 'live SHM is scanned');
  for (const { name } of shadows) {
    for (const row of db.prepare(`SELECT * FROM "${name}"`).all()) {
      for (const value of Object.values(row)) {
        const bytes = ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(String(value));
        for (const secret of canaries) assert.ok(!bytes.includes(Buffer.from(secret)), `${name} contains raw canary`);
      }
    }
  }
  for (const file of store.databaseFiles()) {
    const bytes = readFileSync(file);
    assert.equal(bytes.toString('latin1').toLowerCase().split(tokenBody).length - 1, 0, `${file} contains token body`);
    for (const secret of canaries) assert.ok(!bytes.includes(Buffer.from(secret)), file);
  }
});
test('import deduplicates redacted content and indexes only redacted text', t => {
  let store; t.after(() => store?.close()); const root = temporary(t); store = new ContextStore(root);
  const owner = store.activateOwner('a'), repo = store.repository(owner, 'r');
  const text = 'imported password=IMPORT_SECRET_CANARY', safe = store.redactPayload(text), file = join(root, 'import.jsonl');
  writeFileSync(file, [1, 2].map(id => JSON.stringify({ id, owner_key: owner, repo_uuid: repo, text })).join('\n'));
  assert.equal(importLegacy(store, file).duplicates, 1);
  const db = store.repoDatabase(owner, repo);
  assert.equal(db.prepare('SELECT content_hash FROM legacy_imports').get().content_hash, safe.hash);
  assert.notEqual(safe.hash, createHash('sha256').update(text).digest('hex'));
  sync(store, owner, repo);
  assert.ok(!db.prepare('SELECT text FROM evidence_fts').get().text.includes('IMPORT_SECRET_CANARY'));
  for (const path of store.databaseFiles()) assert.ok(!readFileSync(path).includes(Buffer.from('IMPORT_SECRET_CANARY')));
});

test('secret markers use keyed tags, never offline-guessable plain hashes', () => {
  const secret = 'password=guessable', key = Buffer.alloc(32, 1), otherKey = Buffer.alloc(32, 2);
  const safe = redact(secret, { key });
  const redactionKey = createHmac('sha256', key).update('redaction_tagging_v1').digest();
  const cursorKey = createHmac('sha256', key).update('cursor_signing_v1').digest();
  assert.notDeepEqual(redactionKey, cursorKey);
  const tag = createHmac('sha256', redactionKey).update(secret).digest('hex').slice(0, 16);
  assert.equal(safe.text, `[REDACTED:password:${tag}]`);
  assert.notEqual(safe.text, redact(secret, { key: otherKey }).text);
  assert.equal(safe.hash, createHash('sha256').update(safe.text).digest('hex'));
  assert.ok(!safe.text.includes(createHash('sha256').update(secret).digest('hex').slice(0, 16)));
});

test('UTF-8 budgets handle zero, four-byte emoji boundaries and surrogate pairs', () => {
  assert.equal(utf8Prefix('😀x', 0), '');
  assert.equal(redact('😀x', { maxBytes: 0 }).text, '');
  for (const cap of [1, 2, 3]) assert.equal(utf8Prefix('😀x', cap), '');
  assert.equal(utf8Prefix('😀x', 4), '😀');
  for (const cap of [2, 3, 4]) assert.equal(utf8Prefix('a\uD83D\uDE00b', cap), 'a');
  assert.equal(utf8Prefix('a\uD83D\uDE00b', 5), 'a😀');
  assert.equal(redact('a😀b', { maxBytes: 4 }).text, 'a');
  assert.equal(redact('a😀b', { maxBytes: 5 }).text, 'a😀');
});

test('excluded paths, binary/base64, UTF-8 byte caps and boundary secrets', () => {
  for (const path of ['.env', '.env.production', '/home/me/.ssh/id_rsa', 'credentials.json', 'C:\\project\\.env']) assert.equal(redact(input, { path }).text, '');
  assert.equal(redact(Buffer.from([0, 1, 2, 255])).state, 'binary');
  assert.equal(redact(Buffer.from('canary').toString('base64').repeat(200)).state, 'binary');
  const limited = redact('語'.repeat(200), { maxBytes: 100 });
  assert.ok(Buffer.byteLength(limited.text) <= 100); assert.ok(!limited.text.includes('�')); assert.equal(limited.partial, true);
  assert.ok(!redact('x'.repeat(90) + ' password=boundary-canary', { maxBytes: 100 }).text.includes('boundary'));
  assert.throws(() => redact('a', { maxBytes: 4194305 }), /BUDGET_EXCEEDED/);
  const json = redact(JSON.stringify({ api_key: 'json-key-canary', password: 'json-password-canary', nested: { access_token: 'json-token-canary' } }));
  assert.ok(!json.text.includes('json-key-canary')); assert.ok(!json.text.includes('json-password-canary')); assert.ok(!json.text.includes('json-token-canary'));
  assert.equal(redact('word '.repeat(838880)).retainedBytes, 4194304);
});
