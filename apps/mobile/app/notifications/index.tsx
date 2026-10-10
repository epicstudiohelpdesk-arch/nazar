import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDefaultAuthClient } from '../../src/auth/default-client';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics';
import { createNotificationsApi } from '../../src/notifications/notifications-api';
import type { PushPermissionState } from '../../src/notifications/push-permissions';
import {
  configurePushRuntime,
  getCurrentPushPermission,
  probePushDevice,
  requestPushPermission,
} from '../../src/notifications/push-runtime';
import { NotificationsScreen } from '../../src/notifications/NotificationsScreen';
import {
  useNotificationIngress,
  useNotificationResumeSync,
} from '../../src/notifications/useNotifications';

export default function NotificationsRoute(): React.JSX.Element {
  const authClient = getDefaultAuthClient();
  const client = useMemo(() => createNotificationsApi(authClient), [authClient]);

  const [permission, setPermission] = useState<PushPermissionState>('not_requested');
  const [isEnabling, setIsEnabling] = useState(false);

  useNotificationIngress();
  useNotificationResumeSync();

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
    trackOnboardingEvent('notifications_center_viewed', { source: 'route' });
  }, []);

  /**
   * Permission is followed by registration in the same gesture: a granted
   * permission is not useful until the device is registered, and the backend is
   * what decides whether the device is actually eligible.
   */
  const handleEnable = useCallback(async () => {
    setIsEnabling(true);
    trackOnboardingEvent('push_permission_prompted', { surface: 'activity_center' });
    try {
      const result = await requestPushPermission();
      setPermission(result);
      if (result === 'granted' || result === 'provisional') {
        trackOnboardingEvent('push_permission_granted', { surface: 'activity_center' });
        const snapshot = await probePushDevice();
        if (snapshot.pushToken && snapshot.descriptor) {
          try {
            await client.registerDevice({
              ...snapshot.descriptor,
              pushToken: snapshot.pushToken,
            });
            trackOnboardingEvent('push_registered', { platform: snapshot.descriptor.platform });
          } catch {
            // A failed registration is not surfaced as a permission problem; the
            // Activity Center and the in-app feed keep working.
            trackOnboardingEvent('push_registration_failed', {
              platform: snapshot.descriptor.platform,
            });
          }
        }
      } else if (result === 'denied' || result === 'blocked') {
        trackOnboardingEvent('push_permission_denied', {
          surface: 'activity_center',
          state: result,
        });
      } else {
        trackOnboardingEvent('push_permission_unavailable', { state: result });
      }
    } finally {
      setIsEnabling(false);
    }
  }, [client]);

  return (
    <NotificationsScreen
      client={client}
      pushPermission={permission}
      onEnablePush={() => void handleEnable()}
      isEnablingPush={isEnabling}
    />
  );
}
