import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CommunitiesScreen } from '../../src/social/CommunitiesScreen.js';
import { useSocialApi } from '../../src/social/useSocialApi.js';

export default function CommunitiesRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/discovery');
    }
  };

  return (
    <CommunitiesScreen
      client={client}
      initialTab={tab === 'discover' ? 'discover' : 'mine'}
      onBack={handleBack}
    />
  );
}
