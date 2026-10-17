import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CreateEventScreen } from '../../../src/social/CreateEventScreen.js';
import { useSocialApi } from '../../../src/social/useSocialApi.js';
import { SOCIAL_QUERY_KEYS } from '../../../src/social/social-api.js';

export default function CreateEventRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId?: string }>();

  // Optional context only. A failure here must not block hosting an event, so it
  // degrades to a neutral label instead of an error screen.
  const communityQuery = useQuery({
    queryKey: SOCIAL_QUERY_KEYS.community(communityId ?? ''),
    queryFn: () => client.getCommunity(communityId as string),
    enabled: Boolean(communityId),
    staleTime: 60_000,
  });

  return (
    <CreateEventScreen
      client={client}
      communityId={communityId}
      communityName={communityQuery.data?.name}
      onCancel={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/social/events');
        }
      }}
      onCreated={(event) => router.replace(`/social/event/${event.id}`)}
    />
  );
}
