/** Match Vietnamese stroked d as well as combining accents on both sides of FTS. */
export function fold(text: string): string {
  return text.replace(/[đĐ]/g, 'd').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Return a byte-bounded prefix without splitting UTF-8 code points or surrogate pairs. */
export function utf8Prefix(text: string, cap: number): string {
  if (Buffer.byteLength(text) <= cap) return text;
  const buffer = Buffer.from(text);
  let end = Math.min(cap, buffer.length);
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) end--;
  return buffer.subarray(0, end).toString('utf8');
}
