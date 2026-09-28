import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AuthClient,
  InMemoryTokenStorage,
  SecureTokenStorage,
  type ISecureStoreAdapter,
} from '../src/index.js';

describe('Mobile Auth Client & Token Storage', () => {
  let storage: InMemoryTokenStorage;

  beforeEach(() => {
    storage = new InMemoryTokenStorage();
  });

  it('stores and retrieves access and refresh tokens in memory', async () => {
    await storage.setAccessToken('access-123');
    await storage.setRefreshToken('refresh-456');
    await storage.setDeviceId('device-789');

    expect(await storage.getAccessToken()).toBe('access-123');
    expect(await storage.getRefreshToken()).toBe('refresh-456');
    expect(await storage.getDeviceId()).toBe('device-789');

    await storage.clearTokens();
    expect(await storage.getAccessToken()).toBeNull();
    expect(await storage.getRefreshToken()).toBeNull();
  });

  it('delegates to secure store adapter in SecureTokenStorage', async () => {
    const store = new Map<string, string>();
    const mockSecureStore: ISecureStoreAdapter = {
      getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
      setItemAsync: vi.fn(async (key: string, val: string) => {
        store.set(key, val);
      }),
      deleteItemAsync: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    };

    const secureStorage = new SecureTokenStorage(mockSecureStore);
    await secureStorage.setAccessToken('sec-token-1');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalled();
    expect(await secureStorage.getAccessToken()).toBe('sec-token-1');

    await secureStorage.clearTokens();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(await secureStorage.getAccessToken()).toBeNull();
  });

  it('attaches Bearer token to authenticated requests', async () => {
    await storage.setAccessToken('my-jwt-token');

    let passedHeaders: Headers | undefined;
    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      passedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ success: true, data: { status: 'ok' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new AuthClient({
      baseUrl: 'https://api.nazar.app',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await client.request<{ status: string }>('/v1/me');
    expect(result.success).toBe(true);
    expect(passedHeaders?.get('Authorization')).toBe('Bearer my-jwt-token');
  });

  it('performs single-flight refresh when 401 occurs and replays request', async () => {
    await storage.setAccessToken('expired-access-token');
    await storage.setRefreshToken('valid-refresh-token');

    let refreshCalls = 0;
    let originalRequestCalls = 0;

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);

      if (url.includes('/v1/auth/refresh')) {
        refreshCalls++;
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: 'fresh-access-token',
              refreshToken: 'fresh-refresh-token',
              expiresIn: 900,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      originalRequestCalls++;
      if (headers.get('Authorization') === 'Bearer expired-access-token') {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Token expired' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true, data: { profile: 'test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new AuthClient({
      baseUrl: 'https://api.nazar.app',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    // Fire 3 concurrent requests simultaneously while token is expired
    const [res1, res2, res3] = await Promise.all([
      client.request('/v1/data1'),
      client.request('/v1/data2'),
      client.request('/v1/data3'),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res3.success).toBe(true);

    // Exactly ONE refresh request should have been made due to single-flight mutex!
    expect(refreshCalls).toBe(1);

    // Tokens in storage must be updated
    expect(await storage.getAccessToken()).toBe('fresh-access-token');
    expect(await storage.getRefreshToken()).toBe('fresh-refresh-token');
  });

  it('clears storage and triggers onSessionExpired when refresh returns 401', async () => {
    await storage.setAccessToken('expired-access-token');
    await storage.setRefreshToken('revoked-refresh-token');

    const sessionExpiredMock = vi.fn();

    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('/v1/auth/refresh')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'TOKEN_REPLAY_DETECTED', message: 'Token revoked' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new AuthClient({
      baseUrl: 'https://api.nazar.app',
      storage,
      onSessionExpired: sessionExpiredMock,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.request('/v1/profile');
    expect(res.success).toBe(false);
    expect(sessionExpiredMock).toHaveBeenCalledTimes(1);
    expect(await storage.getAccessToken()).toBeNull();
    expect(await storage.getRefreshToken()).toBeNull();
  });
});
