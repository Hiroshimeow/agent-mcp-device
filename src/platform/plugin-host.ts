import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CapabilityError, compatible, validateManifest, type Capability, type PluginManifest, type PluginRecord } from './plugin-contract.js';
import { createPluginDriver, type PluginDriver } from './plugin-driver.js';
import { coordinationOwnerAbandoned, processAppearsDead, repairCoordinationLock, withCoordinationLock } from './coordination-lock.js';
import { processBirth, processNamespace, type ProcessNamespace } from './process-identity.js';

type StoredPluginRecord = PluginRecord & { settings?: Record<string, unknown>; lifecycleToken?: string };
interface Registry { version: 1; revision: number; plugins: Record<string, StoredPluginRecord>; }
type UpgradePhase = 'preparing' | 'candidate-ready' | 'swapping' | 'swapped' | 'rollback' | 'committed';
interface UpgradeIntent {
  version: 1; id: string; token: string; pid: number; startedAt: number; processBirth?:string; namespace?:ProcessNamespace; phase: UpgradePhase;
  candidate: string; backup: string; failed: string;
  previous: StoredPluginRecord; next: StoredPluginRecord;
}
export interface PluginHostOptions { stateRoot: string; deviceId: string; projectRoots?: string[]; sourceRoots?: string[]; }
type Candidate = { id: string; capability: Capability };
type DependencyBinding = { providerId: string; driver: PluginDriver; requiredVersion: string };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, canonical(item)]));
  return value;
}
const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const activeUpgradeTokens = new Set<string>();
function bundleContract(manifest: PluginManifest, options: { ignoreVersion?: boolean } = {}): string {
  const { entry: _entry, version: _version, ...rest } = manifest;
  const contract = options.ignoreVersion ? rest : { ...rest, version: manifest.version };
  return JSON.stringify(canonical(contract));
}
async function pathExists(filename: string): Promise<boolean> {
  try { await fs.lstat(filename); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
async function renameWithRetry(source: string, target: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(source, target); return; }
    catch (error) {
      if (process.platform !== 'win32' || attempt >= 7 || !['EPERM', 'EBUSY', 'EACCES'].includes(String((error as NodeJS.ErrnoException).code))) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(250, 20 * (2 ** attempt))));
    }
  }
}
async function writeJsonAtomic(filename: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = filename + '.' + randomUUID() + '.tmp';
  const text = JSON.stringify(value, null, 2) + '\n';
  if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new CapabilityError('PLUGIN_UPGRADE_INTENT_INVALID', 'Plugin upgrade intent exceeds the bounded metadata limit');
  try {
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
    await renameWithRetry(temporary, filename);
  } finally { await fs.rm(temporary, { force: true }); }
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
  private registrySavePending = false;
  private pendingFaults = new Map<string, { previous: StoredPluginRecord; fault: StoredPluginRecord }>();
  private operations: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  readonly root: string;
  readonly registryPath: string;
  private notifyCapabilitiesChanged(): void { for (const listener of this.listeners) { try { listener(); } catch { /* observers do not own lifecycle */ } } }
  onCapabilitiesChanged(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  constructor(readonly options: PluginHostOptions) {
    this.root = path.resolve(options.stateRoot, 'plugins');
    this.registryPath = path.join(this.root, 'registry.json');
  }
  private pluginRoot(id: string): string { return path.join(this.root, id); }
  private upgradeIntentPath(id: string): string { return path.join(this.pluginRoot(id), 'upgrade-intent.json'); }
  private validateUpgradeIntent(value: unknown, id: string): UpgradeIntent {
    const intent=value as UpgradeIntent;
    const phases:UpgradePhase[]=['preparing','candidate-ready','swapping','swapped','rollback','committed'];
    if(!intent||intent.version!==1||intent.id!==id||!phases.includes(intent.phase)||
      !Number.isSafeInteger(intent.pid)||intent.pid<1||!Number.isFinite(intent.startedAt)||
      (intent.processBirth!==undefined&&(typeof intent.processBirth!=='string'||intent.processBirth.length>256))||
      (intent.namespace!==undefined&&(!intent.namespace||typeof intent.namespace.platform!=='string'||typeof intent.namespace.hostname!=='string'))||
      !/^[a-f0-9-]{36}$/i.test(intent.token)||intent.candidate!==`upgrade-candidate-${intent.token}`||
      intent.backup!==`upgrade-backup-${intent.token}`||intent.failed!==`upgrade-failed-${intent.token}`)
      throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Invalid upgrade intent for ${id}`);
    validateManifest(intent.previous?.manifest);validateManifest(intent.next?.manifest);
    if(intent.previous.manifest.id!==id||intent.next.manifest.id!==id)
      throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Upgrade intent identity mismatch for ${id}`);
    return intent;
  }
  private async writeUpgradeIntent(intent: UpgradeIntent): Promise<void> {
    await writeJsonAtomic(this.upgradeIntentPath(intent.id),intent);
  }
  private upgradePaths(intent: UpgradeIntent): { data:string;candidate:string;backup:string;failed:string;intentPath:string } {
    const root=this.pluginRoot(intent.id);
    return {data:path.join(root,'data'),candidate:path.join(root,intent.candidate),backup:path.join(root,intent.backup),failed:path.join(root,intent.failed),intentPath:this.upgradeIntentPath(intent.id)};
  }
  private recordGenerationMatches(actual: StoredPluginRecord|undefined, expected: StoredPluginRecord): boolean {
    // Activation may transiently change enabled/state/schema while validating a
    // new generation. Manifest plus provenance identifies the generation; the
    // complete prior record is restored on rollback.
    return !!actual&&sameValue(actual.manifest,expected.manifest)&&actual.installationSource===expected.installationSource;
  }
  private async rollbackUpgradeIntent(intent: UpgradeIntent): Promise<void> {
    const paths=this.upgradePaths(intent),current=this.registry.plugins[intent.id];
    if(!this.recordGenerationMatches(current,intent.previous)&&!this.recordGenerationMatches(current,intent.next))
      throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Plugin ${intent.id} changed outside its pending upgrade`);
    intent.phase='rollback';await this.writeUpgradeIntent(intent);
    const backup=await pathExists(paths.backup),data=await pathExists(paths.data),failed=await pathExists(paths.failed);
    if(backup){
      if(data){if(failed)throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Ambiguous rollback trees for ${intent.id}`);await renameWithRetry(paths.data,paths.failed);}
      await renameWithRetry(paths.backup,paths.data);
    }else if(!(data&&(failed||this.recordGenerationMatches(current,intent.previous)))){
      throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Rollback backup is unavailable for ${intent.id}`);
    }
    this.registry.plugins[intent.id]=structuredClone(intent.previous);await this.save();
    await fs.rm(paths.failed,{recursive:true,force:true});await fs.rm(paths.candidate,{recursive:true,force:true});await fs.rm(paths.backup,{recursive:true,force:true});
    await fs.rm(paths.intentPath,{force:true});
  }
  private async recoverUpgradeIntent(intent: UpgradeIntent): Promise<void> {
    const paths=this.upgradePaths(intent);
    if(activeUpgradeTokens.has(intent.token))throw new CapabilityError('PLUGIN_UPGRADE_BUSY',`Plugin ${intent.id} is being upgraded in this process`);
    if(intent.pid!==process.pid){
      // Namespace-bearing intents are never recovered from PID liveness alone.
      // When birth identity is absent we can still prove abandonment only if the
      // recorded namespace matches and that PID no longer exists there.
      const abandoned=intent.namespace
        ? await coordinationOwnerAbandoned({pid:intent.pid,token:intent.token,...(intent.processBirth?{processBirth:intent.processBirth}:{}),namespace:intent.namespace})
        : processAppearsDead(intent.pid);
      if(!abandoned)throw new CapabilityError('PLUGIN_UPGRADE_BUSY',`Plugin ${intent.id} is being upgraded by a live or uninspectable owner PID ${intent.pid}`);
    }
    if(intent.phase==='committed'){
      if(!this.recordGenerationMatches(this.registry.plugins[intent.id],intent.next)||!await pathExists(paths.data))
        throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Committed upgrade state is incomplete for ${intent.id}`);
      await fs.rm(paths.backup,{recursive:true,force:true});await fs.rm(paths.candidate,{recursive:true,force:true});await fs.rm(paths.failed,{recursive:true,force:true});await fs.rm(paths.intentPath,{force:true});return;
    }
    if(intent.phase==='preparing'||intent.phase==='candidate-ready'){
      if(await pathExists(paths.backup)||!await pathExists(paths.data)){await this.rollbackUpgradeIntent(intent);return;}
      if(!this.recordGenerationMatches(this.registry.plugins[intent.id],intent.previous))
        throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Prepared upgrade registry changed for ${intent.id}`);
      await fs.rm(paths.candidate,{recursive:true,force:true});await fs.rm(paths.failed,{recursive:true,force:true});await fs.rm(paths.intentPath,{force:true});return;
    }
    if(intent.phase==='swapping'&&!await pathExists(paths.backup)&&await pathExists(paths.data)&&await pathExists(paths.candidate)){
      if(!this.recordGenerationMatches(this.registry.plugins[intent.id],intent.previous))
        throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Upgrade registry changed before swap for ${intent.id}`);
      await fs.rm(paths.candidate,{recursive:true,force:true});await fs.rm(paths.intentPath,{force:true});return;
    }
    await this.rollbackUpgradeIntent(intent);
  }
  private async recoverUpgradeIntents(): Promise<void> {
    for(const id of Object.keys(this.registry.plugins)){
      const filename=this.upgradeIntentPath(id);if(!await pathExists(filename))continue;
      const stat=await fs.lstat(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)
        throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Unsafe upgrade intent for ${id}`);
      const intent=this.validateUpgradeIntent(JSON.parse(await fs.readFile(filename,'utf8')),id);
      await this.recoverUpgradeIntent(intent);
    }
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operations.then(operation, operation); this.operations = next.catch(() => {}); return next;
  }
  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.registryPath, 'utf8')) as Registry;
      if (parsed.version !== 1 || !Number.isSafeInteger(parsed.revision) || !parsed.plugins) throw new Error('Unsupported plugin registry');
      for (const [id, record] of Object.entries(parsed.plugins)) { validateManifest(record.manifest); if (id !== record.manifest.id) throw new Error('Plugin registry identity mismatch'); }
      for (const [id, pending] of this.pendingFaults) {
        const current = parsed.plugins[id];
        const sameActivationIntent = current && ['installed','enabled'].includes(current.state)
          && ['installed','enabled'].includes(pending.previous.state)
          && sameValue({ ...current, state: 'installed' }, { ...pending.previous, state: 'installed' });
        if (sameValue(current, pending.previous) || sameValue(current, pending.fault) || sameActivationIntent) {
          parsed.plugins[id] = structuredClone(pending.fault);
          this.registrySavePending = true;
        } else {
          // A changed record (including an explicit enable of identical state)
          // owns newer intent. Unrelated registry revisions do not clear faults.
          this.pendingFaults.delete(id);
        }
      }
      this.registry = parsed;
      await this.recoverUpgradeIntents();
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  private registryLockOptions(){
    return {
      attempts:100,staleMs:5000,retainAbandoned:true,messagePrefix:'Plugin registry',
      codes:{busy:'PLUGIN_REGISTRY_BUSY',active:'PLUGIN_REGISTRY_LOCK_ACTIVE',recoveryRequired:'PLUGIN_REGISTRY_RECOVERY_REQUIRED'}
    } as const;
  }
  async repairRegistryLock():Promise<{recovered:boolean;reason?:string}>{
    await fs.mkdir(this.root,{recursive:true});
    return repairCoordinationLock(path.join(this.root,'registry.lock'),{...this.registryLockOptions(),breakLock:true});
  }
  private async save(): Promise<void> {
    await fs.mkdir(this.root,{recursive:true});
    const lockPath=path.join(this.root,'registry.lock');
    await withCoordinationLock(lockPath,async()=>{
      const temporary=this.registryPath+'.'+randomUUID()+'.tmp';
      try{
        let currentRevision=0;
        try{currentRevision=JSON.parse(await fs.readFile(this.registryPath,'utf8')).revision;}
        catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
        if(currentRevision!==this.registry.revision)throw new CapabilityError('PLUGIN_REGISTRY_CHANGED','Reload plugin registry before retrying the lifecycle change');
        const updated={...this.registry,revision:currentRevision+1};
        const handle=await fs.open(temporary,'wx',0o600);
        try{await handle.writeFile(JSON.stringify(updated,null,2)+'\n');await handle.sync();}
        finally{await handle.close();}
        await renameWithRetry(temporary,this.registryPath);this.registry.revision=updated.revision;this.notifyCapabilitiesChanged();
        // Rename has already published the revision even if directory sync fails.
        // Never retry from the old revision in that case. Windows cannot open
        // directory handles this way; POSIX sync failures remain observable.
        if(process.platform!=='win32'){
          const directory=await fs.open(this.root,'r');
          try{await directory.sync();}finally{await directory.close();}
        }
        this.pendingFaults.clear();
      }finally{await fs.rm(temporary,{force:true});}
    },this.registryLockOptions());
  }
  dataRoot(id: string): string { if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) throw new CapabilityError('PLUGIN_ID_INVALID', 'Invalid plugin id'); return path.join(this.root, id, 'data'); }
  list(): PluginRecord[] { return Object.values(this.registry.plugins).map(record => ({ ...record, manifest: structuredClone(record.manifest) })).sort((a, b) => a.manifest.id.localeCompare(b.manifest.id)); }
  async install(manifest: PluginManifest, options: { enabled?: boolean; settings?: Record<string, unknown>; installationSource?: 'distribution'|'manual' } = {}): Promise<void> {
    return this.serial(async () => {
      validateManifest(manifest); await this.load();
      const prior = this.registry.plugins[manifest.id];
      if (prior?.installed) {
        if (prior.manifest.version === manifest.version && prior.manifest.entry === manifest.entry) return;
        throw new CapabilityError('PLUGIN_UPGRADE_REQUIRED', 'Use upgrade to replace an installed plugin');
      }
      this.registry.plugins[manifest.id] = { manifest: structuredClone(manifest), installed: true, installationSource: options.installationSource ?? 'manual', enabled: options.enabled ?? false, schemaVersion: prior?.schemaVersion ?? manifest.dataSchemaVersion, state: options.enabled ? 'installed' : 'disabled', settings: options.settings ?? prior?.settings };
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
        const runtimeContractMatches=bundleContract(record.manifest,{ignoreVersion:true})===bundleContract(manifest,{ignoreVersion:true})
          && record.schemaVersion===manifest.dataSchemaVersion;
        if (!runtimeContractMatches) {
          const driver = this.drivers.get(manifest.id);
          this.drivers.delete(manifest.id); this.dependencies.delete(manifest.id); if(driver)this.notifyCapabilitiesChanged();
          await this.stopDriver(driver).catch(() => {});
          const gate = { version: manifest.version, dataSchemaVersion: manifest.dataSchemaVersion };
          const state = record.enabled ? 'faulted' : 'disabled';
          const error = 'PLUGIN_UPGRADE_REQUIRED: Bundled contract changed; run plugins upgrade '+manifest.id+' --bundled before loading this installation';
          const changed = JSON.stringify(record.bundleUpgradeRequired) !== JSON.stringify(gate)
            || record.state !== state || record.error !== error;
          record.bundleUpgradeRequired = gate; record.state = state; record.error = error;
          if (changed) await this.save();
          continue;
        }
        const needsRepin=bundleContract(record.manifest)!==bundleContract(manifest)
          || record.manifest.entry!==manifest.entry || Boolean(record.bundleUpgradeRequired);
        if (!needsRepin) continue;
        const driver = this.drivers.get(manifest.id);
        this.drivers.delete(manifest.id); this.dependencies.delete(manifest.id); if(driver)this.notifyCapabilitiesChanged();
        await this.stopDriver(driver).catch(() => {});
        // Version-only updates and package relocation keep the exact runtime/data contract.
        let oldEntryMissing = false;
        try { await fs.access(record.manifest.entry); }
        catch (error) { oldEntryMissing = (error as NodeJS.ErrnoException).code === 'ENOENT'; }
        const recoveredMissingEntry = oldEntryMissing && record.state === 'faulted' && record.error?.startsWith('ENOENT:');
        const hadUpgradeGate=Boolean(record.bundleUpgradeRequired);
        record.manifest=structuredClone(manifest);delete record.bundleUpgradeRequired;
        if(driver||recoveredMissingEntry||hadUpgradeGate){
          record.state=record.enabled?'installed':'disabled';delete record.error;
        }
        await this.save();
        if (this.started && record.enabled)
          await this.activate(manifest.id, new Set()).catch(() => {});
      }
      for (const id of [...this.drivers.keys()]) if (!this.dependenciesAvailable(id))
        await this.markFault(id, new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'Bundled provider was replaced'));
    });
  }
  private candidates(name: string, version = '*', healthyOnly = true): Candidate[] {
    const result: Candidate[] = [];
    for (const [id, record] of Object.entries(this.registry.plugins)) {
      if (!record.installed || !record.enabled || record.state === 'faulted' || record.bundleUpgradeRequired || (healthyOnly && (!this.drivers.has(id) || record.state !== 'enabled' || !this.dependenciesAvailable(id)))) continue;
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
    if (record?.state === 'faulted') throw new CapabilityError('PLUGIN_FAULTED', record.error ?? 'Explicitly enable the faulted plugin before retrying it');
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
      await driver.start(); record.state = 'enabled'; record.schemaVersion = record.manifest.dataSchemaVersion; delete record.error;
      try{await this.save();this.registrySavePending=false;}
      catch(error){
        // The child is already healthy. A metadata rename failure must not turn
        // a running provider into a product fault. Preserve the in-memory state
        // and retry persistence from refresh before loading older metadata.
        this.registrySavePending=true;this.notifyCapabilitiesChanged();
        process.stderr.write(`[plugins] ${id} started; registry persistence will retry: ${(error as Error).message}\n`);
      }
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
    if (driver) this.notifyCapabilitiesChanged();
    const record = this.registry.plugins[id];
    if (record) {
      const previous = this.pendingFaults.get(id)?.previous ?? structuredClone(record);
      record.state = 'faulted'; record.error = `${(error as CapabilityError).code ?? 'PLUGIN_FAULT'}: ${error.message}`;
      this.pendingFaults.set(id, { previous, fault: structuredClone(record) });
      try { await this.save(); }
      catch { this.registrySavePending = true; }
    }
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
    if(this.registrySavePending){
      try{await this.save();this.registrySavePending=false;}
      catch(error){
        if((error as CapabilityError).code!=='PLUGIN_REGISTRY_CHANGED')return;
        // A newer lifecycle revision owns intent. Do not overwrite it with the
        // stale post-start snapshot or let persistence retries starve refresh.
        this.registrySavePending=false;
      }
    }
    const previous = this.registry; await this.load();
    if(this.pendingFaults.size){
      try{await this.save();this.registrySavePending=false;}
      catch{this.registrySavePending=true;}
    }
    if (previous.revision === this.registry.revision) return;
    for (const [id, driver] of [...this.drivers]) {
      const current = this.registry.plugins[id];
      if (!current?.installed || !current.enabled || current.state === 'faulted' || current.bundleUpgradeRequired || JSON.stringify(current.manifest) !== JSON.stringify(previous.plugins[id]?.manifest)) {
        this.drivers.delete(id); this.dependencies.delete(id); this.notifyCapabilitiesChanged(); await this.stopDriver(driver);
      } else current.state = 'enabled';
    }
    for (const [id, current] of Object.entries(this.registry.plugins)) if (current.installed && current.enabled && current.state !== 'faulted' && !this.drivers.has(id)) await this.activate(id, new Set()).catch(() => {});
    for (const id of [...this.drivers.keys()]) {
      if (!this.dependenciesAvailable(id)) await this.markFault(id, new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'A provider was disabled by another local process'));
    }
    this.notifyCapabilitiesChanged();
  }
  async enable(id: string): Promise<void> {
    return this.serial(async () => { await this.load(); const record = this.registry.plugins[id]; if (!record?.installed) throw new CapabilityError('PLUGIN_NOT_INSTALLED', 'Plugin is not installed'); if (record.bundleUpgradeRequired) throw new CapabilityError('PLUGIN_UPGRADE_REQUIRED', 'Explicitly upgrade the changed bundled plugin before enabling it'); record.enabled = true; record.state = 'installed'; record.lifecycleToken = randomUUID(); delete record.error; await this.save(); if (this.started) await this.activate(id, new Set()); });
  }
  async disable(id: string): Promise<void> {
    return this.serial(async () => { await this.load(); const record = this.registry.plugins[id]; if (!record) throw new CapabilityError('PLUGIN_NOT_FOUND', 'Unknown plugin'); const driver=this.drivers.get(id);this.drivers.delete(id); this.dependencies.delete(id);if(driver)this.notifyCapabilitiesChanged(); await this.stopOwnedDrivers(id); record.enabled = false; record.state = 'disabled'; record.lifecycleToken = randomUUID(); delete record.error; await this.save(); for (const dependent of [...this.drivers.keys()]) { if (!this.dependenciesAvailable(dependent)) await this.markFault(dependent, new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'Required provider disabled')); } });
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
  async upgrade(manifest: PluginManifest, options: { installationSource?: 'distribution' | 'manual' } = {}): Promise<void> {
    return this.serial(async () => {
      validateManifest(manifest); await this.load(); const old = this.registry.plugins[manifest.id];
      if (!old?.installed) throw new CapabilityError('PLUGIN_NOT_INSTALLED', 'Install the plugin first');
      const previous=structuredClone(old),next=structuredClone(old),token=randomUUID();
      const [birth,namespace]=await Promise.all([processBirth(process.pid),processNamespace()]);
      next.manifest=structuredClone(manifest);next.installationSource=options.installationSource??old.installationSource;
      next.state='installed';delete next.error;delete next.bundleUpgradeRequired;
      const intent:UpgradeIntent={version:1,id:manifest.id,token,pid:process.pid,startedAt:Date.now(),...(birth?{processBirth:birth}:{}),...(namespace?{namespace}:{}),phase:'preparing',
        candidate:`upgrade-candidate-${token}`,backup:`upgrade-backup-${token}`,failed:`upgrade-failed-${token}`,previous,next};
      const paths=this.upgradePaths(intent),driver=this.drivers.get(manifest.id);
      this.drivers.delete(manifest.id);this.dependencies.delete(manifest.id);if(driver)this.notifyCapabilitiesChanged();await this.stopOwnedDrivers(manifest.id);
      await fs.mkdir(paths.data,{recursive:true});activeUpgradeTokens.add(token);
      try {
        await this.writeUpgradeIntent(intent);
        await fs.cp(paths.data,paths.candidate,{recursive:true,force:false,errorOnExist:true});
        intent.phase='candidate-ready';await this.writeUpgradeIntent(intent);
        intent.phase='swapping';await this.writeUpgradeIntent(intent);
        await renameWithRetry(paths.data,paths.backup);await renameWithRetry(paths.candidate,paths.data);
        intent.phase='swapped';await this.writeUpgradeIntent(intent);
        this.registry.plugins[manifest.id]=structuredClone(next);await this.save();
        const current=this.registry.plugins[manifest.id],shouldEnable=previous.enabled;current.enabled=true;
        await this.activate(manifest.id,new Set());
        if(!this.started||!shouldEnable){
          const validationDriver=this.drivers.get(manifest.id);this.drivers.delete(manifest.id);this.dependencies.delete(manifest.id);
          if(validationDriver)this.notifyCapabilitiesChanged();await this.stopDriver(validationDriver);
          current.enabled=shouldEnable;current.state=shouldEnable?'installed':'disabled';await this.save();
        }
        intent.next=structuredClone(this.registry.plugins[manifest.id]);intent.phase='committed';await this.writeUpgradeIntent(intent);
        await fs.rm(paths.backup,{recursive:true,force:true});await fs.rm(paths.failed,{recursive:true,force:true});await fs.rm(paths.intentPath,{force:true});
      } catch(error) {
        this.drivers.delete(manifest.id);this.dependencies.delete(manifest.id);await this.stopOwnedDrivers(manifest.id).catch(()=>{});
        activeUpgradeTokens.delete(token);
        try {
          if(await pathExists(paths.intentPath)){
            const saved=this.validateUpgradeIntent(JSON.parse(await fs.readFile(paths.intentPath,'utf8')),manifest.id),committed=saved.phase==='committed';
            await this.recoverUpgradeIntent(saved);
            if(committed)return;
          }else this.registry.plugins[manifest.id]=previous;
          if(this.started&&previous.enabled)await this.activate(manifest.id,new Set()).catch(()=>{});
        }catch(recoveryError){
          throw new CapabilityError('PLUGIN_UPGRADE_RECOVERY_REQUIRED',`Upgrade failed and recovery requires inspection: ${String((recoveryError as Error).message??recoveryError)}`);
        }
        throw error;
      } finally {
        activeUpgradeTokens.delete(token);
        for (const dependent of [...this.drivers.keys()]) {
          if (!this.dependenciesAvailable(dependent)) await this.markFault(dependent,
            new CapabilityError('CAPABILITY_DEPENDENCY_UNAVAILABLE', 'Pinned provider changed during upgrade'));
        }
      }
    });
  }
  private unavailableCapability(name:string):CapabilityError {
    const records=Object.values(this.registry.plugins).filter(record=>record.manifest.capabilities.some(capability=>capability.name===name))
      .sort((a,b)=>(Math.max(...b.manifest.capabilities.filter(c=>c.name===name).map(c=>c.priority??0))-
        Math.max(...a.manifest.capabilities.filter(c=>c.name===name).map(c=>c.priority??0))));
    const record=records[0];
    if(!record)return new CapabilityError('CAPABILITY_UNAVAILABLE',`No compatible provider for ${name}`);
    if(!record.installed||record.state==='uninstalled')return new CapabilityError('PLUGIN_UNINSTALLED',`Plugin ${record.manifest.id} is uninstalled`);
    if(record.bundleUpgradeRequired)return new CapabilityError('PLUGIN_UPGRADE_REQUIRED',record.error??`Plugin ${record.manifest.id} requires an explicit bundled upgrade`);
    if(!record.enabled||record.state==='disabled')return new CapabilityError('PLUGIN_DISABLED',`Plugin ${record.manifest.id} is disabled`);
    if(record.state==='faulted')return new CapabilityError('PLUGIN_FAULTED',record.error??`Plugin ${record.manifest.id} is faulted`);
    return new CapabilityError('CAPABILITY_UNAVAILABLE',`No healthy compatible provider for ${name}`);
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
    if (!succeeded) throw lastError ?? this.unavailableCapability(name);
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
