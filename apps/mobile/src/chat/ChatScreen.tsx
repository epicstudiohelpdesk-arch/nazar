import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReportReasonCode, ReportTargetType, MessageItemDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { ErrorState } from '../design/components/feedback/ErrorState.js';
import { OfflineBanner } from '../design/components/feedback/OfflineBanner.js';
import { getDefaultAuthClient } from '../auth/default-client.js';
import { createChatApi, CHAT_QUERY_KEYS } from './chat-api.js';
import { chatSocket, type SocketConnectionState } from './chat-socket.js';
import { createSafetyApi } from '../safety/safety-api.js';
import { getDefaultMatchesApi } from '../matches/matches-api.js';
import { ReportModal } from '../safety/components/ReportModal.js';
import { BlockModal } from '../safety/components/BlockModal.js';
import { ChatHeader } from './components/ChatHeader.js';
import { MessageBubble, type OptimisticMessageItem } from './components/MessageBubble.js';
import { MessageComposer } from './components/MessageComposer.js';
import { TypingIndicator } from './components/TypingIndicator.js';
import { AreYouSureModal } from './components/AreYouSureModal.js';
import { CallModal } from './components/CallModal.js';
import { getDefaultCallingApi } from './calling-api.js';
import { detectToxicity } from './moderation/toxicity-detector.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import type { AuthClient } from '../auth/auth-client.js';

export interface ChatScreenProps {
  readonly conversationId: string;
  readonly authClient?: AuthClient;
  readonly onBack?: () => void;
}

type ChatListItem =
  | { type: 'message'; message: OptimisticMessageItem }
  | { type: 'date_separator'; id: string; label: string };

