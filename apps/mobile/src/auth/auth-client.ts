import type {
  ApiResponse,
  RefreshTokenResponse,
  RefreshTokenPayload,
} from '@platform/api-contracts';
import type { ITokenStorage } from './token-storage.js';

export interface AuthClientConfig {
  baseUrl: string;
  storage: ITokenStorage;
  onSessionExpired?: () => void;
  fetchFn?: typeof fetch;
}

export class AuthClient {
  private readonly baseUrl: string;
  private readonly storage: ITokenStorage;
  private readonly onSessionExpired?: () => void;
  private readonly fetch: typeof fetch;

  // Single-flight refresh promise to serialize concurrent 401 retries
  private refreshPromise: Promise<string | null> | null = null;

  constructor(config: AuthClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.storage = config.storage;
    this.onSessionExpired = config.onSessionExpired;
    this.fetch = config.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  getStorage(): ITokenStorage {
    return this.storage;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const accessToken = await this.storage.getAccessToken();
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    let response = await this.fetch(url, {
      ...options,
      headers,
    });

    // Check for 401 Unauthorized - attempt single-flight refresh
    if (
      response.status === 401 &&
      !endpoint.includes('/auth/refresh') &&
      !endpoint.includes('/auth/otp/verify')
    ) {
      const newAccessToken = await this.executeSingleFlightRefresh();

      if (newAccessToken) {
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);
        if (!retryHeaders.has('Content-Type') && options.body && typeof options.body === 'string') {
          retryHeaders.set('Content-Type', 'application/json');
        }

        response = await this.fetch(url, {
          ...options,
          headers: retryHeaders,
        });
      }
    }

    const json = (await response.json()) as ApiResponse<T>;
    return json;
  }

  /**
   * Ensures that even if multiple requests fail with 401 simultaneously,
   * only ONE refresh API call is dispatched across the application.
   */
  async executeSingleFlightRefresh(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await this.storage.getRefreshToken();
        if (!refreshToken) {
          await this.handleSessionExpired();
          return null;
        }

        const payload: RefreshTokenPayload = {
          refreshToken,
        };

        const res = await this.fetch(`${this.baseUrl}/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          await this.handleSessionExpired();
          return null;
        }

        const data = (await res.json()) as ApiResponse<RefreshTokenResponse>;
        if (!data.success || !data.data) {
          await this.handleSessionExpired();
          return null;
        }

        await this.storage.setAccessToken(data.data.accessToken);
        await this.storage.setRefreshToken(data.data.refreshToken);

        return data.data.accessToken;
      } catch {
        await this.handleSessionExpired();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async handleSessionExpired(): Promise<void> {
    await this.storage.clearTokens();
    if (this.onSessionExpired) {
      this.onSessionExpired();
    }
  }
}
