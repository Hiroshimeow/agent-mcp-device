/** Platform exchange contract. No knowledge provider package is imported here. */
export interface KnowledgeScope {
  projectId?: string;
  visibility: 'project' | 'account' | 'local';
}
export type KnowledgeStatus = 'hypothesis' | 'observed' | 'validated' | 'stale' | 'superseded' | 'withdrawn';
export interface KnowledgeEvidence {
  id: string;
  originDeviceId: string;
  sourceId: string;
  sourceRef: string;
  recordHash: string;
  kind: 'source_trace' | 'tool_receipt' | 'postcondition';
  sourceAvailable: boolean;
  observedAt: number;
}
export interface KnowledgeCard {
  id: string;
  version: number;
  contentHash: string;
  summary: string;
  body: string;
  status: KnowledgeStatus;
  originDeviceId: string;
  servingDeviceId: string;
  scope: KnowledgeScope;
  evidence: KnowledgeEvidence[];
  derivedFrom: string[];
  provenance: string[];
  updatedAt: number;
  lastVerifiedAt: number | null;
}
export interface KnowledgePreview {
  id: string;
  version: number;
  contentHash: string;
  summary: string;
  status: KnowledgeStatus;
  originDeviceId: string;
  servingDeviceId: string;
  scope: KnowledgeScope;
  read_ref: string;
  evidenceCount: number;
  lastVerifiedAt: number | null;
}
export const KNOWLEDGE_CONTRACT_VERSION = '1.0.0';
