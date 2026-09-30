import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PostDetailScreen } from '../../../src/social/PostDetailScreen.js';
import { useSocialApi } from '../../../src/social/useSocialApi.js';

export default function PostDetailRoute(): React.JSX.Element {
  const client = useSocialApi();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return <PostDetailScreen client={client} postId={postId ?? ''} />;
}
