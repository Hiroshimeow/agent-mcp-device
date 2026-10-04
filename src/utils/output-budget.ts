import { StringDecoder } from 'node:string_decoder';

export interface BudgetedText {
  text: string;
  bytes: number;
  truncated: boolean;
}

export function takeUtf8Budget(text: string, maxBytes: number): BudgetedText {
  const totalBytes = Buffer.byteLength(text, 'utf8');
  if (totalBytes <= maxBytes) {
    return { text, bytes: totalBytes, truncated: false };
  }

  const decoder = new StringDecoder('utf8');
  const chunk = Buffer.from(text, 'utf8').subarray(0, Math.max(0, maxBytes));
  const bounded = decoder.write(chunk);
  return {
    text: bounded,
    bytes: Buffer.byteLength(bounded, 'utf8'),
    truncated: true,
  };
}
