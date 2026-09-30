import React from 'react';
import { useLocalSearchParams, Redirect } from 'expo-router';

/** Deep-link alias for `/social/community/[communityId]`. */
export default function CommunityDeepLinkRoute(): React.JSX.Element {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();

  if (!communityId) {
    return <Redirect href="/(tabs)/explore" />;
  }

  return <Redirect href={`/social/community/${communityId}`} />;
}
