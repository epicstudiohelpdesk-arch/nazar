import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  uuidV7Schema,
  cursorPaginationQuerySchema,
  e164PhoneSchema,
  standardEmailSchema,
  validateEnv,
  calculateAge,
  dateOfBirthSchema,
  updatePreferencesSchema,
  calculateProfileCompleteness,
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

  it('should accurately calculate age from date of birth', () => {
    const ref = new Date('2026-09-28');
    expect(calculateAge('2000-09-28', ref)).toBe(26);
    expect(calculateAge('2000-09-29', ref)).toBe(25); // birthday not yet reached
    expect(calculateAge('2000-01-01', ref)).toBe(26);
  });

  it('should validate date of birth enforcing minimum age 18 and maximum age 120', () => {
    // Valid adult
    expect(dateOfBirthSchema.safeParse('2000-01-15').success).toBe(true);

    // Minor (under 18)
    const minorDob = '2015-01-01';
    const minorRes = dateOfBirthSchema.safeParse(minorDob);
    expect(minorRes.success).toBe(false);
    if (!minorRes.success) {
      expect(minorRes.error.errors[0].message).toContain('at least 18');
    }

    // Future date
    const futureRes = dateOfBirthSchema.safeParse('2099-01-01');
    expect(futureRes.success).toBe(false);

    // Over 120 years old
    const ancientRes = dateOfBirthSchema.safeParse('1850-01-01');
    expect(ancientRes.success).toBe(false);

    // Invalid calendar date
    const invalidCalendar = dateOfBirthSchema.safeParse('2000-02-31');
    expect(invalidCalendar.success).toBe(false);
  });

  it('should validate preference ranges and reject minAge > maxAge', () => {
    expect(
      updatePreferencesSchema.safeParse({
        minAge: 21,
        maxAge: 35,
        maxDistanceKm: 50,
      }).success
    ).toBe(true);

    const invalidRange = updatePreferencesSchema.safeParse({
      minAge: 40,
      maxAge: 25,
    });
    expect(invalidRange.success).toBe(false);
  });

  it('should calculate profile completeness accurately', () => {
    // Incomplete draft
    const incomplete = calculateProfileCompleteness({
      displayName: 'Alex',
      dateOfBirth: '2000-01-01',
      gender: 'MAN',
      hasPrimaryPhoto: false,
      hasPreferences: false,
      bio: null,
      interestsCount: 0,
      occupation: null,
      education: null,
      promptsCount: 0,
      readyPhotosCount: 0,
    });
    expect(incomplete.percentage).toBeLessThan(50);
    expect(incomplete.missingRequired).toContain('PRIMARY_PHOTO');
    expect(incomplete.missingRequired).toContain('PREFERENCES');
    expect(incomplete.recommended).toContain('BIO');

    // Fully complete profile
    const complete = calculateProfileCompleteness({
      displayName: 'Alex',
      dateOfBirth: '2000-01-01',
      gender: 'MAN',
      hasPrimaryPhoto: true,
      hasPreferences: true,
      bio: 'Loves hiking, coffee, and open source code.',
      interestsCount: 5,
      occupation: 'Software Engineer',
      education: 'B.Tech CS',
      promptsCount: 2,
      readyPhotosCount: 3,
    });
    expect(complete.percentage).toBe(100);
    expect(complete.missingRequired).toHaveLength(0);
    expect(complete.recommended).toHaveLength(0);
  });
});
