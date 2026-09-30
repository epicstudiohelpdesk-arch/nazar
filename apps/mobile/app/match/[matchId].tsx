import React from 'react';
import { useLocalSearchParams, Redirect } from 'expo-router';

/**
 * Deep Link Forwarder:
 * Handles incoming URI schemes such as nazar://match/:matchId
 * and redirects to the canonical route /matches/[matchId].
 */
export default function MatchDeepLinkRoute(): React.JSX.Element {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  return <Redirect href={`/matches/${matchId || ''}`} />;
}
