import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAuthProvider } from '../src/modules/auth/providers/firebase.provider.js';
import { AppConfigService } from '../src/config/app-config.service.js';

describe('FirebaseAuthProvider (Backend)', () => {
  let mockConfigService: AppConfigService;
  let provider: FirebaseAuthProvider;

  beforeEach(() => {
    mockConfigService = {
      firebaseProjectId: 'nazar-85664',
      firebaseServiceAccountPath:
        '/Users/subhamdas/Downloads/nazar-85664-firebase-adminsdk-fbsvc-f507fa6678.json',
    } as unknown as AppConfigService;

    provider = new FirebaseAuthProvider(mockConfigService);
  });

  it('rejects empty or non-string ID tokens with UnauthorizedException', async () => {
    await expect(provider.verifyIdToken('')).rejects.toThrow('Firebase ID token is required');
    await expect(provider.verifyIdToken(null as any)).rejects.toThrow(
      'Firebase ID token is required'
    );
  });

  it('rejects invalid or malformed Firebase ID tokens', async () => {
    await expect(provider.verifyIdToken('invalid.jwt.token')).rejects.toThrow(
      'Invalid or expired Firebase ID token'
    );
  });
});
