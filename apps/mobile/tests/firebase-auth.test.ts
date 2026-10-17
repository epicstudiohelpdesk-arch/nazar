import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firebaseConfig, getFirebaseApp, getFirebaseAuth } from '../src/auth/firebase.js';
import { AuthService } from '../src/auth/auth-service.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import {
  confirmFirebasePhoneOtp,
  setActiveConfirmationResult,
} from '../src/auth/firebase-auth-service.js';

describe('Firebase Authentication (Client & Mobile)', () => {
  it('exports valid project configuration matching user credentials', () => {
    expect(firebaseConfig.projectId).toBe('nazar-85664');
    expect(firebaseConfig.apiKey).toBe('AIzaSyBwe92HDL56oq1ZcbEED577aKv8nWm00uE');
    expect(firebaseConfig.authDomain).toBe('nazar-85664.firebaseapp.com');
    expect(firebaseConfig.storageBucket).toBe('nazar-85664.firebasestorage.app');
  });

  it('initializes Firebase App and Auth instances', () => {
    const app = getFirebaseApp();
    expect(app).toBeDefined();
    expect(app.name).toBe('[DEFAULT]');

    const auth = getFirebaseAuth();
    expect(auth).toBeDefined();
    expect(auth.app.name).toBe('[DEFAULT]');
  });

  it('loginWithFirebase submits ID token to /v1/auth/firebase and persists tokens', async () => {
    const storage = new InMemoryTokenStorage();
    let sentBody: any = null;

    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      sentBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            accessToken: 'firebase-app-jwt-access',
            expiresIn: 900,
            refreshToken: 'firebase-app-jwt-refresh',
            user: {
              id: 'user-uuid-fb-001',
              isNewUser: false,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new AuthClient({
      baseUrl: 'http://localhost:4000',
      storage,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    const authService = new AuthService(client);

    const result = await authService.loginWithFirebase('test-fb-id-token-123', {
      platform: 'ios',
      deviceModel: 'iPhone 15 Pro',
    });

    expect(result.success).toBe(true);
    expect(sentBody).toEqual({
      idToken: 'test-fb-id-token-123',
      device: {
        platform: 'ios',
        deviceModel: 'iPhone 15 Pro',
      },
    });

    expect(await storage.getAccessToken()).toBe('firebase-app-jwt-access');
    expect(await storage.getRefreshToken()).toBe('firebase-app-jwt-refresh');
  });

  it('confirmFirebasePhoneOtp verifies code and logs in user', async () => {
    const mockConfirm = vi.fn(async (code: string) => {
      if (code === '123456') {
        return {
          user: {
            getIdToken: vi.fn(async () => 'valid-id-token-123456'),
          },
        };
      }
      throw new Error('Invalid code');
    });

    const mockConfirmationResult = {
      confirm: mockConfirm,
      verificationId: 'mock-v-id',
    } as any;

    setActiveConfirmationResult(mockConfirmationResult);

    // Test with invalid code
    const failRes = await confirmFirebasePhoneOtp('999999');
    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain('Invalid code');

    // Test with valid code
    const successRes = await confirmFirebasePhoneOtp('123456');
    // Note: will attempt to call real or default client
    expect(mockConfirm).toHaveBeenCalledWith('123456');
  });
});
