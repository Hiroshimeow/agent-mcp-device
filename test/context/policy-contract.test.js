import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const policy = load('policy-v1');
assert.equal(policy.schema_version, 1);
// Explicit expected constants make accidental policy drift fail, not self-validate.
assert.deepEqual(policy.storage, {
  repo_stores_per_owner: 256, device_bytes: 8589934592, owner_bytes: 8589934592,
  repo_bytes: 2147483648, source_metadata_reserve_bytes: 134217728,
  event_payload_bytes: 4194304, blob_chunk_bytes: 1048576,
  modifying_jobs_per_repo: 1, jobs_per_owner: 4,
  metadata_ttl_ms: null, payload_ttl_ms: null, silent_eviction: false,
  device_quota_includes_sealed: true, cleanup_required_before_live_capture: true
});
assert.deepEqual(policy.sqlite, {
  journal_mode: 'WAL', synchronous: 'NORMAL', power_loss_durability: false,
  intent_busy_ms: 5, outcome_busy_ms: 10, maintenance_acquire_ms: 100,
  write_batch_target_ms: 5, write_batch_max_ms: 50, yield: 'setImmediate',
  online_heavy_db_work_on_gateway_event_loop: false
});
const expectedBounds = {
  search: { hits: [8, 50], response_bytes: [32768, 131072] },
  read: { refs: [8, 20], response_bytes: [262144, 1048576] },
  cursor: { lifetime_ms: [600000, 1800000] },
  graph: { hops: [2, 4], returned_nodes: [50, 200], examined_edges: [500, 2000], visited_nodes: [200, 1000], response_bytes: [65536, 131072], wall_ms: [25, 100] },
  maintenance: { offline_ms: [2000, 10000] }
};
assert.deepEqual(policy.bounds, expectedBounds);
for (const dimensions of Object.values(policy.bounds)) {
  for (const [defaultValue, hardMaximum] of Object.values(dimensions)) {
    assert.ok(Number.isSafeInteger(defaultValue) && defaultValue > 0 && defaultValue <= hardMaximum);
  }
}
assert.deepEqual(policy.retrieval, { exact_top3: 1, history_recall_at8_min: 0.9, unauthorized_hits: 0 });
assert.equal(policy.schema_token_max, 10000);
assert.equal(policy.capture.failure_policy, 'fail_open');
assert.equal(policy.capture.gap_counter_fallback, 'in_memory');
assert.equal(policy.capture.late_outcome_recording_status, 'degraded');
assert.deepEqual(policy.cursor_visibility, ['first_indexed_generation <= G', 'last_indexed_generation <= G']);
assert.equal(policy.import_redaction, 'redact.ts_before_persistence');
assert.deepEqual(policy.hmac, { location: 'device_state_root', access: 'os_user_only', shared_cli_mcp: true, rotate_on_repair: false });

const contract = load('context-tool-contract');
assert.equal(contract.register_public_tools, false);
assert.deepEqual(contract.tools.map(tool => tool.name), ['local_status', 'local_search', 'local_read', 'local_graph', 'local_index', 'local_wiki']);
for (const tool of contract.tools) {
  assert.equal(tool.annotations.readOnlyHint, tool.name !== 'local_index');
  assert.equal(tool.annotations.openWorldHint, false);
  assert.equal(tool.annotations.destructiveHint, false);
  assert.equal(tool.provider_calls, 0);
  assert.equal(tool.inputSchema.additionalProperties, false);
}
assert.deepEqual(contract.tools.find(tool => tool.name === 'local_index').actions, ['sync', 'checkpoint', 'rebuild', 'cancel']);
const wiki = contract.tools.find(tool => tool.name === 'local_wiki');
assert.deepEqual(wiki.inputSchema, { type: 'object', properties: { action: { type: 'string', enum: ['status'] } }, required: ['action'], additionalProperties: false });
assert.equal(wiki.result.code, 'WIKI_DISABLED');
assert.equal(wiki.result.enabled, false);
const baseline = load('tool-manifest-baseline');
for (const catalog of [baseline.device, baseline.gateway.local_catalog]) {
  assert.equal(catalog.tool_count, catalog.tools.length);
  assert.equal(catalog.schema_bytes, Buffer.byteLength(JSON.stringify({ tools: catalog.tools }), 'utf8'));
  assert.equal(catalog.estimated_tokens, Math.ceil(catalog.schema_bytes / 4));
}
assert.ok(!baseline.device.tools.some(tool => tool.name.startsWith('local_')));
// This phase reserves names, not runtime handlers: zero-provider runtime tests belong to T050.
const proposedTools = contract.tools.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations }));
const addedBytes = Buffer.byteLength(JSON.stringify(proposedTools), 'utf8');
const proposedWholeBytes = baseline.gateway.observed_live_catalog.schema_bytes + addedBytes;
assert.ok(Math.ceil(proposedWholeBytes / 4) <= policy.schema_token_max, 'Observed gateway catalog plus six proposed tools exceeds 10,000 tokens');
console.log('PASS: frozen policy bounds, six-tool contract, baseline byte accounting and proposed local catalog budget');
