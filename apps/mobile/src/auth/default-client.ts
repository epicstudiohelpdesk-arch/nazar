import { AuthClient } from './auth-client.js';
import { InMemoryTokenStorage } from './token-storage.js';

import { getMobileConfig } from '../config/mobile-config';

let defaultClient: AuthClient | null = null;

export function getDefaultAuthClient(): AuthClient {
  if (!defaultClient) {
    const config = getMobileConfig();

    defaultClient = new AuthClient({
      baseUrl: config.EXPO_PUBLIC_API_URL,
      storage: new InMemoryTokenStorage(),
    });
  }
  return defaultClient;
}
