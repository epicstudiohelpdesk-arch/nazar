import React from 'react';
import { View, Modal, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';
import { Avatar } from '../../primitives/Avatar.js';
import { Button } from '../../components/button/Button.js';

// --- MATCH AVATAR PAIR ---
export interface MatchAvatarPairProps {
  readonly userPhoto?: string | null;
  readonly partnerPhoto?: string | null;
  readonly userName?: string;
  readonly partnerName?: string;
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export const MatchAvatarPair: React.FC<MatchAvatarPairProps> = ({
  userPhoto,
  partnerPhoto,
  userName = 'You',
  partnerName = 'Match',
  size = 76,
  style,
}) => {
  const { colors, radii } = useTheme();

  return (
    <View style={[styles.avatarPairContainer, style]}>
      {/* User Avatar */}
      <View style={{ zIndex: 1 }}>
        <Avatar uri={userPhoto} name={userName} size={size} />
      </View>

      {/* Partner Avatar with overlap */}
      <View style={{ marginLeft: -24, zIndex: 2 }}>
        <Avatar uri={partnerPhoto} name={partnerName} size={size} />
      </View>

      {/* Center Heart Emblem */}
      <View
        style={[
          styles.heartEmblem,
          {
            backgroundColor: colors.accent,
            borderColor: colors.surface,
            borderRadius: radii.radiusFull,
          },
        ]}
      >
        <Icon name="heart" size="tiny" color="#FFFFFF" />
      </View>
    </View>
  );
};

// --- MATCH CELEBRATION MODAL ---
export interface MatchCelebrationProps {
  readonly visible: boolean;
  readonly partnerName: string;
  readonly partnerPhoto?: string | null;
  readonly userPhoto?: string | null;
  readonly onSendMessage: () => void;
  readonly onKeepBrowsing: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const MatchCelebration: React.FC<MatchCelebrationProps> = ({
  visible,
  partnerName,
  partnerPhoto,
  userPhoto,
  onSendMessage,
  onKeepBrowsing,
  style,
}) => {
  const { colors, radii, spacing, shadows } = useTheme();

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.dialogCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.radiusXL,
              padding: spacing.xl,
              ...shadows.shadowLG,
            },
            style,
          ]}
          accessibilityRole="alert"
          accessibilityLabel={`It's a Match! You and ${partnerName} liked each other.`}
        >
          <View
            style={[
              styles.badgePill,
              { backgroundColor: colors.accentSoft, borderRadius: radii.radiusFull },
            ]}
          >
            <Icon
              name="sparkles"
              size="tiny"
              color={colors.accentStrong}
              style={{ marginRight: 4 }}
            />
            <Text variant="caption" weight="bold" style={{ color: colors.accentStrong }}>
              MUTUAL CONNECTION
            </Text>
          </View>

          <Heading level="h1" align="center" style={{ marginTop: spacing.md }}>
            It's a Match!
          </Heading>

          <Text
            variant="body"
            align="center"
            style={{ color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}
          >
            You and {partnerName} appreciate each other. Say something thoughtful to start the
            story.
          </Text>

          <MatchAvatarPair
            userPhoto={userPhoto}
            partnerPhoto={partnerPhoto}
            partnerName={partnerName}
            style={{ marginBottom: spacing.xl }}
          />

          <View style={styles.actionStack}>
            <Button
              label={`Message ${partnerName}`}
              variant="primary"
              size="lg"
              fullWidth
              onPress={onSendMessage}
              style={{ marginBottom: spacing.sm }}
            />
            <Button
              label="Keep Exploring"
              variant="tertiary"
              size="md"
              fullWidth
              onPress={onKeepBrowsing}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- MATCH ACTION BUTTONS ---
export interface MatchActionProps {
  readonly onChat: () => void;
  readonly onDismiss?: () => void;
  readonly chatLabel?: string;
  readonly dismissLabel?: string;
}

export const MatchAction: React.FC<MatchActionProps> = ({
  onChat,
  onDismiss,
  chatLabel = 'Start Chat',
  dismissLabel = 'Later',
}) => {
  const { spacing } = useTheme();

  return (
    <View style={[styles.actionRow, { gap: spacing.sm }]}>
      {onDismiss && (
        <Button
          label={dismissLabel}
          variant="secondary"
          size="md"
          onPress={onDismiss}
          style={{ flex: 1 }}
        />
      )}
      <Button label={chatLabel} variant="primary" size="md" onPress={onChat} style={{ flex: 2 }} />
    </View>
  );
};

export const MatchActionRow = MatchAction;

const styles = StyleSheet.create({
  avatarPairContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heartEmblem: {
    position: 'absolute',
    bottom: -6,
    width: 28,
    height: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  actionStack: {
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
});
