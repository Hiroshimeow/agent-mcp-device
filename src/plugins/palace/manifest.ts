import { fileURLToPath } from 'node:url';
import type { PluginManifest } from '../../platform/plugin-contract.js';

/** Optional Palace contract; never imported or provisioned by Core. */
export function palacePluginManifest(): PluginManifest {
  return {
    id: 'palace', version: '1.0.12', dataSchemaVersion: 1, isolation: 'process',
    entry: fileURLToPath(new URL('./plugin.js', import.meta.url)), timeoutMs: 30_000,
    capabilities: ['knowledge.search', 'knowledge.list', 'knowledge.read', 'knowledge.stat', 'knowledge.import', 'knowledge.ingest', 'knowledge.correct', 'knowledge.learn', 'knowledge.skills'].map(name => ({ name, version: '1.0.0', role: 'provider' as const, priority: 100 }))
  };
}
