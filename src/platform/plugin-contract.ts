import type { PluginServices } from './plugin-services.js';

export type CapabilityRole = 'provider' | 'augmenter' | 'observer' | 'fallback';
export interface Capability {
  name: string;
  version: string;
  role?: CapabilityRole;
  priority?: number;
}
export interface CapabilityRequirement { name: string; version: string; }
export interface PluginManifest {
  id: string;
  version: string;
  dataSchemaVersion: number;
  capabilities: Capability[];
  requires?: CapabilityRequirement[];
  isolation: 'process' | 'in-process';
  /** In-process code is trusted and must not block the JS event loop. */
  trusted?: boolean;
  entry: string;
  /** Optional language-independent JSON-lines executable. */
  executable?: string;
  args?: string[];
  timeoutMs?: number;
}
export interface PluginContext {
  deviceId: string;
  dataRoot: string;
  projectRoots: string[];
  sourceRoots: string[];
  previousSchemaVersion?: number;
  settings?: Record<string, unknown>;
  /** Init-scoped dependency services; invoke/start receive a fresh scope. */
  services?: PluginServices;
}
export interface InvocationContext { signal: AbortSignal; services: PluginServices; }
export interface PluginInstance {
  start?(context?: InvocationContext): Promise<void> | void;
  stop?(context?: InvocationContext): Promise<void> | void;
  invoke(capability: string, input: unknown, context: InvocationContext): Promise<unknown> | unknown;
}
export interface PluginModule {
  createPlugin(context: PluginContext): Promise<PluginInstance> | PluginInstance;
  migrate?(options: { dataRoot: string; fromVersion: number; toVersion: number }): Promise<void> | void;
}
export type PluginState = 'installed' | 'enabled' | 'disabled' | 'faulted' | 'uninstalled' | 'missing';
export interface PluginRecord {
  manifest: PluginManifest;
  enabled: boolean;
  installed: boolean;
  schemaVersion: number;
  state: PluginState;
  error?: string;
  /** Only ensureBundled creates distribution provenance. Unmarked records are user-managed. */
  installationSource?: 'distribution' | 'manual';
  /** Persisted gate: replaced distribution bytes must not run under stale metadata. */
  bundleUpgradeRequired?: { version: string; dataSchemaVersion: number };
}
export class CapabilityError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'CapabilityError'; }
}
export function compatible(version: string, range: string): boolean {
  const actual = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!actual) return false;
  if (range === '*' || range === version) return true;
  const requested = range.match(/^(?:\^)?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/);
  if (!requested || actual[1] !== requested[1]) return false;
  if (range.startsWith('^')) {
    if (!/^\^\d+\.\d+\.\d+$/.test(range)) return false;
    const minor = Number(requested[2] ?? 0), patch = Number(requested[3] ?? 0);
    if (Number(actual[1]) === 0) return Number(actual[2]) === minor && (minor === 0 ? Number(actual[3]) === patch : Number(actual[3]) >= patch);
    return Number(actual[2]) > minor || (Number(actual[2]) === minor && Number(actual[3]) >= patch);
  }
  return (!requested[2] || /[x*]/.test(requested[2]) || requested[2] === actual[2]) &&
    (!requested[3] || /[x*]/.test(requested[3]) || requested[3] === actual[3]);
}
export function validateManifest(value: PluginManifest): void {
  if (!value || !/^[a-z][a-z0-9-]{0,63}$/.test(value.id)) throw new CapabilityError('PLUGIN_MANIFEST_INVALID', 'Invalid plugin id');
  if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value.version)) throw new CapabilityError('PLUGIN_MANIFEST_INVALID', 'Invalid plugin version');
  if (!Number.isSafeInteger(value.dataSchemaVersion) || value.dataSchemaVersion < 1) throw new CapabilityError('PLUGIN_MANIFEST_INVALID', 'Invalid data schema');
  if (!['process', 'in-process'].includes(value.isolation) || (value.isolation === 'in-process' && value.trusted !== true)) throw new CapabilityError('PLUGIN_ISOLATION_REQUIRED', 'In-process plugins must explicitly declare cooperative trusted execution');
  if (typeof value.entry !== 'string' || !value.entry || !Array.isArray(value.capabilities) || value.capabilities.length > 128) throw new CapabilityError('PLUGIN_MANIFEST_INVALID', 'Invalid entry/capabilities');
  const seen = new Set<string>();
  for (const c of value.capabilities) {
    const key = `${c.name}:${c.role ?? 'provider'}`;
    if (!/^[a-z][a-z0-9_.-]{0,95}$/.test(c.name) || !/^\d+\.\d+\.\d+$/.test(c.version) || seen.has(key) || !['provider', 'augmenter', 'observer', 'fallback'].includes(c.role ?? 'provider')) throw new CapabilityError('PLUGIN_MANIFEST_INVALID', 'Invalid or duplicate capability');
    if (c.priority !== undefined && (!Number.isSafeInteger(c.priority) || Math.abs(c.priority) > 10000)) throw new CapabilityError('PLUGIN_MANIFEST_INVALID', 'Invalid capability priority');
    seen.add(key);
  }
  if (new Set((value.requires ?? []).map(requirement => requirement.name)).size !== (value.requires ?? []).length) throw new CapabilityError('PLUGIN_MANIFEST_INVALID', 'Duplicate capability requirement');
  for (const r of value.requires ?? []) if (!/^[a-z][a-z0-9_.-]{0,95}$/.test(r.name) || typeof r.version !== 'string' || !(r.version === '*' || /^\^\d+\.\d+\.\d+$/.test(r.version) || /^\d+(?:\.(?:\d+|x|\*)){0,2}$/.test(r.version))) throw new CapabilityError('PLUGIN_MANIFEST_INVALID', 'Invalid capability requirement or unsupported version range');
}
