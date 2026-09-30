import React from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon, type IconName } from '../../primitives/Icon.js';

export type BannerVariant =
  | 'offline'
  | 'reconnecting'
  | 'account_warning'
  | 'moderation_state'
  | 'payment_issue'
  | 'system_announcement'
  | 'info';

export interface BannerProps {
  readonly variant?: BannerVariant;
  readonly message: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly onDismiss?: () => void;
  readonly isDismissible?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const Banner: React.FC<BannerProps> = ({
  variant = 'info',
  message,
  description,
  actionLabel,
  onAction,
  onDismiss,
  isDismissible = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();

  const getVariantStyles = (): { icon: IconName; bg: string; border: string; text: string } => {
    switch (variant) {
      case 'offline':
      case 'payment_issue':
        return {
          icon: 'warning',
          bg: colors.errorSoft,
          border: colors.error,
          text: colors.error,
        };
      case 'account_warning':
      case 'moderation_state':
        return {
          icon: 'warning',
          bg: colors.warningSoft,
          border: colors.warning,
          text: colors.warning,
        };
      case 'reconnecting':
        return {
          icon: 'refresh',
          bg: colors.surfaceMuted,
          border: colors.borderStrong,
          text: colors.textPrimary,
        };
      case 'system_announcement':
      case 'info':
      default:
        return {
          icon: 'info',
          bg: colors.infoSoft,
          border: colors.info,
          text: colors.info,
        };
    }
  };

  const vs = getVariantStyles();

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: vs.bg,
          borderColor: vs.border,
          borderRadius: radii.radiusMD,
          padding: spacing.sm,
        },
        style,
      ]}
      testID={testID || `banner-${variant}`}
      accessibilityRole="alert"
      accessibilityLabel={`${variant}: ${message}`}
    >
      <View style={styles.topRow}>
        <Icon name={vs.icon} size="sm" color={vs.text} style={{ marginRight: spacing.xs }} />

        <View style={{ flex: 1 }}>
          <Text variant="bodySmall" weight="semibold" style={{ color: colors.textPrimary }}>
            {message}
          </Text>
          {description && (
            <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
              {description}
            </Text>
          )}
        </View>

        {isDismissible && onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissBtn}
            accessibilityRole="button"
            accessibilityLabel="Dismiss banner"
          >
            <Icon name="close" size="tiny" color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={[styles.actionRow, { borderTopColor: vs.border }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text variant="caption" weight="bold" style={{ color: vs.text }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// --- SPECIALIZED OFFLINE & CONNECTION HELPERS ---
export interface ConnectionIndicatorProps {
  readonly isConnected: boolean;
  readonly isReconnecting?: boolean;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  isConnected,
  isReconnecting = false,
}) => {
  const { colors, radii, spacing } = useTheme();

  if (isConnected && !isReconnecting) return null;

  return (
    <View
      style={[
        styles.indicatorPill,
        {
          backgroundColor: isReconnecting ? colors.warningSoft : colors.errorSoft,
          borderColor: isReconnecting ? colors.warning : colors.error,
          borderRadius: radii.radiusFull,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={isReconnecting ? 'Reconnecting...' : 'Offline'}
    >
      {isReconnecting ? (
        <ActivityIndicator size="small" color={colors.warning} style={{ marginRight: 4 }} />
      ) : (
        <Icon name="warning" size="tiny" color={colors.error} style={{ marginRight: 4 }} />
      )}
      <Text
        variant="caption"
        weight="semibold"
        style={{ color: isReconnecting ? colors.warning : colors.error }}
      >
        {isReconnecting ? 'Reconnecting...' : 'Offline'}
      </Text>
    </View>
  );
};

export interface SyncIndicatorProps {
  readonly isSyncing: boolean;
  readonly label?: string;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  isSyncing,
  label = 'Syncing...',
}) => {
  const { colors, spacing } = useTheme();
  if (!isSyncing) return null;

  return (
    <View style={styles.syncRow}>
      <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: spacing.xs }} />
      <Text variant="caption" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
    </View>
  );
};

export interface RetryActionProps {
  readonly onRetry: () => void;
  readonly label?: string;
  readonly isRetrying?: boolean;
}

export const RetryAction: React.FC<RetryActionProps> = ({
  onRetry,
  label = 'Try Again',
  isRetrying = false,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <TouchableOpacity
      onPress={onRetry}
      disabled={isRetrying}
      style={[styles.retryBtn, { padding: spacing.xs }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {isRetrying ? (
        <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 4 }} />
      ) : (
        <Icon name="refresh" size="tiny" color={colors.accent} style={{ marginRight: 4 }} />
      )}
      <Text variant="caption" weight="bold" style={{ color: colors.accent }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    width: '100%',
    borderWidth: 1,
    marginVertical: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dismissBtn: {
    padding: 4,
    marginLeft: 8,
  },
  actionRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    alignSelf: 'flex-start',
  },
  indicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'center',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
