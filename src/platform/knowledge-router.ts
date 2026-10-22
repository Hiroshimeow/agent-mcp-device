import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { CapabilityError } from './plugin-contract.js';
import type { KnowledgeCard, KnowledgePreview } from './knowledge-contract.js';

export interface KnowledgeDevice {
  deviceId: string;
  accountId: string;
  online: boolean;
  capabilities: string[];
  projects?: string[];
  lastSeenAt?: number;
  latencyMs?: number;
}
export interface KnowledgeTransport {
  devices(accountId: string): Promise<KnowledgeDevice[]>;
  call(accountId: string, deviceId: string, capability: string, input: unknown): Promise<unknown>;
}
export interface KnowledgeRequestContext { accountId: string; requesterDeviceId: string; sessionId: string; }
interface ReadReference { v: 1; account: string; provider: string; origin: string; id: string; version: number; project?: string; }
interface CacheEntry { card: KnowledgeCard; at: number; bytes: number; }
interface RevisionGuard { version: number; contentHash: string; status: KnowledgeCard['status']; at: number; blocked?: string; }
export function unwrapKnowledgeResult(value: any): any {
  if (value?.structuredContent !== undefined) return value.structuredContent;
  if (Array.isArray(value?.content)) {
    const text = value.content.find((item: any) => item.type === 'text')?.text;
    if (text) { try { return JSON.parse(text); } catch { /* domain result stays intact */ } }
  }
  return value;
}

