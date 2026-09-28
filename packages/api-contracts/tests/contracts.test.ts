import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createFailureResponse,
  ErrorCode,
  encodeCursor,
  decodeCursor,
} from '../src/index.js';

describe('@platform/api-contracts', () => {
  it('should construct valid success envelopes', () => {
    const res = createSuccessResponse({ id: 'test-1' }, { page: 1 });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: 'test-1' });
    expect(res.meta).toEqual({ page: 1 });
  });

  it('should construct valid failure envelopes', () => {
    const res = createFailureResponse({
      statusCode: 400,
      code: ErrorCode.BAD_REQUEST,
      message: 'Invalid input',
      timestamp: new Date().toISOString(),
    });
    expect(res.success).toBe(false);
    expect(res.error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it('should encode and decode cursors correctly', () => {
    const payload = { id: 'item-10', createdAtMs: 1700000000 };
    const encoded = encodeCursor(payload);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(payload);
  });

  it('should safely return null for invalid cursor strings', () => {
    expect(decodeCursor('not-a-valid-cursor')).toBeNull();
  });
});
