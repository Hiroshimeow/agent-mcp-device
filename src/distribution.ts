import { fileURLToPath } from 'node:url';
import type { PluginManifest } from './platform/plugin-contract.js';

/** Distribution policy is outside Device Core and the generic capability host. */
export function bundledPluginManifests(): PluginManifest[] {
  return [{
    id: 'palace', version: '1.0.12', dataSchemaVersion: 1, isolation: 'process',
    entry: fileURLToPath(new URL('./plugins/palace/plugin.js', import.meta.url)), timeoutMs: 30_000,
    capabilities: ['knowledge.search', 'knowledge.list', 'knowledge.read', 'knowledge.stat', 'knowledge.import', 'knowledge.ingest', 'knowledge.correct', 'knowledge.learn', 'knowledge.skills'].map(name => ({ name, version: '1.0.0', role: 'provider' as const, priority: 100 }))
  }];
}
export function referencePluginManifest(): PluginManifest {
  return { id: 'reference-text', version: '1.0.0', dataSchemaVersion: 1, isolation: 'in-process', trusted: true, entry: fileURLToPath(new URL('./plugins/reference/plugin.js', import.meta.url)), capabilities: [{ name: 'text.transform', version: '1.0.0', priority: 10 }] };
}
