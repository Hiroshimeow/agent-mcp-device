import assert from 'node:assert/strict';
import { featureFlagManager } from '../dist/utils/feature-flags.js';

await featureFlagManager.initialize();
assert.deepEqual(featureFlagManager.getAll(), {});
assert.equal(featureFlagManager.get('missing', false), false);
assert.equal(featureFlagManager.get('missing', 'fallback'), 'fallback');
assert.equal(featureFlagManager.wasLoadedFromCache(), false);
assert.equal(await featureFlagManager.refresh(), true);
await featureFlagManager.waitForFreshFlags();
featureFlagManager.destroy();
console.log('Local feature flag compatibility surface passed');
