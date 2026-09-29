import type React from 'react';
import { useMemo } from 'react';
import { SubscriptionScreen } from '../../src/billing/SubscriptionScreen.js';
import { BillingApiClient } from '../../src/billing/billing-api.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function BillingRoute(): React.JSX.Element {
  const authClient = getDefaultAuthClient();

  const client = useMemo(
    () =>
      new BillingApiClient({
        baseUrl:
          (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
          'http://localhost:3000',
        getAccessToken: async () => authClient.getStorage().getAccessToken(),
      }),
    [authClient]
  );

  return <SubscriptionScreen client={client} />;
}
