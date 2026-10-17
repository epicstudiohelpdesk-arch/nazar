import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrivateProfileResponse, AuthTokensResponse } from '@platform/api-contracts';
import {
  determineNextStepFromProfile,
  getStepProgress,
  useOnboardingStore,
} from '../src/auth/onboarding-store.js';
import { sanitizeAnalyticsProperties } from '../src/analytics/onboarding-analytics.js';
import { AuthService } from '../src/auth/auth-service.js';
import { SessionService } from '../src/auth/session-service.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import { AuthClient } from '../src/auth/auth-client.js';

describe('Onboarding & First-Run Suite', () => {
  beforeEach(() => {
    useOnboardingStore.getState().resetOnboardingDraft();
  });

  describe('First-Run State Machine & Milestone Resolver', () => {
    it('returns intro when profile is null', () => {
      expect(determineNextStepFromProfile(null)).toBe('intro');
    });

    it('returns profile-setup when basic details are missing', () => {
      const incompleteProfile = {
        displayName: '',
        dateOfBirth: '',
        gender: 'WOMAN',
        media: [],
        interests: [],
        prompts: [],
      } as unknown as PrivateProfileResponse;

      expect(determineNextStepFromProfile(incompleteProfile)).toBe('profile-setup');
    });

    it('returns photos when less than 2 photos are ready', () => {
      const profile = {
        displayName: 'Aanya',
        dateOfBirth: '1998-05-15',
        gender: 'WOMAN',
        media: [{ id: 'm1', url: 'https://img.com/1', status: 'READY', isPrimary: true }],
        interests: [],
        prompts: [],
      } as unknown as PrivateProfileResponse;

      expect(determineNextStepFromProfile(profile)).toBe('photos');
    });

    it('returns interests when photos are >= 2 but interests < 3', () => {
      const profile = {
        displayName: 'Aanya',
        dateOfBirth: '1998-05-15',
        gender: 'WOMAN',
        media: [
          { id: 'm1', url: 'https://img.com/1', status: 'READY', isPrimary: true },
          { id: 'm2', url: 'https://img.com/2', status: 'READY', isPrimary: false },
        ],
        interests: [{ id: '1', name: 'Filter Coffee' }],
        prompts: [],
      } as unknown as PrivateProfileResponse;

      expect(determineNextStepFromProfile(profile)).toBe('interests');
    });

    it('returns prompts when interests >= 3 but prompts < 1', () => {
      const profile = {
        displayName: 'Aanya',
        dateOfBirth: '1998-05-15',
        gender: 'WOMAN',
        media: [
          { id: 'm1', url: 'https://img.com/1', status: 'READY', isPrimary: true },
          { id: 'm2', url: 'https://img.com/2', status: 'READY', isPrimary: false },
        ],
        interests: [
          { id: '1', name: 'Filter Coffee' },
          { id: '2', name: 'Indie Cinema' },
          { id: '3', name: 'Books' },
        ],
        prompts: [],
      } as unknown as PrivateProfileResponse;

      expect(determineNextStepFromProfile(profile)).toBe('prompts');
    });

    it('returns preferences when prompts >= 1 but preferences are null', () => {
      const profile = {
        displayName: 'Aanya',
        dateOfBirth: '1998-05-15',
        gender: 'WOMAN',
        media: [
          { id: 'm1', url: 'https://img.com/1', status: 'READY', isPrimary: true },
          { id: 'm2', url: 'https://img.com/2', status: 'READY', isPrimary: false },
        ],
        interests: [
          { id: '1', name: 'Filter Coffee' },
          { id: '2', name: 'Indie Cinema' },
          { id: '3', name: 'Books' },
        ],
        prompts: [
          {
            id: 'p1',
            promptDefinitionId: 'pd1',
            prompt: 'Sunday morning',
            answer: 'Filter coffee',
          },
        ],
        preferences: null,
      } as unknown as PrivateProfileResponse;

      expect(determineNextStepFromProfile(profile)).toBe('preferences');
    });

    it('returns preview when all profile milestones are satisfied', () => {
      const profile = {
        displayName: 'Aanya',
        dateOfBirth: '1998-05-15',
        gender: 'WOMAN',
        media: [
          { id: 'm1', url: 'https://img.com/1', status: 'READY', isPrimary: true },
          { id: 'm2', url: 'https://img.com/2', status: 'READY', isPrimary: false },
        ],
        interests: [
          { id: '1', name: 'Filter Coffee' },
          { id: '2', name: 'Indie Cinema' },
          { id: '3', name: 'Books' },
        ],
        prompts: [
          {
            id: 'p1',
            promptDefinitionId: 'pd1',
            prompt: 'Sunday morning',
            answer: 'Filter coffee',
          },
        ],
        preferences: {
          minAge: 21,
          maxAge: 35,
          genderPreferences: ['MAN'],
          maxDistanceKm: 50,
          relationshipIntent: 'LONG_TERM',
        },
      } as unknown as PrivateProfileResponse;

      expect(determineNextStepFromProfile(profile)).toBe('preview');
    });

    it('calculates step progression correctly', () => {
      expect(getStepProgress('intro')).toBeGreaterThan(0);
      expect(getStepProgress('preview')).toBe(1.0);
    });
  });

  describe('Analytics & Zero-PII Sanitization', () => {
    it('strips sensitive PII fields (phone, email, otp, password, dob)', () => {
      const rawProps = {
        step: 'phone_auth',
        phoneNumber: '+919876543210',
        email: 'user@example.com',
        code: '123456',
        token: 'secret_jwt_token',
        password: 'my_password',
        dateOfBirth: '1995-10-20',
        latitude: 19.076,
        longitude: 72.8777,
        authMethod: 'phone',
        isNewUser: true,
      };

      const sanitized = sanitizeAnalyticsProperties(rawProps);

      expect(sanitized).toEqual({
        step: 'phone_auth',
        authMethod: 'phone',
        isNewUser: true,
      });

      expect(sanitized.phoneNumber).toBeUndefined();
      expect(sanitized.email).toBeUndefined();
      expect(sanitized.code).toBeUndefined();
      expect(sanitized.token).toBeUndefined();
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.dateOfBirth).toBeUndefined();
      expect(sanitized.latitude).toBeUndefined();
    });
  });

  describe.skip('AuthService & Rate Limit Handling (Deprecated - backend OTP removed)', () => {
    it('handles 429 rate limit correctly', async () => {
      const mockStorage = new InMemoryTokenStorage();
      const mockClient = new AuthClient({
        baseUrl: 'http://localhost:3000',
        storage: mockStorage,
        fetchFn: vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded: Too many attempts',
            },
          }),
        }),
      });

      const authService = new AuthService(mockClient);
      const res = await authService.requestPhoneOtp('+919876543210');

      expect(res.success).toBe(false);
      expect(res.isRateLimited).toBe(true);
      expect(res.retryAfterSeconds).toBe(60);
      expect(res.error).toContain('Too many attempts');
    });

    it('verifies phone OTP and stores tokens', async () => {
      const mockStorage = new InMemoryTokenStorage();
      const tokensPayload: AuthTokensResponse = {
        accessToken: 'access_123',
        refreshToken: 'refresh_456',
        expiresIn: 3600,
        user: { id: 'u1', isNewUser: true },
      };

      const mockClient = new AuthClient({
        baseUrl: 'http://localhost:3000',
        storage: mockStorage,
        fetchFn: vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: tokensPayload,
          }),
        }),
      });

      const authService = new AuthService(mockClient);
      const res = await authService.verifyPhoneOtp('+919876543210', '123456');

      expect(res.success).toBe(true);
      expect(res.data?.user.isNewUser).toBe(true);
      expect(await mockStorage.getAccessToken()).toBe('access_123');
      expect(await mockStorage.getRefreshToken()).toBe('refresh_456');
    });
  });

  describe('SessionService & Returning User Flow', () => {
    it('returns UNAUTHENTICATED if no tokens exist', async () => {
      const mockStorage = new InMemoryTokenStorage();
      const mockClient = new AuthClient({
        baseUrl: 'http://localhost:3000',
        storage: mockStorage,
      });

      const sessionService = new SessionService(mockClient, {
        getMyProfile: vi.fn(),
      } as any);

      const res = await sessionService.restoreSession();
      expect(res.status).toBe('UNAUTHENTICATED');
    });

    it('returns ACTIVE if profile has ACTIVE visibility', async () => {
      const mockStorage = new InMemoryTokenStorage();
      await mockStorage.setAccessToken('valid_token');

      const mockClient = new AuthClient({
        baseUrl: 'http://localhost:3000',
        storage: mockStorage,
      });

      const mockProfileApi = {
        getMyProfile: vi.fn().mockResolvedValue({
          id: 'p1',
          displayName: 'Priya',
          visibility: 'ACTIVE',
          media: [],
          interests: [],
          prompts: [],
        }),
      };

      const sessionService = new SessionService(mockClient, mockProfileApi as any);
      const res = await sessionService.restoreSession();

      expect(res.status).toBe('ACTIVE');
      expect(res.profile?.displayName).toBe('Priya');
    });

    it('handles expired tokens (401) by clearing storage and returning EXPIRED', async () => {
      const mockStorage = new InMemoryTokenStorage();
      await mockStorage.setAccessToken('expired_token');

      const mockClient = new AuthClient({
        baseUrl: 'http://localhost:3000',
        storage: mockStorage,
      });

      const mockProfileApi = {
        getMyProfile: vi.fn().mockRejectedValue(new Error('401 Unauthorized')),
      };

      const sessionService = new SessionService(mockClient, mockProfileApi as any);
      const res = await sessionService.restoreSession();

      expect(res.status).toBe('EXPIRED');
      expect(await mockStorage.getAccessToken()).toBeNull();
    });
  });
});
