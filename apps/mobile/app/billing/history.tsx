import type React from 'react';
import { useMemo } from 'react';
import { BillingHistoryScreen } from '../../src/billing/BillingHistoryScreen';
import { createBillingApi } from '../../src/billing/billing-api';
import { getDefaultAuthClient } from '../../src/auth/default-client';

export default function BillingHistoryRoute(): React.JSX.Element {
  const authClient = getDefaultAuthClient();
  const client = useMemo(() => createBillingApi(authClient), [authClient]);

  return <BillingHistoryScreen client={client} />;
}
