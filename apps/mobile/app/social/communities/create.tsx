import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { getDefaultAuthClient } from '../../../src/auth/default-client.js';
import { SocialApiClient } from '../../../src/social/social-api.js';
import { CreateCommunityScreen } from '../../../src/social/CreateCommunityScreen.js';

export default function CreateCommunityRoute(): React.JSX.Element {
  const router = useRouter();
  const authClient = useMemo(() => getDefaultAuthClient(), []);
  const client = useMemo(
    () =>
      new SocialApiClient({
        baseUrl: authClient.getBaseUrl(),
        getAccessToken: async () => authClient.getStorage().getAccessToken(),
      }),
    [authClient]
  );

  return (
    <CreateCommunityScreen
      client={client}
      onCancel={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/social/communities');
        }
      }}
      onCreated={(community) => router.replace(`/social/community/${community.id}`)}
    />
  );
}
