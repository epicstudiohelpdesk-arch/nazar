import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CommunityDetailScreen } from '../../../src/social/CommunityDetailScreen.js';
import { SocialApiClient } from '../../../src/social/social-api.js';
import { getDefaultAuthClient } from '../../../src/auth/default-client.js';

export default function CommunityDetailRoute(): React.JSX.Element {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
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
    <CommunityDetailScreen
      client={client}
      communityId={communityId || ''}
      onOpenFeed={(id) => router.push(`/social/community/${id}`)}
      onBack={() => router.back()}
    />
  );
}
