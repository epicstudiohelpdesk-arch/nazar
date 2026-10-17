import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';
import { useTheme } from '../../src/design/theme/index.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { createNotificationsApi } from '../../src/notifications/notifications-api.js';
import type { PushPermissionState } from '../../src/notifications/push-permissions.js';
import {
  configurePushRuntime,
  getCurrentPushPermission,
  probePushDevice,
  requestPushPermission,
} from '../../src/notifications/push-runtime.js';
import { NotificationSettingsScreen } from '../../src/notifications/NotificationSettingsScreen.js';

export default function NotificationSettingsRoute(): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const authClient = getDefaultAuthClient();
  const client = useMemo(() => createNotificationsApi(authClient), [authClient]);

  const [permission, setPermission] = useState<PushPermissionState>('not_requested');
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await configurePushRuntime();
      const current = await getCurrentPushPermission();
      if (!cancelled) setPermission(current);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    trackOnboardingEvent('notification_settings_viewed', { source: 'settings' });
  }, []);

  const handleEnable = useCallback(async () => {
    setIsEnabling(true);
    trackOnboardingEvent('push_permission_prompted', { surface: 'settings' });
    try {
      const result = await requestPushPermission();
      setPermission(result);
      if (result === 'granted' || result === 'provisional') {
        trackOnboardingEvent('push_permission_granted', { surface: 'settings' });
        const snapshot = await probePushDevice();
        if (snapshot.pushToken && snapshot.descriptor) {
          try {
            await client.registerDevice({
              ...snapshot.descriptor,
              pushToken: snapshot.pushToken,
            });
            trackOnboardingEvent('push_registered', { platform: snapshot.descriptor.platform });
          } catch {
            trackOnboardingEvent('push_registration_failed', {
              platform: snapshot.descriptor.platform,
            });
          }
        }
      } else if (result === 'denied' || result === 'blocked') {
        trackOnboardingEvent('push_permission_denied', { surface: 'settings', state: result });
      }
    } finally {
      setIsEnabling(false);
    }
  }, [client]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <NotificationSettingsScreen
        client={client}
        pushPermission={permission}
        onEnablePush={() => void handleEnable()}
        isEnablingPush={isEnabling}
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/settings');
          }
        }}
      />
    </SafeAreaView>
  );
}
