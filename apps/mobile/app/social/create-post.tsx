import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CreatePostScreen } from '../../src/social/CreatePostScreen.js';
import { useSocialApi } from '../../src/social/useSocialApi.js';
import { SOCIAL_QUERY_KEYS } from '../../src/social/social-api.js';

export default function CreatePostRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId?: string }>();

  // Used only for the "Posting to <name>" affordance. A failure here must not
  // block composing, so it is treated as optional detail.
  const communityQuery = useQuery({
    queryKey: SOCIAL_QUERY_KEYS.community(communityId ?? ''),
    queryFn: () => client.getCommunity(communityId as string),
    enabled: Boolean(communityId),
    staleTime: 60_000,
  });

  return (
    <CreatePostScreen
      client={client}
      communityId={communityId}
      communityName={communityQuery.data?.name}
      onCancel={() => router.back()}
      onPostCreated={() => router.back()}
    />
  );
}
