import { describe, it, expect } from "vitest";
import {
  generateUuidV7,
  isValidUuidV7,
  getTimestampFromUuidV7,
  uuidV7Schema,
} from "../src/common/id.js";
import {
  cursorPaginationQuerySchema,
  encodeCursor,
  decodeCursor,
} from "../src/common/pagination.js";
import {
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
} from "../src/auth/schemas.js";
import { geoPointSchema } from "../src/geo/schemas.js";
import {
  validateAge18OrOlder,
  userProfileUpdateSchema,
  Gender,
  DatingIntent,
} from "../src/user/schemas.js";
import {
  discoveryPreferencesSchema,
  swipeRequestSchema,
  SwipeAction,
} from "../src/discovery/schemas.js";
import { sendMessageRequestSchema, MessageType } from "../src/chat/schemas.js";

describe("@nazar/contracts - Common ID & UUIDv7", () => {
  it("should generate valid RFC 9562 UUIDv7 identifiers", () => {
    const id = generateUuidV7();
    expect(isValidUuidV7(id)).toBe(true);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("should maintain strict lexicographical monotonicity when generated sequentially", () => {
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      ids.push(generateUuidV7());
    }
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it("should extract correct timestamp from UUIDv7", () => {
    const before = Date.now();
    const id = generateUuidV7();
    const after = Date.now();
    const extracted = getTimestampFromUuidV7(id).getTime();
    expect(extracted).toBeGreaterThanOrEqual(before);
    expect(extracted).toBeLessThanOrEqual(after);
  });

  it("should validate UUIDv7 with Zod schema", () => {
    const id = generateUuidV7();
    const result = uuidV7Schema.safeParse(id);
    expect(result.success).toBe(true);

    const invalidResult = uuidV7Schema.safeParse("not-a-uuid");
    expect(invalidResult.success).toBe(false);

    // UUIDv4 should also fail the v7 check
    const v4 = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    expect(uuidV7Schema.safeParse(v4).success).toBe(false);
  });
});

describe("@nazar/contracts - Pagination & Cursors", () => {
  it("should enforce default and bounded limit in pagination query", () => {
    const defaultQuery = cursorPaginationQuerySchema.parse({});
    expect(defaultQuery.limit).toBe(20);

    const customQuery = cursorPaginationQuerySchema.parse({ limit: "50" });
    expect(customQuery.limit).toBe(50);

    expect(() => cursorPaginationQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => cursorPaginationQuerySchema.parse({ limit: 200 })).toThrow();
  });

  it("should encode and decode opaque cursor payloads", () => {
    const payload = { id: generateUuidV7(), createdAtMs: Date.now() };
    const cursor = encodeCursor(payload);
    expect(typeof cursor).toBe("string");

    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(payload);
  });

  it("should return null for corrupted cursor strings", () => {
    expect(decodeCursor("invalid-base64-payload-###")).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });
});

describe("@nazar/contracts - Auth & User Schemas", () => {
  it("should validate E.164 phone numbers strictly", () => {
    expect(
      phoneOtpRequestSchema.safeParse({ phoneNumber: "+12025550143" }).success,
    ).toBe(true);
    expect(
      phoneOtpRequestSchema.safeParse({ phoneNumber: "+919876543210" }).success,
    ).toBe(true);
    expect(
      phoneOtpRequestSchema.safeParse({ phoneNumber: "1234567890" }).success,
    ).toBe(false);
    expect(
      phoneOtpRequestSchema.safeParse({ phoneNumber: "invalid" }).success,
    ).toBe(false);
  });

  it("should validate phone OTP verify request fields", () => {
    const valid = {
      phoneNumber: "+12025550143",
      code: "123456",
      deviceFingerprint: "device-fingerprint-uuid-or-hash",
      platform: "ios" as const,
    };
    expect(phoneOtpVerifySchema.safeParse(valid).success).toBe(true);

    // Invalid code length
    expect(
      phoneOtpVerifySchema.safeParse({ ...valid, code: "123" }).success,
    ).toBe(false);
    // Short fingerprint
    expect(
      phoneOtpVerifySchema.safeParse({ ...valid, deviceFingerprint: "short" })
        .success,
    ).toBe(false);
  });

  it("should enforce >= 18 age restriction", () => {
    const today = new Date();
    const seventeenYearsAgo = new Date(
      today.getFullYear() - 17,
      today.getMonth(),
      today.getDate(),
    )
      .toISOString()
      .split("T")[0]!;
    const twentyYearsAgo = new Date(
      today.getFullYear() - 20,
      today.getMonth(),
      today.getDate(),
    )
      .toISOString()
      .split("T")[0]!;

    expect(validateAge18OrOlder(seventeenYearsAgo)).toBe(false);
    expect(validateAge18OrOlder(twentyYearsAgo)).toBe(true);

    expect(
      userProfileUpdateSchema.safeParse({
        displayName: "John Doe",
        birthDate: seventeenYearsAgo,
        gender: Gender.MAN,
      }).success,
    ).toBe(false);

    expect(
      userProfileUpdateSchema.safeParse({
        displayName: "John Doe",
        birthDate: twentyYearsAgo,
        gender: Gender.MAN,
      }).success,
    ).toBe(true);
  });
});

describe("@nazar/contracts - Geolocation & Discovery Schemas", () => {
  it("should validate WGS84 geographic coordinate bounds", () => {
    expect(
      geoPointSchema.safeParse({ latitude: 37.7749, longitude: -122.4194 })
        .success,
    ).toBe(true);
    expect(
      geoPointSchema.safeParse({ latitude: 95.0, longitude: 0 }).success,
    ).toBe(false);
    expect(
      geoPointSchema.safeParse({ latitude: 0, longitude: 185.0 }).success,
    ).toBe(false);
  });

  it("should validate discovery preferences and age range constraints", () => {
    const validPref = {
      minAge: 20,
      maxAge: 35,
      maxDistanceKm: 50,
      genderPreferences: [Gender.WOMAN],
      datingIntents: [DatingIntent.LONG_TERM],
    };
    expect(discoveryPreferencesSchema.safeParse(validPref).success).toBe(true);

    // minAge > maxAge should fail refinement
    const invalidAgeRange = {
      ...validPref,
      minAge: 40,
      maxAge: 30,
    };
    expect(discoveryPreferencesSchema.safeParse(invalidAgeRange).success).toBe(
      false,
    );
  });

  it("should validate idempotent swipe request", () => {
    const validSwipe = {
      targetUserId: generateUuidV7(),
      action: SwipeAction.LIKE,
      idempotencyKey: generateUuidV7(),
    };
    expect(swipeRequestSchema.safeParse(validSwipe).success).toBe(true);
  });
});

describe("@nazar/contracts - Chat Schemas", () => {
  it("should validate chat message creation request", () => {
    const validMessage = {
      clientGeneratedId: generateUuidV7(),
      content: "Hey there! How is your day going?",
      type: MessageType.TEXT,
    };
    expect(sendMessageRequestSchema.safeParse(validMessage).success).toBe(true);

    // Empty content fails
    expect(
      sendMessageRequestSchema.safeParse({
        ...validMessage,
        content: "   ",
      }).success,
    ).toBe(false);
  });
});
