import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EventDetailScreen } from '../../../../src/social/EventDetailScreen.js';
import { useSocialApi } from '../../../../src/social/useSocialApi.js';

export default function EventDetailRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/social/events');
    }
  };

  return <EventDetailScreen client={client} eventId={eventId ?? ''} onBack={handleBack} />;
}
