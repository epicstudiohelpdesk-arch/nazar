import React from 'react';
import { useRouter } from 'expo-router';
import { DiscoveryScreen } from '../../src/discovery/DiscoveryScreen';
import { getDefaultAuthClient } from '../../src/auth/default-client';

export default function DiscoveryRoute(): React.JSX.Element {
  const router = useRouter();
  const authClient = getDefaultAuthClient();

  return (
    <DiscoveryScreen
      authClient={authClient}
      onOpenMatches={() => router.push('/matches')}
      onOpenProfile={() => router.push('/')}
    />
  );
}
