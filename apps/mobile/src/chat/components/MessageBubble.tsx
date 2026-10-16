import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import type { MessageItemDto, DeliveryState } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/index.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';

export interface OptimisticMessageItem extends MessageItemDto {
  readonly isOptimistic?: boolean;
  readonly isFailed?: boolean;
}

export interface MessageBubbleProps {
  readonly message: OptimisticMessageItem;
  readonly isCurrentUser: boolean;
  readonly onRetry?: (message: OptimisticMessageItem) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isCurrentUser,
  onRetry,
}) => {
  const { colors, radii, spacing } = useTheme();

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
          accessibilityRole="button"
          accessibilityLabel="Retry sending message"
          testID={`retry-msg-${message.clientMessageId || message.id}`}
        >
          <View style={styles.retryRow}>
            <Icon name="warning" size="tiny" color={colors.error} />
            <Text
              variant="caption"
              weight="bold"
              style={{ color: colors.error, marginLeft: 2, fontSize: 11 }}
            >
              Retry
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (isOptimistic) {
      return (
        <Text
          variant="caption"
          style={{
            color: isCurrentUser ? 'rgba(255,255,255,0.7)' : colors.textTertiary,
            fontSize: 11,
          }}
        >
          ⋯
        </Text>
      );
    }

    switch (state) {
      case 'READ':
        return (
          <View style={styles.checksRow}>
            <Icon name="check" size="tiny" color={isCurrentUser ? '#93C5FD' : colors.info} />
            <Icon
              name="check"
              size="tiny"
              color={isCurrentUser ? '#93C5FD' : colors.info}
              style={{ marginLeft: -6 }}
            />
          </View>
        );
      case 'DELIVERED':
        return (
          <View style={styles.checksRow}>
            <Icon
              name="check"
              size="tiny"
              color={isCurrentUser ? 'rgba(255,255,255,0.75)' : colors.textTertiary}
            />
            <Icon
              name="check"
              size="tiny"
              color={isCurrentUser ? 'rgba(255,255,255,0.75)' : colors.textTertiary}
              style={{ marginLeft: -6 }}
            />
          </View>
        );
      case 'SENT':
      default:
        return (
          <Icon
            name="check"
            size="tiny"
            color={isCurrentUser ? 'rgba(255,255,255,0.75)' : colors.textTertiary}
          />
        );
    }
  };

  const bubbleBg = isCurrentUser ? colors.accent : colors.surfaceMuted;
  const bubbleBorder = isCurrentUser ? colors.accent : colors.border;
  const textColor = isCurrentUser ? colors.textInverse : colors.textPrimary;
  const timeColor = isCurrentUser ? 'rgba(255,255,255,0.8)' : colors.textTertiary;

  return (
    <View
      style={[
        styles.container,
        isCurrentUser ? styles.containerOutgoing : styles.containerIncoming,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${isCurrentUser ? 'You' : 'Partner'}: ${message.body}, ${formatTime(message.createdAt)}`}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleBg,
            borderColor: bubbleBorder,
            borderRadius: radii.radiusLG,
            borderBottomRightRadius: isCurrentUser ? 4 : radii.radiusLG,
            borderBottomLeftRadius: !isCurrentUser ? 4 : radii.radiusLG,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        {message.messageType === 'AUDIO' ? (
          <View style={styles.audioRow}>
            <View
              style={[
                styles.audioPlayBtn,
                { backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.25)' : colors.accentSoft },
              ]}
            >
              <Icon
                name="mic"
                size="sm"
                color={isCurrentUser ? '#FFFFFF' : colors.accent}
              />
            </View>
            <View style={styles.audioWaveform}>
              <View style={styles.waveformBars}>
                {((message.waveformPeaks && message.waveformPeaks.length > 0)
                  ? message.waveformPeaks.slice(0, 20)
                  : [0.3, 0.6, 0.9, 0.4, 0.7, 0.5, 0.8, 1.0, 0.6, 0.3, 0.5, 0.7, 0.4, 0.6, 0.8]
                ).map((peak, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.waveformBar,
                      {
                        height: Math.max(4, Math.round(peak * 24)),
                        backgroundColor: isCurrentUser
                          ? 'rgba(255,255,255,0.85)'
                          : colors.accent,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text
                variant="caption"
                style={{
                  color: isCurrentUser ? 'rgba(255,255,255,0.8)' : colors.textSecondary,
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {message.durationSeconds
                  ? `${Math.floor(message.durationSeconds / 60)}:${(message.durationSeconds % 60).toString().padStart(2, '0')}`
                  : '0:15'}
              </Text>
            </View>
          </View>
        ) : (
          <Text variant="body" style={{ color: textColor, lineHeight: 20 }}>
            {message.body}
          </Text>
        )}

        <View style={styles.metaRow}>
          <Text variant="caption" style={{ color: timeColor, fontSize: 11 }}>
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
    marginVertical: 3,
    paddingHorizontal: 12,
    flexDirection: 'row',
    width: '100%',
  },
  containerOutgoing: {
    justifyContent: 'flex-end',
  },
  containerIncoming: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1.5,
    elevation: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  statusIcon: {
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checksRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryButton: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    minWidth: 160,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  audioWaveform: {
    flex: 1,
    justifyContent: 'center',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 3,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
});
