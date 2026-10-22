import { CapabilityError, type CapabilityRequirement } from './plugin-contract.js';

/** Services are scoped to one lifecycle or invocation request, never a process-global caller. */
export interface PluginServices {
  invoke(name: string, input: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
}
export interface DependencyCallOptions {
  version: string;
  signal: AbortSignal;
  compose: false;
}
export type DependencyInvoker = (name: string, input: unknown, options: DependencyCallOptions) => Promise<unknown>;

export function createPluginServices(
  requirements: readonly CapabilityRequirement[],
  invokeProvider: DependencyInvoker,
  parentSignal: AbortSignal
): PluginServices {
  const declared = new Map(requirements.map(requirement => [requirement.name, requirement.version]));
  return Object.freeze({
    async invoke(name: string, input: unknown, options: { signal?: AbortSignal } = {}): Promise<unknown> {
      const version = declared.get(name);
      if (!version) throw new CapabilityError('CAPABILITY_DEPENDENCY_UNDECLARED', 'Plugin did not declare the required capability');
      const signal = options.signal ? AbortSignal.any([parentSignal, options.signal]) : parentSignal;
      if (signal.aborted) throw new CapabilityError('CANCELLED', 'Dependency call scope ended or was cancelled');
      let abort: (() => void) | undefined;
      try {
        return await Promise.race([
          Promise.resolve().then(() => {
            if (signal.aborted) throw new CapabilityError('CANCELLED', 'Dependency call cancelled before dispatch');
            return invokeProvider(name, input, { version, signal, compose: false });
          }),
          new Promise<never>((_, reject) => {
            abort = () => reject(new CapabilityError('CANCELLED', 'Dependency call cancelled'));
            signal.addEventListener('abort', abort, { once: true });
          })
        ]);
      } finally {
        if (abort) signal.removeEventListener('abort', abort);
      }
    }
  });
}
