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
      onOpenProfile={() => router.push('/profile/edit')}
      onOpenMatches={() => router.push('/matches')}
    />
  );
}
