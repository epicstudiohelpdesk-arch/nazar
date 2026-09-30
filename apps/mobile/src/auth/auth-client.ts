import type {
  ApiResponse,
  RefreshTokenResponse,
  RefreshTokenPayload,
  SessionItemResponse,
  RevokeSessionResponse,
  LogoutResponse,
  DeviceItemResponse,
  RevokeDeviceResponse,
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

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = await this.storage.getRefreshToken();
      if (refreshToken) {
        await this.request('/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } finally {
      await this.storage.clearTokens();
    }
  }

  async logoutAll(): Promise<LogoutResponse> {
    const res = await this.request<LogoutResponse>('/v1/auth/logout-all', {
      method: 'POST',
    });
    if (!res.success) throw new Error(res.error?.message || 'Failed to revoke all sessions');
    return res.data;
  }

  async listSessions(): Promise<SessionItemResponse[]> {
    const res = await this.request<SessionItemResponse[]>('/v1/auth/sessions');
    if (!res.success) throw new Error(res.error?.message || 'Failed to list active sessions');
    return res.data;
  }

  async revokeSession(sessionId: string): Promise<RevokeSessionResponse> {
    const res = await this.request<RevokeSessionResponse>(`/v1/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    if (!res.success) throw new Error(res.error?.message || 'Failed to revoke session');
    return res.data;
  }

  async listDevices(): Promise<DeviceItemResponse[]> {
    const res = await this.request<DeviceItemResponse[]>('/v1/auth/devices');
    if (!res.success) throw new Error(res.error?.message || 'Failed to list registered devices');
    return res.data;
  }

  async revokeDevice(deviceId: string): Promise<RevokeDeviceResponse> {
    const res = await this.request<RevokeDeviceResponse>(`/v1/auth/devices/${deviceId}`, {
      method: 'DELETE',
    });
    if (!res.success) throw new Error(res.error?.message || 'Failed to revoke device');
    return res.data;
  }

  async deleteAccount(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.request<{ success: boolean; message: string }>('/v1/auth/account', {
        method: 'DELETE',
      });
      if (res.success) {
        return res.data;
      }
      throw new Error(res.error?.message || 'Failed to delete account');
    } finally {
      await this.storage.clearTokens();
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    let base = this.baseUrl.replace(/\/+$/, '');
    const path = endpoint.replace(/^\/+/, '');

    // Strip redundant /api/v1, /v1, or /api from base if endpoint already includes v1/
    if (base.endsWith('/api/v1')) {
      base = base.slice(0, -7);
    } else if (base.endsWith('/v1') && path.startsWith('v1/')) {
      base = base.slice(0, -3);
    } else if (base.endsWith('/api')) {
      base = base.slice(0, -4);
    }

    const url = endpoint.startsWith('http') ? endpoint : `${base}/${path}`;

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
