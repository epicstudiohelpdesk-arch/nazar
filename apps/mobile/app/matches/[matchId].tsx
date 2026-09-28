import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MatchDetailScreen } from '../../src/matches/MatchDetailScreen.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function MatchDetailRoute(): React.JSX.Element {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const authClient = getDefaultAuthClient();

  if (!matchId) {
    return <></>;
  }

  return (
    <MatchDetailScreen
      authClient={authClient}
      matchId={matchId}
      onBack={() => router.back()}
      onUnmatched={() => router.replace('/matches')}
    />
  );
}
