import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EventAttendeesScreen } from '../../../../src/social/EventAttendeesScreen.js';
import { useSocialApi } from '../../../../src/social/useSocialApi.js';

export default function EventAttendeesRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(eventId ? `/social/event/${eventId}` : '/social/events');
    }
  };

  return <EventAttendeesScreen client={client} eventId={eventId ?? ''} onBack={handleBack} />;
}
