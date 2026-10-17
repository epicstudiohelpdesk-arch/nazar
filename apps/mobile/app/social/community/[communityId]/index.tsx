import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CommunityDetailScreen } from '../../../../src/social/CommunityDetailScreen.js';
import { useSocialApi } from '../../../../src/social/useSocialApi.js';

export default function CommunityDetailRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/social/communities');
    }
  };

  return <CommunityDetailScreen client={client} communityId={communityId ?? ''} onBack={handleBack} />;
}
