/** Language-neutral exchange shape. Platform contracts must not depend on this plugin. */
export type KnowledgeStatus = 'hypothesis' | 'observed' | 'validated' | 'stale' | 'superseded' | 'withdrawn';
export interface KnowledgeScope { projectId?: string; visibility: 'project' | 'account' | 'local' }
export interface KnowledgeEvidence {
  id: string; originDeviceId: string; sourceId: string; sourceRef: string; recordHash: string;
  kind: 'source_trace' | 'tool_receipt' | 'postcondition'; sourceAvailable: boolean; observedAt: number;
}
export interface KnowledgeCard {
  id: string; version: number; contentHash: string; summary: string; body: string; status: KnowledgeStatus;
  originDeviceId: string; servingDeviceId: string; scope: KnowledgeScope; evidence: KnowledgeEvidence[];
  derivedFrom: string[]; provenance: string[]; updatedAt: number; lastVerifiedAt: number | null;
}
export interface KnowledgePreview {
  id: string; read_ref: string; version: number; contentHash: string; summary: string; status: KnowledgeStatus;
  originDeviceId: string; servingDeviceId: string; scope: KnowledgeScope; evidenceCount: number;
  updatedAt: number; lastVerifiedAt: number | null;
}
export interface ValidationReceipt {
  executionId: string; exitCode: number; postconditionPassed: boolean;
  output: string; validatorVersion: string;
}
export interface PalaceOptions {
  dataRoot: string; deviceId: string; projectRoots?: string[]; sourceRoots?: string[]; autoIndex?: boolean; discoverKnownSources?: boolean;
  indexBudget?: { maxRecords?:number;maxBytes?:number;maxFiles?:number;intervalMs?:number };
  /** Trusted installation policy hook. Never deserialized from a knowledge request. */
  validationRunner?: (card: KnowledgeCard, signal?: AbortSignal) => Promise<ValidationReceipt>;
}
export interface InvokeContext { signal?: AbortSignal }
export interface PalaceProvider {
  start(): Promise<void>; stop(): Promise<void>;
  invoke(capability: string, input: unknown, context?: InvokeContext): Promise<unknown>;
}
