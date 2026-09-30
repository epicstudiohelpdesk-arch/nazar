import type {
  PrivateProfileResponse,
  UpdateProfilePayload,
  PreferencesResponse,
  UpdatePreferencesPayload,
  InterestItem,
  UpdateInterestsPayload,
  PromptDefinitionItem,
  ProfilePromptItem,
  UpdatePromptsPayload,
  MediaItemResponse,
  MediaUploadResponse,
  MediaUploadRequestPayload,
  ReorderMediaPayload,
  ProfileStateChangeResponse,
  PublicProfileResponse,
} from '@platform/api-contracts';
import type { AuthClient } from '../auth/auth-client.js';
import { getDefaultAuthClient } from '../auth/default-client.js';
import { useProfileStore } from './profile-store.js';

let defaultProfileApi: ProfileApiClient | null = null;

export function getDefaultProfileApi(): ProfileApiClient {
  if (!defaultProfileApi) {
    defaultProfileApi = createProfileApi(getDefaultAuthClient());
  }
  return defaultProfileApi;
}

export const PROFILE_QUERY_KEYS = {
  me: ['profile', 'me'] as const,
  preferences: ['profile', 'preferences'] as const,
  interestsTaxonomy: ['interests', 'taxonomy'] as const,
  myInterests: ['profile', 'interests'] as const,
  promptsTaxonomy: ['prompts', 'taxonomy'] as const,
  myPrompts: ['profile', 'prompts'] as const,
  media: ['profile', 'media'] as const,
};

export function createProfileApi(authClient: AuthClient, customFetch?: typeof fetch) {
  const fetchFn = customFetch ?? globalThis.fetch.bind(globalThis);
  return {
    // ----------------------------------------------------
    // Profile
    // ----------------------------------------------------
    async getMyProfile(): Promise<PrivateProfileResponse> {
      const res = await authClient.request<PrivateProfileResponse>('/v1/profiles/me');
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async getPublicProfile(profileId: string): Promise<PublicProfileResponse> {
      const res = await authClient.request<PublicProfileResponse>(`/v1/profiles/${profileId}`);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async updateMyProfile(payload: UpdateProfilePayload): Promise<PrivateProfileResponse> {
      const res = await authClient.request<PrivateProfileResponse>('/v1/profiles/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async activateProfile(): Promise<ProfileStateChangeResponse> {
      const res = await authClient.request<ProfileStateChangeResponse>('/v1/profiles/me/activate', {
        method: 'POST',
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async pauseProfile(): Promise<ProfileStateChangeResponse> {
      const res = await authClient.request<ProfileStateChangeResponse>('/v1/profiles/me/pause', {
        method: 'POST',
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async hideProfile(): Promise<ProfileStateChangeResponse> {
      const res = await authClient.request<ProfileStateChangeResponse>('/v1/profiles/me/hide', {
        method: 'POST',
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    // ----------------------------------------------------
    // Preferences
    // ----------------------------------------------------
    async getPreferences(): Promise<PreferencesResponse> {
      const res = await authClient.request<PreferencesResponse>('/v1/profiles/me/preferences');
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async updatePreferences(payload: UpdatePreferencesPayload): Promise<PreferencesResponse> {
      const res = await authClient.request<PreferencesResponse>('/v1/profiles/me/preferences', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    // ----------------------------------------------------
    // Interests
    // ----------------------------------------------------
    async getInterestsTaxonomy(): Promise<InterestItem[]> {
      const res = await authClient.request<InterestItem[]>('/v1/interests');
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async getMyInterests(): Promise<InterestItem[]> {
      const res = await authClient.request<InterestItem[]>('/v1/profiles/me/interests');
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async updateMyInterests(payload: UpdateInterestsPayload): Promise<InterestItem[]> {
      const res = await authClient.request<InterestItem[]>('/v1/profiles/me/interests', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    // ----------------------------------------------------
    // Prompts
    // ----------------------------------------------------
    async getPromptsTaxonomy(): Promise<PromptDefinitionItem[]> {
      const res = await authClient.request<PromptDefinitionItem[]>('/v1/prompts');
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async getMyPrompts(): Promise<ProfilePromptItem[]> {
      const res = await authClient.request<ProfilePromptItem[]>('/v1/profiles/me/prompts');
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async updateMyPrompts(payload: UpdatePromptsPayload): Promise<ProfilePromptItem[]> {
      const res = await authClient.request<ProfilePromptItem[]>('/v1/profiles/me/prompts', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    // ----------------------------------------------------
    // Media
    // ----------------------------------------------------
    async getMediaList(): Promise<MediaItemResponse[]> {
      const res = await authClient.request<MediaItemResponse[]>('/v1/profiles/me/media');
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async requestUploadUrl(payload: MediaUploadRequestPayload): Promise<MediaUploadResponse> {
      const res = await authClient.request<MediaUploadResponse>(
        '/v1/profiles/me/media/upload-url',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async completeUpload(mediaId: string): Promise<MediaItemResponse> {
      const res = await authClient.request<MediaItemResponse>(
        `/v1/profiles/me/media/${mediaId}/complete`,
        {
          method: 'POST',
        }
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async setPrimaryPhoto(mediaId: string): Promise<MediaItemResponse[]> {
      const res = await authClient.request<MediaItemResponse[]>(
        `/v1/profiles/me/media/${mediaId}/primary`,
        {
          method: 'POST',
        }
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async reorderMedia(payload: ReorderMediaPayload): Promise<MediaItemResponse[]> {
      const res = await authClient.request<MediaItemResponse[]>('/v1/profiles/me/media/reorder', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },

    async deleteMedia(mediaId: string): Promise<void> {
      const res = await authClient.request<{ message: string }>(
        `/v1/profiles/me/media/${mediaId}`,
        {
          method: 'DELETE',
        }
      );
      if (!res.success) throw new Error(res.error.message);
    },

    async uploadPhotoWorkflow(fileBlob: Blob, mimeType: string): Promise<MediaItemResponse> {
      const store = useProfileStore.getState();
      try {
        // Phase 1: Request signed URL
        store.setUploadProgress({ phase: 'REQUESTING_URL', progress: 10 });
        const uploadInfo = await this.requestUploadUrl({
          mimeType,
          sizeBytes: fileBlob.size,
        });

        // Phase 2: Direct S3 Binary Upload
        store.setUploadProgress({
          phase: 'UPLOADING',
          progress: 40,
          mediaId: uploadInfo.mediaId,
        });

        const uploadRes = await fetchFn(uploadInfo.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType },
          body: fileBlob,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload to storage failed with status ${uploadRes.status}`);
        }

        // Phase 3: Complete upload on backend
        store.setUploadProgress({ phase: 'COMPLETING', progress: 85 });
        const readyMedia = await this.completeUpload(uploadInfo.mediaId);

        store.setUploadProgress({ phase: 'SUCCESS', progress: 100 });
        return readyMedia;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        store.setUploadProgress({ phase: 'ERROR', error: errorMsg });
        throw err;
      }
    },
  };
}

export type ProfileApiClient = ReturnType<typeof createProfileApi>;
