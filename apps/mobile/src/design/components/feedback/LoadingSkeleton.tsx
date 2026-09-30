import React from 'react';
import {
  View,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import type { RadiiTokens } from '../../tokens/index.js';

export interface SkeletonBoxProps {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly radius?: keyof RadiiTokens;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = '100%',
  height = 20,
  radius = 'radiusSM',
  style,
  testID,
}) => {
  const { colors, radii } = useTheme();

  return (
    <View
      style={[
        styles.skeletonBase,
        {
          width: width as ViewStyle['width'],
          height: height as ViewStyle['height'],
          borderRadius: radii[radius],
          backgroundColor: colors.surfaceMuted,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading content"
    />
  );
};

export const Skeleton = SkeletonBox;

export interface SkeletonTextProps {
  readonly lines?: number;
  readonly lastLineWidth?: number | string;
  readonly style?: StyleProp<ViewStyle>;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lastLineWidth = '60%',
  style,
}) => {
  const { spacing } = useTheme();

  return (
    <View style={[{ width: '100%' }, style]}>
      {Array.from({ length: lines }, (_, idx) => {
        const isLast = idx === lines - 1;
        return (
          <SkeletonBox
            key={idx}
            height={14}
            width={isLast ? lastLineWidth : '100%'}
            style={{ marginBottom: isLast ? 0 : spacing.xs }}
          />
        );
      })}
    </View>
  );
};

export const SkeletonCard: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <View
      style={[
        styles.cardSkeleton,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.radiusLG,
          borderColor: colors.border,
          borderWidth: 1,
          padding: spacing.md,
        },
        style,
      ]}
    >
      <SkeletonBox height={180} radius="radiusMD" style={{ marginBottom: spacing.md }} />
      <SkeletonBox width="70%" height={20} radius="radiusSM" style={{ marginBottom: spacing.xs }} />
      <SkeletonBox width="45%" height={14} radius="radiusSM" />
    </View>
  );
};

export const ProfileCardSkeleton: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <View
      style={[
        styles.profileSkeleton,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.radiusXL,
          borderColor: colors.border,
          borderWidth: 1,
          padding: spacing.md,
        },
        style,
      ]}
    >
      <SkeletonBox height={340} radius="radiusLG" style={{ marginBottom: spacing.md }} />
      <SkeletonBox width="60%" height={26} radius="radiusSM" style={{ marginBottom: spacing.xs }} />
      <SkeletonBox width="40%" height={16} radius="radiusSM" style={{ marginBottom: spacing.md }} />
      <SkeletonBox width="90%" height={16} radius="radiusSM" style={{ marginBottom: spacing.xs }} />
      <SkeletonBox width="75%" height={16} radius="radiusSM" />
    </View>
  );
};

export const SkeletonProfile = ProfileCardSkeleton;

export const ConversationListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  const { spacing } = useTheme();

  return (
    <View style={{ width: '100%' }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.convoRow, { marginVertical: spacing.sm }]}>
          <SkeletonBox width={48} height={48} radius="radiusFull" style={{ marginRight: spacing.md }} />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <SkeletonBox width="50%" height={16} radius="radiusSM" style={{ marginBottom: 6 }} />
            <SkeletonBox width="80%" height={14} radius="radiusSM" />
          </View>
        </View>
      ))}
    </View>
  );
};

export interface SpinnerProps {
  readonly size?: 'small' | 'large' | number;
  readonly color?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'small',
  color,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.spinnerWrapper, style]} testID={testID}>
      <ActivityIndicator
        size={typeof size === 'number' ? 'small' : size}
        color={color || colors.accent}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading"
      />
    </View>
  );
};

export interface PullToRefreshProps {
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ refreshing, onRefresh }) => {
  const { colors } = useTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.accent}
      colors={[colors.accent]}
    />
  );
};

const styles = StyleSheet.create({
  skeletonBase: {
    opacity: 0.7,
  },
  cardSkeleton: {
    width: '100%',
    marginBottom: 12,
  },
  profileSkeleton: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginBottom: 16,
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  spinnerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
});
