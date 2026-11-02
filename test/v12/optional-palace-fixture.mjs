// Explicit optional-plugin fixture, not the Core distribution/default policy.
import { palacePluginManifest } from '../../dist/plugins/palace/manifest.js';
export const bundledPluginManifests = () => [palacePluginManifest()];
