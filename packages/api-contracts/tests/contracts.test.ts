import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createPaginatedResponse,
  createFailureResponse,
  ErrorCode,
  encodeCursor,
  decodeCursor,
  HEADER_REQUEST_ID,
  HEADER_IDEMPOTENCY_KEY,
} from '../src/index.js';

describe('@platform/api-contracts', () => {
  it('should construct valid success envelopes with requestId', () => {
    const res = createSuccessResponse({ id: 'test-1' }, 'req-12345', { page: 1 });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: 'test-1' });
    expect(res.meta).toEqual({ page: 1 });
    expect(res.requestId).toBe('req-12345');
  });

  it('should construct valid paginated envelopes', () => {
    const res = createPaginatedResponse(
      [{ id: '1' }, { id: '2' }],
      { nextCursor: 'abc', hasMore: true, totalCount: 10 },
      'req-54321'
    );
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    expect(res.pagination.nextCursor).toBe('abc');
    expect(res.pagination.hasMore).toBe(true);
    expect(res.requestId).toBe('req-54321');
  });

  it('should construct valid failure envelopes with requestId', () => {
    const res = createFailureResponse(
      {
        statusCode: 400,
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid input',
        timestamp: new Date().toISOString(),
      },
      'req-error-99'
    );
    expect(res.success).toBe(false);
    expect(res.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.requestId).toBe('req-error-99');
  });

  it('should expose header constants', () => {
    expect(HEADER_REQUEST_ID).toBe('x-request-id');
    expect(HEADER_IDEMPOTENCY_KEY).toBe('idempotency-key');
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

  it('should accurately map meter distances to privacy-preserving distance buckets', async () => {
    const { getDistanceBucket } = await import('../src/index.js');
    expect(getDistanceBucket(null)).toBeNull();
    expect(getDistanceBucket(undefined)).toBeNull();
    expect(getDistanceBucket(-100)).toBeNull();
    expect(getDistanceBucket(500)).toBe('< 1 km');
    expect(getDistanceBucket(1000)).toBe('1-5 km');
    expect(getDistanceBucket(4999)).toBe('1-5 km');
    expect(getDistanceBucket(5000)).toBe('1-5 km');
    expect(getDistanceBucket(5001)).toBe('5-10 km');
    expect(getDistanceBucket(10000)).toBe('5-10 km');
    expect(getDistanceBucket(22000)).toBe('10-25 km');
    expect(getDistanceBucket(48000)).toBe('25-50 km');
    expect(getDistanceBucket(75000)).toBe('50+ km');
  });
});
