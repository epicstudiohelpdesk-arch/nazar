import React from 'react';
import { View, Linking, StyleSheet } from 'react-native';
import { useTheme } from '../../design/theme/index.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';
import { Button } from '../../design/components/button/Button.js';
import { SurfaceCard } from '../../design/primitives/SurfaceCard.js';
import {
  describePermissionState,
  type PushPermissionState,
} from '../push-permissions.js';

export interface PushPermissionCardProps {
  readonly permission: PushPermissionState;
  /** True once the app has attempted a native prompt, so denial can be explained. */
  readonly requestedBefore?: boolean;
  readonly onEnable: () => void;
  readonly isBusy?: boolean;
  /** Hides the card entirely, e.g. on the Activity Center once granted. */
  readonly visible?: boolean;
}

/**
 * Contextual push permission prompt.
 *
 * The benefit is stated *before* the native prompt is triggered, and a user who
 * has already refused is routed to system settings instead of being prompted
 * again — on iOS a second `requestPermissionsAsync()` is a silent no-op, so
 * re-offering it would produce a button that appears broken.
 *
 * Nothing here reports "enabled" from local state: the card renders whatever
 * `expo-notifications` reports, and the Activity Center works unchanged when
 * push is unavailable.
 */
export const PushPermissionCard: React.FC<PushPermissionCardProps> = ({
  permission,
  requestedBefore = false,
  onEnable,
  isBusy = false,
  visible = true,
}) => {
  const { colors, spacing } = useTheme();

  if (!visible) return null;

  const presentation = describePermissionState(permission, { requestedBefore });

  // Nothing to say once push is fully granted.
  if (permission === 'granted') return null;

  const tone = permission === 'blocked' || permission === 'denied' ? colors.error : colors.accent;

  return (
    <SurfaceCard
      elevation="sm"
      style={[styles.card, { backgroundColor: colors.surfaceMuted, gap: spacing.sm }]}
      testID="push-permission-card"
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
        <Icon
          name={
            permission === 'blocked' || permission === 'denied' ? 'warning' : 'bell'
          }
          size="sm"
          color={tone}
        />
      </View>

      <View style={styles.copy}>
        <Text variant="title" weight="semibold" color="primary">
          {presentation.headline}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {presentation.detail}
        </Text>
      </View>

      {presentation.canRequest && (
        <Button
          label={presentation.primaryActionLabel ?? 'Enable notifications'}
          variant="primary"
          size="sm"
          fullWidth
          onPress={onEnable}
          isLoading={isBusy}
          accessibilityLabel="Enable push notifications"
          accessibilityHint="Explains what you will be notified about, then asks your device for permission"
        />
      )}

      {!presentation.canRequest && presentation.shouldOfferSystemSettings && (
        <Button
          label={presentation.primaryActionLabel ?? 'Open Settings'}
          variant="secondary"
          size="sm"
          fullWidth
          icon="settings"
          onPress={() => {
            void Linking.openSettings().catch(() => undefined);
          }}
          accessibilityLabel="Open device settings to change notification permission"
        />
      )}
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: 4,
  },
});
