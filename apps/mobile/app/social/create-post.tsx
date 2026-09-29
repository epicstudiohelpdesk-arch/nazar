import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { CreatePostScreen } from '../../src/social/CreatePostScreen.js';
import { SocialApiClient } from '../../src/social/social-api.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function CreatePostRoute(): React.JSX.Element {
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
    <CreatePostScreen
      client={client}
      onPostCreated={() => router.back()}
      onCancel={() => router.back()}
    />
  );
}
