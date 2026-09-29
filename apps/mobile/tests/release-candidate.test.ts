import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getMobileConfig, resetMobileConfigCache } from '../src/config/mobile-config';
import { CrashReporter } from '../src/observability/crash-reporter';
import { notificationManager } from '../src/notifications/notification-manager';
import type { NotificationType } from '@platform/api-contracts';

describe('Gate 19: Mobile Release Candidate & App Store Readiness', () => {
  const projectRoot = path.resolve(__dirname, '..');

  beforeEach(() => {
    resetMobileConfigCache();
  });

  describe('1. Release Candidate Identity & Configuration', () => {
    it('should have consistent semantic versioning in app.json and package.json', () => {
      const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf-8'));
      const pkgJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));

      expect(appJson.expo.version).toBe('1.0.0');
      expect(pkgJson.version).toBe('1.0.0');
      expect(appJson.expo.android.versionCode).toBe(10000);
      expect(appJson.expo.ios.buildNumber).toBe('10000');
      expect(appJson.expo.ios.bundleIdentifier).toBe('com.nazar.app');
      expect(appJson.expo.android.package).toBe('com.nazar.app');
      expect(appJson.expo.scheme).toBe('nazar');
    });

    it('should contain all required branding assets', () => {
      const assetsDir = path.join(projectRoot, 'assets');
      expect(fs.existsSync(path.join(assetsDir, 'icon.png'))).toBe(true);
      expect(fs.existsSync(path.join(assetsDir, 'adaptive-icon.png'))).toBe(true);
      expect(fs.existsSync(path.join(assetsDir, 'splash.png'))).toBe(true);
      expect(fs.existsSync(path.join(assetsDir, 'favicon.png'))).toBe(true);
    });

    it('should configure reproducible EAS build profiles', () => {
      const easJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'eas.json'), 'utf-8'));

      expect(easJson.build.development).toBeDefined();
      expect(easJson.build.staging).toBeDefined();
      expect(easJson.build.production).toBeDefined();
      expect(easJson.build.production.distribution).toBe('store');
      expect(easJson.build.production.channel).toBe('production');
      expect(easJson.build.production.env.EXPO_PUBLIC_APP_ENV).toBe('production');
      expect(easJson.build.production.env.EXPO_PUBLIC_API_URL).toMatch(/^https:\/\//);
      expect(easJson.build.production.env.EXPO_PUBLIC_WS_URL).toMatch(/^wss:\/\//);
    });
  });

  describe('2. Environment Safety & Config Validation', () => {
    it('should reject insecure HTTP and localhost in production builds', () => {
      expect(() =>
        getMobileConfig({
          EXPO_PUBLIC_APP_ENV: 'production',
          EXPO_PUBLIC_API_URL: 'http://localhost:4000/api/v1',
          EXPO_PUBLIC_WS_URL: 'wss://api.nazar.app',
        })
      ).toThrow(/Production mobile builds must use a secure remote HTTPS API endpoint/);

      expect(() =>
        getMobileConfig({
          EXPO_PUBLIC_APP_ENV: 'production',
          EXPO_PUBLIC_API_URL: 'https://api.nazar.app/v1',
          EXPO_PUBLIC_WS_URL: 'ws://localhost:4000',
        })
      ).toThrow(/Production mobile builds must use a secure remote WSS WebSocket endpoint/);
    });

    it('should accept valid HTTPS and WSS in production', () => {
      const config = getMobileConfig({
        EXPO_PUBLIC_APP_ENV: 'production',
        EXPO_PUBLIC_API_URL: 'https://api.nazar.app/v1',
        EXPO_PUBLIC_WS_URL: 'wss://api.nazar.app',
      });

      expect(config.EXPO_PUBLIC_APP_ENV).toBe('production');
      expect(config.EXPO_PUBLIC_API_URL).toBe('https://api.nazar.app/v1');
      expect(config.EXPO_PUBLIC_WS_URL).toBe('wss://api.nazar.app');
      expect('DATABASE_URL' in config).toBe(false);
      expect('JWT_SECRET' in config).toBe(false);
    });
  });

  describe('3. Store Permissions & Privacy Manifest Audit', () => {
    it('should audit declared Android permissions strictly', () => {
      const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf-8'));
      const permissions: string[] = appJson.expo.android.permissions;

      expect(permissions).toContain('ACCESS_FINE_LOCATION');
      expect(permissions).toContain('ACCESS_COARSE_LOCATION');
      expect(permissions).toContain('CAMERA');
      expect(permissions).toContain('READ_MEDIA_IMAGES');
      expect(permissions).toContain('POST_NOTIFICATIONS');

      // Superfluous permissions MUST NOT be present
      expect(permissions).not.toContain('ACCESS_BACKGROUND_LOCATION');
      expect(permissions).not.toContain('RECORD_AUDIO');
      expect(permissions).not.toContain('READ_CONTACTS');
      expect(permissions).not.toContain('BLUETOOTH');
    });

    it('should audit declared iOS permission descriptions and entitlements', () => {
      const appJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf-8'));
      const infoPlist = appJson.expo.ios.infoPlist;

      expect(infoPlist.NSCameraUsageDescription).toBeDefined();
      expect(infoPlist.NSCameraUsageDescription.length).toBeGreaterThan(10);
      expect(infoPlist.NSPhotoLibraryUsageDescription).toBeDefined();
      expect(infoPlist.NSLocationWhenInUseUsageDescription).toBeDefined();
      expect(infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);

      // Entitlements
      const entitlements = appJson.expo.ios.entitlements;
      expect(entitlements['aps-environment']).toBe('production');
      expect(entitlements['com.apple.developer.associated-domains']).toContain(
        'applinks:nazar.app'
      );
    });

    it('should verify Apple Privacy Manifest PrivacyInfo.xcprivacy', () => {
      const privacyPath = path.join(projectRoot, 'ios', 'PrivacyInfo.xcprivacy');
      expect(fs.existsSync(privacyPath)).toBe(true);

      const content = fs.readFileSync(privacyPath, 'utf-8');
      expect(content).toContain('NSPrivacyTracking');
      expect(content).toContain('NSPrivacyCollectedDataTypes');
      expect(content).toContain('NSPrivacyAccessedAPITypes');
      expect(content).toContain('CA92.1'); // UserDefaults
      expect(content).toContain('NSPrivacyCollectedDataTypePreciseLocation');
    });
  });

  describe('4. Deep Linking & Notification Routing', () => {
    it('should route deep links correctly for all notification events', () => {
      const cases: Array<{
        type: NotificationType;
        payload: Record<string, string>;
        expected: string;
      }> = [
        {
          type: 'NEW_MESSAGE',
          payload: { conversationId: 'c-123' },
          expected: '/chat/c-123',
        },
        {
          type: 'NEW_MESSAGE',
          payload: {},
          expected: '/conversations',
        },
        {
          type: 'NEW_MATCH',
          payload: { matchId: 'm-456' },
          expected: '/matches/m-456',
        },
        {
          type: 'NEW_MATCH',
          payload: {},
          expected: '/matches',
        },
        {
          type: 'NEW_LIKE',
          payload: {},
          expected: '/discovery',
        },
        {
          type: 'SYSTEM_NOTICE',
          payload: {},
          expected: '/notifications',
        },
        {
          type: 'ACCOUNT_RESTRICTION',
          payload: {},
          expected: '/notifications',
        },
      ];

      for (const c of cases) {
        const route = notificationManager.resolveDeepLinkRoute({
          type: c.type,
          ...c.payload,
        });
        expect(route).toBe(c.expected);
      }
    });
  });

  describe('5. Observability & Crash Reporting', () => {
    it('should record crash reports tagged with release candidate identity and redacting PII', () => {
      const reporter = new CrashReporter({
        release: 'nazar-mobile@1.0.0+10000',
        environment: 'production',
        commitSha: 'commit-sha-123',
        appVersion: '1.0.0',
        buildNumber: '10000',
      });

      reporter.setUser('usr-anon-999');
      reporter.addBreadcrumb('navigation', 'User opened chat screen', {
        conversationId: 'conv-88',
      });

      const report = reporter.captureException(
        new Error('Simulated socket reconnect timeout'),
        'error'
      );

      expect(report.release).toBe('nazar-mobile@1.0.0+10000');
      expect(report.environment).toBe('production');
      expect(report.commitSha).toBe('commit-sha-123');
      expect(report.severity).toBe('error');
      expect(report.errorName).toBe('Error');
      expect(report.errorMessage).toBe('Simulated socket reconnect timeout');
      expect(report.breadcrumbs.length).toBe(1);
      expect(report.breadcrumbs[0]?.message).toBe('User opened chat screen');
      expect(report.userContext?.userId).toBe('usr-anon-999');
      // Verify no PII fields
      expect('phone' in report.userContext!).toBe(false);
      expect('token' in report.userContext!).toBe(false);
    });
  });
});
