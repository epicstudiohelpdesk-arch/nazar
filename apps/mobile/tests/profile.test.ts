import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProfileStore } from '../src/profile/profile-store.js';
import { createProfileApi } from '../src/profile/profile-api.js';
import { AuthClient } from '../src/auth/auth-client.js';
import { InMemoryTokenStorage } from '../src/auth/token-storage.js';
import type {
  PrivateProfileResponse,
  PreferencesResponse,
  MediaItemResponse,
} from '@platform/api-contracts';

describe('Mobile Profile Layer: Store, State Machine & API Client', () => {
  let authClient: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockProfile: PrivateProfileResponse = {
    id: '018f0000-0000-7000-8000-000000000001',
    userId: '018f0000-0000-7000-8000-000000000002',
    displayName: 'Priya',
    dateOfBirth: '1998-05-20',
    age: 28,
    gender: 'WOMAN',
    bio: 'Explorer and book lover',
    visibility: 'DRAFT',
    completionStatus: {
      percentage: 60,
      missingRequired: ['At least 1 photo required', 'Dating preferences required'],
      recommended: ['Bio recommended'],
    },
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
  };

  const mockPreferences: PreferencesResponse = {
    id: '018f0000-0000-7000-8000-000000000003',
    userId: '018f0000-0000-7000-8000-000000000002',
    minAge: 24,
    maxAge: 32,
    genderPreferences: ['MAN'],
    maxDistanceKm: 40,
    relationshipIntent: 'LONG_TERM',
  };

  beforeEach(() => {
    useProfileStore.getState().resetAll();

    mockFetch = vi.fn();
    authClient = new AuthClient({
      baseUrl: 'https://api.test.platform.com',
      storage: new InMemoryTokenStorage('test_token'),
      fetchFn: mockFetch as unknown as typeof fetch,
    });
  });

  it('manages profile, preferences, and media state in Zustand store', () => {
    const store = useProfileStore.getState();

    expect(store.profile).toBeNull();
    expect(store.preferences).toBeNull();
    expect(store.media).toEqual([]);

    store.setProfile(mockProfile);
    expect(useProfileStore.getState().profile?.displayName).toBe('Priya');
    expect(useProfileStore.getState().profile?.age).toBe(28);

    store.setPreferences(mockPreferences);
    expect(useProfileStore.getState().preferences?.minAge).toBe(24);
    expect(useProfileStore.getState().preferences?.maxDistanceKm).toBe(40);

    const mockMedia: MediaItemResponse = {
      id: '018f0000-0000-7000-8000-000000000004',
      url: 'https://cdn.platform.com/media/photo.jpg',
      mediaType: 'IMAGE',
      mimeType: 'image/jpeg',
      status: 'READY',
      position: 0,
      isPrimary: true,
      createdAt: '2026-09-28T00:00:00.000Z',
    };

    store.setMedia([mockMedia]);
    expect(useProfileStore.getState().media.length).toBe(1);
    expect(useProfileStore.getState().media[0]?.isPrimary).toBe(true);
  });

  it('tracks media upload workflow through distinct lifecycle phases', () => {
    const store = useProfileStore.getState();

    expect(store.uploadProgress.phase).toBe('IDLE');
    expect(store.uploadProgress.progress).toBe(0);

    store.setUploadProgress({ phase: 'REQUESTING_URL', progress: 10 });
    expect(useProfileStore.getState().uploadProgress.phase).toBe('REQUESTING_URL');

    store.setUploadProgress({
      phase: 'UPLOADING',
      progress: 50,
      mediaId: 'media_123',
    });
    expect(useProfileStore.getState().uploadProgress.phase).toBe('UPLOADING');
    expect(useProfileStore.getState().uploadProgress.progress).toBe(50);
    expect(useProfileStore.getState().uploadProgress.mediaId).toBe('media_123');

    store.setUploadProgress({ phase: 'SUCCESS', progress: 100 });
    expect(useProfileStore.getState().uploadProgress.phase).toBe('SUCCESS');

    store.resetUploadProgress();
    expect(useProfileStore.getState().uploadProgress.phase).toBe('IDLE');
  });

  it('executes full uploadPhotoWorkflow coordinating signed URL, S3 PUT, and complete endpoint', async () => {
    const api = createProfileApi(authClient, mockFetch as unknown as typeof fetch);

    // Mock requestUploadUrl response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: {
          mediaId: 'media_abc',
          uploadUrl: 'https://s3.amazonaws.com/bucket/key?signed=true',
          storageKey: 'profiles/uid/media_abc.jpg',
          expiresAt: '2026-09-28T01:00:00.000Z',
        },
      }),
    });

    // Mock direct S3 PUT response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    // Mock completeUpload response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: {
          id: 'media_abc',
          url: 'https://cdn.platform.com/profiles/uid/media_abc.jpg',
          mediaType: 'IMAGE',
          mimeType: 'image/jpeg',
          status: 'READY',
          position: 0,
          isPrimary: true,
          createdAt: '2026-09-28T00:00:00.000Z',
        },
      }),
    });

    const fakeBlob = new Blob(['fake image content'], { type: 'image/jpeg' });
    const result = await api.uploadPhotoWorkflow(fakeBlob, 'image/jpeg');

    expect(result.id).toBe('media_abc');
    expect(result.status).toBe('READY');
    expect(result.isPrimary).toBe(true);
    expect(useProfileStore.getState().uploadProgress.phase).toBe('SUCCESS');
    expect(useProfileStore.getState().uploadProgress.progress).toBe(100);
  });
});
