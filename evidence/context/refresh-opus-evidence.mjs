import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const files = [
  'src/context/search.ts',
  'src/context/store.ts',
  'src/context/redact.ts',
  'src/context/importer.ts',
  'src/context/text.ts',
  'src/context/migrations/index.ts',
  'src/context/indexer.ts',
  'test/context/retrieval.test.js',
  'test/context/store.test.js',
  'test/context/redaction.test.js',
  'test/context/helpers.js',
  'evidence/context/decisions.md',
];
let report = `# Checkpoint 1 — adversarial blocker remediation evidence\n\nSelf-contained full source and regression tests for feature 002-device-local-context. No excerpts, omitted function bodies, or abbreviated tests are used below.\n\n## Verification\n\n- \`npm run build\`: exit 0. Full output: \`evidence/context/blockers-build.log\`.\n- \`node --test test/context/*.test.js\`: exit 0; **39 tests, 39 passed, 0 failed, 0 skipped**. Full TAP output is included below.\n- Runtime: Node ${process.versions.node}; SQLite ${process.versions.sqlite}; ${process.platform}/${process.arch}. Linux/Node-floor runs are not claimed.\n- The explicit H2 read-cursor MAC assertion and M1 concurrent-opener regression failed before these fixes and passed afterward. H1 clock-skew exclusion and H3 token-body checks passed against the existing generation/redaction boundaries. The concurrent-opener test deterministically forces the racing interleaving with two real SQLite handles; it does not claim multi-process stress coverage.\n\n## Blocker mapping\n\n- H1: search uses deterministic keysets (exact bucket, timestamp descending, ref ascending), never BM25 rank or OFFSET. Tests prove different BM25 scores change at G+1 yet every pinned G ref is retrieved exactly once. An additional exact-bucket test protects frozen top-3 usefulness. The clock-skew test inserts a G+1 event older than the cursor timestamp, verifies current search sees it, and verifies the complete pinned G traversal excludes it. The WHERE clause enforces first_indexed_generation <= G and deleted_generation IS NULL OR deleted_generation > G before keyset selection.\n- H2: both cursor MAC inputs are JSON arrays. Read cursors explicitly bind generation, query key and expiry alongside kind, scope, sealed=false and body. Wrong decoded signature length is rejected before JSON parsing; bounded metadata is decoded only to recompute the MAC and no state is returned before authentication. Tests assert the exact MAC, metadata tampering rejection, owner/repo scope, colon-scope collisions, both kind-confusion directions, and replay rejection against different search queries/read refs within the same repo.\n- H3: the canary token body canarysecret1234567890abcdef yields zero FTS MATCH hits and no matching fts5vocab terms. Lowercase raw-file scans assert zero token-body occurrences across main DB, active WAL and SHM (presence of all three is asserted); all five FTS shadow tables are also scanned for raw canaries. Redacted-byte content hashes are asserted directly.\n- M1: migration re-reads user_version immediately after BEGIN IMMEDIATE, rejects future versions, and commits a no-op if a competing opener already installed v3. A deterministic two-handle race test verifies no duplicate column, integrity and write-lock release. Existing tests exercise pre-commit exception rollback, actual child-process termination/recovery, idempotent reruns, stored-content FTS5, folded matching and original-diacritic snippets.\n- Full updated decisions appear verbatim below. Live capture, quota/cleanup, merge and release remain outside this correction scope; reviewer approval is not asserted.\n\n## Exact file contents\n\n`;
for (const path of files) {
  const content = readFileSync(new URL(path, root), 'utf8');
  const hash = createHash('sha256').update(content).digest('hex');
  const language = path.endsWith('.ts') ? 'typescript' : path.endsWith('.js') ? 'javascript' : 'markdown';
  report += `### ${path}\n\nSHA-256 (UTF-8): \`${hash}\`\n\n~~~~${language}\n${content}${content.endsWith('\n') ? '' : '\n'}~~~~\n\n`;
}
report += `## Complete final context test output\n\n~~~~text\n${readFileSync(new URL('evidence/context/blockers-tests.log', root), 'utf8')}~~~~\n`;
writeFileSync(new URL('checkpoint1-opus-evidence.md', import.meta.url), report);
console.log(`Wrote complete evidence for ${files.length} files (${Buffer.byteLength(report)} bytes).`);
