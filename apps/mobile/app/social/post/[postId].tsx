import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PostDetailScreen } from '../../../src/social/PostDetailScreen.js';
import { useSocialApi } from '../../../src/social/useSocialApi.js';

export default function PostDetailRoute(): React.JSX.Element {
  const client = useSocialApi();
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/social/feed');
    }
  };

  return <PostDetailScreen client={client} postId={postId ?? ''} onBack={handleBack} />;
}
