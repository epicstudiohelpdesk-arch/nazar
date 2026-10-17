import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MatchDetailScreen } from '../../src/matches/MatchDetailScreen';
import { getDefaultAuthClient } from '../../src/auth/default-client';

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
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/matches');
        }
      }}
      onUnmatched={() => router.replace('/(tabs)/matches')}
    />
  );
}
