import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Avatar } from '../../primitives/Avatar.js';
import { Button } from '../../components/button/Button.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

// --- MEMBER AVATAR STACK ---
export interface MemberAvatarStackProps {
  readonly avatars: readonly { uri?: string | null; name: string }[];
  readonly totalCount?: number;
  readonly maxDisplay?: number;
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export const MemberAvatarStack: React.FC<MemberAvatarStackProps> = ({
  avatars,
  totalCount,
  maxDisplay = 3,
  size = 28,
  style,
}) => {
  const { colors, radii } = useTheme();
  const displayAvatars = avatars.slice(0, maxDisplay);
  const remaining = (totalCount || avatars.length) - maxDisplay;

  return (
    <View style={[styles.avatarStack, style]}>
      {displayAvatars.map((member, index) => (
        <View
          key={index}
          style={[
            styles.stackedAvatar,
            {
              marginLeft: index === 0 ? 0 : -8,
              zIndex: maxDisplay - index,
              borderColor: colors.surface,
            },
          ]}
        >
          <Avatar uri={member.uri} name={member.name} size={size} />
        </View>
      ))}

      {remaining > 0 && (
        <View
          style={[
            styles.stackedBadge,
            {
              width: size,
              height: size,
              borderRadius: radii.radiusFull,
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.surface,
              marginLeft: -8,
              zIndex: 0,
            },
          ]}
        >
          <Text
            variant="caption"
            weight="bold"
            style={{ color: colors.textSecondary, fontSize: 10 }}
          >
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
};

// --- MEMBERSHIP BUTTON ---
export interface MembershipButtonProps {
  readonly isMember: boolean;
  readonly onToggleMembership: () => void;
  readonly isLoading?: boolean;
}

export const MembershipButton: React.FC<MembershipButtonProps> = ({
  isMember,
  onToggleMembership,
  isLoading = false,
}) => {
  return (
    <Button
      label={isMember ? 'Joined' : 'Join Circle'}
      variant={isMember ? 'secondary' : 'primary'}
      size="sm"
      onPress={onToggleMembership}
      isLoading={isLoading}
      icon={isMember ? 'check' : 'plus'}
    />
  );
};

// --- COMMUNITY HEADER ---
export interface CommunityHeaderProps {
  readonly name: string;
  readonly description?: string;
  readonly memberCount: number;
  readonly isMember: boolean;
  readonly onToggleMembership: () => void;
  readonly coverPhoto?: string | null;
  readonly members?: readonly { uri?: string | null; name: string }[];
  readonly style?: StyleProp<ViewStyle>;
}

export const CommunityHeader: React.FC<CommunityHeaderProps> = ({
  name,
  description,
  memberCount,
  isMember,
  onToggleMembership,
  members = [],
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.communityHeader,
        { backgroundColor: colors.surface, padding: spacing.md },
        style,
      ]}
    >
      <View style={styles.headerTop}>
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Heading level="h2">{name}</Heading>
          <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
            {memberCount.toLocaleString()} members
          </Text>
        </View>

        <MembershipButton isMember={isMember} onToggleMembership={onToggleMembership} />
      </View>

      {description && (
        <Text
          variant="body"
          style={{ color: colors.textPrimary, marginTop: spacing.sm, lineHeight: 22 }}
        >
          {description}
        </Text>
      )}

      {members.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <MemberAvatarStack avatars={members} totalCount={memberCount} />
        </View>
      )}
    </View>
  );
};

// --- COMMUNITY FEED CARD ---
export interface CommunityFeedCardProps {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly memberCount: number;
  readonly isMember?: boolean;
  readonly onToggleMembership?: () => void;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const CommunityFeedCard: React.FC<CommunityFeedCardProps> = ({
  name,
  description,
  memberCount,
  isMember = false,
  onToggleMembership,
  onPress,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <SurfaceCard
      p="md"
      radius="radiusLG"
      elevationLevel="shadowSM"
      onPress={onPress}
      style={[styles.card, style]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text variant="title" weight="bold" style={{ color: colors.textPrimary }}>
            {name}
          </Text>
          <Text variant="caption" style={{ color: colors.textTertiary, marginTop: 2 }}>
            {memberCount.toLocaleString()} members
          </Text>
        </View>

        {onToggleMembership && (
          <MembershipButton isMember={isMember} onToggleMembership={onToggleMembership} />
        )}
      </View>

      <Text
        variant="bodySmall"
        style={{ color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }}
        numberOfLines={2}
      >
        {description}
      </Text>
    </SurfaceCard>
  );
};

// --- COMMUNITY POST PREVIEW ---
export interface CommunityPostPreviewProps {
  readonly authorName: string;
  readonly snippet: string;
  readonly timestamp: string;
  readonly onPress?: () => void;
}

export const CommunityPostPreview: React.FC<CommunityPostPreviewProps> = ({
  authorName,
  snippet,
  timestamp,
  onPress,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.postPreview, { paddingVertical: spacing.xs }]}
      activeOpacity={0.7}
    >
      <Text variant="caption" weight="bold" style={{ color: colors.accent }}>
        {authorName}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: colors.textPrimary, marginVertical: 2 }}
        numberOfLines={1}
      >
        {snippet}
      </Text>
      <Text variant="caption" style={{ color: colors.textTertiary }}>
        {timestamp}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatar: {
    borderWidth: 2,
    borderRadius: 999,
  },
  stackedBadge: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityHeader: {
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    width: '100%',
    marginVertical: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postPreview: {
    width: '100%',
  },
});
