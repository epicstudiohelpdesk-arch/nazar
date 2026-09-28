/**
 * RFC 9562 Monotonic UUIDv7 Domain Identifier
 */

let lastMs = 0;
let seq = 0;

export function generateUuidV7(customTimestampMs?: number): string {
  let ms = customTimestampMs ?? Date.now();

  if (ms > lastMs) {
    lastMs = ms;
    seq = 0;
  } else if (ms === lastMs) {
    seq++;
    if (seq > 0xfff) {
      ms = ++lastMs;
      seq = 0;
    }
  } else {
    ms = lastMs;
    seq++;
    if (seq > 0xfff) {
      ms = ++lastMs;
      seq = 0;
    }
  }

  const tsHigh = Math.floor(ms / 0x100000000);
  const tsLow = ms >>> 0;
  const timeHiAndVersion = ((seq & 0x0fff) | 0x7000) >>> 0;

  const randomBytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 8; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  randomBytes[0] = (randomBytes[0]! & 0x3f) | 0x80;

  const hexBytes = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const p1 = (
    tsHigh.toString(16).padStart(4, '0') + (tsLow >>> 16).toString(16).padStart(4, '0')
  ).slice(-8);
  const p2 = (tsLow & 0xffff).toString(16).padStart(4, '0');
  const p3 = timeHiAndVersion.toString(16).padStart(4, '0');
  const p4 = hexBytes.slice(0, 4);
  const p5 = hexBytes.slice(4, 16);

  return `${p1}-${p2}-${p3}-${p4}-${p5}`.toLowerCase();
}

export const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuidV7(id: string): boolean {
  if (typeof id !== 'string') return false;
  return UUID_V7_REGEX.test(id);
}

export function getTimestampFromUuidV7(id: string): Date {
  if (!isValidUuidV7(id)) {
    throw new Error(`Invalid UUIDv7 identifier: ${id}`);
  }
  const clean = id.replace(/-/g, '');
  const hexTs = clean.slice(0, 12);
  const ms = parseInt(hexTs, 16);
  return new Date(ms);
}
