import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  checkPasskeyAvailability,
  promptPasskeyLogin,
  promptPasskeySignUp,
  promptPasskeyRegistration,
} from '../src/auth/passkey-auth.js';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_REVERSED_CLIENT_ID,
  promptGoogleSignIn,
} from '../src/auth/google-auth.js';
import { AuthService } from '../src/auth/auth-service.js';
import { AuthClient } from '../src/auth/auth-client.js';
import {
  InMemoryTokenStorage,
  SecureTokenStorage,
  type ISecureStoreAdapter,
} from '../src/auth/token-storage.js';

describe('Google & Passkey Authentication Suite', () => {
  let storage: InMemoryTokenStorage;
  let authClient: AuthClient;
  let authService: AuthService;

  beforeEach(() => {
    storage = new InMemoryTokenStorage();
    authClient = new AuthClient({
      baseUrl: 'https://api.nazar.app',
      storage,
    });
    authService = new AuthService(authClient);
  });

  describe('Google OAuth Configuration', () => {
    it('contains valid iOS and Web Google Client IDs', () => {
      expect(GOOGLE_IOS_CLIENT_ID).toContain('.apps.googleusercontent.com');
      expect(GOOGLE_WEB_CLIENT_ID).toContain('.apps.googleusercontent.com');
      expect(GOOGLE_REVERSED_CLIENT_ID).toBe(
        `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.split('.apps.googleusercontent.com')[0]}`
      );
    });

    it('promptGoogleSignIn returns cancelled when user dismisses the browser', async () => {
      // In the mock AuthSession, promptAsync returns { type: 'cancel' } by default
      const result = await promptGoogleSignIn();
      expect(result.cancelled).toBe(true);
      expect(result.success).toBe(false);
    });
  });

  describe('Passkey & Biometric Capabilities', () => {
    it('detects hardware and maps Face ID correctly', async () => {
      const avail = await checkPasskeyAvailability();
      expect(avail.hasHardware).toBe(true);
      expect(avail.isEnrolled).toBe(true);
      expect(avail.label).toBe('Face ID');
      expect(avail.biometryType).toBe('FACE_ID');
    });

    it('handles devices without biometric hardware gracefully', async () => {
      const spy = vi.spyOn(LocalAuthentication, 'hasHardwareAsync').mockResolvedValueOnce(false);
      const avail = await checkPasskeyAvailability();
      expect(avail.hasHardware).toBe(false);
      expect(avail.label).toBe('Passkey');
      spy.mockRestore();
    });
  });

  describe('Passkey Credential Storage', () => {
    it('persists and clears passkey credential ID in InMemoryTokenStorage', async () => {
      expect(await storage.getPasskeyCredentialId()).toBeNull();
      await storage.setPasskeyCredentialId('pk_credential_999');
      expect(await storage.getPasskeyCredentialId()).toBe('pk_credential_999');
      await storage.clearPasskeyCredentialId();
      expect(await storage.getPasskeyCredentialId()).toBeNull();
    });

    it('persists passkey credential ID in SecureTokenStorage via adapter', async () => {
      const store = new Map<string, string>();
      const mockAdapter: ISecureStoreAdapter = {
        getItemAsync: vi.fn(async (key) => store.get(key) ?? null),
        setItemAsync: vi.fn(async (key, val) => {
          store.set(key, val);
        }),
        deleteItemAsync: vi.fn(async (key) => {
          store.delete(key);
        }),
      };

      const secureStore = new SecureTokenStorage(mockAdapter);
      await secureStore.setPasskeyCredentialId('pk_secure_123');
      expect(mockAdapter.setItemAsync).toHaveBeenCalledWith(
        'nazar_auth_passkey_credential_id',
        'pk_secure_123'
      );
      expect(await secureStore.getPasskeyCredentialId()).toBe('pk_secure_123');

      await secureStore.clearPasskeyCredentialId();
      expect(mockAdapter.deleteItemAsync).toHaveBeenCalledWith('nazar_auth_passkey_credential_id');
      expect(await secureStore.getPasskeyCredentialId()).toBeNull();
    });
  });

  describe('AuthService Passkey Endpoints', () => {
    it('calls passkey login options endpoint and returns challenge', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url.includes('/v1/auth/passkey/login/options')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                challenge: 'test-challenge-123',
                rpId: 'nazar.app',
                timeout: 60000,
                userVerification: 'preferred',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ success: false }), { status: 400 });
      });

      const customClient = new AuthClient({
        baseUrl: 'https://api.nazar.app',
        storage,
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      const customService = new AuthService(customClient);

      const res = await customService.getPasskeyLoginOptions('+919876543210');
      expect(res.success).toBe(true);
      expect(res.data?.challenge).toBe('test-challenge-123');
      expect(res.data?.rpId).toBe('nazar.app');
    });

    it('calls passkey register options and verify endpoints', async () => {
      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/v1/auth/passkey/register/options')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                challenge: 'reg-challenge-abc',
                rp: { id: 'nazar.app', name: 'Nazar' },
                user: { id: 'usr_1', name: 'Subham', displayName: 'Subham' },
                pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                timeout: 60000,
                authenticatorSelection: { residentKey: 'preferred' },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/v1/auth/passkey/register/verify')) {
          const body = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              success: true,
              data: { credentialId: body.credentialId },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ success: false }), { status: 400 });
      });

      const customClient = new AuthClient({
        baseUrl: 'https://api.nazar.app',
        storage,
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      const customService = new AuthService(customClient);

      const optRes = await customService.getPasskeyRegisterOptions();
      expect(optRes.success).toBe(true);
      expect(optRes.data?.challenge).toBe('reg-challenge-abc');

      const verifyRes = await customService.verifyPasskeyRegistration({
        challenge: 'reg-challenge-abc',
        credentialId: 'cred_new_99',
        publicKey: 'pubkey_sample',
      });
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.data?.credentialId).toBe('cred_new_99');
    });
  });

  describe('Passkey Flows (promptPasskeyLogin & promptPasskeyRegistration)', () => {
    it('prompts passkey registration and establishes credential', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url.includes('/v1/auth/passkey/register/options')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                challenge: 'test-challenge',
                rp: { id: 'nazar.app', name: 'Nazar' },
                user: { id: 'usr_1', name: 'Subham', displayName: 'Subham' },
                pubKeyCredParams: [],
                timeout: 60000,
                authenticatorSelection: {},
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/v1/auth/passkey/register/verify')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { credentialId: 'nazar_pk_usr12345_cred' },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ success: false }), { status: 400 });
      });

      const client = new AuthClient({
        baseUrl: 'https://api.nazar.app',
        storage,
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      const service = new AuthService(client);

      const res = await promptPasskeyRegistration('usr_test_user_id', {
        services: { authService: service, authClient: client },
      });
      expect(res.success).toBe(true);
      expect(res.credentialId).toBeDefined();
    });

    it('returns cancelled when user cancels biometric prompt', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              challenge: 'test-challenge',
              rp: { id: 'nazar.app', name: 'Nazar' },
              user: { id: 'usr_1', name: 'Subham', displayName: 'Subham' },
              pubKeyCredParams: [],
              timeout: 60000,
              authenticatorSelection: {},
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new AuthClient({
        baseUrl: 'https://api.nazar.app',
        storage,
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      const service = new AuthService(client);

      const authSpy = vi
        .spyOn(LocalAuthentication, 'authenticateAsync')
        .mockResolvedValueOnce({ success: false, error: 'user_cancel' });

      const res = await promptPasskeyRegistration('usr_test_user_id', {
        services: { authService: service, authClient: client },
      });
      expect(res.success).toBe(false);
      expect(res.cancelled).toBe(true);

      authSpy.mockRestore();
    });

    it('prompts passkey sign up and establishes new user session', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url.includes('/v1/auth/passkey/register/options')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                challenge: 'test-reg-challenge',
                rp: { id: 'nazar.app', name: 'Nazar' },
                user: { id: 'usr_new', name: 'New User', displayName: 'New User' },
                pubKeyCredParams: [],
                timeout: 60000,
                authenticatorSelection: {},
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/v1/auth/passkey/register/verify')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { credentialId: 'nazar_pk_new_cred' },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ success: false }), { status: 400 });
      });

      const client = new AuthClient({
        baseUrl: 'https://api.nazar.app',
        storage,
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      const service = new AuthService(client);

      const res = await promptPasskeySignUp('+919876543210', {
        services: { authService: service, authClient: client },
      });
      expect(res.success).toBe(true);
      expect(res.isNewUser).toBe(true);
      expect(res.credentialId).toBeDefined();
    });
  });

  describe('Identifier Existence Checking (Anti-Enumeration Guarded)', () => {
    it('returns exists: true when backend confirms identifier is registered', async () => {
      const mockFetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/v1/auth/check-identifier')) {
          const body = JSON.parse(init?.body as string);
          expect(body.identifier).toBe('+919876543210');
          expect(body.type).toBe('PHONE');
          return new Response(
            JSON.stringify({
              success: true,
              data: { exists: true, provider: 'PHONE' },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        return new Response(JSON.stringify({ success: false }), { status: 404 });
      });

      const client = new AuthClient({
        baseUrl: 'https://api.nazar.app',
        storage,
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      const service = new AuthService(client);

      const res = await service.checkIdentifier('+919876543210', 'PHONE');
      expect(res.success).toBe(true);
      expect(res.data?.exists).toBe(true);
      expect(res.data?.provider).toBe('PHONE');
    });

    it('returns exists: false when identifier is not registered', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            data: { exists: false },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const client = new AuthClient({
        baseUrl: 'https://api.nazar.app',
        storage,
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      const service = new AuthService(client);

      const res = await service.checkIdentifier('+919111111111', 'PHONE');
      expect(res.success).toBe(true);
      expect(res.data?.exists).toBe(false);
    });

    it('falls back gracefully in development when backend is offline', async () => {
      const mockFetch = vi.fn(async () => {
        throw new Error('Network error');
      });

      const client = new AuthClient({
        baseUrl: 'https://api.nazar.app',
        storage,
        fetchFn: mockFetch as unknown as typeof fetch,
      });
      const service = new AuthService(client);

      const res = await service.checkIdentifier('+919876543210', 'PHONE');
      expect(res.success).toBe(true);
      expect(res.data?.exists).toBe(false);
    });
  });

  describe('LegalConsentModal (Top Sheet Governance)', () => {
    it('exports LegalConsentModal component from auth package', async () => {
      const authModule = await import('../src/auth/index.js');
      expect(authModule.LegalConsentModal).toBeDefined();
      expect(typeof authModule.LegalConsentModal).toBe('function');
    });
  });
});
