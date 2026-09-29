import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Avatar } from '../../primitives/Avatar.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

export interface ConversationCardProps {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl?: string | null;
  readonly isOnline?: boolean;
  readonly isVerified?: boolean;
  readonly lastMessage?: string;
  readonly timestamp?: string;
  readonly unreadCount?: number;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const ConversationCard: React.FC<ConversationCardProps> = ({
  id,
  name,
  avatarUrl,
  isOnline,
  isVerified,
  lastMessage,
  timestamp,
  unreadCount = 0,
  onPress,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  const hasUnread = unreadCount > 0;

  return (
    <SurfaceCard
      p="sm"
      radius="radiusMD"
      elevationLevel="shadowNone"
      border={false}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: hasUnread ? colors.surfaceMuted : 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        style,
      ]}
      testID={testID || `conversation-card-${id}`}
      accessibilityLabel={`Conversation with ${name}${hasUnread ? `, ${unreadCount} unread messages` : ''}`}
    >
      <View style={styles.contentRow}>
        <Avatar
          uri={avatarUrl}
          name={name}
          size="medium"
          isOnline={isOnline}
          isVerified={isVerified}
          style={{ marginRight: spacing.md }}
        />

        <View style={styles.textCol}>
          <View style={styles.topRow}>
            <Text
              variant="body"
              weight={hasUnread ? 'bold' : 'semibold'}
              style={{ color: colors.textPrimary, flex: 1 }}
              numberOfLines={1}
            >
              {name}
            </Text>
            {timestamp && (
              <Text
                variant="caption"
                style={{
                  color: hasUnread ? colors.accent : colors.textTertiary,
                  marginLeft: 8,
                }}
              >
                {timestamp}
              </Text>
            )}
          </View>

          <View style={styles.bottomRow}>
            <Text
              variant="bodySmall"
              weight={hasUnread ? 'medium' : 'normal'}
              style={{
                color: hasUnread ? colors.textPrimary : colors.textSecondary,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {lastMessage || 'Sent a photo'}
            </Text>

            {hasUnread && (
              <View
                style={[
                  styles.unreadBadge,
                  {
                    backgroundColor: colors.accent,
                    borderRadius: radii.radiusFull,
                  },
                ]}
              >
                <Text variant="caption" weight="bold" style={{ color: '#FFFFFF', fontSize: 11 }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
});
