import React from 'react';
import { useRouter } from 'expo-router';
import { ConversationsScreen } from '../../../src/chat/ConversationsScreen.js';
import { getDefaultAuthClient } from '../../../src/auth/default-client.js';

export default function MessagesTabRoute(): React.JSX.Element {
  const router = useRouter();
  const authClient = getDefaultAuthClient();

  return (
    <ConversationsScreen
      authClient={authClient}
      onSelectConversation={(conversationId) => router.push(`/chat/${conversationId}`)}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/discovery');
        }
      }}
    />
  );
}
