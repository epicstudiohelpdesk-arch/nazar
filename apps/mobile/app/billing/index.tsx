import type React from 'react';
import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SubscriptionScreen } from '../../src/billing/SubscriptionScreen';
import { createBillingApi } from '../../src/billing/billing-api';
import { getDefaultAuthClient } from '../../src/auth/default-client';

export default function BillingRoute(): React.JSX.Element {
  const authClient = getDefaultAuthClient();
  const params = useLocalSearchParams<{ plan?: string; returnRoute?: string }>();
  const client = useMemo(() => createBillingApi(authClient), [authClient]);

  return (
    <SubscriptionScreen
      client={client}
      defaultPlanCode={params.plan}
      returnRoute={params.returnRoute}
    />
  );
}
