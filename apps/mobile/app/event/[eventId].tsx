import React from 'react';
import { useLocalSearchParams, Redirect } from 'expo-router';

/** Deep-link alias for `/social/event/[eventId]`. */
export default function EventDeepLinkRoute(): React.JSX.Element {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  if (!eventId) {
    return <Redirect href="/(tabs)/explore" />;
  }

  return <Redirect href={`/social/event/${eventId}`} />;
}
