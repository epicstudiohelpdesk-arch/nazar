import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { UpdateNotificationPreferencesDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { SettingsSection, SettingsToggle } from '../design/patterns/settings/index.js';
import { Banner } from '../design/components/feedback/Banner.js';
import { ErrorState } from '../design/components/feedback/ErrorState.js';
import { Spinner } from '../design/components/feedback/LoadingSkeleton.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import type { NotificationsApiClient } from './notifications-api.js';
import type { PushPermissionState } from './push-permissions.js';
import { PushPermissionCard } from './components/PushPermissionCard.js';
import { useNotificationPreferences, useUpdateNotificationPreference } from './useNotifications.js';
import { useResponsiveLayout } from '../design/responsive/index.js';
import { haptics } from '../design/haptics/index.js';

/**
 * A switch may only ever write the one field it owns. Restricting the key here
 * is what keeps a stray key from being spread into the PATCH body.
 */
type PreferenceKey = keyof UpdateNotificationPreferencesDto;

export interface NotificationSettingsScreenProps {
  readonly client: NotificationsApiClient;
  readonly pushPermission: PushPermissionState;
  readonly onEnablePush: () => void;
  readonly isEnablingPush?: boolean;
  /** Wired to the header back affordance by the route. */
  readonly onBack?: () => void;
}

/**
 * The six switches are exactly the fields on `NotificationPreferencesDto`. There
 * is no push/email/in-app channel dimension in the contract, so the UI does not
 * invent one; the server applies every preference to both the in-app record and
 * the push delivery job at creation time.
 */
export function NotificationSettingsScreen({
  client,
  pushPermission,
  onEnablePush,
  isEnablingPush = false,
  onBack,
}: NotificationSettingsScreenProps): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const preferencesQuery = useNotificationPreferences(client);
  const updatePreference = useUpdateNotificationPreference(client);
  const [failedKey, setFailedKey] = useState<PreferenceKey | null>(null);

  const handleToggle = useCallback(
    (key: PreferenceKey, value: boolean) => {
      haptics.selection();
      setFailedKey(null);
      updatePreference.mutate({ [key]: value } as UpdateNotificationPreferencesDto, {
        onSuccess: () =>
          trackOnboardingEvent('notification_preference_changed', {
            preference: key,
            enabled: value,
          }),
        onError: () => {
          haptics.notificationError();
          setFailedKey(key);
        },
      });
    },
    [updatePreference]
  );

  const preferences = preferencesQuery.data;
  /**
   * Only the row being written is disabled. A failed write leaves the server
   * value in place, so the switch visibly snaps back rather than showing an
   * optimistic value that was never saved.
   */
  const pendingKeys = updatePreference.isPending
    ? Object.keys(updatePreference.variables ?? {})
    : [];
  const isBusy = (key: PreferenceKey): boolean => pendingKeys.includes(key);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <TopNavHeader
        title="Notifications"
        leftAction="back"
        onBack={onBack}
        testID="notification-settings-header"
      />

      {preferencesQuery.isPending ? (
        <View style={styles.centered}>
          <Spinner size="large" />
        </View>
      ) : preferencesQuery.isError ? (
        <View style={styles.centered}>
          <ErrorState
            type="server_error"
            message="We could not load your notification settings."
            onRetry={() => void preferencesQuery.refetch()}
          />
        </View>
      ) : preferences ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { gap: spacing.xl, maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {updatePreference.isError && (
            <Banner
              variant="account_warning"
              message="That change was not saved"
              description="Your settings are unchanged. Try again in a moment."
              testID="preference-error-banner"
            />
          )}

          <PushPermissionCard
            permission={pushPermission}
            onEnable={onEnablePush}
            isBusy={isEnablingPush}
            visible={pushPermission !== 'granted'}
          />

          <SettingsSection title="Activity you receive">
            <View
              style={[
                styles.group,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <SettingsToggle
                label="New matches"
                description="When someone you liked likes you back."
                icon="heart"
                isEnabled={preferences.matchNotificationsEnabled}
                onToggle={(value) => handleToggle('matchNotificationsEnabled', value)}
                isBusy={isBusy('matchNotificationsEnabled')}
                testID="pref-match"
              />
              <SettingsToggle
                label="Messages"
                description="When a match sends you a message."
                icon="message"
                isEnabled={preferences.messageNotificationsEnabled}
                onToggle={(value) => handleToggle('messageNotificationsEnabled', value)}
                isBusy={isBusy('messageNotificationsEnabled')}
                testID="pref-message"
              />
              <SettingsToggle
                label="Likes"
                description="When someone likes your profile."
                icon="sparkles"
                isEnabled={preferences.likeNotificationsEnabled}
                onToggle={(value) => handleToggle('likeNotificationsEnabled', value)}
                isBusy={isBusy('likeNotificationsEnabled')}
                testID="pref-like"
              />
              <SettingsToggle
                label="Safety and account notices"
                description="Important updates about your account and reports."
                icon="shield"
                isEnabled={preferences.safetyNotificationsEnabled}
                onToggle={(value) => handleToggle('safetyNotificationsEnabled', value)}
                isBusy={isBusy('safetyNotificationsEnabled')}
                isLast
                testID="pref-safety"
              />
            </View>
          </SettingsSection>

          <SettingsSection title="Nazar updates">
            <View
              style={[
                styles.group,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <SettingsToggle
                label="Subscription and billing"
                description="Receipts, renewals and payment problems."
                icon="info"
                isEnabled={preferences.systemNotificationsEnabled}
                onToggle={(value) => handleToggle('systemNotificationsEnabled', value)}
                isBusy={isBusy('systemNotificationsEnabled')}
                isLast
                testID="pref-system"
              />
            </View>
          </SettingsSection>

          {preferences.messageNotificationsEnabled && (
            <SettingsSection title="Message privacy">
              <View
                style={[
                  styles.group,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <SettingsToggle
                  label="Show message previews"
                  description="Include the start of a message in the notification. Turn off to show only that you have a new message."
                  icon="eye"
                  isEnabled={preferences.messagePreviewEnabled}
                  onToggle={(value) => handleToggle('messagePreviewEnabled', value)}
                  isBusy={isBusy('messagePreviewEnabled')}
                  isLast
                  testID="pref-preview"
                />
              </View>
              <Text variant="caption" color="tertiary" style={styles.footnote}>
                Previews are decided when a notification is created, so changing this affects future
                messages only.
              </Text>
            </SettingsSection>
          )}

          {failedKey !== null && (
            <Text variant="caption" color="error">
              {failedKey} could not be updated.
            </Text>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  group: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  footnote: {
    marginTop: 8,
  },
});
