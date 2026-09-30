import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CommunityDetailScreen } from '../../../../src/social/CommunityDetailScreen.js';
import { useSocialApi } from '../../../../src/social/useSocialApi.js';

export default function CommunityDetailRoute(): React.JSX.Element {
  const client = useSocialApi();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  return <CommunityDetailScreen client={client} communityId={communityId ?? ''} />;
}
