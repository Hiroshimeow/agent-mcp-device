import { ContextStore } from '../../../dist/context/store.js';
const [root, owner, repo, mode] = process.argv.slice(2);
const store = new ContextStore(root);
const db = store.repoDatabase(owner, repo);
if (mode === 'lease-window') {
  const exec = store.registry.exec.bind(store.registry);
  let committed = false;
  store.registry.exec = sql => {
    if (sql === 'COMMIT' && committed) {
      process.send('lease-window');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
    }
    exec(sql);
  };
  store.quotaWrite(owner, repo, 100000, () => {
    db.prepare("INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES('lease-window','lease window','hash',12,12,'retained',0)").run();
    committed = true;
  });
} else if (mode === 'writer') {
  store.quotaWrite(owner, repo, 100000, () => {
    db.exec('BEGIN IMMEDIATE');
    const evidence = db.prepare('INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES(?,?,?,?,?,?,0)');
    const event = db.prepare('INSERT INTO events(invocation_id,accepted_at,payload_ref) VALUES(?,?,?)');
    for (let i = 0; i < 20; i++) {
      evidence.run(`writer-${i}`, 'writer', 'hash', 6, 6, 'retained');
      event.run(`writer-${i}`, Date.now(), `writer-${i}`);
    }
    process.send('locked');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    store.commitRepository(db);
  });
  store.close();
  process.disconnect();
} else if (mode === 'purge') {
  const exec = db.exec.bind(db);
  db.exec = sql => {
    exec(sql);
    if (sql === 'BEGIN IMMEDIATE') {
      process.send('purge-locked');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  };
  store.cleanup(owner, repo, { before: 1, localAdmin: true });
  store.close(); process.disconnect();
} else {
  store.quotaWrite(owner, repo, 100000, () => {
    db.exec('BEGIN IMMEDIATE');
    db.prepare("INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES('crash-committed','crash committed','hash',15,15,'retained',0)").run();
    db.prepare("INSERT INTO events(invocation_id,accepted_at,payload_ref) VALUES('crash-committed',0,'crash-committed')").run();
    store.commitRepository(db);
    process.send('committed-before-registry');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
  });
}
