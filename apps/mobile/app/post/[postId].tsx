import React from 'react';
import { useLocalSearchParams, Redirect } from 'expo-router';

/** Deep-link alias for `/social/post/[postId]`. */
export default function PostDeepLinkRoute(): React.JSX.Element {
  const { postId } = useLocalSearchParams<{ postId: string }>();

  if (!postId) {
    return <Redirect href="/(tabs)/explore" />;
  }

  return <Redirect href={`/social/post/${postId}`} />;
}
