import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SocketConnectionState } from '../chat-socket.js';
import { useTheme } from '../../design/theme/index.js';
import { Text } from '../../design/primitives/Text.js';
import { Avatar } from '../../design/primitives/Avatar.js';
import { Icon } from '../../design/primitives/Icon.js';

export interface ChatHeaderProps {
  readonly displayName: string;
  readonly age?: number;
  readonly avatarUrl?: string | null;
  readonly isVerified?: boolean;
  readonly connectionState: SocketConnectionState;
  readonly onBack: () => void;
  readonly onAudioCall?: () => void;
  readonly onVideoCall?: () => void;
  readonly onReport?: () => void;
  readonly onBlock?: () => void;
  readonly onUnmatch?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  displayName,
  age,
  avatarUrl,
  isVerified,
  connectionState,
  onBack,
  onAudioCall,
  onVideoCall,
  onReport,
  onBlock,
  onUnmatch,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();

  const renderStatusIndicator = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text variant="caption" style={{ color: colors.textSecondary, fontSize: 11 }}>
              Active now
            </Text>
          </View>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
            <Text variant="caption" style={{ color: colors.warning, fontSize: 11 }}>
              Reconnecting...
            </Text>
          </View>
        );
      case 'disconnected':
      default:
        return (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.textTertiary }]} />
            <Text variant="caption" style={{ color: colors.textTertiary, fontSize: 11 }}>
              Offline
            </Text>
          </View>
        );
    }
  };

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: Math.max(insets.top, 10),
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.sm,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="chat-back-btn"
      >
        <Icon name="back" size="md" color={colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.participantInfo}>
        <Avatar
          uri={avatarUrl}
          name={displayName}
          size="sm"
          isVerified={isVerified}
          isOnline={connectionState === 'connected'}
          style={{ marginRight: spacing.sm }}
        />
        <View style={styles.titleContainer}>
          <View style={styles.nameRow}>
            <Text
              variant="body"
              weight="bold"
              style={{ color: colors.textPrimary }}
              numberOfLines={1}
            >
              {displayName}
              {age ? `, ${age}` : ''}
            </Text>
          </View>
          {renderStatusIndicator()}
        </View>
      </View>

      <View style={styles.actionContainer}>
        {onAudioCall && (
          <TouchableOpacity
            onPress={onAudioCall}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Audio Call"
            testID="chat-audio-call-btn"
          >
            <Icon name="phone" size="sm" color={colors.accent} />
          </TouchableOpacity>
        )}
        {onVideoCall && (
          <TouchableOpacity
            onPress={onVideoCall}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Video Call"
            testID="chat-video-call-btn"
          >
            <Icon name="video" size="sm" color={colors.accent} />
          </TouchableOpacity>
        )}
        {onUnmatch && (
          <TouchableOpacity
            onPress={onUnmatch}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Unmatch"
            testID="chat-unmatch-btn"
          >
            <Icon name="trash" size="sm" color={colors.textTertiary} />
          </TouchableOpacity>
        )}
        {onReport && (
          <TouchableOpacity
            onPress={onReport}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Report user"
            testID="chat-report-btn"
          >
            <Icon name="flag" size="sm" color={colors.textTertiary} />
          </TouchableOpacity>
        )}
        {onBlock && (
          <TouchableOpacity
            onPress={onBlock}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Block user"
            testID="chat-block-btn"
          >
            <Icon name="shield" size="sm" color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 6,
    marginLeft: 2,
  },
});
