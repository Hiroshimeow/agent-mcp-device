import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CapabilityError, compatible, validateManifest, type Capability, type PluginManifest, type PluginRecord } from './plugin-contract.js';
import { createPluginDriver, type PluginDriver } from './plugin-driver.js';

interface Registry { version: 1; revision: number; plugins: Record<string, PluginRecord & { settings?: Record<string, unknown> }>; }
export interface PluginHostOptions { stateRoot: string; deviceId: string; projectRoots?: string[]; sourceRoots?: string[]; }
type Candidate = { id: string; capability: Capability };
type DependencyBinding = { providerId: string; driver: PluginDriver; requiredVersion: string };

function bundleContract(manifest: PluginManifest): string {
  const { entry: _entry, ...contract } = manifest;
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]));
    return value;
  };
  return JSON.stringify(canonical(contract));
}

/** Private plugin state; neither accounts nor Device identity are owned here. */
export class PluginHost {
  private registry: Registry = { version: 1, revision: 0, plugins: {} };
  private drivers = new Map<string, PluginDriver>();
  // Faulted or disabled drivers remain owned until process/resource release is proved.
  private ownedDrivers = new Map<PluginDriver, string>();
  private dependencies = new Map<string, Map<string, DependencyBinding>>();
  private started = false;
  private refreshTimer?: NodeJS.Timeout;
  private operations: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  readonly root: string;
  readonly registryPath: string;
  onCapabilitiesChanged(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  constructor(readonly options: PluginHostOptions) {
    this.root = path.resolve(options.stateRoot, 'plugins');
    this.registryPath = path.join(this.root, 'registry.json');
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operations.then(operation, operation); this.operations = next.catch(() => {}); return next;
  }
  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.registryPath, 'utf8')) as Registry;
      if (parsed.version !== 1 || !Number.isSafeInteger(parsed.revision) || !parsed.plugins) throw new Error('Unsupported plugin registry');
      for (const [id, record] of Object.entries(parsed.plugins)) { validateManifest(record.manifest); if (id !== record.manifest.id) throw new Error('Plugin registry identity mismatch'); }
      this.registry = parsed;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  private async save(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    const lockPath = path.join(this.root, 'registry.lock');
    let lock;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { lock = await fs.open(lockPath, 'wx'); await lock.writeFile(JSON.stringify({ pid: process.pid })); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        try {
          const prior = JSON.parse(await fs.readFile(lockPath, 'utf8'));
          if (Number.isSafeInteger(prior.pid)) {
            try { process.kill(prior.pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') { await fs.unlink(lockPath); continue; } }
          }
        } catch { /* An active writer may not have written its lock body yet. */ }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    if (!lock) throw new CapabilityError('PLUGIN_REGISTRY_BUSY', 'Another process is updating plugin state');
    const temporary = this.registryPath + '.' + randomUUID() + '.tmp';
    try {
      let currentRevision = 0;
      try { currentRevision = JSON.parse(await fs.readFile(this.registryPath, 'utf8')).revision; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (currentRevision !== this.registry.revision) throw new CapabilityError('PLUGIN_REGISTRY_CHANGED', 'Reload plugin registry before retrying the lifecycle change');
      const updated = { ...this.registry, revision: currentRevision + 1 };
      await fs.writeFile(temporary, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600 });
      await fs.rename(temporary, this.registryPath); this.registry.revision = updated.revision;
      for (const listener of this.listeners) { try { listener(); } catch { /* observers do not own lifecycle */ } }
    } finally { await fs.rm(temporary, { force: true }); await lock.close(); await fs.rm(lockPath, { force: true }); }
  }
  dataRoot(id: string): string { if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) throw new CapabilityError('PLUGIN_ID_INVALID', 'Invalid plugin id'); return path.join(this.root, id, 'data'); }
  list(): PluginRecord[] { return Object.values(this.registry.plugins).map(record => ({ ...record, manifest: structuredClone(record.manifest) })).sort((a, b) => a.manifest.id.localeCompare(b.manifest.id)); }
  async install(manifest: PluginManifest, options: { enabled?: boolean; settings?: Record<string, unknown> } = {}): Promise<void> {
    return this.serial(async () => {
      validateManifest(manifest); await this.load();
      const prior = this.registry.plugins[manifest.id];
      if (prior?.installed) {
        if (prior.manifest.version === manifest.version && prior.manifest.entry === manifest.entry) return;
        throw new CapabilityError('PLUGIN_UPGRADE_REQUIRED', 'Use upgrade to replace an installed plugin');
      }
      this.registry.plugins[manifest.id] = { manifest: structuredClone(manifest), installed: true, installationSource: 'manual', enabled: options.enabled ?? false, schemaVersion: prior?.schemaVersion ?? manifest.dataSchemaVersion, state: options.enabled ? 'installed' : 'disabled', settings: options.settings ?? prior?.settings };
      await this.save();
      if (this.started && options.enabled) await this.activate(manifest.id, new Set());
    });
  }
  async ensureBundled(manifests: PluginManifest[]): Promise<void> {
    return this.serial(async () => {
      await this.load();
      for (const manifest of manifests) {
        validateManifest(manifest);
        const record = this.registry.plugins[manifest.id];
        if (!record) {
          this.registry.plugins[manifest.id] = {
            manifest: structuredClone(manifest), installed: true, enabled: true,
            installationSource: 'distribution', schemaVersion: manifest.dataSchemaVersion, state: 'installed'
          };
          await this.save();
          if (this.started) await this.activate(manifest.id, new Set()).catch(() => {});
          continue;
        }
        // A tombstone or user-managed installation is never claimed by the distribution.
        if (!record.installed || record.installationSource !== 'distribution') continue;
        if (bundleContract(record.manifest) !== bundleContract(manifest) || record.schemaVersion !== manifest.dataSchemaVersion) {
          const driver = this.drivers.get(manifest.id);
          this.drivers.delete(manifest.id); this.dependencies.delete(manifest.id);
          await this.stopDriver(driver).catch(() => {});
          const gate = { version: manifest.version, dataSchemaVersion: manifest.dataSchemaVersion };
          const state = record.enabled ? 'faulted' : 'disabled';
          const error = 'PLUGIN_UPGRADE_REQUIRED: Bundled contract changed; explicitly upgrade before loading this installation';
          const changed = JSON.stringify(record.bundleUpgradeRequired) !== JSON.stringify(gate)
            || record.state !== state || record.error !== error;
          record.bundleUpgradeRequired = gate; record.state = state; record.error = error;
          if (changed) await this.save();
          continue;
        }
        if (record.manifest.entry === manifest.entry) continue;
        const driver = this.drivers.get(manifest.id);
        this.drivers.delete(manifest.id); this.dependencies.delete(manifest.id);
        await this.stopDriver(driver).catch(() => {});
        // Exact contract: only the package location changes. No migration or data reset.
        let oldEntryMissing = false;
        try { await fs.access(record.manifest.entry); }
        catch (error) { oldEntryMissing = (error as NodeJS.ErrnoException).code === 'ENOENT'; }
        const recoveredMissingEntry = oldEntryMissing && record.state === 'faulted' && record.error?.startsWith('ENOENT:');
        record.manifest.entry = manifest.entry;
        if (!record.bundleUpgradeRequired && (driver || recoveredMissingEntry)) {
          record.state = record.enabled ? 'installed' : 'disabled'; delete record.error;
        }
        await this.save();
        if (this.started && record.enabled && record.state !== 'faulted' && !record.bundleUpgradeRequired)
          await this.activate(manifest.id, new Set()).catch(() => {});
      }
      for (const id of [...this.drivers.keys()]) if (!this.dependenciesAvailable(id))
        await this.markFault(id, new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'Bundled provider was replaced'));
    });
  }
  private candidates(name: string, version = '*', healthyOnly = true): Candidate[] {
    const result: Candidate[] = [];
    for (const [id, record] of Object.entries(this.registry.plugins)) {
      if (!record.installed || !record.enabled || record.bundleUpgradeRequired || (healthyOnly && (!this.drivers.has(id) || record.state !== 'enabled' || !this.dependenciesAvailable(id)))) continue;
      for (const capability of record.manifest.capabilities) if (capability.name === name && compatible(capability.version, version)) result.push({ id, capability });
    }
    return result.sort((a, b) => (b.capability.priority ?? 0) - (a.capability.priority ?? 0) || a.id.localeCompare(b.id));
  }
  capabilities(): string[] {
    const names = new Set<string>();
    for (const id of this.drivers.keys()) {
      const record = this.registry.plugins[id];
      if (record?.state !== 'enabled' || record.bundleUpgradeRequired || !this.dependenciesAvailable(id)) continue;
      for (const cap of record.manifest.capabilities) if (!['augmenter', 'observer'].includes(cap.role ?? 'provider')) names.add(cap.name);
    }
    return [...names].sort();
  }
  advertisements(): Capability[] {
    return this.capabilities().flatMap(name => this.candidates(name).filter(c => ['provider', 'fallback'].includes(c.capability.role ?? 'provider')).slice(0, 1).map(c => ({ ...c.capability })));
  }
  diagnostics(): { capability: string; code: string; providers: string[] }[] {
    const names = new Set(Object.values(this.registry.plugins).flatMap(r => r.manifest.capabilities.map(c => c.name)));
    return [...names].flatMap(name => {
      const providers = this.candidates(name).filter(c => (c.capability.role ?? 'provider') === 'provider');
      return providers.length > 1 && (providers[0].capability.priority ?? 0) === (providers[1].capability.priority ?? 0) ? [{ capability: name, code: 'PRIORITY_TIE_LEXICAL_ID', providers: providers.map(p => p.id) }] : [];
    });
  }
  private assertDependencyPath(id: string, visiting: Set<string>): void {
    if (visiting.has(id)) throw new CapabilityError('CAPABILITY_CYCLE', `Capability dependency cycle at ${id}`);
    const next = new Set(visiting).add(id);
    for (const dependency of this.dependencies.get(id)?.values() ?? []) this.assertDependencyPath(dependency.providerId, next);
  }
  private dependenciesAvailable(id: string, visiting = new Set<string>()): boolean {
    const record = this.registry.plugins[id];
    if (!record || record.bundleUpgradeRequired || visiting.has(id)) return false;
    const next = new Set(visiting).add(id);
    return (record.manifest.requires ?? []).every(requirement => {
      const binding = this.dependencies.get(id)?.get(requirement.name);
      return binding && binding.requiredVersion === requirement.version
        && this.drivers.get(binding.providerId) === binding.driver
        && this.registry.plugins[binding.providerId]?.state === 'enabled'
        && this.dependenciesAvailable(binding.providerId, next);
    });
  }
  private async activate(id: string, visiting: Set<string>): Promise<void> {
    const record = this.registry.plugins[id];
    if (record?.bundleUpgradeRequired) throw new CapabilityError('PLUGIN_UPGRADE_REQUIRED', 'Explicitly upgrade the changed bundled plugin before enabling it');
    if (this.drivers.has(id)) { this.assertDependencyPath(id, visiting); return; }
    if (!record?.installed || !record.enabled) throw new CapabilityError('PLUGIN_DISABLED', 'Plugin is not enabled');
    if (visiting.has(id)) throw new CapabilityError('CAPABILITY_CYCLE', `Capability dependency cycle at ${id}`);
    const next = new Set(visiting).add(id);
    const bindings = new Map<string, DependencyBinding>();
    try {
      for (const requirement of record.manifest.requires ?? []) {
        const providers = this.candidates(requirement.name, requirement.version, false).filter(c => ['provider', 'fallback'].includes(c.capability.role ?? 'provider'));
        if (!providers.length) throw new CapabilityError('CAPABILITY_DEPENDENCY_MISSING', `No compatible provider for ${requirement.name}`);
        const provider = providers[0]; await this.activate(provider.id, next);
        const providerDriver = this.drivers.get(provider.id);
        if (!providerDriver || !this.dependenciesAvailable(provider.id)) throw new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'Required provider is unavailable');
        bindings.set(requirement.name, { providerId: provider.id, driver: providerDriver, requiredVersion: requirement.version });
      }
      await this.stopOwnedDrivers(id);
      await fs.access(record.manifest.entry);
      await fs.mkdir(this.dataRoot(id), { recursive: true });
      const driver = createPluginDriver(record.manifest, {
        deviceId: this.options.deviceId, dataRoot: this.dataRoot(id), projectRoots: this.options.projectRoots ?? [], sourceRoots: this.options.sourceRoots ?? [], previousSchemaVersion: record.schemaVersion, settings: record.settings
      }, error => { void this.serial(() => this.drivers.get(id) === driver ? this.markFault(id, error) : Promise.resolve()); },
      async (name, input, options) => {
        const binding = this.dependencies.get(id)?.get(name);
        if (this.drivers.get(id) !== driver || !binding || binding.requiredVersion !== options.version
          || this.drivers.get(binding.providerId) !== binding.driver || !this.dependenciesAvailable(binding.providerId))
          throw new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'Bound dependency provider is unavailable');
        // Call the pinned provider directly; dependency services do not re-enter
        // augmenters/observers or select a new edge during an active invocation.
        return binding.driver.invoke(name, input, options.signal);
      });
      this.dependencies.set(id, bindings); this.drivers.set(id, driver); this.ownedDrivers.set(driver, id);
      await driver.start(); record.state = 'enabled'; record.schemaVersion = record.manifest.dataSchemaVersion; delete record.error; await this.save();
    } catch (error) { await this.markFault(id, error as Error); throw error; }
  }
  private async stopDriver(driver?: PluginDriver): Promise<void> {
    if (!driver) return;
    await driver.stop(); this.ownedDrivers.delete(driver);
  }
  private async stopOwnedDrivers(id: string): Promise<void> {
    await Promise.all([...this.ownedDrivers].filter(([, owner]) => owner === id).map(([driver]) => this.stopDriver(driver)));
  }
  private async markFault(id: string, error: Error): Promise<void> {
    const driver = this.drivers.get(id); this.drivers.delete(id); this.dependencies.delete(id);
    const record = this.registry.plugins[id];
    if (record) { record.state = 'faulted'; record.error = `${(error as CapabilityError).code ?? 'PLUGIN_FAULT'}: ${error.message}`; await this.save().catch(() => {}); }
    await this.stopDriver(driver).catch(() => {});
    // Dependency loss degrades only dependents, not ordinary Device tools.
    for (const dependent of [...this.drivers.keys()]) {
      if (!this.dependenciesAvailable(dependent)) await this.markFault(dependent, new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', `A required capability became unavailable`));
    }
  }
  async start(): Promise<void> {
    await this.load(); this.started = true;
    for (const [id, record] of Object.entries(this.registry.plugins)) if (record.installed && record.enabled && record.state !== 'faulted') await this.activate(id, new Set()).catch(() => {});
    // Lifecycle changes from the CLI are atomically picked up without a second runtime.
    this.refreshTimer = setInterval(() => { void this.serial(() => this.refresh()).catch(() => {}); }, 1000); this.refreshTimer.unref();
  }
  private async refresh(): Promise<void> {
    const previous = this.registry; await this.load(); if (previous.revision === this.registry.revision) return;
    for (const [id, driver] of [...this.drivers]) {
      const current = this.registry.plugins[id];
      if (!current?.installed || !current.enabled || current.bundleUpgradeRequired || JSON.stringify(current.manifest) !== JSON.stringify(previous.plugins[id]?.manifest)) { this.drivers.delete(id); this.dependencies.delete(id); await this.stopDriver(driver); }
      else current.state = 'enabled';
    }
    for (const [id, current] of Object.entries(this.registry.plugins)) if (current.installed && current.enabled && current.state !== 'faulted' && !this.drivers.has(id)) await this.activate(id, new Set()).catch(() => {});
    for (const id of [...this.drivers.keys()]) {
      if (!this.dependenciesAvailable(id)) await this.markFault(id, new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'A provider was disabled by another local process'));
    }
    for (const listener of this.listeners) { try { listener(); } catch { /* observers do not own lifecycle */ } }
  }
  async enable(id: string): Promise<void> {
    return this.serial(async () => { await this.load(); const record = this.registry.plugins[id]; if (!record?.installed) throw new CapabilityError('PLUGIN_NOT_INSTALLED', 'Plugin is not installed'); if (record.bundleUpgradeRequired) throw new CapabilityError('PLUGIN_UPGRADE_REQUIRED', 'Explicitly upgrade the changed bundled plugin before enabling it'); record.enabled = true; record.state = 'installed'; delete record.error; await this.save(); if (this.started) await this.activate(id, new Set()); });
  }
  async disable(id: string): Promise<void> {
    return this.serial(async () => { await this.load(); const record = this.registry.plugins[id]; if (!record) throw new CapabilityError('PLUGIN_NOT_FOUND', 'Unknown plugin'); this.drivers.delete(id); this.dependencies.delete(id); await this.stopOwnedDrivers(id); record.enabled = false; record.state = 'disabled'; delete record.error; await this.save(); for (const dependent of [...this.drivers.keys()]) { if (!this.dependenciesAvailable(dependent)) await this.markFault(dependent, new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'Required provider disabled')); } });
  }
  async uninstall(id: string): Promise<void> {
    await this.disable(id);
    return this.serial(async () => { await this.load(); const record = this.registry.plugins[id]; record.installed = false; record.state = 'uninstalled'; await this.save(); });
  }
  async purge(id: string): Promise<void> {
    return this.serial(async () => { await this.load(); const record = this.registry.plugins[id]; if (record?.enabled || this.drivers.has(id)) throw new CapabilityError('PLUGIN_STILL_ENABLED', 'Disable plugin before explicitly purging its data'); await fs.rm(this.dataRoot(id), { recursive: true, force: true }); });
  }
  async configure(id: string, settings: Record<string, unknown>): Promise<void> {
    return this.serial(async () => { await this.load(); const record = this.registry.plugins[id]; if (!record) throw new CapabilityError('PLUGIN_NOT_FOUND', 'Unknown plugin'); if (this.drivers.has(id)) throw new CapabilityError('PLUGIN_STILL_ENABLED', 'Disable plugin before changing settings'); record.settings = structuredClone(settings); await this.save(); });
  }
  async upgrade(manifest: PluginManifest): Promise<void> {
    return this.serial(async () => {
      validateManifest(manifest); await this.load(); const old = this.registry.plugins[manifest.id];
      if (!old?.installed) throw new CapabilityError('PLUGIN_NOT_INSTALLED', 'Install the plugin first');
      const previous = structuredClone(old); this.drivers.delete(manifest.id); this.dependencies.delete(manifest.id); await this.stopOwnedDrivers(manifest.id);
      const data = this.dataRoot(manifest.id), backup = path.join(this.root, manifest.id, 'upgrade-backup-' + randomUUID());
      await fs.mkdir(data, { recursive: true }); await fs.cp(data, backup, { recursive: true });
      old.manifest = structuredClone(manifest); old.state = 'installed'; delete old.error; delete old.bundleUpgradeRequired; await this.save();
      try {
        // Migration is explicit even when the daemon is not running. It uses the new isolated driver.
        const shouldEnable = old.enabled; old.enabled = true; await this.activate(manifest.id, new Set());
        if (!this.started || !shouldEnable) { const current = this.drivers.get(manifest.id); this.drivers.delete(manifest.id); this.dependencies.delete(manifest.id); await this.stopDriver(current); old.enabled = shouldEnable; old.state = shouldEnable ? 'installed' : 'disabled'; await this.save(); }
      } catch (error) {
        this.drivers.delete(manifest.id); this.dependencies.delete(manifest.id); await this.stopOwnedDrivers(manifest.id);
        await fs.rm(data, { recursive: true, force: true }); await fs.cp(backup, data, { recursive: true }); this.registry.plugins[manifest.id] = previous; await this.save();
        if (this.started && previous.enabled) await this.activate(manifest.id, new Set()).catch(() => {});
        throw error;
      } finally {
        for (const dependent of [...this.drivers.keys()]) {
          if (!this.dependenciesAvailable(dependent)) await this.markFault(dependent,
            new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'Pinned provider changed during upgrade'));
        }
      }
    });
  }
  async invoke(name: string, input: unknown, options: { version?: string; signal?: AbortSignal } = {}): Promise<unknown> {
    const candidates = this.candidates(name, options.version ?? '*');
    const providers = candidates.filter(c => (c.capability.role ?? 'provider') === 'provider');
    const fallback = candidates.filter(c => c.capability.role === 'fallback');
    let result: unknown, succeeded = false, lastError: unknown;
    for (const candidate of [...providers, ...fallback]) {
      try { result = await this.drivers.get(candidate.id)!.invoke(name, input, options.signal); succeeded = true; break; }
      catch (error) { lastError = error; if (options.signal?.aborted) throw error; }
    }
    if (!succeeded) throw lastError ?? new CapabilityError('CAPABILITY_UNAVAILABLE', `No healthy compatible provider for ${name}`);
    for (const candidate of candidates.filter(c => c.capability.role === 'augmenter')) {
      try { result = await this.drivers.get(candidate.id)?.invoke(name, { input, result }, options.signal) ?? result; } catch { /* provider result remains usable */ }
    }
    for (const candidate of candidates.filter(c => c.capability.role === 'observer')) {
      try { await this.drivers.get(candidate.id)?.invoke(name, { input, result }, options.signal); } catch { /* observations cannot invalidate a provider result */ }
    }
    return result;
  }
  async close(): Promise<void> {
    if (this.refreshTimer) clearInterval(this.refreshTimer); this.started = false;
    await this.operations;
    this.drivers.clear(); this.dependencies.clear();
    const released = await Promise.allSettled([...this.ownedDrivers.keys()].map(driver => this.stopDriver(driver)));
    const failures = released.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length) throw new CapabilityError('PLUGIN_TERMINATION_FAILED',
      `Cannot prove ${failures.length} plugin driver(s) released their resources; runtime ownership must remain held`);
  }
}
