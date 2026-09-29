import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EventDetailScreen } from '../../../src/social/EventDetailScreen.js';
import { SocialApiClient } from '../../../src/social/social-api.js';
import { getDefaultAuthClient } from '../../../src/auth/default-client.js';

export default function EventDetailRoute(): React.JSX.Element {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
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
    <EventDetailScreen
      client={client}
      eventId={eventId || ''}
      onBack={() => router.back()}
    />
  );
}
