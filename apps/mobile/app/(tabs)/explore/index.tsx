import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SocialFeedScreen } from '../../../src/social/SocialFeedScreen.js';
import { SocialApiClient } from '../../../src/social/social-api.js';
import { getDefaultAuthClient } from '../../../src/auth/default-client.js';

export default function ExploreTabRoute(): React.JSX.Element {
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
    <SocialFeedScreen
      client={client}
      onOpenPost={(postId) => router.push(`/social/post/${postId}`)}
      onCreatePost={() => router.push('/social/create-post')}
    />
  );
}
