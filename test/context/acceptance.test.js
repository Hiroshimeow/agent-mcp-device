import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { ContextStore } from '../../dist/context/store.js';
import { ContextService } from '../../dist/context/service.js';
import { sync } from '../../dist/context/indexer.js';
import { temporary } from './helpers.js';

export function runCorpus(store) {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/retrieval.json', import.meta.url), 'utf8'));
  const sealed = store.activateOwner('previous'), sealedRepo = store.repository(sealed, 'sealed');
  for (const doc of corpus.sealed_owner_documents) store.append(sealed, sealedRepo, doc.text);
  sync(store, sealed, sealedRepo);
  const owner = store.activateOwner('active'), repo = store.repository(owner, 'active'), other = store.repository(owner, 'other');
  const identities = new Map();
  for (const doc of corpus.documents) identities.set(store.append(owner, repo, doc.text), doc.id);
  for (const doc of corpus.other_repo_documents) store.append(owner, other, doc.text);
  sync(store, owner, repo); sync(store, owner, other);
  const service = new ContextService(store);
  const outcomes = corpus.queries.map(query => {
    const response = service.search(owner, repo, { query: query.query, limit: 8 });
    const returned = response.items.map(item => identities.get(item.ref) ?? 'UNAUTHORIZED');
    return { ...query, returned, recall: query.expected.length ? query.expected.filter(id => returned.includes(id)).length / query.expected.length : Number(returned.length === 0) };
  });
  assert.throws(() => service.search(sealed, sealedRepo, { query: 'SEALED_OWNER_CANARY' }), /ACCESS_DENIED/);
  return { outcomes,
    exact_top3: outcomes.filter(q => q.kind === 'exact').filter(q => q.expected.every(id => q.returned.slice(0, 3).includes(id))).length / outcomes.filter(q => q.kind === 'exact').length,
    history_recall8: outcomes.filter(q => q.kind === 'history').reduce((sum, q) => sum + q.recall, 0) / outcomes.filter(q => q.kind === 'history').length,
    unauthorized_hits: outcomes.reduce((sum, q) => sum + q.returned.filter(id => id === 'UNAUTHORIZED').length, 0) };
}

test('frozen ground truth: exact top-3 100%, history Recall@8 >=90%, unauthorized hits zero', t => {
  let store; t.after(() => store?.close()); store = new ContextStore(temporary(t));
  const result = runCorpus(store);
  if (process.env.CONTEXT_RECORD_ACCEPTANCE === '1') {
    const report = `# US1 retrieval acceptance\n\nGenerated from the frozen corpus by \`node --test test/context/acceptance.test.js\` with \`CONTEXT_RECORD_ACCEPTANCE=1\`.\n\nRuntime: Node ${process.versions.node}; SQLite ${process.versions.sqlite}; ${process.platform}/${process.arch}.\n\nExact path/identifier top-3: ${result.exact_top3 * 100}%. History Recall@8: ${result.history_recall8.toFixed(4)}. Unauthorized hits: ${result.unauthorized_hits}.\n\nNegative queries include secret, cross-repository and sealed-owner canaries. Sealed-owner access explicitly returns ACCESS_DENIED.\n\n## Raw query outcomes\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\nNo provider, source-file scan, or source-code parser is used. Database/WAL bytes are unchanged by search/read; SQLite may update reader bookkeeping in SHM, which is not durable content.\n`;
    writeFileSync(new URL('../../evidence/context/us1-retrieval.md', import.meta.url), report);
  }
  assert.equal(result.exact_top3, 1); assert.ok(result.history_recall8 >= 0.90, JSON.stringify(result));
  assert.equal(result.unauthorized_hits, 0);
  for (const outcome of result.outcomes.filter(q => q.kind === 'negative')) assert.deepEqual(outcome.returned, [], outcome.query);
});
