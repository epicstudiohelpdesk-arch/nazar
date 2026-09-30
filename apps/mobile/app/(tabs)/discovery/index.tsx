import React from 'react';
import { useRouter } from 'expo-router';
import { DiscoveryScreen } from '../../../src/discovery/DiscoveryScreen.js';
import { getDefaultAuthClient } from '../../../src/auth/default-client.js';

export default function DiscoverTabRoute(): React.JSX.Element {
  const router = useRouter();
  const authClient = getDefaultAuthClient();

  return (
    <DiscoveryScreen
      authClient={authClient}
      onOpenProfile={(userId) => router.push(`/profile/${userId}`)}
      onOpenMatches={() => router.push('/(tabs)/matches')}
    />
  );
}
