export type DevicePluginPolicy = 'bundled' | 'core-first';

const POLICY_ERROR = '--plugin-policy must be bundled or core-first';

function parsePolicy(value: unknown, source: 'cli' | 'env'): DevicePluginPolicy | undefined {
  if (value === undefined || (source === 'env' && value === '')) return undefined;
  if (value === 'bundled' || value === 'core-first') return value;
  throw new Error(POLICY_ERROR);
}

/** Legacy option compatibility only. Core never bundles optional plugins. */
export function resolveDevicePluginPolicy(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env
): DevicePluginPolicy | undefined {
  let cliValue: string | undefined;
  let cliSpecified = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--plugin-policy') {
      cliSpecified = true;
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error(POLICY_ERROR);
      cliValue = next;
      index += 1;
    } else if (argument.startsWith('--plugin-policy=')) {
      cliSpecified = true;
      cliValue = argument.slice('--plugin-policy='.length);
    }
  }
  return cliSpecified ? parsePolicy(cliValue, 'cli') : parsePolicy(env.MCP_DEVICE_PLUGIN_POLICY, 'env');
}
