import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EventsScreen } from '../../src/social/EventsScreen.js';
import { useSocialApi } from '../../src/social/useSocialApi.js';

export default function EventsRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId?: string }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/discovery');
    }
  };

  return <EventsScreen client={client} communityId={communityId} onBack={handleBack} />;
}