function formatDateLabel(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'long' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ conversationId, authClient, onBack }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, radii } = useTheme();

  const effectiveClient = useMemo(() => authClient || getDefaultAuthClient(), [authClient]);
  const chatApi = useMemo(() => createChatApi(effectiveClient), [effectiveClient]);
  const safetyApi = useMemo(() => createSafetyApi(effectiveClient), [effectiveClient]);
  const matchesApi = useMemo(() => getDefaultMatchesApi(), []);
  const callingApi = useMemo(() => getDefaultCallingApi(), []);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>(
    chatSocket.getConnectionState()
  );
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessageItem[]>([]);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isBlockModalVisible, setIsBlockModalVisible] = useState(false);
  const [isAysModalVisible, setIsAysModalVisible] = useState(false);
  const [pendingToxicText, setPendingToxicText] = useState('');
  const [aysReason, setAysReason] = useState<string | undefined>();
  const [activeCallSessionId, setActiveCallSessionId] = useState<string | null>(null);
  const [activeCallType, setActiveCallType] = useState<'AUDIO' | 'VIDEO'>('AUDIO');
  const [isCallModalVisible, setIsCallModalVisible] = useState(false);

  const lastTypingEmittedRef = useRef<number>(0);
  const lastMarkedReadMessageIdRef = useRef<string | null>(null);
  const CLIENT_MESSAGE_ID_PREFIX = 'cmsg_';

  // 1. Load conversation detail
  const {
    data: conversation,
    isLoading: isLoadingConversation,
    error: conversationError,
  } = useQuery({
    queryKey: CHAT_QUERY_KEYS.conversation(conversationId),
    queryFn: () => chatApi.getConversationDetail(conversationId),
    enabled: Boolean(conversationId),
  });

  // 2. Load message history using useInfiniteQuery (cursor pagination)
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error: messagesError,
  } = useInfiniteQuery({
    queryKey: CHAT_QUERY_KEYS.messages(conversationId),
    queryFn: ({ pageParam }) =>
      chatApi.getMessages(conversationId, { limit: 30, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
  });

  // Analytics on mount & unmount
  useEffect(() => {
    trackOnboardingEvent('conversation_opened', { conversationId });
    return () => {
      trackOnboardingEvent('conversation_closed', { conversationId });
    };
  }, [conversationId]);

  // Combine & deduplicate server messages in descending order (newest first)
  const serverMessages = useMemo(() => {
    if (!messagesData?.pages) return [];
    const seen = new Set<string>();
    const list: MessageItemDto[] = [];
    for (const page of messagesData.pages) {
      for (const item of page.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
        }
      }
    }
    return list;
  }, [messagesData]);

  // Combined messages for inverted display (optimistic at top/index 0 + server messages)
  const allMessages: OptimisticMessageItem[] = useMemo(() => {
    const serverClientIds = new Set(serverMessages.map((m) => m.clientMessageId).filter(Boolean));
    const activeOptimistic = optimisticMessages.filter(
      (m) => !serverClientIds.has(m.clientMessageId)
    );
    return [...activeOptimistic, ...serverMessages];
  }, [optimisticMessages, serverMessages]);

  // 3. Mark last message as read upon opening or receiving new message
  useEffect(() => {
    if (serverMessages.length > 0 && conversation?.otherUser.userId) {
      const newestIncoming = serverMessages.find(
        (m) => m.senderUserId === conversation.otherUser.userId
      );
      if (newestIncoming && lastMarkedReadMessageIdRef.current !== newestIncoming.id) {
        lastMarkedReadMessageIdRef.current = newestIncoming.id;
        chatApi.markRead(conversationId, newestIncoming.id).catch(() => {});
        trackOnboardingEvent('conversation_marked_read', {
          conversationId,
          messageId: newestIncoming.id,
        });
      }
    }
  }, [conversationId, serverMessages, conversation?.otherUser.userId, chatApi]);

  // 4. WebSocket setup & listeners
  useEffect(() => {
    chatSocket.joinConversation(conversationId);

    const unsubConnection = chatSocket.onConnectionStateChange((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) });
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
      }
    });

    const unsubMessage = chatSocket.onMessageCreated((event) => {
      if (event.conversationId === conversationId) {
        // Remove matching optimistic message
        setOptimisticMessages((prev) =>
          prev.filter((m) => m.clientMessageId !== event.payload.clientMessageId)
        );

        // Update message cache
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) });
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });

        // If incoming from other user, mark as read
        if (
          conversation?.otherUser.userId &&
          event.payload.senderUserId === conversation.otherUser.userId
        ) {
          lastMarkedReadMessageIdRef.current = event.payload.id;
          chatApi.markRead(conversationId, event.payload.id).catch(() => {});
          trackOnboardingEvent('conversation_marked_read', {
            conversationId,
            messageId: event.payload.id,
          });
        }
      }
    });

    const unsubRead = chatSocket.onMessageRead((event) => {
      if (event.conversationId === conversationId) {
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) });
      }
    });

    const unsubDelivered = chatSocket.onMessageDelivered((event) => {
      if (event.payload.conversationId === conversationId) {
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) });
      }
    });

    const unsubTyping = chatSocket.onTyping((event) => {
      if (event.conversationId === conversationId) {
        setIsPartnerTyping(event.payload.isTyping);
      }
    });

    return () => {
      chatSocket.stopTyping(conversationId);
      chatSocket.leaveConversation(conversationId);
      unsubConnection();
      unsubMessage();
      unsubRead();
      unsubDelivered();
      unsubTyping();
    };
  }, [conversationId, queryClient, chatApi, conversation?.otherUser.userId]);

  // 5. Send message handler (with AI Toxic Intervention check)
  const handleSendMessage = async (bypassAys = false) => {
    const textToSend = bypassAys ? pendingToxicText : inputText.trim();
    if (!textToSend || isSending) return;

    if (!bypassAys) {
      const toxCheck = detectToxicity(textToSend);
      if (toxCheck.isToxic) {
        setPendingToxicText(textToSend);
        setAysReason(toxCheck.reason);
        setIsAysModalVisible(true);
        trackOnboardingEvent('toxic_intervention_triggered', {
          conversationId,
          score: toxCheck.score,
          categories: toxCheck.categories,
        });
        return;
      }
    }

    const clientMessageId = `${CLIENT_MESSAGE_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newOptimisticMsg: OptimisticMessageItem = {
      id: clientMessageId,
      conversationId,
      senderUserId: 'me',
      clientMessageId,
      messageType: 'TEXT',
      body: textToSend,
      metadata: bypassAys ? { warnedByAys: true, toxicityReason: aysReason } : null,
      deliveryState: 'SENT',
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      isOptimistic: true,
      isFailed: false,
    };

    setInputText('');
    setPendingToxicText('');
    setAysReason(undefined);
    lastTypingEmittedRef.current = 0;
    chatSocket.stopTyping(conversationId);
    setOptimisticMessages((prev) => [newOptimisticMsg, ...prev]);
    setIsSending(true);
    trackOnboardingEvent('message_send_attempted', { conversationId, clientMessageId });

    try {
      const res = await chatApi.sendMessage(conversationId, {
        clientMessageId,
        body: textToSend,
        messageType: 'TEXT',
        metadata: bypassAys ? { warnedByAys: true, toxicityReason: aysReason } : undefined,
      });

      setOptimisticMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) });
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
      trackOnboardingEvent('message_sent', { conversationId, messageId: res.message.id });
    } catch {
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, isOptimistic: false, isFailed: true } : m
        )
      );
      trackOnboardingEvent('message_send_failed', { conversationId, clientMessageId });
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = async (failedMsg: OptimisticMessageItem) => {
    trackOnboardingEvent('message_retried', {
      conversationId,
      clientMessageId: failedMsg.clientMessageId,
    });
    setOptimisticMessages((prev) =>
      prev.map((m) =>
        m.clientMessageId === failedMsg.clientMessageId
          ? { ...m, isFailed: false, isOptimistic: true }
          : m
      )
    );

    try {
      const res = await chatApi.sendMessage(conversationId, {
        clientMessageId: failedMsg.clientMessageId || `${CLIENT_MESSAGE_ID_PREFIX}${Date.now()}`,
        body: failedMsg.body,
        messageType: failedMsg.messageType,
      });

      setOptimisticMessages((prev) =>
        prev.filter((m) => m.clientMessageId !== failedMsg.clientMessageId)
      );
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) });
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
      trackOnboardingEvent('message_sent', { conversationId, messageId: res.message.id });
    } catch {
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === failedMsg.clientMessageId
            ? { ...m, isFailed: true, isOptimistic: false }
            : m
        )
      );
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      const now = Date.now();
      if (now - lastTypingEmittedRef.current > 2000) {
        lastTypingEmittedRef.current = now;
        chatSocket.startTyping(conversationId);
      }
    } else {
      lastTypingEmittedRef.current = 0;
      chatSocket.stopTyping(conversationId);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Build list items with date separators
  const listItems: ChatListItem[] = useMemo(() => {
    const items: ChatListItem[] = [];
    for (let i = 0; i < allMessages.length; i++) {
      const current = allMessages[i];
      if (!current) continue;
      items.push({ type: 'message', message: current });

      const currentDate = new Date(current.createdAt).toDateString();
      const next = allMessages[i + 1];
      const nextDate = next ? new Date(next.createdAt).toDateString() : null;

      if (!next || currentDate !== nextDate) {
        items.push({
          type: 'date_separator',
          id: `date-${currentDate}-${i}`,
          label: formatDateLabel(current.createdAt),
        });
      }
    }
    return items;
  }, [allMessages]);

  const renderItem = useCallback(
    ({ item }: { item: ChatListItem }) => {
      if (item.type === 'date_separator') {
        return (
          <View style={styles.dateSeparatorRow}>
            <View
              style={[
                styles.dateSeparatorPill,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                  borderRadius: radii.radiusFull,
                },
              ]}
            >
              <Text
                variant="caption"
                weight="medium"
                style={{ color: colors.textTertiary, fontSize: 11 }}
              >
                {item.label}
              </Text>
            </View>
          </View>
        );
      }

      const msg = item.message;
      const isCurrentUser =
        msg.isOptimistic ||
        msg.senderUserId === 'me' ||
        (conversation ? msg.senderUserId !== conversation.otherUser.userId : true);

      return <MessageBubble message={msg} isCurrentUser={isCurrentUser} onRetry={handleRetry} />;
    },
    [conversation, colors, radii, handleRetry]
  );

  const handleBlockConfirm = async (targetUserId: string, reason?: string) => {
    trackOnboardingEvent('chat_block_started', { conversationId, targetUserId });
    await safetyApi.blockUser(targetUserId, { reason });
    trackOnboardingEvent('chat_block_completed', { conversationId, targetUserId });
    queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    queryClient.removeQueries({ queryKey: CHAT_QUERY_KEYS.conversation(conversationId) });
    handleBack();
  };

  const handleReportSubmit = async (data: {
    targetType: ReportTargetType;
    targetId: string;
    reasonCode: ReportReasonCode;
    notes?: string;
  }) => {
    trackOnboardingEvent('chat_report_started', { conversationId, reasonCode: data.reasonCode });
    await safetyApi.createReport({
      targetType: data.targetType,
      targetId: data.targetId,
      reasonCode: data.reasonCode,
      description: data.notes || undefined,
    });
    trackOnboardingEvent('chat_report_completed', { conversationId, reasonCode: data.reasonCode });
  };

  const handleUnmatch = () => {
    if (!conversation) return;
    Alert.alert(
      `Unmatch with ${conversation.otherUser.displayName}?`,
      'You will no longer be able to message each other, and this conversation will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: async () => {
            try {
              trackOnboardingEvent('chat_unmatch_started', {
                conversationId,
                matchId: conversation.matchId,
              });
              await matchesApi.unmatch(conversation.matchId);
              trackOnboardingEvent('chat_unmatch_completed', {
                conversationId,
                matchId: conversation.matchId,
              });
              queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
              queryClient.removeQueries({ queryKey: CHAT_QUERY_KEYS.conversation(conversationId) });
              queryClient.invalidateQueries({ queryKey: ['matches'] });
              handleBack();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to unmatch';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  if (conversationError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ChatHeader displayName="Conversation" connectionState="disconnected" onBack={handleBack} />
        <ErrorState
          type="content_unavailable"
          title="Conversation Unavailable"
          message="This conversation could not be found or has ended."
          retryLabel="Go Back"
          onRetry={handleBack}
        />
      </View>
    );
  }

  if (isLoadingConversation && !conversation) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ChatHeader displayName="Loading..." connectionState="connecting" onBack={handleBack} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  const handleStartCall = async (type: 'AUDIO' | 'VIDEO') => {
    try {
      const res = await callingApi.initiateCall({ conversationId, callType: type });
      setActiveCallSessionId(res.callSessionId);
      setActiveCallType(type);
      setIsCallModalVisible(true);
      trackOnboardingEvent('call_initiated', { conversationId, callType: type });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start call';
      Alert.alert('Call Not Available', msg);
    }
  };

  const handleHangup = async () => {
    if (activeCallSessionId) {
      try {
        await callingApi.endCall(activeCallSessionId);
        trackOnboardingEvent('call_ended', { conversationId, callSessionId: activeCallSessionId });
      } catch {
        // Silently ignore end call failure on local hangup
      }
    }
    setActiveCallSessionId(null);
    setIsCallModalVisible(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ChatHeader
        displayName={conversation?.otherUser.displayName || 'Chat'}
        age={conversation?.otherUser.age}
        avatarUrl={conversation?.otherUser.primaryMedia?.url}
        connectionState={connectionState}
        onBack={handleBack}
        onAudioCall={() => handleStartCall('AUDIO')}
        onVideoCall={() => handleStartCall('VIDEO')}
        onReport={() => setIsReportModalVisible(true)}
        onBlock={() => setIsBlockModalVisible(true)}
        onUnmatch={conversation?.matchId ? handleUnmatch : undefined}
      />

      {connectionState !== 'connected' && (
        <OfflineBanner
          status={connectionState === 'reconnecting' ? 'reconnecting' : 'offline'}
          onRetrySync={() => {
            if (conversation?.id) {
              chatSocket.joinConversation(conversation.id);
            }
          }}
        />
      )}

      {messagesError && !messagesData ? (
        <ErrorState
          type="server_error"
          title="Failed to load messages"
          message="Could not retrieve chat history. Please try again."
          onRetry={() =>
            queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) })
          }
        />
      ) : isLoadingMessages && !messagesData ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          inverted
          data={listItems}
          keyExtractor={(item) => (item.type === 'message' ? item.message.id : item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.paginationLoader}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
        />
      )}

      <TypingIndicator
        isTyping={isPartnerTyping}
        displayName={conversation?.otherUser.displayName}
      />

      <MessageComposer
        value={inputText}
        onChangeText={handleTextChange}
        onSend={handleSendMessage}
        disabled={isSending || conversation?.status === 'CLOSED'}
        placeholder={
          conversation?.status === 'CLOSED'
            ? 'This conversation is closed'
            : 'Say something nice...'
        }
      />

      {conversation && (
        <>
          <ReportModal
            visible={isReportModalVisible}
            targetType="CONVERSATION"
            targetId={conversation.id}
            targetName={conversation.otherUser.displayName}
            onClose={() => setIsReportModalVisible(false)}
            onSubmit={handleReportSubmit}
          />
          <BlockModal
            visible={isBlockModalVisible}
            targetUserId={conversation.otherUser.userId}
            targetUserName={conversation.otherUser.displayName}
            onClose={() => setIsBlockModalVisible(false)}
            onConfirm={handleBlockConfirm}
          />
          <AreYouSureModal
            visible={isAysModalVisible}
            messageText={pendingToxicText}
            reason={aysReason}
            onEdit={() => setIsAysModalVisible(false)}
            onSendAnyway={() => {
              setIsAysModalVisible(false);
              void handleSendMessage(true);
            }}
          />
          <CallModal
            visible={isCallModalVisible}
            callType={activeCallType}
            partnerName={conversation.otherUser.displayName}
            avatarUrl={conversation.otherUser.primaryMedia?.url}
            onHangup={handleHangup}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  dateSeparatorRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
  },
  paginationLoader: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
