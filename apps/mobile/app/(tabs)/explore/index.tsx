import React from 'react';
import { SocialHomeScreen } from '../../../src/social/SocialHomeScreen.js';
import { useSocialApi } from '../../../src/social/useSocialApi.js';

export default function ExploreTabRoute(): React.JSX.Element {
  const client = useSocialApi();
  return <SocialHomeScreen client={client} />;
}
