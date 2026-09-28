import { describe, it, expect, beforeEach } from 'vitest';
import { DiscoveryCursorService } from '../src/modules/discovery/cursor/discovery-cursor.service.js';
import { AppConfigService } from '../src/config/app-config.service.js';
import { BadRequestException } from '@nestjs/common';
import { ErrorCode } from '@platform/api-contracts';

describe('DiscoveryCursorService Unit Tests', () => {
  let cursorService: DiscoveryCursorService;
  const mockConfigService = {
    jwtAccessSecret: 'super-secure-cursor-test-secret-at-least-32-chars-long',
  } as unknown as AppConfigService;

  beforeEach(() => {
    cursorService = new DiscoveryCursorService(mockConfigService);
  });

  it('should encode and decode a valid discovery cursor roundtrip', () => {
    const score = 0.8543;
    const profileId = '018f673a-45e2-7634-8c4d-91b3e8e2fa10';

    const encoded = cursorService.encode(score, profileId);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(10);

    const decoded = cursorService.decode(encoded);
    expect(decoded.v).toBe(1);
    expect(decoded.score).toBe(0.8543);
    expect(decoded.id).toBe(profileId);
  });

  it('should reject tampered payload with DISCOVERY_INVALID_CURSOR', () => {
    const score = 0.75;
    const profileId = '018f673a-45e2-7634-8c4d-91b3e8e2fa10';
    const encoded = cursorService.encode(score, profileId);

    // Tamper with base64 content (replace a character)
    const tampered = encoded.substring(0, encoded.length - 5) + 'AAAAA';

    try {
      cursorService.decode(tampered);
      expect.fail('Should have thrown BadRequestException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = (err as BadRequestException).getResponse() as { code: string };
      expect(res.code).toBe(ErrorCode.DISCOVERY_INVALID_CURSOR);
    }
  });

  it('should reject malformed non-base64 cursor string', () => {
    expect(() => cursorService.decode('invalid!@#$%^&*()')).toThrow(BadRequestException);
  });

  it('should reject empty or oversized cursor', () => {
    expect(() => cursorService.decode('')).toThrow(BadRequestException);
    expect(() => cursorService.decode('a'.repeat(600))).toThrow(BadRequestException);
  });

  it('should reject invalid UUID profileId in cursor', () => {
    // Manually forge a cursor with invalid UUID
    const forgedWire = {
      v: 1,
      s: 0.5,
      id: 'not-a-valid-uuid',
      sig: 'abc',
    };
    const json = JSON.stringify(forgedWire);
    const forgedCursor = Buffer.from(json).toString('base64url');

    expect(() => cursorService.decode(forgedCursor)).toThrow(BadRequestException);
  });
});
