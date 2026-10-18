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

  describe('Internet Passion Suggestions & Crowdsourcing Taxonomy', () => {
    it('cleanInterestName strips emojis and trims whitespace cleanly', async () => {
      const { cleanInterestName } = await import('../app/(onboarding)/interests.js');
      expect(cleanInterestName('🍕 Masala Chai ☕')).toBe('Masala Chai');
      expect(cleanInterestName('✨ Death Note & Shinigami 🍎')).toBe('Death Note & Shinigami');
      expect(cleanInterestName('   Anime Soundtracks   ')).toBe('Anime Soundtracks');
    });

    it('fetchInternetPassionSuggestions returns empty for short queries', async () => {
      const { fetchInternetPassionSuggestions } = await import('../app/(onboarding)/interests.js');
      const results = await fetchInternetPassionSuggestions('a');
      expect(results).toEqual([]);
    });

    it('fetchInternetPassionSuggestions resolves real entities from Wikipedia API mock', async () => {
      const { fetchInternetPassionSuggestions } = await import('../app/(onboarding)/interests.js');

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          'attack on titan',
          ['Attack on Titan', 'Attack on Titan (TV series)', 'Attack on Titan: Junior High'],
        ],
      }) as unknown as typeof fetch;

      try {
        const results = await fetchInternetPassionSuggestions('attack on titan');
        expect(results).toContain('Attack on Titan');
        expect(results).toContain('Attack on Titan: Junior High');
        // Parenthetical disambiguation should be stripped
        expect(results).not.toContain('Attack on Titan (TV series)');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('createProfileApi.createInterest submits POST /v1/interests', async () => {
      const { createProfileApi } = await import('../src/profile/profile-api.js');
      const mockRequest = vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: '0192e123-4567-789a-bcde-f0123456789a',
          name: 'Cyberpunk Edgerunners',
          slug: 'cyberpunk-edgerunners',
          category: 'Anime',
        },
      });

      const mockAuthClient = {
        request: mockRequest,
      } as unknown as AuthClient;

      const profileApi = createProfileApi(mockAuthClient);
      const res = await profileApi.createInterest({
        name: 'Cyberpunk Edgerunners',
        category: 'Anime',
      });

      expect(mockRequest).toHaveBeenCalledWith('/v1/interests', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Cyberpunk Edgerunners',
          category: 'Anime',
        }),
      });
      expect(res.id).toBe('0192e123-4567-789a-bcde-f0123456789a');
      expect(res.name).toBe('Cyberpunk Edgerunners');
    });

    it('resolveCategoryForPassion accurately classifies cultural entities into correct categories', async () => {
      const { resolveCategoryForPassion } = await import('../app/(onboarding)/interests.js');

      // Anime & Manga
      expect(resolveCategoryForPassion('Attack on Titan')).toBe('Anime');
      expect(resolveCategoryForPassion('Demon Slayer')).toBe('Anime');
      expect(resolveCategoryForPassion('Studio Ghibli')).toBe('Anime');
      expect(resolveCategoryForPassion('Jujutsu Kaisen')).toBe('Anime');

      // Gaming & Tech
      expect(resolveCategoryForPassion('Cyberpunk 2077')).toBe('Gaming & Tech');
      expect(resolveCategoryForPassion('Robotics & AI')).toBe('Gaming & Tech');
      expect(resolveCategoryForPassion('Nintendo Switch')).toBe('Gaming & Tech');
      expect(resolveCategoryForPassion('Minecraft')).toBe('Gaming & Tech');

      // Movies & Cinema
      expect(resolveCategoryForPassion('Christopher Nolan Films')).toBe('Movies & Cinema');
      expect(resolveCategoryForPassion('Marvel Cinematic Universe')).toBe('Movies & Cinema');
      expect(resolveCategoryForPassion('Quentin Tarantino')).toBe('Movies & Cinema');

      // Music & Audio
      expect(resolveCategoryForPassion('Taylor Swift Albums')).toBe('Music & Audio');
      expect(resolveCategoryForPassion('Indie Rock Band')).toBe('Music & Audio');
      expect(resolveCategoryForPassion('Electronic Synthesizer')).toBe('Music & Audio');

      // Food & Drink
      expect(resolveCategoryForPassion('Sourdough Baking')).toBe('Food & Drink');
      expect(resolveCategoryForPassion('Artisanal Coffee & Espresso')).toBe('Food & Drink');
      expect(resolveCategoryForPassion('Hyderabadi Biryani')).toBe('Food & Drink');

      // Books & Literature
      expect(resolveCategoryForPassion('Haruki Murakami Novels')).toBe('Books & Literature');
      expect(resolveCategoryForPassion('Sci-Fi Fantasy Fiction')).toBe('Books & Literature');
      expect(resolveCategoryForPassion('Classic Poetry')).toBe('Books & Literature');

      // Sports & Fitness
      expect(resolveCategoryForPassion('Formula 1 Racing')).toBe('Sports & Fitness');
      expect(resolveCategoryForPassion('Padel Tennis')).toBe('Sports & Fitness');
      expect(resolveCategoryForPassion('Marathon Running')).toBe('Sports & Fitness');

      // Outdoor & Nature
      expect(resolveCategoryForPassion('Himalayan Trekking')).toBe('Outdoor & Nature');
      expect(resolveCategoryForPassion('Stargazing & Astronomy')).toBe('Outdoor & Nature');
      expect(resolveCategoryForPassion('Scuba Diving')).toBe('Outdoor & Nature');

      // Travel & Adventure
      expect(resolveCategoryForPassion('Solo Backpacking in Bali')).toBe('Travel & Adventure');
      expect(resolveCategoryForPassion('Road Trips & Wanderlust')).toBe('Travel & Adventure');

      // Arts & Culture
      expect(resolveCategoryForPassion('Pottery & Ceramics')).toBe('Arts & Culture');
      expect(resolveCategoryForPassion('Classical Ballet & Theater')).toBe('Arts & Culture');
      expect(resolveCategoryForPassion('Modern Architecture')).toBe('Arts & Culture');

      // Science & Knowledge
      expect(resolveCategoryForPassion('Astrophysics & Quantum Space')).toBe('Science & Knowledge');

      // Automotive & Speed
      expect(resolveCategoryForPassion('Supercars & Drifting')).toBe('Automotive & Speed');

      // Business & Startups
      expect(resolveCategoryForPassion('Startup Founders & Venture Capital')).toBe(
        'Business & Startups'
      );

      // Lifestyle & Social
      expect(resolveCategoryForPassion('Golden Retriever Puppies')).toBe('Lifestyle & Social');
      expect(resolveCategoryForPassion('Mindfulness Meditation')).toBe('Lifestyle & Social');
      expect(resolveCategoryForPassion('Stand-up Comedy')).toBe('Lifestyle & Social');
    });

    it('fetchInternetPassionSuggestionsWithDetails resolves web suggestions with resolved categories', async () => {
      const { fetchInternetPassionSuggestionsWithDetails } =
        await import('../app/(onboarding)/interests.js');

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          'naruto',
          ['Naruto Shippuden', 'Naruto: Ninja Destiny', 'Naruto: Ultimate Ninja Storm'],
        ],
      }) as unknown as typeof fetch;

      try {
        const results = await fetchInternetPassionSuggestionsWithDetails('naruto');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.name).toBe('Naruto Shippuden');
        expect(results[0]?.category).toBe('Anime');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
