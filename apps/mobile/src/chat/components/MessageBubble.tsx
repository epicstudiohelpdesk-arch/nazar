import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '@platform/ui';
import type { MessageItemDto, DeliveryState } from '@platform/api-contracts';

export interface OptimisticMessageItem extends MessageItemDto {
  readonly isOptimistic?: boolean;
  readonly isFailed?: boolean;
}

interface MessageBubbleProps {
  readonly message: OptimisticMessageItem;
  readonly isCurrentUser: boolean;
  readonly onRetry?: (message: OptimisticMessageItem) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isCurrentUser,
  onRetry,
}) => {
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderDeliveryStatus = (
    state: DeliveryState,
    isOptimistic?: boolean,
    isFailed?: boolean
  ) => {
    if (isFailed) {
      return (
        <TouchableOpacity
          onPress={() => onRetry?.(message)}
          style={styles.retryButton}
          accessibilityLabel="Retry sending message"
        >
          <Text style={styles.statusFailed}>Failed ↺</Text>
        </TouchableOpacity>
      );
    }
    if (isOptimistic) {
      return <Text style={styles.statusPending}>⋯</Text>;
    }
    switch (state) {
      case 'READ':
        return <Text style={styles.statusRead}>✓✓</Text>;
      case 'DELIVERED':
        return <Text style={styles.statusDelivered}>✓✓</Text>;
      case 'SENT':
      default:
        return <Text style={styles.statusSent}>✓</Text>;
    }
  };

  return (
    <View
      style={[
        styles.container,
        isCurrentUser ? styles.containerOutgoing : styles.containerIncoming,
      ]}
    >
      <View style={[styles.bubble, isCurrentUser ? styles.bubbleOutgoing : styles.bubbleIncoming]}>
        <Text style={[styles.bodyText, isCurrentUser ? styles.bodyOutgoing : styles.bodyIncoming]}>
          {message.body}
        </Text>
        <View style={styles.metaRow}>
          <Text
            style={[styles.timeText, isCurrentUser ? styles.timeOutgoing : styles.timeIncoming]}
          >
            {formatTime(message.createdAt)}
          </Text>
          {isCurrentUser && (
            <View style={styles.statusIcon}>
              {renderDeliveryStatus(message.deliveryState, message.isOptimistic, message.isFailed)}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
  },
  containerOutgoing: {
    justifyContent: 'flex-end',
  },
  containerIncoming: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOutgoing: {
    backgroundColor: colors.primary[500],
    borderBottomRightRadius: 4,
  },
  bubbleIncoming: {
    backgroundColor: colors.neutral[100],
    borderBottomLeftRadius: 4,
  },
  bodyText: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  bodyOutgoing: {
    color: '#ffffff',
  },
  bodyIncoming: {
    color: colors.neutral[900],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  timeText: {
    fontSize: typography.fontSize.xs,
  },
  timeOutgoing: {
    color: colors.primary[100],
  },
  timeIncoming: {
    color: colors.neutral[400],
  },
  statusIcon: {
    marginLeft: spacing.xs,
  },
  statusPending: {
    fontSize: 10,
    color: colors.primary[100],
  },
  statusSent: {
    fontSize: 11,
    color: colors.primary[100],
    fontWeight: 'bold',
  },
  statusDelivered: {
    fontSize: 11,
    color: colors.neutral[200],
    fontWeight: 'bold',
  },
  statusRead: {
    fontSize: 11,
    color: colors.status.info,
    fontWeight: 'bold',
  },
  statusFailed: {
    fontSize: 11,
    color: colors.status.error,
    fontWeight: 'bold',
  },
  retryButton: {
    paddingHorizontal: 2,
  },
});
