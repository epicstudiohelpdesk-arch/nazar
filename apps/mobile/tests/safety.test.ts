import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSafetyApi } from '../src/safety/safety-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import type {
  BlockUserResponseDto,
  UnblockUserResponseDto,
  BlockedUserListResponseDto,
  ReportResponseDto,
} from '@platform/api-contracts';

describe('Mobile Safety Layer: API Client & Trust Primitives', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockBlockResponse: BlockUserResponseDto = {
    success: true,
    blockedUserId: 'user-b',
    createdAt: '2026-09-29T10:00:00.000Z',
  };

  const mockUnblockResponse: UnblockUserResponseDto = {
    success: true,
    unblockedUserId: 'user-b',
    unblockedAt: '2026-09-29T10:05:00.000Z',
  };

  const mockBlockedListResponse: BlockedUserListResponseDto = {
    items: [
      {
        blockedUserId: 'user-b',
        displayName: 'Priya',
        age: 26,
        city: 'Bangalore',
        primaryPhotoUrl: 'https://cdn.example.com/priya.jpg',
        blockedAt: '2026-09-29T10:00:00.000Z',
      },
    ],
    nextCursor: null,
    hasMore: false,
  };

  const mockReportResponse: ReportResponseDto = {
    id: 'rep-1',
    reporterUserId: 'user-a',
    targetType: 'USER',
    targetId: 'user-b',
    reasonCode: 'HARASSMENT',
    status: 'OPEN',
    createdAt: '2026-09-29T10:00:00.000Z',
    resolvedAt: null,
  };

  beforeEach(async () => {
    mockFetch = vi.fn();
    const storage = new InMemoryTokenStorage();
    await storage.setAccessToken('mobile_safety_token');
    authClient = new AuthClient({
      baseUrl: 'https://api.dating.internal',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
  });

  it('blocks a user with optional reason payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockBlockResponse,
      }),
    });

    const api = createSafetyApi(authClient);
    const result = await api.blockUser('user-b', { reason: 'Inappropriate language' });

    expect(result.success).toBe(true);
    expect(result.blockedUserId).toBe('user-b');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.dating.internal/v1/users/user-b/block',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Inappropriate language' }),
      })
    );
  });

  it('unblocks a user using DELETE request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockUnblockResponse,
      }),
    });

    const api = createSafetyApi(authClient);
    const result = await api.unblockUser('user-b');

    expect(result.success).toBe(true);
    expect(result.unblockedUserId).toBe('user-b');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.dating.internal/v1/users/user-b/block',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('fetches blocked users list with pagination parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockBlockedListResponse,
      }),
    });

    const api = createSafetyApi(authClient);
    const result = await api.getBlockedUsers({ limit: 10, cursor: 'cur-123' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.displayName).toBe('Priya');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.dating.internal/v1/users/blocks?limit=10&cursor=cur-123',
      expect.anything()
    );
  });

  it('submits a report against a target with taxonomy reason code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: mockReportResponse,
      }),
    });

    const api = createSafetyApi(authClient);
    const result = await api.createReport({
      targetType: 'USER',
      targetId: 'user-b',
      reasonCode: 'HARASSMENT',
      description: 'Persistent unwanted messages',
    });

    expect(result.id).toBe('rep-1');
    expect(result.status).toBe('OPEN');
    expect(result.reasonCode).toBe('HARASSMENT');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.dating.internal/v1/reports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          targetType: 'USER',
          targetId: 'user-b',
          reasonCode: 'HARASSMENT',
          description: 'Persistent unwanted messages',
        }),
      })
    );
  });

  it('retrieves an existing report by ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockReportResponse,
      }),
    });

    const api = createSafetyApi(authClient);
    const result = await api.getReport('rep-1');

    expect(result.id).toBe('rep-1');
    expect(result.targetId).toBe('user-b');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.dating.internal/v1/reports/rep-1',
      expect.anything()
    );
  });

  it('throws informative error when API call fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: {
          code: 'REPORT_DUPLICATE',
          message: 'An active report with this reason already exists for this target',
        },
      }),
    });

    const api = createSafetyApi(authClient);
    await expect(
      api.createReport({
        targetType: 'USER',
        targetId: 'user-b',
        reasonCode: 'HARASSMENT',
      })
    ).rejects.toThrow('An active report with this reason already exists for this target');
  });
});
