import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const scope = { device_id: z.string().min(1), cwd: z.string().optional(), project_id: z.string().optional() };
const strings = z.array(z.string());
const cap = (maximum: number, fallback: number) => z.number().int().min(1).max(maximum).default(fallback).optional();
export const CONTEXT_INPUTS = {
  local_status: z.object({ ...scope, check_current: z.boolean().optional(), job_id: z.string().optional() }).strict(),
  local_search: z.object({ ...scope, query: z.string().min(1), source_types: z.array(z.enum(['history', 'checkpoint', 'activity'])).optional(), since: z.string().optional(), until: z.string().optional(), limit: cap(50, 8), max_bytes: cap(131072, 32768), cursor: z.string().optional(), include_related: z.boolean().optional() }).strict(),
  local_read: z.object({ ...scope, refs: strings.min(1).max(20), max_bytes: cap(1048576, 262144), cursor: z.string().optional(), ranges: z.array(z.object({ ref: z.string(), start: z.number().int().min(0), end: z.number().int().min(0).optional() }).strict()).max(20).optional() }).strict(),
  local_graph: z.object({ ...scope, action: z.enum(['neighbors', 'path', 'timeline', 'related']), refs: strings, target: z.string().optional(), relations: strings.optional(), direction: z.enum(['in', 'out', 'both']).optional(), max_hops: cap(4, 2), max_nodes: cap(200, 50), max_edges: cap(2000, 500), max_bytes: cap(131072, 65536), wall_ms: cap(100, 25), cursor: z.string().optional() }).strict(),
  local_index: z.object({ ...scope, action: z.enum(['sync', 'checkpoint', 'rebuild', 'cancel']), budget_profile: z.string().optional(), idempotency_key: z.string().optional(), job_id: z.string().optional(), summary: z.string().optional(), evidence_refs: strings.optional() }).strict(),
  local_wiki: z.object({ action: z.enum(['status']) }).strict(),
} as const;
export type ContextToolName = keyof typeof CONTEXT_INPUTS;
export const CONTEXT_TOOL_NAMES = Object.keys(CONTEXT_INPUTS) as ContextToolName[];
const descriptions: Record<ContextToolName, string> = {
  local_status: 'Inspect bounded local context freshness, storage, capture gaps and jobs. No indexing.',
  local_search: 'Search retained history, checkpoints and activity in the published generation. No hidden sync.',
  local_read: 'Read retained evidence in ref order within aggregate byte bounds, never current source substitution.',
  local_graph: 'Query bounded activity/provenance relations, not source-code or causal similarity.',
  local_index: 'Explicit retained-event sync, checkpoint, derived rebuild or job cancel. No destructive administration.',
  local_wiki: 'Reserved disabled wiki status. No provider calls in feature 002.',
};
export function buildContextCatalog() {
  return CONTEXT_TOOL_NAMES.map(name => {
    const { $schema: _schema, ...inputSchema } = zodToJsonSchema(CONTEXT_INPUTS[name], { $refStrategy: 'none' });
    return { name, description: descriptions[name], inputSchema, annotations: {
      readOnlyHint: name !== 'local_index', idempotentHint: name !== 'local_index', destructiveHint: false, openWorldHint: false,
    }, risk_lane: name === 'local_index' ? 'write' as const : 'read' as const };
  });
}
export function validateContextInput(name: string, input: unknown): Record<string, any> {
  const schema = CONTEXT_INPUTS[name as ContextToolName];
  if (!schema || !schema.safeParse(input).success) throw new Error('ACTION_UNSUPPORTED');
  // Validation never materializes schema defaults: preserve CLI/domain defaults.
  return input as Record<string, any>;
}
export const WIKI_DISABLED = { ok: false, code: 'WIKI_DISABLED', enabled: false, implementation_feature: '003-manual-repo-wiki' } as const;
const SAFE_ERRORS = new Set(['DEVICE_UNSUPPORTED', 'DEVICE_OFFLINE', 'SCOPE_REQUIRED', 'SCOPE_AMBIGUOUS', 'ACCESS_DENIED', 'LOCAL_STATE_UNAVAILABLE', 'REPOSITORY_NOT_FOUND', 'INDEX_MISSING', 'INDEX_INCOMPATIBLE', 'REF_NOT_FOUND', 'EVIDENCE_EXPIRED', 'CURSOR_INVALID', 'CURSOR_STALE', 'BUSY', 'BUDGET_EXCEEDED', 'STORAGE_DEGRADED', 'ACTION_UNSUPPORTED', 'WIKI_DISABLED']);
export function contextError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const code = (error as { code?: string })?.code;
  const safe = SAFE_ERRORS.has(message) ? message : code && SAFE_ERRORS.has(code) ? code : ['EACCES', 'EPERM', 'EROFS', 'ENOTDIR', 'ENOENT'].includes(code ?? '') ? 'LOCAL_STATE_UNAVAILABLE' : 'INTERNAL_ERROR';
  return { ok: false as const, error: { code: safe } };
}
