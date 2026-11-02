import { fileURLToPath } from 'node:url';
import type { PluginManifest } from './platform/plugin-contract.js';

/** Distribution policy is outside Device Core and the generic capability host. */
export function bundledPluginManifests(): PluginManifest[] {
  return [];
}
export function referencePluginManifest(): PluginManifest {
  return { id: 'reference-text', version: '1.0.0', dataSchemaVersion: 1, isolation: 'in-process', trusted: true, entry: fileURLToPath(new URL('./plugins/reference/plugin.js', import.meta.url)), capabilities: [{ name: 'text.transform', version: '1.0.0', priority: 10 }] };
}
