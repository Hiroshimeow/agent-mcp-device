import { parentPort, workerData } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../../../dist/context/migrations/index.js';

const db = new DatabaseSync(workerData.path);
// migrate must configure its own timeout, not rely on the caller/default.
db.exec('PRAGMA busy_timeout=1');
const signal = new Int32Array(workerData.signal), sql = [], versions = [];
const exec = db.exec.bind(db), prepare = db.prepare.bind(db);
// Instrument real SQLite operations, never simulate lock acquisition or migration.
db.prepare = text => {
  const statement = prepare(text);
  if (text !== 'PRAGMA user_version') return statement;
  return { get: () => { const row = statement.get(); versions.push(row.user_version); return row; } };
};
db.exec = text => {
  sql.push(text);
  if (text === 'BEGIN IMMEDIATE') { Atomics.store(signal, 0, 1); Atomics.notify(signal, 0); }
  return exec(text);
};
let error, canBegin;
try { migrate(db, 'repo'); } catch (caught) {
  error = caught.message;
  if (error === 'INDEX_INCOMPATIBLE') {
    // Probe this SAME connection immediately, before close or any other cleanup.
    canBegin = (() => {
      try { db.exec('BEGIN IMMEDIATE; COMMIT;'); return true; }
      catch { return false; }
    })();
  }
}
const result = { error, canBegin, sql, versions,
  busyTimeout: prepare('PRAGMA busy_timeout').get().timeout,
  changes: prepare('SELECT total_changes() AS n').get().n,
  schemaVersion: prepare('PRAGMA schema_version').get().schema_version };
// BEGIN would fail if migrate left a transaction dangling.
try { exec('BEGIN IMMEDIATE; ROLLBACK'); result.transactionReleased = true; }
catch (caught) { result.transactionError = caught.message; }
db.close();
Atomics.store(signal, 1, 1); Atomics.notify(signal, 1);
parentPort.postMessage(result);
