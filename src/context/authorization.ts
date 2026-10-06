import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyOfficialApproval } from '../device/official-trust.js';
export { SOC_PUBLIC_KEY } from '../device/official-trust.js';

export type GatedFeature = 'FEATURE_LIVE_CAPTURE' | 'FEATURE_PUBLIC_GATEWAY';
export const GATE_ERROR = 'FEATURE_GATE_LOCKED: Phase 7/8 requires valid SOC security approval artifact';

// Anchor trust configuration to the installed module, never the caller's cwd.
const CONFIG_DIRECTORY = fileURLToPath(new URL('../../config/', import.meta.url));

function approvalFailure(scope: GatedFeature): string | undefined {
  try {
    if (!['FEATURE_LIVE_CAPTURE', 'FEATURE_PUBLIC_GATEWAY'].includes(scope)) return GATE_ERROR;
    const path = join(CONFIG_DIRECTORY, 'soc-approval.json');
    if (statSync(path).size > 16384) return GATE_ERROR;
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    if (artifact.schema_version !== 1 || !Array.isArray(artifact.features) || artifact.features.length < 1 || artifact.features.length > 2 ||
        !artifact.features.every((value: unknown) => value === 'FEATURE_LIVE_CAPTURE' || value === 'FEATURE_PUBLIC_GATEWAY') ||
        new Set(artifact.features).size !== artifact.features.length || !artifact.features.includes(scope) ||
        !Number.isSafeInteger(artifact.expires_at) || artifact.expires_at <= Date.now() || typeof artifact.signature !== 'string') return GATE_ERROR;

    // RFC 8785 JCS for this closed schema: lexicographically sorted ASCII keys,
    // safe integer time, ASCII enum strings, and order-preserving arrays. JSON's
    // ECMAScript serialization is canonical for these validated value types.
    if (!verifyOfficialApproval(artifact)) return `${GATE_ERROR}: SOC_KEY_UNTRUSTED`;
    // Digest the canonical signed artifact, not file formatting: whitespace or
    // insertion-order changes cannot resurrect a revoked approval.
    const digest = createHash('sha256').update(JSON.stringify({
      expires_at: artifact.expires_at, features: artifact.features,
      schema_version: artifact.schema_version, signature: artifact.signature
    })).digest('hex');
    const revokedPath = join(CONFIG_DIRECTORY, 'revoked-approvals.json');
    let revokedText: string;
    try {
      if (statSync(revokedPath).size > 1048576) return GATE_ERROR;
      revokedText = readFileSync(revokedPath, 'utf8');
    } catch {
      return 'FEATURE_GATE_LOCKED: revocation list missing or unreadable';
    }
    let revoked;
    try { revoked = JSON.parse(revokedText); }
    catch { return 'FEATURE_GATE_LOCKED: revocation list malformed'; }
    if (!Array.isArray(revoked)) return 'FEATURE_GATE_LOCKED: revocation list malformed';
    if (!revoked.every((value: unknown) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value))) return 'FEATURE_GATE_LOCKED: revocation list malformed';
    if (revoked.includes(digest)) return 'FEATURE_GATE_LOCKED: artifact revoked';
    return undefined;
  } catch { return GATE_ERROR; }
}

export function isFeatureAuthorized(scope: GatedFeature): boolean {
  return approvalFailure(scope) === undefined;
}

export function requireFeatureAuthorized(scope: GatedFeature): void {
  const failure = approvalFailure(scope);
  if (failure) throw new Error(failure);
}
