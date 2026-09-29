import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Root & Layouts
import RootLayout from '../app/_layout.js';
import IndexScreen from '../app/index.js';
import TabsLayout from '../app/(tabs)/_layout.js';
import AuthLayout from '../app/(auth)/_layout.js';
import OnboardingLayout from '../app/(onboarding)/_layout.js';

// Tabs
import DiscoverTabRoute from '../app/(tabs)/discovery/index.js';
import MatchesTabRoute from '../app/(tabs)/matches/index.js';
import MessagesTabRoute from '../app/(tabs)/messages/index.js';
import ExploreTabRoute from '../app/(tabs)/explore/index.js';
import ProfileTabRoute from '../app/(tabs)/profile/index.js';

// Auth & Onboarding
import WelcomeScreen from '../app/(auth)/welcome.js';
import LoginScreen from '../app/(auth)/login.js';
import OtpVerificationScreen from '../app/(auth)/otp.js';
import OnboardingProfileSetupScreen from '../app/(onboarding)/profile-setup.js';
import OnboardingPhotosScreen from '../app/(onboarding)/photos.js';
import OnboardingInterestsScreen from '../app/(onboarding)/interests.js';
import OnboardingPromptsScreen from '../app/(onboarding)/prompts.js';
import OnboardingPermissionsScreen from '../app/(onboarding)/permissions.js';

// Profiles & Social
import PublicProfileRoute from '../app/profile/[userId].js';
import EditProfileRoute from '../app/profile/edit.js';
import ProfilePreviewRoute from '../app/profile/preview.js';
import PostDetailRoute from '../app/social/post/[postId].js';
import CreatePostRoute from '../app/social/create-post.js';
import CommunityDetailRoute from '../app/social/community/[communityId].js';
import EventDetailRoute from '../app/social/event/[eventId].js';

// Settings & Modals
import SettingsHubRoute from '../app/settings/index.js';
import PrivacySettingsRoute from '../app/settings/privacy.js';
import SafetyHubRoute from '../app/settings/safety.js';
import NotificationSettingsRoute from '../app/settings/notifications.js';
import DeleteAccountRoute from '../app/settings/delete-account.js';
import FiltersModalRoute from '../app/modal/filters.js';
import SafetyReportModalRoute from '../app/modal/report.js';
import BlockModalRoute from '../app/modal/block.js';
import MatchCelebrationModalRoute from '../app/modal/celebration.js';

import { notificationManager } from '../src/notifications/notification-manager.js';

