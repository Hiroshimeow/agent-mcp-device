import assert from 'node:assert/strict';
import { existsSync, realpathSync } from 'node:fs';
import { ContextStore } from '../../../dist/context/store.js';

const [root, owner, repo, release] = process.argv.slice(2);
// Private test harness only: no constructor option or runtime hook is exposed.
class InterleavingTestStore extends ContextStore {
  pauseAfterAdmission() {
    const exec = this.registry.exec.bind(this.registry);
    let paused = false;
    this.registry.exec = sql => {
      exec(sql);
      if (sql === 'COMMIT' && this.activeReservation && !paused) {
        paused = true;
        const db = this.repoDatabase(owner, repo);
        assert.equal(db.isTransaction, false);
        const file = db.prepare('PRAGMA database_list').all().find(row => row.name === 'main').file;
        process.send({ file: realpathSync(file), epoch: this.activeEpoch });
        const deadline = Date.now() + 15000;
        while (!existsSync(release)) {
          if (Date.now() > deadline) throw new Error('test overlap timeout');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        }
      }
    };
  }
}
const store = new InterleavingTestStore(root);
try {
  store.pauseAfterAdmission();
  assert.throws(() => store.append(owner, repo, 'must rollback'), /RESERVATION_FENCED_OFF/);
} finally { store.close(); }
process.disconnect();
