import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Avatar } from '../../primitives/Avatar.js';
import { Icon } from '../../primitives/Icon.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

export interface MatchCardProps {
  readonly id: string;
  readonly name: string;
  readonly age?: number;
  readonly avatarUrl?: string | null;
  readonly matchedAt?: string;
  readonly compatibilityScore?: number; // e.g. 94%
  readonly isNew?: boolean;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  id,
  name,
  age,
  avatarUrl,
  matchedAt,
  compatibilityScore,
  isNew = false,
  onPress,
  style,
  testID,
}) => {
  const { colors, radii } = useTheme();

  return (
    <SurfaceCard
      p="sm"
      radius="radiusLG"
      elevationLevel="shadowSM"
      onPress={onPress}
      style={[styles.card, style]}
      testID={testID || `match-card-${id}`}
      accessibilityLabel={`Match with ${name}`}
    >
      <View style={styles.contentRow}>
        <View style={styles.avatarWrapper}>
          <Avatar uri={avatarUrl} name={name} size="medium" />
          {isNew && (
            <View
              style={[
                styles.newDot,
                { backgroundColor: colors.accent, borderColor: colors.surface },
              ]}
            />
          )}
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text variant="body" weight="semibold" numberOfLines={1}>
              {name}
              {age ? `, ${age}` : ''}
            </Text>
            {compatibilityScore !== undefined && (
              <View
                style={[
                  styles.sparkBadge,
                  {
                    backgroundColor: colors.accentSoft,
                    borderRadius: radii.radiusFull,
                  },
                ]}
              >
                <Icon
                  name="sparkles"
                  size="tiny"
                  color={colors.accent}
                  style={{ marginRight: 3 }}
                />
                <Text variant="caption" weight="bold" style={{ color: colors.accentStrong }}>
                  {compatibilityScore}%
                </Text>
              </View>
            )}
          </View>

          {matchedAt && (
            <Text variant="caption" style={{ color: colors.textTertiary, marginTop: 2 }}>
              Matched {matchedAt}
            </Text>
          )}
        </View>

        <Icon name="chevron" direction="right" size="tiny" color={colors.textTertiary} />
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  newDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  sparkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
