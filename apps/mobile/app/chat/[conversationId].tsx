import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChatScreen } from '../../src/chat/ChatScreen';
import { getDefaultAuthClient } from '../../src/auth/default-client';

export default function ChatRoute(): React.JSX.Element {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const authClient = getDefaultAuthClient();

  return (
    <ChatScreen
      conversationId={conversationId || ''}
      authClient={authClient}
      onBack={() => router.back()}
    />
  );
}
