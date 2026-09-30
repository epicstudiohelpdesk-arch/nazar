import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EventDetailScreen } from '../../../../src/social/EventDetailScreen.js';
import { useSocialApi } from '../../../../src/social/useSocialApi.js';

export default function EventDetailRoute(): React.JSX.Element {
  const client = useSocialApi();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <EventDetailScreen client={client} eventId={eventId ?? ''} />;
}
