import React from 'react';
import { SocialFeedScreen } from '../../src/social/SocialFeedScreen.js';
import { useSocialApi } from '../../src/social/useSocialApi.js';

export default function SocialFeedRoute(): React.JSX.Element {
  const client = useSocialApi();
  return <SocialFeedScreen client={client} />;
}
