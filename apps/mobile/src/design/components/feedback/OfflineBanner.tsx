import React from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';

export type NetworkSyncStatus = 'offline' | 'reconnecting' | 'syncing' | 'synced' | 'failed';

export interface OfflineBannerProps {
  readonly status: NetworkSyncStatus;
  readonly pendingSyncCount?: number;
  readonly onRetrySync?: () => void;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  status,
  pendingSyncCount = 0,
  onRetrySync,
  style,
  testID,
}) => {
  const { radii, spacing } = useTheme();

  // If fully synced with 0 pending operations, keep UI uncluttered
  if (status === 'synced' && pendingSyncCount === 0) {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'offline':
        return {
          bg: '#FEF3C7',
          border: '#F59E0B',
          text: '#92400E',
          iconColor: '#B45309',
          message: pendingSyncCount > 0
            ? `Offline · ${pendingSyncCount} changes queued locally`
            : 'You are offline · Showing cached profiles',
          showSpinner: false,
          showRetry: false,
        };
      case 'reconnecting':
        return {
          bg: '#EFF6FF',
          border: '#3B82F6',
          text: '#1E40AF',
          iconColor: '#2563EB',
          message: 'Reconnecting to Nazar network...',
          showSpinner: true,
          showRetry: false,
        };
      case 'syncing':
        return {
          bg: '#EFF6FF',
          border: '#3B82F6',
          text: '#1E40AF',
          iconColor: '#2563EB',
          message: `Syncing ${pendingSyncCount} pending actions...`,
          showSpinner: true,
          showRetry: false,
        };
      case 'failed':
        return {
          bg: '#FEF2F2',
          border: '#EF4444',
          text: '#991B1B',
          iconColor: '#DC2626',
          message: 'Sync interrupted · Tap to retry pending changes',
          showSpinner: false,
          showRetry: true,
        };
      case 'synced':
      default:
        return {
          bg: '#F0FDF4',
          border: '#22C55E',
          text: '#166534',
          iconColor: '#16A34A',
          message: 'All changes synced',
          showSpinner: false,
          showRetry: false,
        };
    }
  };

  const cfg = getStatusConfig();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: cfg.bg,
          borderColor: cfg.border,
          borderRadius: radii.radiusMD,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={cfg.message}
    >
      <View style={styles.contentRow}>
        {cfg.showSpinner ? (
          <ActivityIndicator size="small" color={cfg.iconColor} style={{ marginRight: 8 }} />
        ) : (
          <Icon
            name={status === 'offline' ? 'warning' : status === 'failed' ? 'warning' : 'check'}
            size="sm"
            color={cfg.iconColor}
            style={{ marginRight: 8 }}
          />
        )}

        <Text variant="caption" weight="medium" style={{ color: cfg.text, flex: 1 }}>
          {cfg.message}
        </Text>

        {cfg.showRetry && onRetrySync && (
          <TouchableOpacity
            onPress={onRetrySync}
            style={[
              styles.retryButton,
              { borderColor: cfg.border, borderRadius: radii.radiusSM },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Retry syncing pending changes"
          >
            <Text variant="caption" weight="bold" style={{ color: cfg.text }}>
              Retry
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    borderWidth: 1,
    marginVertical: 6,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  retryButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    marginLeft: 8,
  },
});
