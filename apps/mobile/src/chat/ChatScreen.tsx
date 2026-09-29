import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@platform/ui';
import { getDefaultAuthClient } from '../auth/default-client.js';
import { createChatApi, CHAT_QUERY_KEYS } from './chat-api.js';
import { chatSocket, type SocketConnectionState } from './chat-socket.js';
import { createSafetyApi } from '../safety/safety-api.js';
import { ReportModal } from '../safety/components/ReportModal.js';
import { BlockModal } from '../safety/components/BlockModal.js';
import type { ReportReasonCode, ReportTargetType } from '@platform/api-contracts';
import { ChatHeader } from './components/ChatHeader.js';
import { MessageBubble, type OptimisticMessageItem } from './components/MessageBubble.js';
import { MessageComposer } from './components/MessageComposer.js';
import { TypingIndicator } from './components/TypingIndicator.js';
import type { AuthClient } from '../auth/auth-client.js';

export interface ChatScreenProps {
  readonly conversationId: string;
  readonly authClient?: AuthClient;
  readonly onBack?: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ conversationId, authClient, onBack }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

  const effectiveClient = useMemo(() => authClient || getDefaultAuthClient(), [authClient]);
  const chatApi = useMemo(() => createChatApi(effectiveClient), [effectiveClient]);
  const safetyApi = useMemo(() => createSafetyApi(effectiveClient), [effectiveClient]);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>(
    chatSocket.getConnectionState()
  );
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessageItem[]>([]);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isBlockModalVisible, setIsBlockModalVisible] = useState(false);

  // 1. Load conversation detail
  const { data: conversation } = useQuery({
    queryKey: CHAT_QUERY_KEYS.conversation(conversationId),
    queryFn: () => chatApi.getConversationDetail(conversationId),
    enabled: Boolean(conversationId),
  });

  // 2. Load message history
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: CHAT_QUERY_KEYS.messages(conversationId),
    queryFn: () => chatApi.getMessages(conversationId, { limit: 50 }),
    enabled: Boolean(conversationId),
  });

  // Combine server messages (reverse order for ascending display) + optimistic messages
  const serverMessages = messagesData?.items ? [...messagesData.items].reverse() : [];
  const allMessages: OptimisticMessageItem[] = [...serverMessages, ...optimisticMessages];

  // 3. Mark last message as read upon opening
  useEffect(() => {
    if (serverMessages.length > 0) {
      const lastMsg = serverMessages[serverMessages.length - 1];
      if (lastMsg && lastMsg.senderUserId !== conversation?.otherUser.userId) {
        chatApi.markRead(conversationId, lastMsg.id).catch(() => {});
      }
    }
  }, [conversationId, serverMessages.length, conversation?.otherUser.userId, chatApi]);

  // 4. WebSocket setup & listeners
  useEffect(() => {
    chatSocket.joinConversation(conversationId);

    const unsubConnection = chatSocket.onConnectionStateChange((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) });
      }
    });

    const unsubMessage = chatSocket.onMessageCreated((event) => {
      if (event.conversationId === conversationId) {
        setOptimisticMessages((prev) =>
          prev.filter((m) => m.clientMessageId !== event.payload.clientMessageId)
        );
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) });
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });

        chatApi.markRead(conversationId, event.payload.id).catch(() => {});
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
      chatSocket.leaveConversation(conversationId);
      unsubConnection();
      unsubMessage();
      unsubRead();
      unsubDelivered();
      unsubTyping();
    };
  }, [conversationId, queryClient, chatApi]);

  // 5. Send message handler
  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    const clientMessageId = `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newOptimisticMsg: OptimisticMessageItem = {
      id: clientMessageId,
      conversationId,
      senderUserId: 'me',
      clientMessageId,
      messageType: 'TEXT',
      body: trimmed,
      deliveryState: 'SENT',
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    setInputText('');
    chatSocket.stopTyping(conversationId);
    setOptimisticMessages((prev) => [...prev, newOptimisticMsg]);
    setIsSending(true);

    try {
      const res = await chatApi.sendMessage(conversationId, {
        clientMessageId,
        body: trimmed,
        messageType: 'TEXT',
      });

      setOptimisticMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));
      queryClient.setQueryData(CHAT_QUERY_KEYS.messages(conversationId), (old: any) => {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!old) return { items: [res.message], hasMore: false };
        return {
          ...old,
          items: [res.message, ...(old.items || [])],
        };
      });
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    } catch {
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, isOptimistic: false, isFailed: true } : m
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = async (failedMsg: OptimisticMessageItem) => {
    setOptimisticMessages((prev) =>
      prev.map((m) =>
        m.clientMessageId === failedMsg.clientMessageId
          ? { ...m, isFailed: false, isOptimistic: true }
          : m
      )
    );

    try {
      const res = await chatApi.sendMessage(conversationId, {
        clientMessageId: failedMsg.clientMessageId,
        body: failedMsg.body,
        messageType: failedMsg.messageType,
      });

      setOptimisticMessages((prev) =>
        prev.filter((m) => m.clientMessageId !== failedMsg.clientMessageId)
      );
      queryClient.setQueryData(CHAT_QUERY_KEYS.messages(conversationId), (old: any) => {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!old) return { items: [res.message], hasMore: false };
        return { ...old, items: [res.message, ...(old.items || [])] };
      });
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
      chatSocket.startTyping(conversationId);
    } else {
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

  const renderItem = useCallback(
    ({ item }: { item: OptimisticMessageItem }) => {
      const isCurrentUser =
        item.isOptimistic ||
        item.senderUserId === 'me' ||
        (conversation ? item.senderUserId !== conversation.otherUser.userId : true);

      return <MessageBubble message={item} isCurrentUser={isCurrentUser} onRetry={handleRetry} />;
    },
    [conversation]
  );

  const handleBlockConfirm = async (targetUserId: string, reason?: string) => {
    await safetyApi.blockUser(targetUserId, { reason });
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
    await safetyApi.createReport({
      targetType: data.targetType,
      targetId: data.targetId,
      reasonCode: data.reasonCode,
      description: data.notes || undefined,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ChatHeader
        displayName={conversation?.otherUser.displayName || 'Chat'}
        age={conversation?.otherUser.age}
        avatarUrl={conversation?.otherUser.primaryMedia?.url}
        connectionState={connectionState}
        onBack={handleBack}
        onReport={() => setIsReportModalVisible(true)}
        onBlock={() => setIsBlockModalVisible(true)}
      />

      {connectionState === 'reconnecting' && (
        <View style={styles.reconnectBanner}>
          <Text style={styles.reconnectText}>Connecting to chat...</Text>
        </View>
      )}

      {isLoadingMessages ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
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
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reconnectBanner: {
    backgroundColor: colors.status.warning,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  reconnectText: {
    color: '#ffffff',
    fontSize: typography.fontSize.xs,
    fontWeight: 'bold',
  },
  messageList: {
    paddingVertical: spacing.xs,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
});
