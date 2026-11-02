import fs from 'node:fs/promises';
import path from 'node:path';
import { CapabilityError } from './plugin-contract.js';
import { probeRuntimeOwner } from '../device/runtime-owner.js';
import { coordinationObservation, coordinationOwnerAbandoned, createCoordinationLock, releaseCoordinationLock, repairCoordinationLock } from './coordination-lock.js';

/** No listener is created and no prior runtime is stopped by taking this lease. */
export async function acquireServerLease(stateRoot: string, options: { allowDeviceOwnerPid?: number } = {}): Promise<() => Promise<void>> {
  stateRoot = path.resolve(stateRoot);
  await fs.mkdir(stateRoot, { recursive: true });
  const filename = path.join(stateRoot, 'server-runtime.lock');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const lock = await createCoordinationLock(filename);
      const release = () => releaseCoordinationLock(lock, filename);
      try {
        // Device-only v11 uses a named pipe / Unix socket. Holding the common
        // lease first also serializes new Device, server and maintenance starts.
        const owner = await probeRuntimeOwner({ root: stateRoot, identity: path.join(stateRoot, 'gateway-identity.json'), config: path.join(stateRoot, 'gateway-config.json'), status: path.join(stateRoot, 'gateway-status.json'), runtime: path.join(stateRoot, 'runtime'), update: path.join(stateRoot, 'update') });
        if (owner && !(options.allowDeviceOwnerPid === process.pid && owner.pid === process.pid)) throw new CapabilityError('RUNTIME_ALREADY_RUNNING', `This state directory has an active Device runtime in PID ${owner.pid}`);
        if (!owner) {
          try { await fs.access(path.join(stateRoot, 'runtime-control.json')); }
          catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return release; throw error; }
          throw new CapabilityError('DEVICE_RUNTIME_STOP_NOT_PROVEN', 'Device runtime control exists but does not respond; inspect the stopped runtime before recovering it');
        }
        return release;
      } catch (error) { await release(); throw error; }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const previous = await coordinationObservation(filename);
      if (!previous) continue;
      if (!previous.body) throw new CapabilityError('RUNTIME_LOCK_INVALID', 'Runtime lease does not identify a valid process and token; inspect the stopped runtime before recovering it');
      if (await coordinationOwnerAbandoned(previous.body)) {
        await repairCoordinationLock(filename, {
          codes: { busy: 'RUNTIME_RECOVERY_BUSY', active: 'RUNTIME_ALREADY_RUNNING', recoveryRequired: 'RUNTIME_RECOVERY_BUSY' },
          messagePrefix: 'Runtime lease', retainAbandoned: false
        });
        continue;
      }
      throw new CapabilityError('RUNTIME_ALREADY_RUNNING', `This state directory is already owned by PID ${previous.body.pid}`);
    }
  }
  throw new CapabilityError('RUNTIME_ALREADY_RUNNING', 'Another process acquired this runtime state');
}
