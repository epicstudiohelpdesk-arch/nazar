import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  uuidV7Schema,
  cursorPaginationQuerySchema,
  e164PhoneSchema,
  standardEmailSchema,
  validateEnv,
} from '../src/index.js';

describe('@platform/validation', () => {
  it('should validate valid UUIDv7 format and reject invalid strings', () => {
    const validUuidV7 = '018f3a2b-9876-7abc-8123-456789abcdef';
    expect(uuidV7Schema.safeParse(validUuidV7).success).toBe(true);

    const invalidUuid = 'not-a-uuid';
    expect(uuidV7Schema.safeParse(invalidUuid).success).toBe(false);

    // v4 has '4' at version position, should fail v7
    const v4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    expect(uuidV7Schema.safeParse(v4).success).toBe(false);
  });

  it('should validate cursor pagination query parameters', () => {
    const defaultRes = cursorPaginationQuerySchema.parse({});
    expect(defaultRes.limit).toBe(20);

    const customRes = cursorPaginationQuerySchema.parse({ limit: '35', cursor: 'abc' });
    expect(customRes.limit).toBe(35);
    expect(customRes.cursor).toBe('abc');

    expect(() => cursorPaginationQuerySchema.parse({ limit: -1 })).toThrow();
    expect(() => cursorPaginationQuerySchema.parse({ limit: 150 })).toThrow();
  });

  it('should validate E.164 phone numbers and emails', () => {
    expect(e164PhoneSchema.safeParse('+14155552671').success).toBe(true);
    expect(e164PhoneSchema.safeParse('4155552671').success).toBe(false);

    expect(standardEmailSchema.safeParse('USER@EXAMPLE.COM').success).toBe(true);
    if (standardEmailSchema.safeParse('USER@EXAMPLE.COM').success) {
      expect(standardEmailSchema.parse('USER@EXAMPLE.COM')).toBe('user@example.com');
    }
    expect(standardEmailSchema.safeParse('invalid-email').success).toBe(false);
  });

  it('should validate environment variables using validateEnv helper', () => {
    const schema = z.object({
      PORT: z.coerce.number().default(3000),
      APP_NAME: z.string(),
    });

    const validated = validateEnv(schema, { APP_NAME: 'Nazar' });
    expect(validated.PORT).toBe(3000);
    expect(validated.APP_NAME).toBe('Nazar');

    expect(() => validateEnv(schema, {})).toThrow('[FATAL] Environment variable validation failed');
  });
});
