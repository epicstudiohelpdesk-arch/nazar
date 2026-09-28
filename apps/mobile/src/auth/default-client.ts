import { AuthClient } from './auth-client.js';
import { InMemoryTokenStorage } from './token-storage.js';

let defaultClient: AuthClient | null = null;

export function getDefaultAuthClient(): AuthClient {
  if (!defaultClient) {
    const baseUrl =
      (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
      'http://localhost:3000';

    defaultClient = new AuthClient({
      baseUrl,
      storage: new InMemoryTokenStorage(),
    });
  }
  return defaultClient;
}
