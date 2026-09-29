import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import type { RadiiTokens } from '../../tokens/index.js';

export interface SkeletonBoxProps {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly radius?: keyof RadiiTokens;
  readonly style?: ViewStyle;
}

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = '100%',
  height = 20,
  radius = 'radiusSM',
  style,
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
      accessibilityRole="progressbar"
      accessibilityLabel="Loading content"
    />
  );
};

export const ProfileCardSkeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => {
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

const styles = StyleSheet.create({
  skeletonBase: {
    opacity: 0.7,
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
});
