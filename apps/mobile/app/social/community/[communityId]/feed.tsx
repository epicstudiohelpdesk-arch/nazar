import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CommunityFeedScreen } from '../../../../src/social/CommunityFeedScreen.js';
import { useSocialApi } from '../../../../src/social/useSocialApi.js';

export default function CommunityFeedRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(communityId ? `/social/community/${communityId}` : '/social/communities');
    }
  };

  return <CommunityFeedScreen client={client} communityId={communityId ?? ''} onBack={handleBack} />;
}
