import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { CommunityDto } from '@platform/api-contracts';
import { CommunityMembersScreen } from '../../../../src/social/CommunityMembersScreen.js';
import { useSocialApi } from '../../../../src/social/useSocialApi.js';
import { SOCIAL_QUERY_KEYS } from '../../../../src/social/social-api.js';

export default function CommunityMembersRoute(): React.JSX.Element {
  const client = useSocialApi();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const id = communityId ?? '';

  // Role and membership status come from the community DTO, which the detail
  // screen already populates in cache. Reusing it avoids a second identical
  // request and keeps moderation decisions on server-provided values.
  const { data: community } = useQuery<CommunityDto>({
    queryKey: SOCIAL_QUERY_KEYS.community(id),
    queryFn: () => client.getCommunity(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  return (
    <CommunityMembersScreen
      client={client}
      communityId={id}
      currentUserRole={community?.currentUserRole ?? null}
      currentUserMembershipStatus={community?.currentUserMembershipStatus ?? null}
    />
  );
}
