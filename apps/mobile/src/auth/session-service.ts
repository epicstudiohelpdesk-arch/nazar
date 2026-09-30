import type { PrivateProfileResponse } from '@platform/api-contracts';
import { getDefaultAuthClient } from './default-client.js';
import { getDefaultProfileApi } from '../profile/profile-api.js';
import { useProfileStore } from '../profile/profile-store.js';
import {
  useOnboardingStore,
  determineNextStepFromProfile,
  type OnboardingStep,
} from './onboarding-store.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

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
   * Delete account and purge session.
   */
  async deleteAccount(): Promise<void> {
    await this.authClient.deleteAccount();
    useProfileStore.getState().resetAll();
    useOnboardingStore.getState().resetOnboardingDraft();
  }
}

let defaultSessionService: SessionService | null = null;

export function getDefaultSessionService(): SessionService {
  if (!defaultSessionService) {
    defaultSessionService = new SessionService();
  }
  return defaultSessionService;
}
