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

  describe('Feature 2.1: Privacy-Preserving Contact Blocking', () => {
    it('normalizes raw phone numbers correctly', async () => {
      const { normalizePhoneNumber } = await import('../src/safety/phone-hash.js');
      expect(normalizePhoneNumber('+1 (415) 555-2671')).toBe('+14155552671');
      expect(normalizePhoneNumber('415-555-2671', '1')).toBe('+14155552671');
      expect(normalizePhoneNumber('0091 98765 43210')).toBe('+919876543210');
      expect(normalizePhoneNumber('  +91 98765-43210  ')).toBe('+919876543210');
    });

    it('computes consistent SHA-256 hash across platforms', async () => {
      const { hashPhoneNumber } = await import('../src/safety/phone-hash.js');
      const hash = await hashPhoneNumber('+14155552671');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      // Verify deterministic output
      const hash2 = await hashPhoneNumber('+1 (415) 555-2671');
      expect(hash2).toBe(hash);
    });

    it('submits hashed contacts list to API', async () => {
      const mockBlockContactsRes = {
        success: true,
        addedCount: 2,
        totalBlockedCount: 5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockBlockContactsRes,
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.blockContacts({
        contacts: [
          {
            phoneHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            label: 'Ex',
          },
          {
            phoneHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
            label: 'Boss',
          },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.addedCount).toBe(2);
      expect(res.totalBlockedCount).toBe(5);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/users/blocked-contacts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            contacts: [
              {
                phoneHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                label: 'Ex',
              },
              {
                phoneHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
                label: 'Boss',
              },
            ],
          }),
        })
      );
    });

    it('lists blocked contacts', async () => {
      const mockListRes = {
        items: [
          {
            id: 'bc-1',
            phoneHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            label: 'Ex',
            createdAt: '2026-10-15T12:00:00.000Z',
          },
        ],
        totalCount: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockListRes,
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.listBlockedContacts();

      expect(res.totalCount).toBe(1);
      expect(res.items[0]?.label).toBe('Ex');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/users/blocked-contacts',
        expect.anything()
      );
    });

    it('unblocks a contact by phone hash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { success: true },
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.unblockContact(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/users/blocked-contacts/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Feature 2.3: Selfie Pose Liveness KYC Photo Verification', () => {
    it('requests a dynamic selfie pose verification challenge', async () => {
      const mockChallenge = {
        challengeToken: 'usr-1:PEACE_SIGN:1700000000:signature',
        gesture: 'PEACE_SIGN',
        gesturePrompt: 'Hold up a peace sign next to your cheek.',
        expiresAt: '2026-10-15T13:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockChallenge,
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.getVerificationChallenge();

      expect(res.gesture).toBe('PEACE_SIGN');
      expect(res.challengeToken).toContain('PEACE_SIGN');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/safety/verification/challenge',
        expect.anything()
      );
    });

    it('submits a KYC selfie photo and receives verified confirmation', async () => {
      const mockVerifyResponse = {
        success: true,
        isVerified: true,
        message: 'Selfie pose verified successfully!',
        verifiedAt: '2026-10-15T12:05:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockVerifyResponse,
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.submitPhotoVerification({
        challengeToken: 'usr-1:PEACE_SIGN:1700000000:signature',
        gesture: 'PEACE_SIGN',
        selfiePhotoUrl: 'https://cdn.nazar.app/verifications/selfie-live.jpg',
      });

      expect(res.isVerified).toBe(true);
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/safety/verification/verify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            challengeToken: 'usr-1:PEACE_SIGN:1700000000:signature',
            gesture: 'PEACE_SIGN',
            selfiePhotoUrl: 'https://cdn.nazar.app/verifications/selfie-live.jpg',
          }),
        })
      );
    });

    it('retrieves verification status for the current user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            isVerified: true,
            verifiedAt: '2026-10-15T12:05:00.000Z',
          },
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.getVerificationStatus();

      expect(res.isVerified).toBe(true);
      expect(res.verifiedAt).toBe('2026-10-15T12:05:00.000Z');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/safety/verification/status',
        expect.anything()
      );
    });
  });

  describe('Feature 2.5: Date Safety & SOS Check-In', () => {
    it('schedules a date safety check-in with emergency contact', async () => {
      const mockCheckin = {
        id: 'chk-123',
        userId: 'user-a',
        matchId: '01918a24-7411-789a-bcde-0123456789ab',
        meetingLocation: 'Joe Coffee, West Village',
        meetingAt: '2026-10-15T19:00:00.000Z',
        checkInDeadline: '2026-10-15T21:00:00.000Z',
        emergencyContactName: 'Sarah Jenkins',
        emergencyContactPhone: '+15551234567',
        status: 'SCHEDULED',
        createdAt: '2026-10-15T17:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: mockCheckin,
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.createDateCheckin({
        matchId: '01918a24-7411-789a-bcde-0123456789ab',
        meetingLocation: 'Joe Coffee, West Village',
        meetingAt: '2026-10-15T19:00:00.000Z',
        checkInDeadline: '2026-10-15T21:00:00.000Z',
        emergencyContactName: 'Sarah Jenkins',
        emergencyContactPhone: '+15551234567',
      });

      expect(res.id).toBe('chk-123');
      expect(res.status).toBe('SCHEDULED');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/safety/date-checkin',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('retrieves active date check-in', async () => {
      const mockActive = {
        id: 'chk-123',
        userId: 'user-a',
        matchId: '01918a24-7411-789a-bcde-0123456789ab',
        meetingLocation: 'Joe Coffee, West Village',
        meetingAt: '2026-10-15T19:00:00.000Z',
        checkInDeadline: '2026-10-15T21:00:00.000Z',
        emergencyContactName: 'Sarah Jenkins',
        emergencyContactPhone: '+15551234567',
        status: 'SCHEDULED',
        createdAt: '2026-10-15T17:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockActive,
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.getActiveDateCheckin();
      expect(res).not.toBeNull();
      expect(res?.id).toBe('chk-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/safety/date-checkin/active',
        expect.anything()
      );
    });

    it('confirms safe check-in', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            success: true,
            checkedInAt: '2026-10-15T20:30:00.000Z',
            message: 'Successfully checked in safe!',
          },
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.confirmDateCheckin('chk-123');
      expect(res.success).toBe(true);
      expect(res.message).toContain('safe');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/safety/date-checkin/chk-123/confirm',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('triggers instant emergency SOS alert', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            success: true,
            alertDispatched: true,
            message: 'Emergency SOS alert dispatched',
            timestamp: '2026-10-15T20:45:00.000Z',
          },
        }),
      });

      const api = createSafetyApi(authClient);
      const res = await api.triggerSos({
        dateCheckinId: 'chk-123',
        latitude: 40.73061,
        longitude: -73.935242,
        note: 'Need urgent assistance',
      });

      expect(res.success).toBe(true);
      expect(res.alertDispatched).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dating.internal/v1/safety/sos',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            dateCheckinId: 'chk-123',
            latitude: 40.73061,
            longitude: -73.935242,
            note: 'Need urgent assistance',
          }),
        })
      );
    });
  });
});