describe('Frontend F1: Information Architecture & Navigation', () => {
  const projectRoot = path.resolve(__dirname, '..');

  describe('1. Route Tree & Screen Component Integrity', () => {
    it('should export all root and group layout components', () => {
      expect(typeof RootLayout).toBe('function');
      expect(typeof IndexScreen).toBe('function');
      expect(typeof TabsLayout).toBe('function');
      expect(typeof AuthLayout).toBe('function');
      expect(typeof OnboardingLayout).toBe('function');
    });

    it('should export all 5 primary tab screen routes', () => {
      expect(typeof DiscoverTabRoute).toBe('function');
      expect(typeof MatchesTabRoute).toBe('function');
      expect(typeof MessagesTabRoute).toBe('function');
      expect(typeof ExploreTabRoute).toBe('function');
      expect(typeof ProfileTabRoute).toBe('function');
    });

    it('should export all public authentication screens', () => {
      expect(typeof WelcomeScreen).toBe('function');
      expect(typeof LoginScreen).toBe('function');
      expect(typeof OtpVerificationScreen).toBe('function');
    });

    it('should export all 5 onboarding flow screens', () => {
      expect(typeof OnboardingProfileSetupScreen).toBe('function');
      expect(typeof OnboardingPhotosScreen).toBe('function');
      expect(typeof OnboardingInterestsScreen).toBe('function');
      expect(typeof OnboardingPromptsScreen).toBe('function');
      expect(typeof OnboardingPermissionsScreen).toBe('function');
    });

    it('should export all profile and social stack screens', () => {
      expect(typeof PublicProfileRoute).toBe('function');
      expect(typeof EditProfileRoute).toBe('function');
      expect(typeof ProfilePreviewRoute).toBe('function');
      expect(typeof PostDetailRoute).toBe('function');
      expect(typeof CreatePostRoute).toBe('function');
      expect(typeof CommunityDetailRoute).toBe('function');
      expect(typeof EventDetailRoute).toBe('function');
    });

    it('should export all settings screens', () => {
      expect(typeof SettingsHubRoute).toBe('function');
      expect(typeof PrivacySettingsRoute).toBe('function');
      expect(typeof SafetyHubRoute).toBe('function');
      expect(typeof NotificationSettingsRoute).toBe('function');
      expect(typeof DeleteAccountRoute).toBe('function');
    });

    it('should export all modal route screens', () => {
      expect(typeof FiltersModalRoute).toBe('function');
      expect(typeof SafetyReportModalRoute).toBe('function');
      expect(typeof BlockModalRoute).toBe('function');
      expect(typeof MatchCelebrationModalRoute).toBe('function');
    });
  });

  describe('2. Deep-Link Configuration & Universal Links', () => {
    it('should have proper scheme and associated domains configured in app.json', () => {
      const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf-8'));
      expect(appJson.expo.scheme).toBe('nazar');
      expect(appJson.expo.ios.associatedDomains).toContain('applinks:nazar.app');
      expect(appJson.expo.ios.associatedDomains).toContain('applinks:links.nazar.app');

      const intentFilters = appJson.expo.android.intentFilters;
      expect(Array.isArray(intentFilters)).toBe(true);
      const dataHosts = intentFilters.flatMap((f: any) => f.data.map((d: any) => d.host));
      expect(dataHosts).toContain('nazar.app');
      expect(dataHosts).toContain('links.nazar.app');
    });

    it('should resolve push notification deep links deterministically', () => {
      expect(
        notificationManager.resolveDeepLinkRoute({
          type: 'NEW_MESSAGE',
          conversationId: 'conv-999',
        })
      ).toBe('/chat/conv-999');

      expect(
        notificationManager.resolveDeepLinkRoute({
          type: 'NEW_MATCH',
          matchId: 'match-888',
        })
      ).toBe('/matches/match-888');

      expect(
        notificationManager.resolveDeepLinkRoute({
          type: 'NEW_LIKE',
        })
      ).toBe('/discovery');

      expect(
        notificationManager.resolveDeepLinkRoute({
          type: 'SYSTEM_NOTICE',
        })
      ).toBe('/notifications');
    });
  });

  describe('3. Information Architecture Documentation Verification', () => {
    const docsDir = path.resolve(projectRoot, '..', '..', 'docs', 'frontend');

    it('should verify screen-map.md exists and documents key requirements', () => {
      const screenMapPath = path.join(docsDir, 'screen-map.md');
      expect(fs.existsSync(screenMapPath)).toBe(true);
      const content = fs.readFileSync(screenMapPath, 'utf-8');
      expect(content).toContain('Screen Map & Navigation Hierarchy');
      expect(content).toContain('Screen 10: Discover Feed');
      expect(content).toContain('Screen 14: Active Chat');
      expect(content).toContain('Screen 36: Match Celebration Modal');
      expect(content).toContain('Screen Priority Tiers');
    });

    it('should verify user-flows.md exists and documents core flows', () => {
      const userFlowsPath = path.join(docsDir, 'user-flows.md');
      expect(fs.existsSync(userFlowsPath)).toBe(true);
      const content = fs.readFileSync(userFlowsPath, 'utf-8');
      expect(content).toContain('New User Onboarding Flow');
      expect(content).toContain('Returning User Session Flow');
      expect(content).toContain('Discovery & Evaluation Flow');
      expect(content).toContain('Match & Celebration Flow');
      expect(content).toContain('Messaging & Realtime Chat Flow');
      expect(content).toContain('Safety, Reporting & Blocking Flow');
      expect(content).toContain('Account Deletion Flow');
    });

    it('should verify navigation-qa.md exists and contains test cases', () => {
      const qaPath = path.join(docsDir, 'navigation-qa.md');
      expect(fs.existsSync(qaPath)).toBe(true);
      const content = fs.readFileSync(qaPath, 'utf-8');
      expect(content).toContain('NAV-01');
      expect(content).toContain('Cold Launch');
      expect(content).toContain('NAV-07');
      expect(content).toContain('Android Hardware Back');
      expect(content).toContain('NAV-10');
      expect(content).toContain('Session Expiration');
      expect(content).toContain('NAV-14');
      expect(content).toContain('Unsaved Changes Guard');
    });
  });
});
