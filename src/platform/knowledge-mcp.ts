import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { KnowledgeRouter, unwrapKnowledgeResult, type KnowledgeDevice, type KnowledgeRequestContext } from './knowledge-router.js';
import { CapabilityError } from './plugin-contract.js';

interface BrokerDevice { deviceId: string; online: boolean; capabilities: string[]; projects?: string[]; lastSeenAt?: number; latencyMs?: number; }
export interface TrustedToolContext {
  accountId: string;
  sessionId: string;
  listDevices(): BrokerDevice[] | Promise<BrokerDevice[]>;
  callDevice(options: { deviceId: string; tool: string; arguments: Record<string, unknown>; timeoutMs?: number }): Promise<unknown>;
}
export interface PlatformTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, boolean>;
  handler(args: Record<string, any>, context: TrustedToolContext): Promise<unknown>;
}

/** The key is runtime state, so references survive restart and verified restore. */
async function referenceKey(stateRoot: string): Promise<Buffer> {
  await fs.mkdir(stateRoot, { recursive: true });
  const filename = path.join(stateRoot, 'knowledge-reference.key');
  try { await fs.writeFile(filename, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  const key = await fs.readFile(filename);
  if (key.length !== 32) throw new CapabilityError('KNOWLEDGE_KEY_INVALID', 'Persisted knowledge reference key is invalid; restore the original key');
  return key;
}

/** All owner and caller policy checks still flow through the authenticated wrapper. */
export async function createPlatformTools(stateRoot: string): Promise<PlatformTool[]> {
  const requests = new AsyncLocalStorage<TrustedToolContext>();
  const trusted = (accountId: string) => {
    const context = requests.getStore();
    if (!context || !context.accountId || context.accountId !== accountId) throw new CapabilityError('AUTH_REQUIRED', 'An authenticated account context is required');
    return context;
  };
  const router = new KnowledgeRouter({
    async devices(accountId): Promise<KnowledgeDevice[]> {
      return (await trusted(accountId).listDevices()).map(device => ({ ...device, accountId }));
    },
    call: (accountId, deviceId, capability, input) => trusted(accountId).callDevice({ deviceId, tool: capability, arguments: input as Record<string, unknown>, timeoutMs: 30_000 })
  }, { secret: await referenceKey(stateRoot) });
  const properties = {
    device_id: { type: 'string', minLength: 1, maxLength: 64, description: 'Owned Device requesting the knowledge. It may have no knowledge plugin.' },
    project_id: { type: 'string', minLength: 1, maxLength: 512 },
    max_bytes: { type: 'integer', minimum: 1024, maximum: 65536, default: 16384 }
  };
  const contextFor = (args: Record<string, any>, context: TrustedToolContext): KnowledgeRequestContext => {
    if (!context.accountId || !context.sessionId) throw new CapabilityError('AUTH_REQUIRED', 'An authenticated account and session are required');
    return { accountId: context.accountId, sessionId: context.sessionId, requesterDeviceId: args.device_id };
  };
  const tools: PlatformTool[] = (['search', 'list'] as const).map(action => ({
    name: 'knowledge.' + action,
    description: action === 'search' ? 'Search compact knowledge previews across an account’s relevant available Devices. Does not import knowledge.' : 'List scoped knowledge previews on relevant available Devices. Does not import knowledge.',
    inputSchema: { type: 'object', additionalProperties: false, required: action === 'search' ? ['device_id', 'query'] : ['device_id'], properties: { ...properties, query: { type: 'string', maxLength: 4096 }, limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }, provider_device_id: { type: 'string', minLength: 1, maxLength: 64 } } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    handler: (args, context) => requests.run(context, () => router.search(contextFor(args, context), { query: args.query, projectId: args.project_id, limit: args.limit, maxBytes: args.max_bytes, providerDeviceId: args.provider_device_id }, action))
  }));
  tools.push({
    name: 'knowledge.read',
    description: 'Read one selected knowledge reference with provenance and freshness. Lazily import that item only when the requesting Device has a storage provider; otherwise use bounded session cache. Evidence is returned only when requested.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['device_id', 'ref'], properties: { ...properties, ref: { type: 'string', minLength: 1, maxLength: 4096 }, evidence: { type: 'boolean', default: false } } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    handler: (args, context) => requests.run(context, () => router.read(contextFor(args, context), { ref: args.ref, projectId: args.project_id, evidence: args.evidence, maxBytes: args.max_bytes }))
  });
  tools.push({
    name: 'capability.list',
    description: 'Discover current capabilities advertised by an owned Device. Plugin disable, crash and dependency loss remove unavailable capabilities.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['device_id'], properties: { device_id: properties.device_id } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async handler(args, context) {
      if (!context.accountId) throw new CapabilityError('AUTH_REQUIRED', 'An authenticated account is required');
      const device = (await context.listDevices()).find(item => item.deviceId === args.device_id);
      if (!device) throw new CapabilityError('ACCESS_DENIED', 'Device is not owned by this account');
      const contracts = device.online && device.capabilities.includes('platform.capabilities') ? unwrapKnowledgeResult(await context.callDevice({ deviceId: device.deviceId, tool: 'platform.capabilities', arguments: {} })).contracts : undefined;
      return { device_id: device.deviceId, online: device.online, capabilities: device.capabilities, ...(contracts ? { contracts } : {}) };
    }
  }, {
    name: 'capability.call',
    description: 'Invoke an advertised plugin capability on an owned Device through normal caller policy. Knowledge exchange uses knowledge.search/list/read; native tools use their existing contracts.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['device_id', 'capability', 'arguments'], properties: { device_id: properties.device_id, capability: { type: 'string', pattern: '^[a-z][a-z0-9_-]*\\.[a-z0-9_.-]+$', maxLength: 96 }, version: { type: 'string', maxLength: 64, description: 'Required compatible capability contract, such as ^1.0.0 or 1.x.' }, arguments: { type: 'object', additionalProperties: true } } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async handler(args, context) {
      if (!context.accountId) throw new CapabilityError('AUTH_REQUIRED', 'An authenticated account is required');
      if (String(args.capability).startsWith('knowledge.')) throw new CapabilityError('CAPABILITY_PRIVATE', 'Use the public knowledge exchange contract');
      const device = (await context.listDevices()).find(item => item.deviceId === args.device_id);
      if (!device) throw new CapabilityError('ACCESS_DENIED', 'Device is not owned by this account');
      if (!device.online || !device.capabilities.includes('platform.invoke') || !device.capabilities.includes(args.capability)) throw new CapabilityError('CAPABILITY_UNAVAILABLE', 'The Device does not advertise this plugin capability');
      return context.callDevice({ deviceId: args.device_id, tool: 'platform.invoke', arguments: { name: args.capability, version: args.version, input: args.arguments }, timeoutMs: 30_000 });
    }
  });
  return tools;
}
