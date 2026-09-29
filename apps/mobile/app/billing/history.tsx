import type React from 'react';
import { useMemo } from 'react';
import { BillingHistoryScreen } from '../../src/billing/BillingHistoryScreen.js';
import { BillingApiClient } from '../../src/billing/billing-api.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function BillingHistoryRoute(): React.JSX.Element {
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

  return <BillingHistoryScreen client={client} />;
}