/** Account-aware routing and lazy transfer live in the platform, not in a plugin. */
export class KnowledgeRouter {
  private cache = new Map<string, CacheEntry>();
  private cacheBytes = 0;
  // Session-bounded revision metadata prevents a known correction from falling back to old bytes.
  private revisions = new Map<string, RevisionGuard>();
  private readonly secret: Buffer;
  constructor(private transport: KnowledgeTransport, private options: { secret?: Buffer; cacheBytes?: number; cacheTtlMs?: number; maxProviders?: number; now?: () => number } = {}) {
    this.secret = options.secret ?? randomBytes(32);
    if (this.secret.length < 32) throw new Error('Knowledge reference key must be at least 256 bits');
  }
  private now(): number { return this.options.now?.() ?? Date.now(); }
  private accountTag(accountId: string): string { return createHmac('sha256', this.secret).update('account:' + accountId).digest('base64url'); }
  private reference(context: KnowledgeRequestContext, provider: string, card: Pick<KnowledgeCard, 'id' | 'originDeviceId' | 'version' | 'scope'>): string {
    const ref: ReadReference = { v: 1, account: this.accountTag(context.accountId), provider, origin: card.originDeviceId, id: card.id, version: card.version, project: card.scope.projectId };
    const payload = Buffer.from(JSON.stringify(ref)).toString('base64url');
    return 'k1.' + payload + '.' + createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
  private parseReference(context: KnowledgeRequestContext, input: string): ReadReference {
    if (typeof input !== 'string' || input.length > 4096) throw new CapabilityError('KNOWLEDGE_REF_INVALID', 'Invalid knowledge reference');
    const [prefix, payload, signature, extra] = input.split('.');
    if (prefix !== 'k1' || !payload || !signature || extra !== undefined) throw new CapabilityError('KNOWLEDGE_REF_INVALID', 'Invalid knowledge reference');
    const expected = createHmac('sha256', this.secret).update(payload).digest();
    let received: Buffer; try { received = Buffer.from(signature, 'base64url'); } catch { throw new CapabilityError('KNOWLEDGE_REF_INVALID', 'Invalid reference signature'); }
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) throw new CapabilityError('KNOWLEDGE_REF_INVALID', 'Invalid reference signature');
    let ref: ReadReference; try { ref = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw new CapabilityError('KNOWLEDGE_REF_INVALID', 'Invalid reference payload'); }
    if (ref.v !== 1 || ref.account !== this.accountTag(context.accountId)) throw new CapabilityError('ACCESS_DENIED', 'Knowledge reference belongs to another account');
    if (![ref.provider, ref.origin, ref.id].every(value => typeof value === 'string' && value.length > 0 && value.length <= 1024) || !Number.isSafeInteger(ref.version)) throw new CapabilityError('KNOWLEDGE_REF_INVALID', 'Invalid reference fields');
    return ref;
  }
  private async scope(context: KnowledgeRequestContext): Promise<KnowledgeDevice[]> {
    if (!context.accountId || !context.requesterDeviceId || !context.sessionId) throw new CapabilityError('AUTH_REQUIRED', 'Authenticated account, requesting Device and session are required');
    const devices = (await this.transport.devices(context.accountId)).filter(device => device.accountId === context.accountId);
    if (!devices.some(device => device.deviceId === context.requesterDeviceId)) throw new CapabilityError('ACCESS_DENIED', 'Requesting Device is not owned by this account');
    return devices;
  }
  private allowed(card: Pick<KnowledgeCard, 'scope'>, providerId: string, context: KnowledgeRequestContext, projectId?: string): boolean {
    if (!card.scope || !['project', 'account', 'local'].includes(card.scope.visibility)) return false;
    if (card.scope.visibility === 'local' && providerId !== context.requesterDeviceId) return false;
    if (card.scope.projectId && card.scope.projectId !== projectId) return false;
    if (card.scope.visibility === 'project' && !card.scope.projectId) return false;
    return true;
  }
  private cacheKey(context: KnowledgeRequestContext, origin: string, id: string): string { return JSON.stringify([context.accountId, context.requesterDeviceId, context.sessionId, origin, id]); }
  private pruneCache(): void {
    for (const [key, entry] of this.cache) if (this.now() - entry.at > (this.options.cacheTtlMs ?? 300_000)) { this.cache.delete(key); this.cacheBytes -= entry.bytes; }
    for (const [key, entry] of this.revisions) if (this.now() - entry.at > (this.options.cacheTtlMs ?? 300_000)) this.revisions.delete(key);
    while (this.revisions.size > 256) this.revisions.delete(this.revisions.keys().next().value!);
    while (this.cache.size > 256 || this.cacheBytes > (this.options.cacheBytes ?? 8 * 1024 * 1024)) { const first = this.cache.entries().next().value; if (!first) break; this.cache.delete(first[0]); this.cacheBytes -= first[1].bytes; }
  }
  private forgetCached(key: string): void {
    const cached = this.cache.get(key);
    if (cached) { this.cache.delete(key); this.cacheBytes -= cached.bytes; }
  }
  private rememberRevision(key: string, card: Pick<KnowledgeCard, 'version' | 'contentHash' | 'status'>, blocked?: string): void {
    const prior = this.revisions.get(key);
    if (prior && (card.version < prior.version || (card.version === prior.version && (card.contentHash !== prior.contentHash || card.status !== prior.status)))) {
      throw new CapabilityError('KNOWLEDGE_REVISION_CONFLICT', 'Origin revision conflicts with previously observed knowledge');
    }
    this.revisions.delete(key);
    this.revisions.set(key, { version: card.version, contentHash: card.contentHash, status: card.status, at: this.now(), ...(blocked ? { blocked } : {}) });
    const cached = this.cache.get(key)?.card;
    if (blocked || (cached && (cached.version < card.version || (cached.version === card.version && (cached.contentHash !== card.contentHash || cached.status !== card.status))))) this.forgetCached(key);
    this.pruneCache();
  }
  private cacheCard(context: KnowledgeRequestContext, card: KnowledgeCard): void {
    const key = this.cacheKey(context, card.originDeviceId, card.id), bytes = Buffer.byteLength(JSON.stringify(card));
    if (bytes > Math.min(1024 * 1024, this.options.cacheBytes ?? 8 * 1024 * 1024)) return;
    const previous = this.cache.get(key); if (previous) this.cacheBytes -= previous.bytes;
    this.cache.delete(key); this.cache.set(key, { card: structuredClone(card), at: this.now(), bytes }); this.cacheBytes += bytes; this.pruneCache();
  }
  cacheStats(): { entries: number; bytes: number } { this.pruneCache(); return { entries: this.cache.size, bytes: this.cacheBytes }; }
  private preview(value: any, context: KnowledgeRequestContext, provider: string): KnowledgePreview | undefined {
    if (!value || typeof value.id !== 'string' || typeof value.summary !== 'string' || typeof value.originDeviceId !== 'string' || !Number.isSafeInteger(value.version)) return;
    return {
      id: value.id, version: value.version, contentHash: String(value.contentHash ?? ''), summary: value.summary.slice(0, 1200), status: value.status,
      originDeviceId: value.originDeviceId, servingDeviceId: provider, scope: value.scope, evidenceCount: Number(value.evidenceCount ?? 0), lastVerifiedAt: value.lastVerifiedAt ?? null,
      read_ref: this.reference(context, provider, value)
    };
  }
  async search(context: KnowledgeRequestContext, input: { query?: string; projectId?: string; limit?: number; maxBytes?: number; providerDeviceId?: string }, action: 'search' | 'list' = 'search'): Promise<unknown> {
    const devices = await this.scope(context), capability = 'knowledge.' + action;
    const limit = Math.min(50, Math.max(1, input.limit ?? 10)), budget = Math.min(64 * 1024, Math.max(1024, input.maxBytes ?? 16 * 1024));
    const score = (device: KnowledgeDevice) => (device.deviceId === context.requesterDeviceId ? 1000 : 0) + (input.projectId && device.projects?.includes(input.projectId) ? 500 : 0) - Math.min(device.latencyMs ?? 100, 500) / 10;
    const providers = devices.filter(device => device.online && device.capabilities.includes(capability) && (!input.providerDeviceId || input.providerDeviceId === device.deviceId)).sort((a, b) => score(b) - score(a) || (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0) || a.deviceId.localeCompare(b.deviceId));
    if (input.providerDeviceId && !devices.some(d => d.deviceId === input.providerDeviceId)) throw new CapabilityError('ACCESS_DENIED', 'Provider Device is not owned by this account');
    const items: KnowledgePreview[] = [], queried: string[] = [], unavailable: { deviceId: string; code: string }[] = [], dedup = new Set<string>();
    let truncated = false;
    // A relevant successful provider is enough; fallback is bounded and only used for absence/failure.
    for (const provider of providers.slice(0, Math.min(3, Math.max(1, this.options.maxProviders ?? 2)))) {
      queried.push(provider.deviceId);
      try {
        const result = unwrapKnowledgeResult(await this.transport.call(context.accountId, provider.deviceId, capability, { query: input.query, projectId: input.projectId, limit, maxBytes: budget }));
        for (const candidate of result.items ?? []) {
          if (!this.allowed(candidate, provider.deviceId, context, input.projectId) || ['withdrawn', 'superseded'].includes(candidate.status)) continue;
          const item = this.preview(candidate, context, provider.deviceId); if (!item) continue;
          const key = item.originDeviceId + ':' + item.id; if (dedup.has(key)) continue;
          if (items.length >= limit || Buffer.byteLength(JSON.stringify({ items: [...items, item], queried, unavailable, truncated: true })) > budget) { truncated = true; break; }
          dedup.add(key); items.push(item);
        }
        truncated ||= Boolean(result.truncated);
        if (items.length) break;
      } catch (error) { unavailable.push({ deviceId: provider.deviceId, code: (error as CapabilityError).code ?? 'PROVIDER_UNAVAILABLE' }); }
    }
    const response = { items, queried, unavailable, truncated, imported: 0 };
    while (Buffer.byteLength(JSON.stringify(response)) > budget && response.items.length) { response.items.pop(); response.truncated = true; }
    if (Buffer.byteLength(JSON.stringify(response)) > budget) throw new CapabilityError('BUDGET_TOO_SMALL', 'Routing metadata exceeds the response budget');
    return response;
  }
  async read(context: KnowledgeRequestContext, input: { ref: string; projectId?: string; evidence?: boolean; maxBytes?: number }): Promise<unknown> {
    const devices = await this.scope(context), ref = this.parseReference(context, input.ref);
    if (input.projectId !== undefined && ref.project !== undefined && input.projectId !== ref.project) throw new CapabilityError('ACCESS_DENIED', 'Reference does not belong to the requested project');
    const projectId = input.projectId ?? ref.project;
    const provider = devices.find(device => device.deviceId === ref.provider), requester = devices.find(device => device.deviceId === context.requesterDeviceId)!;
    if (!provider) throw new CapabilityError('ACCESS_DENIED', 'Serving Device is no longer owned by this account');
    const key = this.cacheKey(context, ref.origin, ref.id);
    this.pruneCache();
    const cached = this.cache.get(key);
    let card: KnowledgeCard | undefined, evidence: unknown;
    let freshness: 'current' | 'stale' = 'current';
    const assertRevision = (value: Pick<KnowledgeCard, 'version' | 'contentHash' | 'status'>): void => {
      if (!value || !Number.isSafeInteger(value.version) || value.version < 1 || typeof value.contentHash !== 'string' || !value.contentHash || value.contentHash.length > 128 ||
          !['hypothesis', 'observed', 'validated', 'stale', 'superseded', 'withdrawn'].includes(value.status)) throw new CapabilityError('KNOWLEDGE_REVISION_INVALID', 'Provider returned invalid revision metadata');
      const known = this.revisions.get(key), minimum = Math.max(ref.version, known?.version ?? 0);
      if (value.version < minimum) throw new CapabilityError('KNOWLEDGE_REVISION_UNAVAILABLE', 'The selected or newer known knowledge revision is unavailable');
      if (known && value.version === known.version && (value.contentHash !== known.contentHash || value.status !== known.status)) throw new CapabilityError('KNOWLEDGE_REVISION_CONFLICT', 'Provider returned conflicting bytes for a known revision');
    };
    const fetchCard = async (device: KnowledgeDevice): Promise<void> => {
      const result = unwrapKnowledgeResult(await this.transport.call(context.accountId, device.deviceId, 'knowledge.read', { ref: ref.id, projectId, evidence: input.evidence === true, maxBytes: Math.min(64 * 1024, Math.max(1024, input.maxBytes ?? 16 * 1024)) }));
      if (!result.card || result.card.id !== ref.id || result.card.originDeviceId !== ref.origin) throw new CapabilityError('KNOWLEDGE_IDENTITY_MISMATCH', 'Provider returned a different knowledge identity');
      assertRevision(result.card);
      if (!this.allowed(result.card, device.deviceId, context, projectId)) throw new CapabilityError('ACCESS_DENIED', 'Knowledge scope does not permit this read');
      // Routing identity comes from the authenticated transport, never from provider-supplied metadata.
      card = { ...result.card, servingDeviceId: device.deviceId }; evidence = result.evidence;
    };
    const useCache = (): boolean => {
      if (!cached || this.revisions.get(key)?.blocked) return false;
      try { assertRevision(cached.card); } catch { return false; }
      card = structuredClone(cached.card); freshness = 'stale'; return true;
    };
    // Prefer a previously imported copy on the requesting Device, if it has one.
    if (requester.online && requester.deviceId !== provider.deviceId && requester.capabilities.includes('knowledge.read')) {
      try { await fetchCard(requester); } catch { /* selected provider remains authoritative fallback */ }
    }
    if (!card && !input.evidence) useCache();
    if (!card && provider.online && provider.capabilities.includes('knowledge.read')) await fetchCard(provider);
    if (!card) useCache();
    if (!card) {
      const blocked = this.revisions.get(key)?.blocked;
      if (blocked) throw new CapabilityError(blocked, 'Origin denied or removed this knowledge');
      if (this.revisions.has(key)) throw new CapabilityError('KNOWLEDGE_REVISION_UNAVAILABLE', 'The newer known knowledge revision is unavailable');
      throw new CapabilityError('PROVIDER_UNAVAILABLE', 'Knowledge provider is offline and this session has no cached selected read');
    }
    const origin = devices.find(device => device.deviceId === card!.originDeviceId);
    if (origin?.online && origin.capabilities.includes('knowledge.stat')) {
      let metadata: any, metadataReceived = false;
      try {
        metadata = unwrapKnowledgeResult(await this.transport.call(context.accountId, origin.deviceId, 'knowledge.stat', { ref: card.id, projectId })); metadataReceived = true;
      } catch (error) {
        const code = (error as CapabilityError).code;
        if (code === 'ACCESS_DENIED' || code === 'KNOWLEDGE_NOT_FOUND' || code === 'KNOWLEDGE_SCOPE_MISMATCH') {
          this.rememberRevision(key, this.revisions.get(key) ?? card, code); throw error;
        }
        freshness = 'stale';
      }
      if (metadataReceived) {
        if (!metadata || typeof metadata !== 'object') throw new CapabilityError('KNOWLEDGE_REVISION_INVALID', 'Origin returned invalid revision metadata');
        if ((metadata.id !== undefined && metadata.id !== ref.id) || (metadata.originDeviceId !== undefined && metadata.originDeviceId !== ref.origin)) throw new CapabilityError('KNOWLEDGE_IDENTITY_MISMATCH', 'Origin returned different revision metadata');
        assertRevision(metadata);
        const wasBlocked = this.revisions.get(key)?.blocked;
        this.rememberRevision(key, metadata, wasBlocked);
        // Once origin confirms change, failure to fetch it must never resurrect/import older bytes.
        if (wasBlocked || metadata.version !== card.version || metadata.contentHash !== card.contentHash || metadata.status !== card.status) {
          try { await fetchCard(origin); }
          catch (error) {
            const code = (error as CapabilityError).code;
            if (code === 'ACCESS_DENIED' || code === 'KNOWLEDGE_NOT_FOUND' || code === 'KNOWLEDGE_SCOPE_MISMATCH') this.rememberRevision(key, metadata, code);
            throw error;
          }
        }
        assertRevision(card);
        this.rememberRevision(key, card);
        freshness = 'current';
      }
    } else if (!origin?.online || card.servingDeviceId !== card.originDeviceId) freshness = 'stale';
    const blocked = this.revisions.get(key)?.blocked;
    if (blocked) throw new CapabilityError(blocked, 'Origin denied or removed this knowledge');
    assertRevision(card);
    if (!this.allowed(card, card.servingDeviceId, context, projectId)) throw new CapabilityError('ACCESS_DENIED', 'Knowledge scope does not permit this read');
    const response = { card, ...(evidence === undefined ? {} : { evidence }), imported: false, freshness: { status: freshness, lastVerifiedAt: freshness === 'current' ? this.now() : card.lastVerifiedAt }, read_ref: this.reference(context, card.servingDeviceId, card) };
    if (Buffer.byteLength(JSON.stringify(response)) > Math.min(64 * 1024, Math.max(1024, input.maxBytes ?? 16 * 1024))) throw new CapabilityError('BUDGET_TOO_SMALL', 'Full selected knowledge and provenance exceed the response budget');
    if (requester.online && requester.capabilities.includes('knowledge.import') && card.originDeviceId !== requester.deviceId) {
      const result = unwrapKnowledgeResult(await this.transport.call(context.accountId, requester.deviceId, 'knowledge.import', { card })); response.imported = Boolean(result.imported);
    }
    this.rememberRevision(key, card);
    this.cacheCard(context, card);
    return response;
  }
}
