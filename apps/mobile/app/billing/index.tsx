import type React from 'react';
import { useMemo } from 'react';
import { SubscriptionScreen } from '../../src/billing/SubscriptionScreen';
import { BillingApiClient } from '../../src/billing/billing-api';
import { getDefaultAuthClient } from '../../src/auth/default-client';

export default function BillingRoute(): React.JSX.Element {
  const authClient = getDefaultAuthClient();

  const client = useMemo(
    () =>
      new BillingApiClient({
        baseUrl: authClient.getBaseUrl(),
        getAccessToken: async () => authClient.getStorage().getAccessToken(),
      }),
    [authClient]
  );

  return <SubscriptionScreen client={client} />;
}
