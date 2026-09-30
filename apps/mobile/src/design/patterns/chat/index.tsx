import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';
import { Avatar } from '../../primitives/Avatar.js';
import { Badge } from '../../primitives/Badge.js';

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

// --- MESSAGE STATUS INDICATOR ---
export interface MessageStatusProps {
  readonly status: MessageDeliveryStatus;
  readonly color?: string;
}

export const MessageStatus: React.FC<MessageStatusProps> = ({ status, color }) => {
  const { colors } = useTheme();
  const iconColor = color || (status === 'read' ? colors.info : colors.textTertiary);

  switch (status) {
    case 'sending':
      return <Icon name="refresh" size="tiny" color={colors.textTertiary} />;
    case 'sent':
      return <Icon name="check" size="tiny" color={colors.textTertiary} />;
    case 'delivered':
    case 'read':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="check" size="tiny" color={iconColor} />
          <Icon name="check" size="tiny" color={iconColor} style={{ marginLeft: -6 }} />
        </View>
      );
    case 'failed':
      return <Icon name="warning" size="tiny" color={colors.error} />;
    default:
      return null;
  }
};

// --- MESSAGE TIMESTAMP ---
export const MessageTimestamp: React.FC<{ time: string; color?: string }> = ({ time, color }) => {
  const { colors } = useTheme();
  return (
    <Text variant="caption" style={{ color: color || colors.textTertiary, fontSize: 11 }}>
      {time}
    </Text>
  );
};

