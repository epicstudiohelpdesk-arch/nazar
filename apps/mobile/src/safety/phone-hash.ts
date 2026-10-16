/**
 * Phone Number Normalization and Privacy-Preserving SHA-256 Hashing.
 * 
 * Used for address book contact blocking without revealing plaintext phone numbers.
 */

/**
 * Normalizes a raw phone number into an E.164-compatible format:
 * - Strips whitespace, parentheses, dots, and hyphens.
 * - Ensures a leading '+' if country code is present.
 */
export function normalizePhoneNumber(raw: string, defaultCountryCode = '1'): string {
  const cleaned = raw.trim().replace(/[\s().-]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If number starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    return `+${cleaned.slice(2)}`;
  }

  // If 10 digits without prefix (e.g. US or IN local), prepend defaultCountryCode
  if (/^\d{10}$/.test(cleaned)) {
    return `+${defaultCountryCode}${cleaned}`;
  }

  return `+${cleaned}`;
}

/**
 * Strictly typed pure TypeScript SHA-256 fallback to ensure zero-dependency,
 * cross-platform execution (React Native Hermes, Jest, Node, Web).
 */
function sha256Fallback(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let asciiStr = ascii;
  let i = 0;
  let j = 0;

  const words: number[] = [];
  const asciiBitLength = asciiStr.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  asciiStr += '\x80';
  while ((asciiStr.length % 64) - 56) asciiStr += '\x00';
  for (i = 0; i < asciiStr.length; i++) {
    j = asciiStr.charCodeAt(i);
    words[i >> 2] = (words[i >> 2] ?? 0) | (j << ((3 - (i % 4)) * 8));
  }
  words.push((asciiBitLength / maxWord) | 0);
  words.push(asciiBitLength);

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const wiMinus16 = w[i - 16] ?? 0;
      const wiMinus7 = w[i - 7] ?? 0;
      w[i] = i < 16
        ? (w[i] ?? 0)
        : (((wiMinus16 + s0) | 0) + ((wiMinus7 + s1) | 0)) | 0;

      const h0 = hash[0] ?? 0;
      const h1 = hash[1] ?? 0;
      const h2 = hash[2] ?? 0;
      const h3 = hash[3] ?? 0;
      const h4 = hash[4] ?? 0;
      const h5 = hash[5] ?? 0;
      const h6 = hash[6] ?? 0;
      const h7 = hash[7] ?? 0;
      const ki = k[i] ?? 0;
      const currWi = w[i] ?? 0;

      const ch = (h4 & h5) ^ (~h4 & h6);
      const maj = (h0 & h1) ^ (h0 & h2) ^ (h1 & h2);
      const sigma0 = rightRotate(h0, 2) ^ rightRotate(h0, 13) ^ rightRotate(h0, 22);
      const sigma1 = rightRotate(h4, 6) ^ rightRotate(h4, 11) ^ rightRotate(h4, 25);

      const temp1 = ((((h7 + sigma1) | 0) + ((ch + ki) | 0)) | 0) + currWi;
      const temp2 = (sigma0 + maj) | 0;

      hash[7] = h6;
      hash[6] = h5;
      hash[5] = h4;
      hash[4] = (h3 + temp1) | 0;
      hash[3] = h2;
      hash[2] = h1;
      hash[1] = h0;
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = ((hash[i] ?? 0) + (oldHash[i] ?? 0)) | 0;
    }
  }

  let result = '';
  for (i = 0; i < 8; i++) {
    const val = hash[i] ?? 0;
    for (let b = 3; b >= 0; b--) {
      const byte = (val >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

/**
 * Computes the lowercase SHA-256 hexadecimal hash of a phone number.
 * Uses Web Crypto if available; otherwise falls back to pure TS SHA-256.
 */
export async function hashPhoneNumber(phoneNumber: string): Promise<string> {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return '';

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback if subtle digest throws
    }
  }

  return sha256Fallback(normalized);
}
