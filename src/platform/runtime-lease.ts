import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CapabilityError } from './plugin-contract.js';
import { probeRuntimeOwner } from '../device/runtime-owner.js';

/** No listener is created and no prior runtime is stopped by taking this lease. */
export async function acquireServerLease(stateRoot: string, options: { allowDeviceOwnerPid?: number } = {}): Promise<() => Promise<void>> {
  stateRoot = path.resolve(stateRoot);
  await fs.mkdir(stateRoot, { recursive: true });
  const filename = path.join(stateRoot, 'server-runtime.lock'), token = randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const handle = await fs.open(filename, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify({ pid: process.pid, token, startedAt: Date.now() }) + '\n'); }
      finally { await handle.close(); }
      const release = async () => {
        try { const current = JSON.parse(await fs.readFile(filename, 'utf8')); if (current.token === token) await fs.unlink(filename); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      };
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
      let previous: { pid?: number; token?: string };
      try { previous = JSON.parse(await fs.readFile(filename, 'utf8')); }
      catch { throw new CapabilityError('RUNTIME_LOCK_INVALID', 'Runtime lease is unreadable; inspect the stopped runtime before recovering it'); }
      if (!Number.isSafeInteger(previous.pid) || (previous.pid ?? 0) < 1) throw new CapabilityError('RUNTIME_LOCK_INVALID', 'Runtime lease does not identify a valid process');
      try { process.kill(previous.pid!, 0); }
      catch (probe) {
        if ((probe as NodeJS.ErrnoException).code === 'ESRCH') {
          const recovery = filename + '.recovery';
          let recoveryHandle;
          try { recoveryHandle = await fs.open(recovery, 'wx', 0o600); }
          catch { throw new CapabilityError('RUNTIME_RECOVERY_BUSY', 'Another process is recovering a stale runtime lease'); }
          try {
            try {
              const current = JSON.parse(await fs.readFile(filename, 'utf8'));
              if (current.token === previous.token && current.pid === previous.pid) await fs.unlink(filename);
            } catch (read) { if ((read as NodeJS.ErrnoException).code !== 'ENOENT') throw read; }
          } finally { await recoveryHandle.close(); await fs.unlink(recovery); }
          continue;
        }
      }
      throw new CapabilityError('RUNTIME_ALREADY_RUNNING', `This state directory is already owned by PID ${previous.pid}`);
    }
  }
  throw new CapabilityError('RUNTIME_ALREADY_RUNNING', 'Another process acquired this runtime state');
}