// --- MESSAGE BUBBLE ---
export interface ChatMessageBubbleProps {
  readonly id: string;
  readonly text: string;
  readonly timestamp: string;
  readonly isOutgoing: boolean;
  readonly status?: MessageDeliveryStatus;
  readonly style?: StyleProp<ViewStyle>;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  text,
  timestamp,
  isOutgoing,
  status = 'sent',
  style,
}) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <View
      style={[
        styles.bubbleRow,
        { justifyContent: isOutgoing ? 'flex-end' : 'flex-start' },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${isOutgoing ? 'You' : 'Partner'}: ${text}, ${timestamp}`}
    >
      <View
        style={[
          styles.bubbleContainer,
          {
            backgroundColor: isOutgoing ? colors.accent : colors.surfaceMuted,
            borderColor: isOutgoing ? colors.accent : colors.border,
            borderBottomRightRadius: isOutgoing ? 4 : radii.radiusLG,
            borderBottomLeftRadius: !isOutgoing ? 4 : radii.radiusLG,
            borderRadius: radii.radiusLG,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            maxWidth: '78%',
          },
        ]}
      >
        <Text
          variant="body"
          style={{ color: isOutgoing ? colors.textInverse : colors.textPrimary }}
        >
          {text}
        </Text>

        <View style={styles.bubbleFooter}>
          <MessageTimestamp
            time={timestamp}
            color={isOutgoing ? 'rgba(255,255,255,0.7)' : undefined}
          />
          {isOutgoing && (
            <View style={{ marginLeft: 4 }}>
              <MessageStatus status={status} color="rgba(255,255,255,0.9)" />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export const ChatBubble = ChatMessageBubble;

// --- TYPING INDICATOR ---
export const ChatTypingIndicator: React.FC<{ partnerName?: string }> = ({ partnerName }) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <View
      style={[
        styles.typingPill,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          borderRadius: radii.radiusFull,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={partnerName ? `${partnerName} is typing...` : 'Typing...'}
    >
      <Text variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
        {partnerName ? `${partnerName} is typing...` : 'Typing...'}
      </Text>
    </View>
  );
};

export const ChatIndicator = ChatTypingIndicator;

// --- UNREAD DIVIDER ---
export const UnreadDivider: React.FC<{ label?: string }> = ({ label = 'New Messages' }) => {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.dividerRow, { marginVertical: spacing.md }]}>
      <View style={[styles.dividerLine, { backgroundColor: colors.accentSoft }]} />
      <Text
        variant="caption"
        weight="bold"
        style={{ color: colors.accent, marginHorizontal: spacing.sm }}
      >
        {label}
      </Text>
      <View style={[styles.dividerLine, { backgroundColor: colors.accentSoft }]} />
    </View>
  );
};

// --- CONVERSATION ROW ---
export interface ConversationRowProps {
  readonly id: string;
  readonly partnerName: string;
  readonly partnerPhoto?: string | null;
  readonly lastMessage?: string;
  readonly lastMessageTime?: string;
  readonly unreadCount?: number;
  readonly isOnline?: boolean;
  readonly isVerified?: boolean;
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const ConversationRow: React.FC<ConversationRowProps> = ({
  partnerName,
  partnerPhoto,
  lastMessage = '',
  lastMessageTime = '',
  unreadCount = 0,
  isOnline,
  isVerified,
  onPress,
  style,
}) => {
  const { colors, spacing } = useTheme();
  const hasUnread = unreadCount > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.convoRow,
        {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          backgroundColor: hasUnread ? colors.surfaceElevated : colors.surface,
        },
        style,
      ]}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${partnerName}. ${hasUnread ? `${unreadCount} new messages.` : ''}`}
    >
      <Avatar
        uri={partnerPhoto}
        name={partnerName}
        size="md"
        isOnline={isOnline}
        isVerified={isVerified}
      />

      <View style={[styles.convoBody, { marginLeft: spacing.md }]}>
        <View style={styles.convoHeader}>
          <Text
            variant="title"
            weight={hasUnread ? 'bold' : 'semibold'}
            style={{ color: colors.textPrimary, flex: 1 }}
            numberOfLines={1}
          >
            {partnerName}
          </Text>
          <Text variant="caption" style={{ color: colors.textTertiary }}>
            {lastMessageTime}
          </Text>
        </View>

        <View style={styles.convoSnippetRow}>
          <Text
            variant="bodySmall"
            weight={hasUnread ? 'semibold' : 'normal'}
            style={{
              color: hasUnread ? colors.textPrimary : colors.textSecondary,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>

          {hasUnread && (
            <Badge label={String(unreadCount)} variant="accent" size="sm" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// --- CHAT ATTACHMENT BUTTON ---
export interface ChatAttachmentButtonProps {
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

export const ChatAttachmentButton: React.FC<ChatAttachmentButtonProps> = ({
  onPress,
  disabled = false,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={styles.attachmentBtn}
      accessibilityRole="button"
      accessibilityLabel="Attach media or photo"
    >
      <Icon name="camera" size="md" color={colors.textTertiary} />
    </TouchableOpacity>
  );
};

// --- MESSAGE COMPOSER ---
export interface ChatMessageComposerProps {
  readonly onSend: (text: string) => void;
  readonly onAttach?: () => void;
  readonly placeholder?: string;
  readonly isSending?: boolean;
  readonly disabled?: boolean;
}

export const ChatMessageComposer: React.FC<ChatMessageComposerProps> = ({
  onSend,
  onAttach,
  placeholder = 'Type a message...',
  isSending = false,
  disabled = false,
}) => {
  const { colors, radii, spacing } = useTheme();
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim() || isSending || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const canSend = text.trim().length > 0 && !isSending && !disabled;

  return (
    <View
      style={[
        styles.composerBar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
      ]}
    >
      {onAttach && <ChatAttachmentButton onPress={onAttach} disabled={disabled} />}

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        multiline
        editable={!disabled}
        style={[
          styles.composerInput,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            borderRadius: radii.radiusLG,
            color: colors.textPrimary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          },
        ]}
      />

      <TouchableOpacity
        onPress={handleSend}
        disabled={!canSend}
        style={[
          styles.sendBtn,
          {
            backgroundColor: canSend ? colors.accent : colors.surfaceMuted,
            borderRadius: radii.radiusFull,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Send message"
      >
        <Icon
          name="send"
          size="sm"
          color={canSend ? colors.textInverse : colors.textTertiary}
        />
      </TouchableOpacity>
    </View>
  );
};

export const ChatComposer = ChatMessageComposer;

const styles = StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: 4,
    width: '100%',
  },
  bubbleContainer: {
    borderWidth: 1,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  typingPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    marginVertical: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  convoBody: {
    flex: 1,
    justifyContent: 'center',
  },
  convoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convoSnippetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  attachmentBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    width: '100%',
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
    borderWidth: 1,
  },
  sendBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
