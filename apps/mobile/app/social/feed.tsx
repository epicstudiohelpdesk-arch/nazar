import React from 'react';
import { useRouter } from 'expo-router';
import { SocialFeedScreen } from '../../src/social/SocialFeedScreen.js';
import { useSocialApi } from '../../src/social/useSocialApi.js';

export default function SocialFeedRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/discovery');
    }
  };

  return <SocialFeedScreen client={client} onBack={handleBack} />;
}
