import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CommunityFeedScreen } from '../../../../src/social/CommunityFeedScreen.js';
import { useSocialApi } from '../../../../src/social/useSocialApi.js';

export default function CommunityFeedRoute(): React.JSX.Element {
  const client = useSocialApi();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  return <CommunityFeedScreen client={client} communityId={communityId ?? ''} />;
}
