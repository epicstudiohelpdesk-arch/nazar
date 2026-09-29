import type React from 'react';
import { useMemo } from 'react';
import { NotificationsScreen } from '../../src/notifications/NotificationsScreen.js';
import { NotificationsApiClient } from '../../src/notifications/notifications-api.js';
import { getDefaultAuthClient } from '../../src/auth/default-client.js';

export default function NotificationsRoute(): React.JSX.Element {
  const authClient = getDefaultAuthClient();

  const client = useMemo(
    () =>
      new NotificationsApiClient({
        baseUrl:
          (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
          'http://localhost:3000',
        getAccessToken: async () => authClient.getStorage().getAccessToken(),
      }),
    [authClient]
  );

  return <NotificationsScreen client={client} />;
}
