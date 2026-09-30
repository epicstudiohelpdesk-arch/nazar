import { useMemo } from 'react';
import { createSocialApi, type SocialApiClient } from './social-api.js';
import { getDefaultAuthClient } from '../auth/default-client.js';

/**
 * Shared social API instance.
 *
 * Route files previously each constructed their own `SocialApiClient`, which
 * duplicated the auth wiring nine times and made it easy for one route to fall
 * out of sync with the others. The client is stateless, so a single memoised
 * instance is safe and keeps React Query caching consistent.
 */
export function useSocialApi(): SocialApiClient {
  const authClient = getDefaultAuthClient();
  return useMemo(() => createSocialApi(authClient), [authClient]);
}
