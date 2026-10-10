import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import { createProfileApi, PROFILE_QUERY_KEYS } from '../src/profile/profile-api.js';
import {
  createSafetyApi,
  invalidateSafetyCaches,
  SAFETY_QUERY_KEYS,
} from '../src/safety/safety-api.js';
import {
  SessionService,
  purgeAccountSessionAndCaches,
  purgeDeletedAccount,
} from '../src/auth/session-service.js';
import { useProfileStore } from '../src/profile/profile-store.js';
import { useOnboardingStore } from '../src/auth/onboarding-store.js';
import { sanitizeAnalyticsProperties } from '../src/analytics/onboarding-analytics.js';
import type {
  PrivateProfileResponse,
  InterestItem,
  PromptDefinitionItem,
  ProfilePromptItem,
  MediaItemResponse,
  SessionItemResponse,
  DeviceItemResponse,
  BlockedUserListResponseDto,
} from '@platform/api-contracts';

describe('Profile + Settings + Privacy + Safety (F10)', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;
  let tokenStorage: InMemoryTokenStorage;

  const mockProfile: PrivateProfileResponse = {
    id: 'prof-123',
    userId: 'user-123',
    displayName: 'Aarav',
    dateOfBirth: '1997-04-12',
    age: 29,
    gender: 'MAN',
    bio: 'Architecture, indie records, and filter coffee.',
    city: 'Mumbai',
    occupation: 'Architect',
    education: 'IIT Roorkee',
    visibility: 'ACTIVE',
    completionStatus: {
      percentage: 100,
      missingRequired: [],
      recommended: [],
    },
    interests: [{ id: 'int-1', name: 'Design', slug: 'design', category: 'Creative' }],
    prompts: [
      {
        id: 'pp-1',
        promptDefinitionId: 'pdef-1',
        prompt: 'My ideal Sunday morning...',
        answer: 'Early morning coffee in Matunga.',
        position: 0,
      },
    ],
    media: [
      {
        id: 'm-1',
        url: 'https://cdn.nazar.app/photo1.jpg',
        mediaType: 'IMAGE',
        mimeType: 'image/jpeg',
        status: 'READY',
        position: 0,
        isPrimary: true,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const mockSessions: SessionItemResponse[] = [
    {
      id: 'sess-current',
      deviceId: 'dev-1',
      platform: 'iOS',
      deviceModel: 'iPhone 15 Pro',
      ipAddress: '203.0.113.195',
      createdAt: '2026-09-29T10:00:00.000Z',
      lastActiveAt: '2026-09-30T12:00:00.000Z',
      isCurrentSession: true,
    },
    {
      id: 'sess-other',
      deviceId: 'dev-2',
      platform: 'Android',
      deviceModel: 'Pixel 8',
      ipAddress: '198.51.100.22',
      createdAt: '2026-09-25T08:00:00.000Z',
      lastActiveAt: '2026-09-28T14:00:00.000Z',
      isCurrentSession: false,
    },
  ];

  const mockDevices: DeviceItemResponse[] = [
    {
      id: 'dev-reg-1',
      userId: 'user-123',
      platform: 'ios',
      deviceModel: 'iPhone 15 Pro',
      appVersion: '1.0.0',
      pushToken: 'fcm_token_sample_123',
      createdAt: '2026-09-29T10:00:00.000Z',
      updatedAt: '2026-09-29T10:00:00.000Z',
    },
  ];

  const mockBlockedUsers: BlockedUserListResponseDto = {
    items: [
      {
        blockedUserId: 'blocked-user-99',
        displayName: 'Rohan',
        age: 31,
        city: 'Delhi',
        primaryPhotoUrl: 'https://cdn.nazar.app/rohan.jpg',
        blockedAt: '2026-09-28T15:30:00.000Z',
      },
    ],
    nextCursor: null,
    hasMore: false,
  };

  beforeEach(async () => {
    mockFetch = vi.fn();
    tokenStorage = new InMemoryTokenStorage();
    await tokenStorage.setAccessToken('auth_access_token');
    await tokenStorage.setRefreshToken('auth_refresh_token');

    authClient = new AuthClient({
      baseUrl: 'https://api.nazar.internal',
      storage: tokenStorage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useProfileStore.getState().resetAll();
    useOnboardingStore.getState().resetOnboardingDraft();
  });

  describe('1. Profile Queries & Mutations API Client', () => {
    it('fetches private profile with complete completeness data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: mockProfile }),
      });

      const profileApi = createProfileApi(authClient);
      const res = await profileApi.getMyProfile();

      expect(res.id).toBe('prof-123');
      expect(res.visibility).toBe('ACTIVE');
      expect(res.completionStatus.percentage).toBe(100);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nazar.internal/v1/profiles/me',
        expect.any(Object)
      );
    });

    it('updates basic profile information (bio, city, occupation, education)', async () => {
      const updated = { ...mockProfile, bio: 'New bio', city: 'Bengaluru' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: updated }),
      });

      const profileApi = createProfileApi(authClient);
      const res = await profileApi.updateMyProfile({ bio: 'New bio', city: 'Bengaluru' });

      expect(res.bio).toBe('New bio');
      expect(res.city).toBe('Bengaluru');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nazar.internal/v1/profiles/me',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ bio: 'New bio', city: 'Bengaluru' }),
        })
      );
    });

    it('transitions profile visibility: activate, pause, hide', async () => {
      const profileApi = createProfileApi(authClient);

      // Activate
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: { id: 'prof-123', visibility: 'ACTIVE', message: 'Profile activated' },
        }),
      });
      const activeRes = await profileApi.activateProfile();
      expect(activeRes.visibility).toBe('ACTIVE');

      // Pause
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: { id: 'prof-123', visibility: 'PAUSED', message: 'Profile paused' },
        }),
      });
      const pauseRes = await profileApi.pauseProfile();
      expect(pauseRes.visibility).toBe('PAUSED');

      // Hide
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: { id: 'prof-123', visibility: 'HIDDEN', message: 'Profile hidden' },
        }),
      });
      const hideRes = await profileApi.hideProfile();
      expect(hideRes.visibility).toBe('HIDDEN');
    });

    it('updates interests and prompts collections', async () => {
      const profileApi = createProfileApi(authClient);

      // Interests
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: [{ id: 'int-1', name: 'Design', slug: 'design', category: 'Creative' }],
        }),
      });
      const interestsRes = await profileApi.updateMyInterests({ interestIds: ['int-1'] });
      expect(interestsRes).toHaveLength(1);

      // Prompts
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: [
            {
              id: 'pp-1',
              promptDefinitionId: 'pdef-1',
              prompt: 'My ideal Sunday...',
              answer: 'Coffee in Bandra',
              position: 0,
            },
          ],
        }),
      });
      const promptsRes = await profileApi.updateMyPrompts({
        prompts: [{ promptDefinitionId: 'pdef-1', answer: 'Coffee in Bandra', position: 0 }],
      });
      expect(promptsRes).toHaveLength(1);
      expect(promptsRes[0]?.answer).toBe('Coffee in Bandra');
    });
  });

  describe('2. Media Workflow & Operations', () => {
    it('supports photo lifecycle: request upload URL, complete, set primary, and delete', async () => {
      const profileApi = createProfileApi(authClient);

      // 1. Request upload URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            mediaId: 'm-99',
            uploadUrl: 'https://s3.amazonaws.com/nazar/upload',
            storageKey: 'users/123/m-99.jpg',
            expiresAt: '2026-09-30T13:00:00.000Z',
          },
        }),
      });
      const uploadUrlRes = await profileApi.requestUploadUrl({
        mimeType: 'image/jpeg',
        sizeBytes: 204800,
      });
      expect(uploadUrlRes.mediaId).toBe('m-99');

      // 2. Complete upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            id: 'm-99',
            url: 'https://cdn.nazar.app/m-99.jpg',
            mediaType: 'IMAGE',
            mimeType: 'image/jpeg',
            status: 'READY',
            position: 1,
            isPrimary: false,
            createdAt: '2026-09-30T12:00:00.000Z',
          },
        }),
      });
      const completeRes = await profileApi.completeUpload('m-99');
      expect(completeRes.status).toBe('READY');

      // 3. Set Primary
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: [{ ...completeRes, isPrimary: true }],
        }),
      });
      const primaryRes = await profileApi.setPrimaryPhoto('m-99');
      expect(primaryRes[0]?.isPrimary).toBe(true);

      // 4. Delete photo
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { message: 'Photo deleted' } }),
      });
      await expect(profileApi.deleteMedia('m-99')).resolves.not.toThrow();
    });
  });

  describe('3. Account & Active Sessions Management', () => {
    it('lists active sessions and correctly identifies current device session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: mockSessions }),
      });

      const sessions = await authClient.listSessions();
      expect(sessions).toHaveLength(2);

      const current = sessions.find((s) => s.isCurrentSession);
      const other = sessions.find((s) => !s.isCurrentSession);

      expect(current?.id).toBe('sess-current');
      expect(current?.platform).toBe('iOS');
      expect(other?.id).toBe('sess-other');
      expect(other?.platform).toBe('Android');
    });

    it('revokes an individual non-current session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { message: 'Session revoked' } }),
      });

      const res = await authClient.revokeSession('sess-other');
      expect(res.message).toBe('Session revoked');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nazar.internal/v1/auth/sessions/sess-other',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('logs out all other devices with logoutAll', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { message: 'All other sessions terminated' } }),
      });

      const res = await authClient.logoutAll();
      expect(res.message).toBe('All other sessions terminated');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nazar.internal/v1/auth/logout-all',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('lists registered push devices and unregisters a device', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: mockDevices }),
      });

      const devices = await authClient.listDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0]?.platform).toBe('ios');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { message: 'Device removed' } }),
      });
      const revokeRes = await authClient.revokeDevice('dev-reg-1');
      expect(revokeRes.message).toBe('Device removed');
    });
  });

  describe('4. Safety & Block Management', () => {
    it('retrieves blocked members list and unblocks a user', async () => {
      const safetyApi = createSafetyApi(authClient);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: mockBlockedUsers }),
      });

      const res = await safetyApi.getBlockedUsers();
      expect(res.items).toHaveLength(1);
      expect(res.items[0]?.displayName).toBe('Rohan');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            success: true,
            unblockedUserId: 'blocked-user-99',
            unblockedAt: '2026-09-30T13:00:00.000Z',
          },
        }),
      });

      const unblockRes = await safetyApi.unblockUser('blocked-user-99');
      expect(unblockRes.success).toBe(true);
      expect(unblockRes.unblockedUserId).toBe('blocked-user-99');
    });

    it('centrally invalidates all safety, discovery, matches, and chat caches', () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      invalidateSafetyCaches(queryClient);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SAFETY_QUERY_KEYS.blocks });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['discovery'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['matches'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['social'] });
    });
  });

  describe('5. Account Boundary Lifecycle & Cleanup', () => {
    it('executes complete account session purge on logout', async () => {
      useProfileStore.getState().setProfile(mockProfile);
      useOnboardingStore.getState().updateDraftProfile({ displayName: 'Aarav' });

      // Pre-populate query cache
      queryClient.setQueryData(PROFILE_QUERY_KEYS.me, mockProfile);
      expect(queryClient.getQueryData(PROFILE_QUERY_KEYS.me)).toBeDefined();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { message: 'Logged out' } }),
      });

      await purgeAccountSessionAndCaches(queryClient, authClient);

      // Verify tokens cleared
      const token = await tokenStorage.getAccessToken();
      expect(token).toBeNull();

      // Verify profile store reset
      expect(useProfileStore.getState().profile).toBeNull();
      expect(useProfileStore.getState().media).toEqual([]);

      // Verify onboarding store reset
      expect(useOnboardingStore.getState().draftProfile.displayName).toBe('');

      // Verify TanStack query cache completely purged
      expect(queryClient.getQueryData(PROFILE_QUERY_KEYS.me)).toBeUndefined();
    });

    it('executes complete account deletion and purges local stores and caches', async () => {
      useProfileStore.getState().setProfile(mockProfile);
      useOnboardingStore.getState().updateDraftProfile({ displayName: 'Aarav' });
      queryClient.setQueryData(PROFILE_QUERY_KEYS.me, mockProfile);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { success: true, message: 'Account deleted' } }),
      });

      await purgeDeletedAccount(queryClient, authClient);

      // Tokens cleared
      expect(await tokenStorage.getAccessToken()).toBeNull();
      expect(await tokenStorage.getRefreshToken()).toBeNull();

      // Stores wiped
      expect(useProfileStore.getState().profile).toBeNull();
      expect(useOnboardingStore.getState().draftProfile.displayName).toBe('');

      // Query cache wiped
      expect(queryClient.getQueryData(PROFILE_QUERY_KEYS.me)).toBeUndefined();
    });
  });

  describe('6. Telemetry & Zero PII Guarantees', () => {
    it('sanitizes and strips forbidden PII fields from telemetry payloads', () => {
      const rawProps = {
        action: 'edit_profile',
        city: 'Mumbai',
        latitude: 19.076,
        longitude: 72.8777,
        phoneNumber: '+919876543210',
        token: 'secret_token_123',
        description: 'safe note',
      };

      const sanitized = sanitizeAnalyticsProperties(rawProps);

      expect(sanitized.action).toBe('edit_profile');
      expect(sanitized.city).toBe('Mumbai');
      expect(sanitized.description).toBe('safe note');

      // Sensitive PII stripped
      expect(sanitized.latitude).toBeUndefined();
      expect(sanitized.longitude).toBeUndefined();
      expect(sanitized.phoneNumber).toBeUndefined();
      expect(sanitized.token).toBeUndefined();
    });
  });
});
