import React from 'react';
import { useRouter } from 'expo-router';
import { MatchesScreen } from '../../src/matches/MatchesScreen';
import { getDefaultAuthClient } from '../../src/auth/default-client';

export default function MatchesRoute(): React.JSX.Element {
  const router = useRouter();
  const authClient = getDefaultAuthClient();

  return (
    <MatchesScreen
      authClient={authClient}
      onSelectMatch={(matchId) => router.push(`/matches/${matchId}`)}
      onBack={() => router.back()}
    />
  );
}
