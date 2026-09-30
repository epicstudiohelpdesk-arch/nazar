import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EventAttendeesScreen } from '../../../../src/social/EventAttendeesScreen.js';
import { useSocialApi } from '../../../../src/social/useSocialApi.js';

export default function EventAttendeesRoute(): React.JSX.Element {
  const client = useSocialApi();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <EventAttendeesScreen client={client} eventId={eventId ?? ''} />;
}
