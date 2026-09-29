import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@platform/ui';
import type { SocketConnectionState } from '../chat-socket.js';

interface ChatHeaderProps {
  readonly displayName: string;
  readonly age?: number;
  readonly avatarUrl?: string | null;
  readonly connectionState: SocketConnectionState;
  readonly onBack: () => void;
  readonly onReport?: () => void;
  readonly onBlock?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  displayName,
  age,
  avatarUrl,
  connectionState,
  onBack,
  onReport,
  onBlock,
}) => {
  const renderStatusIndicator = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, styles.statusOnline]} />
            <Text style={styles.statusText}>Active now</Text>
          </View>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, styles.statusReconnecting]} />
            <Text style={styles.statusText}>Reconnecting...</Text>
          </View>
        );
      case 'disconnected':
      default:
        return (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, styles.statusOffline]} />
            <Text style={styles.statusText}>Offline</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="chat-back-btn"
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <View style={styles.participantInfo}>
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{displayName.substring(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.nameText}>
            {displayName}
            {age ? `, ${age}` : ''}
          </Text>
          {renderStatusIndicator()}
        </View>
      </View>

      <View style={styles.actionContainer}>
        {onReport && (
          <TouchableOpacity
            onPress={onReport}
            style={styles.safetyButton}
            accessibilityRole="button"
            accessibilityLabel="Report user"
            testID="chat-report-btn"
          >
            <Text style={styles.safetyIcon}>🚩</Text>
          </TouchableOpacity>
        )}
        {onBlock && (
          <TouchableOpacity
            onPress={onBlock}
            style={styles.safetyButton}
            accessibilityRole="button"
            accessibilityLabel="Block user"
            testID="chat-block-btn"
          >
            <Text style={styles.safetyIcon}>🚫</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  backButtonText: {
    fontSize: 22,
    color: colors.neutral[900],
    fontWeight: 'bold',
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: spacing.sm,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[200],
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary[700],
  },
  titleContainer: {
    justifyContent: 'center',
  },
  nameText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusOnline: {
    backgroundColor: colors.status.success,
  },
  statusReconnecting: {
    backgroundColor: colors.status.warning,
  },
  statusOffline: {
    backgroundColor: colors.neutral[400],
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
  safetyButton: {
    padding: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
  },
  safetyIcon: {
    fontSize: 16,
  },
});
