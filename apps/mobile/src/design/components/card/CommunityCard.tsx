import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Badge } from '../../primitives/Badge.js';
import { Button } from '../button/Button.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

export interface CommunityCardProps {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly memberCount: number;
  readonly category?: string;
  readonly isJoined?: boolean;
  readonly onJoinPress?: () => void;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const CommunityCard: React.FC<CommunityCardProps> = ({
  id,
  name,
  description,
  memberCount,
  category,
  isJoined = false,
  onJoinPress,
  onPress,
  style,
  testID,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <SurfaceCard
      p="md"
      radius="radiusLG"
      elevationLevel="shadowSM"
      onPress={onPress}
      style={[styles.card, style]}
      testID={testID || `community-card-${id}`}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Heading level="title" numberOfLines={1}>
            {name}
          </Heading>
          {category && (
            <Badge
              label={category}
              variant="neutral"
              size="sm"
              style={{ marginTop: 4 }}
            />
          )}
        </View>

        {onJoinPress && (
          <Button
            label={isJoined ? 'Joined' : 'Join'}
            variant={isJoined ? 'secondary' : 'primary'}
            size="sm"
            onPress={onJoinPress}
          />
        )}
      </View>

      {description && (
        <Text
          variant="bodySmall"
          style={{ color: colors.textSecondary, marginVertical: spacing.xs }}
          numberOfLines={2}
        >
          {description}
        </Text>
      )}

      <Text variant="caption" style={{ color: colors.textTertiary, marginTop: 4 }}>
        👥 {memberCount.toLocaleString()} members
      </Text>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
});
