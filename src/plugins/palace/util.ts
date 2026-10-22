import { createHash } from 'node:crypto';
import type { KnowledgeCard, KnowledgePreview, KnowledgeScope } from './types.js';

export const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(k => (value as Record<string,unknown>)[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + canonical((value as Record<string,unknown>)[k])).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
export function cardHash(card: Omit<KnowledgeCard,'contentHash'> | KnowledgeCard): string {
  return hash(canonical({id:card.id,version:card.version,summary:card.summary,body:card.body,status:card.status,
    originDeviceId:card.originDeviceId,scope:card.scope,derivedFrom:[...card.derivedFrom].sort(),
    evidence:card.evidence.map(e => ({id:e.id,originDeviceId:e.originDeviceId,sourceId:e.sourceId,sourceRef:e.sourceRef,
      recordHash:e.recordHash,kind:e.kind})).sort((a,b) => a.id.localeCompare(b.id))}));
}
export function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw new Error('BUDGET_EXCEEDED');
  return Number(value);
}
export function text(value: unknown, max = 8192): string {
  if (typeof value !== 'string') return '';
  if (Buffer.byteLength(value,'utf8') > max) throw new Error('INPUT_TOO_LARGE');
  return value;
}
export function clip(value: string, maxBytes: number): string {
  const bytes=Buffer.from(value);let end=Math.min(bytes.length,maxBytes);
  while(end>0 && end<bytes.length && (bytes[end]&0xc0)===0x80) end--;
  return bytes.subarray(0,end).toString('utf8');
}
export function object(input: unknown): Record<string,unknown> {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_INPUT');
  return input as Record<string,unknown>;
}
export function scopeOf(input: unknown): KnowledgeScope {
  const x=object(input),projectId=text(x.projectId,512) || undefined;
  const visibility=x.visibility ?? (projectId?'project':'account');
  if (!['project','account','local'].includes(String(visibility))) throw new Error('INVALID_SCOPE');
  if (visibility==='project' && !projectId) throw new Error('PROJECT_REQUIRED');
  return {projectId,visibility:visibility as KnowledgeScope['visibility']};
}
export function preview(card: KnowledgeCard): KnowledgePreview {
  return {id:card.id,read_ref:card.id,version:card.version,contentHash:card.contentHash,summary:card.summary,status:card.status,
    originDeviceId:card.originDeviceId,servingDeviceId:card.servingDeviceId,scope:card.scope,evidenceCount:card.evidence.length,
    updatedAt:card.updatedAt,lastVerifiedAt:card.lastVerifiedAt};
}
export function assertLive(card: KnowledgeCard): void {
  if (['stale','superseded','withdrawn'].includes(card.status)) throw new Error('EVIDENCE_NOT_CURRENT');
}
export function abort(signal?: AbortSignal): void { if(signal?.aborted) throw new Error('ABORTED'); }
