import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PostDetailScreen } from '../../../src/social/PostDetailScreen.js';
import { SocialApiClient } from '../../../src/social/social-api.js';
import { getDefaultAuthClient } from '../../../src/auth/default-client.js';

export default function PostDetailRoute(): React.JSX.Element {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const authClient = getDefaultAuthClient();

  const client = useMemo(
    () =>
      new SocialApiClient({
        baseUrl: authClient.getBaseUrl(),
        getAccessToken: async () => authClient.getStorage().getAccessToken(),
      }),
    [authClient]
  );

  return (
    <PostDetailScreen
      client={client}
      postId={postId || ''}
      onBack={() => router.back()}
    />
  );
}
