import type React from 'react';
import { useMemo } from 'react';
import { BillingHistoryScreen } from '../../src/billing/BillingHistoryScreen';
import { BillingApiClient } from '../../src/billing/billing-api';
import { getDefaultAuthClient } from '../../src/auth/default-client';

export default function BillingHistoryRoute(): React.JSX.Element {
  const authClient = getDefaultAuthClient();

  const client = useMemo(
    () =>
      new BillingApiClient({
        baseUrl: authClient.getBaseUrl(),
        getAccessToken: async () => authClient.getStorage().getAccessToken(),
      }),
    [authClient]
  );

  return <BillingHistoryScreen client={client} />;
}
