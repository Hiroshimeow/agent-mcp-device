import { createHash, createHmac, randomBytes } from 'node:crypto';
import { utf8Prefix } from './text.js';

// Non-persistence callers may redact without a store; persistence always supplies the installation key.
const ephemeralKey = randomBytes(32);

export const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
export interface RedactedPayload {
  text: string;
  hash: string;
  originalBytes: number;
  retainedBytes: number;
  partial: boolean;
  state: 'retained' | 'redacted' | 'excluded' | 'binary';
}

/** This is the sole payload persistence boundary. Hashes cover retained bytes only. */
export function redact(input: string | Buffer, options: { path?: string; maxBytes?: number; key?: Buffer } = {}): RedactedPayload {
  const cap = options.maxBytes ?? MAX_PAYLOAD_BYTES;
  if (!Number.isInteger(cap) || cap < 0 || cap > MAX_PAYLOAD_BYTES) throw new Error('BUDGET_EXCEEDED');
  const tagKey = createHmac('sha256', options.key ?? ephemeralKey).update('redaction_tagging_v1').digest();
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let text = bytes.toString('utf8');
  let state: RedactedPayload['state'] = 'retained';
  const path = options.path?.replace(/\\/g, '/');
  if (path && /(?:^|\/)(?:\.env(?:\.[^/]*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|credentials(?:\.[^/]*)?)(?:$|\/)/i.test(path)) {
    text = ''; state = 'excluded';
  } else if (bytes.includes(0) || text.includes('\uFFFD') || /[\x01-\x08\x0e-\x1f]/.test(text) || /(?:^|\s)[A-Za-z0-9+/]{256,}={0,2}(?:$|\s)/.test(text)) {
    text = ''; state = 'binary';
  } else {
    const patterns: [RegExp, string][] = [
      [/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z ]+ )?PRIVATE KEY-----|$)/g, 'private_key'],
      [/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'bearer'],
      [/\b(?:api[_-]?key|access[_-]?token|secret[_-]?key)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;"'\[\]{}]+)/gi, 'api_key'],
      [/\b(?:password|passwd|pwd)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;"'\[\]{}]+)/gi, 'password'],
      [/\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{20,})\b/g, 'api_key'],
    ];
    for (const [pattern, cls] of patterns) text = text.replace(pattern, secret => {
      state = 'redacted';
      const tag = createHmac('sha256', tagKey).update(secret).digest('hex').slice(0, 16);
      return `[REDACTED:${cls}:${tag}]`;
    });
  }
  const partial = Buffer.byteLength(text) > cap;
  text = utf8Prefix(text, cap);
  return { text, hash: createHash('sha256').update(text).digest('hex'), originalBytes: bytes.length,
    retainedBytes: Buffer.byteLength(text), partial, state };
}
