import type React from 'react';
import { useMemo } from 'react';
import { NotificationsScreen } from '../../src/notifications/NotificationsScreen';
import { NotificationsApiClient } from '../../src/notifications/notifications-api';
import { getDefaultAuthClient } from '../../src/auth/default-client';

export default function NotificationsRoute(): React.JSX.Element {
  const authClient = getDefaultAuthClient();

  const client = useMemo(
    () =>
      new NotificationsApiClient({
        baseUrl: authClient.getBaseUrl(),
        getAccessToken: async () => authClient.getStorage().getAccessToken(),
      }),
    [authClient]
  );

  return <NotificationsScreen client={client} />;
}
