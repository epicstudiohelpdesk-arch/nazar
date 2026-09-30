import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CommunitiesScreen } from '../../src/social/CommunitiesScreen.js';
import { useSocialApi } from '../../src/social/useSocialApi.js';

export default function CommunitiesRoute(): React.JSX.Element {
  const client = useSocialApi();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return (
    <CommunitiesScreen client={client} initialTab={tab === 'discover' ? 'discover' : 'mine'} />
  );
}
