import { requireFeatureAuthorized } from './authorization.js';
import { buildContextCatalog, validateContextInput, contextError, WIKI_DISABLED } from './tool-contract.js';
export { validateContextInput } from './tool-contract.js';

/** Trusted Phase 8 entry boundary; revalidate before every privileged action.
 * No public routes or tools are registered by importing this module. */
export function executePublicGateway<T>(action: () => T): T {
  requireFeatureAuthorized('FEATURE_PUBLIC_GATEWAY');
  return action();
}

/** Registration is explicit and always protected by the pinned approval gate. */
export function contextToolCatalog() { return executePublicGateway(buildContextCatalog); }
export interface ContextGatewayRoute {
  resolveDevice(deviceId: string): Promise<{ owned: boolean; online: boolean; capabilities: readonly string[]; context_version?: number } | undefined>;
  forward(deviceId: string, tool: string, input: Record<string, unknown>): Promise<unknown>;
  /** Payload-free operational counters only; never arguments/results/errors. */
  telemetry?: (event: { tool: string; lane: 'read' | 'write'; outcome: 'success' | 'error' }) => void;
}

/** Stateless broker: ownership and capability checks precede device forwarding.
 * No Store, search engine, content cache, logging or fallback exists here. */
export function callContextTool(tool: string, input: unknown, route: ContextGatewayRoute, lane: 'read' | 'write'): Promise<unknown> {
  return executePublicGateway(async () => {
    let outcome: 'success' | 'error' = 'error';
    try {
      const args = validateContextInput(tool, input);
      const expectedLane = tool === 'local_index' ? 'write' : 'read';
      if (lane !== expectedLane) throw new Error('ACCESS_DENIED');
      if (tool === 'local_wiki') return WIKI_DISABLED;
      if (!args.cwd && !args.project_id) throw new Error('SCOPE_REQUIRED');
      if (args.cwd && args.project_id) throw new Error('SCOPE_AMBIGUOUS');
      const device = await route.resolveDevice(args.device_id);
      if (!device?.owned) throw new Error('ACCESS_DENIED');
      if (!device.online) throw new Error('DEVICE_OFFLINE');
      if (device.context_version !== 1 || !device.capabilities.includes(tool)) throw new Error('DEVICE_UNSUPPORTED');
      const result = await route.forward(args.device_id, tool, args);
      outcome = (result as { ok?: boolean })?.ok === false ? 'error' : 'success';
      return result;
    } catch (error) { return contextError(error); }
    finally {
      // Observability failures must never affect domain results.
      try { route.telemetry?.({ tool: buildContextCatalog().some(entry => entry.name === tool) ? tool : 'unknown', lane, outcome }); } catch { /* best effort */ }
    }
  });
}
