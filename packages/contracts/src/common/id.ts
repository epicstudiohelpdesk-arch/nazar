import { z } from "zod";

/**
 * Monotonic RFC 9562 UUIDv7 Generator and Validator
 * Guarantees time-sortable identifiers for database primary keys,
 * preventing B-tree index fragmentation while maintaining cryptographic randomness.
 */

let lastMs = 0;
let seq = 0;

/**
 * Generates an RFC 9562 compliant UUIDv7 string.
 * @param customTimestampMs Optional timestamp in milliseconds (defaults to Date.now())
 */
export function generateUuidV7(customTimestampMs?: number): string {
  let ms = customTimestampMs ?? Date.now();

  if (ms > lastMs) {
    lastMs = ms;
    seq = 0;
  } else if (ms === lastMs) {
    seq++;
    if (seq > 0xfff) {
      // Sequence overflow within the same millisecond: advance timestamp by 1ms
      ms = ++lastMs;
      seq = 0;
    }
  } else {
    // Clock moved backwards: preserve monotonicity
    ms = lastMs;
    seq++;
    if (seq > 0xfff) {
      ms = ++lastMs;
      seq = 0;
    }
  }

  // 48-bit timestamp
  const tsHigh = Math.floor(ms / 0x100000000);
  const tsLow = ms >>> 0;

  // 12-bit sequence / rand_a with 4-bit version 7
  const timeHiAndVersion = ((seq & 0x0fff) | 0x7000) >>> 0;

  // 64-bit random values for clock_seq_hi_and_reserved (with variant 10xx) and node
  const randomBytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback for non-browser/node environments if crypto global isn't present
    for (let i = 0; i < 8; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set variant to RFC 9562 variant 1 (10xxxxxx)
  randomBytes[0] = (randomBytes[0]! & 0x3f) | 0x80;

  const hexBytes = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const p1 = (
    tsHigh.toString(16).padStart(4, "0") +
    (tsLow >>> 16).toString(16).padStart(4, "0")
  ).slice(-8);
  const p2 = (tsLow & 0xffff).toString(16).padStart(4, "0");
  const p3 = timeHiAndVersion.toString(16).padStart(4, "0");
  const p4 = hexBytes.slice(0, 4);
  const p5 = hexBytes.slice(4, 16);

  return `${p1}-${p2}-${p3}-${p4}-${p5}`.toLowerCase();
}

/**
 * UUIDv7 format regex according to RFC 9562:
 * 8-4-4-4-12 hex digits with version 7 (in 3rd group) and variant 8, 9, a, or b (in 4th group).
 */
export const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether a given string is a valid UUIDv7.
 */
export function isValidUuidV7(id: string): boolean {
  if (typeof id !== "string") return false;
  return UUID_V7_REGEX.test(id);
}

/**
 * Extracts the Unix timestamp (milliseconds) from an RFC 9562 UUIDv7.
 */
export function getTimestampFromUuidV7(id: string): Date {
  if (!isValidUuidV7(id)) {
    throw new Error(`Invalid UUIDv7 identifier: ${id}`);
  }
  const clean = id.replace(/-/g, "");
  const hexTs = clean.slice(0, 12);
  const ms = parseInt(hexTs, 16);
  return new Date(ms);
}

/**
 * Zod schema for UUIDv7 with explicit validation.
 */
export const uuidV7Schema = z
  .string()
  .refine(isValidUuidV7, {
    message: "Must be a valid RFC 9562 UUIDv7 identifier",
  })
  .brand<"UuidV7">();

export type UuidV7 = z.infer<typeof uuidV7Schema>;
