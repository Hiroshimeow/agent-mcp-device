import { ContextStore } from '../../../dist/context/store.js';
const [root, owner, repo] = process.argv.slice(2);
const store = new ContextStore(root);
const db = store.repoDatabase(owner, repo);
db.exec('BEGIN IMMEDIATE');
db.prepare("INSERT INTO evidence(ref,text,hash,original_bytes,retained_bytes,redaction_state,partial) VALUES('partial','UNCOMMITTED','hash',11,11,'retained',0)").run();
db.prepare("INSERT INTO events(invocation_id,accepted_at,payload_ref) VALUES('crash',0,'partial')").run();
process.send('written');
setInterval(() => {}, 1000);
