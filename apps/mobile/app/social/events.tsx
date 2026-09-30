import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EventsScreen } from '../../src/social/EventsScreen.js';
import { useSocialApi } from '../../src/social/useSocialApi.js';

export default function EventsRoute(): React.JSX.Element {
  const client = useSocialApi();
  const { communityId } = useLocalSearchParams<{ communityId?: string }>();
  return <EventsScreen client={client} communityId={communityId} />;
}
