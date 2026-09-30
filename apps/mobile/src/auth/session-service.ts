import type { PrivateProfileResponse } from '@platform/api-contracts';
import type { QueryClient } from '@tanstack/react-query';
import type { AuthClient } from './auth-client.js';
import { getDefaultAuthClient } from './default-client.js';
import { getDefaultProfileApi } from '../profile/profile-api.js';
import { useProfileStore } from '../profile/profile-store.js';
import { clearBillingCaches } from '../billing/useEntitlements.js';
import {
  useOnboardingStore,
  determineNextStepFromProfile,
  type OnboardingStep,
} from './onboarding-store.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export const AUTH_QUERY_KEYS = {
  sessions: ['auth', 'sessions'] as const,
  devices: ['auth', 'devices'] as const,
};

export type SessionRestoreStatus =
  | 'UNAUTHENTICATED'
  | 'ACTIVE'
  | 'INCOMPLETE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'OFFLINE';

export interface SessionRestoreResult {
  status: SessionRestoreStatus;
  profile?: PrivateProfileResponse | null;
  nextStep?: OnboardingStep;
  error?: string;
}

export class SessionService {
  constructor(
    private readonly authClient = getDefaultAuthClient(),
    private readonly profileApi = getDefaultProfileApi()
  ) {}

  /**
   * Evaluates current stored tokens and queries the authoritative backend
   * to determine the exact user state and route.
   */
  async restoreSession(): Promise<SessionRestoreResult> {
    const storage = this.authClient.getStorage();
    const [accessToken, refreshToken] = await Promise.all([
      storage.getAccessToken(),
      storage.getRefreshToken(),
    ]);

    if (!accessToken && !refreshToken) {
      return { status: 'UNAUTHENTICATED' };
    }

    try {
      const profile = await this.profileApi.getMyProfile();

      // Hydrate profile store and onboarding draft
      useProfileStore.getState().setProfile(profile);
      if (profile.preferences) {
        useProfileStore.getState().setPreferences(profile.preferences);
      }
      if (profile.interests) {
        useProfileStore.getState().setInterests([...profile.interests]);
      }
      if (profile.prompts) {
        useProfileStore.getState().setPrompts([...profile.prompts]);
      }
      if (profile.media) {
        useProfileStore.getState().setMedia([...profile.media]);
      }

      useOnboardingStore.getState().hydrateFromProfile(profile);

      trackOnboardingEvent('session_restored', {
        visibility: profile.visibility,
        hasCompleted: profile.visibility === 'ACTIVE',
      });

      if (profile.visibility === 'ACTIVE') {
        return { status: 'ACTIVE', profile };
      }

      if (profile.visibility === 'PAUSED') {
        return { status: 'PAUSED', profile };
      }

      const nextStep = determineNextStepFromProfile(profile);
      return { status: 'INCOMPLETE', profile, nextStep };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // Check if unauthorized or session expired
      if (
        message.toLowerCase().includes('unauthorized') ||
        message.toLowerCase().includes('401') ||
        message.toLowerCase().includes('invalid token')
      ) {
        await storage.clearTokens();
        trackOnboardingEvent('session_restore_failed', { reason: 'EXPIRED' });
        return { status: 'EXPIRED', error: 'Your session has expired. Please log in again.' };
      }

      // Check if network is offline
      trackOnboardingEvent('session_restore_failed', { reason: 'OFFLINE' });
      return {
        status: 'OFFLINE',
        error: 'Unable to reach Nazar servers. Check your connection to continue.',
      };
    }
  }

  /**
   * Log out of current session.
   */
  async logout(): Promise<void> {
    await this.authClient.logout();
    useProfileStore.getState().resetAll();
    useOnboardingStore.getState().resetOnboardingDraft();
  }

  /**
   * Complete account-boundary cleanup on logout.
   * Purges tokens, store state, billing caches, and all TanStack Query cache.
   */
  async purgeAccountSessionAndCaches(queryClient?: QueryClient): Promise<void> {
    try {
      await this.authClient.logout();
    } catch {
      // Continue cleanup even if server logout request fails
    }
    useProfileStore.getState().resetAll();
    useOnboardingStore.getState().resetOnboardingDraft();
    if (queryClient) {
      clearBillingCaches(queryClient);
      queryClient.clear();
    }
    trackOnboardingEvent('logout');
  }

  /**
   * Delete account and purge session.
   */
  async deleteAccount(): Promise<void> {
    await this.authClient.deleteAccount();
    useProfileStore.getState().resetAll();
    useOnboardingStore.getState().resetOnboardingDraft();
  }

  /**
   * Complete account deletion purge.
   */
  async purgeDeletedAccount(queryClient?: QueryClient): Promise<void> {
    try {
      await this.authClient.deleteAccount();
    } catch {
      // Continue cleanup
    }
    useProfileStore.getState().resetAll();
    useOnboardingStore.getState().resetOnboardingDraft();
    if (queryClient) {
      clearBillingCaches(queryClient);
      queryClient.clear();
    }
    trackOnboardingEvent('delete_account_confirmed');
  }
}

let defaultSessionService: SessionService | null = null;

export function getDefaultSessionService(): SessionService {
  if (!defaultSessionService) {
    defaultSessionService = new SessionService();
  }
  return defaultSessionService;
}

/**
 * Top-level function for complete account-boundary cleanup on logout.
 */
export async function purgeAccountSessionAndCaches(
  queryClient?: QueryClient,
  authClient?: AuthClient
): Promise<void> {
  const service = authClient ? new SessionService(authClient) : getDefaultSessionService();
  await service.purgeAccountSessionAndCaches(queryClient);
}

/**
 * Top-level function for complete account deletion purge.
 */
export async function purgeDeletedAccount(
  queryClient?: QueryClient,
  authClient?: AuthClient
): Promise<void> {
  const service = authClient ? new SessionService(authClient) : getDefaultSessionService();
  await service.purgeDeletedAccount(queryClient);
}
