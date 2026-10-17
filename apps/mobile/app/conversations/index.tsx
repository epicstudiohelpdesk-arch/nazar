import React from 'react';
import { useRouter } from 'expo-router';
import { ConversationsScreen } from '../../src/chat/ConversationsScreen.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function ConversationsRoute(): React.JSX.Element {
  const router = useRouter();
  const authClient = getDefaultAuthClient();

  return (
    <ConversationsScreen
      authClient={authClient}
      onSelectConversation={(conversationId) => router.push(`/chat/${conversationId}` as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
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
