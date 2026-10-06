import { join } from 'node:path';
import fs from 'node:fs';
import crypto, { generateKeyPairSync, sign } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ContextStore } from '../../../dist/context/store.js';
import { ContextService } from '../../../dist/context/service.js';
import { createCanonicalObserver } from '../../../dist/context/capture.js';
import { temporary } from '../helpers.js';

// Same throwaway approval/key and installed-config redirection as review-blockers.
export function approvalFixture(t, features = ['FEATURE_LIVE_CAPTURE']) {
  let store;
  const root = temporary({ after: cleanup => t.after(() => { try { store?.close(); } finally { cleanup(); } }) });
  const directory = join(root, 'config');
  fs.mkdirSync(directory);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const originalKey = crypto.createPublicKey;
  const originals = { statSync: fs.statSync, readFileSync: fs.readFileSync };
  const installed = fileURLToPath(new URL('../../../config/', import.meta.url));
  crypto.createPublicKey = () => publicKey;
  for (const name of Object.keys(originals)) fs[name] = (path, ...args) => originals[name](
    typeof path === 'string' && path.startsWith(installed) ? join(directory, path.slice(installed.length)) : path, ...args);
  syncBuiltinESMExports();
  t.after(() => { crypto.createPublicKey = originalKey; Object.assign(fs, originals); syncBuiltinESMExports(); });
  const payload = { expires_at: Date.now() + 300000, features, schema_version: 1 };
  const artifact = { ...payload, signature: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64') };
  const path = join(directory, 'soc-approval.json');
  fs.writeFileSync(path, JSON.stringify(artifact));
  fs.writeFileSync(join(directory, 'revoked-approvals.json'), '[]');
  store = new ContextStore(root);
  const owner = store.activateOwner('capture-owner'), repo = store.repository(owner, 'capture-repo');
  const service = new ContextService(store, { FEATURE_LIVE_CAPTURE: features.includes('FEATURE_LIVE_CAPTURE') });
  const observer = createCanonicalObserver(service, store, owner, repo);
  return { root, owner, repo, service, observer, path, get store() { return store; }, close() { store?.close(); store = undefined; }, restart() {
    store.close(); store = new ContextStore(root); return store;
  } };
}
