import type { PluginContext, PluginInstance } from '../../platform/plugin-contract.js';

/** Small unrelated extension used to exercise the public plugin contract. */
export function createPlugin(context: PluginContext): PluginInstance {
  return {
    invoke(capability, input) {
      if (capability !== 'text.transform') throw Object.assign(new Error('Unsupported capability'), { code: 'CAPABILITY_UNSUPPORTED' });
      const value = input as { text?: unknown; mode?: string };
      if (typeof value?.text !== 'string' || value.text.length > 8192) throw Object.assign(new Error('text must be at most 8192 characters'), { code: 'INVALID_ARGUMENT' });
      return { text: value.mode === 'upper' ? value.text.toUpperCase() : value.mode === 'lower' ? value.text.toLowerCase() : value.text, deviceId: context.deviceId };
    }
  };
}
