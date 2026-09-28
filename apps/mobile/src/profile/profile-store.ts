import { create } from 'zustand';
import type {
  PrivateProfileResponse,
  PreferencesResponse,
  InterestItem,
  ProfilePromptItem,
  MediaItemResponse,
} from '@platform/api-contracts';

export type MediaUploadPhase =
  'IDLE' | 'REQUESTING_URL' | 'UPLOADING' | 'COMPLETING' | 'SUCCESS' | 'ERROR';

export interface UploadProgressState {
  readonly phase: MediaUploadPhase;
  readonly progress: number; // 0 to 100
  readonly mediaId?: string;
  readonly error?: string;
}

export interface ProfileStoreState {
  profile: PrivateProfileResponse | null;
  preferences: PreferencesResponse | null;
  interests: InterestItem[];
  prompts: ProfilePromptItem[];
  media: MediaItemResponse[];
  uploadProgress: UploadProgressState;

  // Actions
  setProfile: (profile: PrivateProfileResponse | null) => void;
  setPreferences: (preferences: PreferencesResponse | null) => void;
  setInterests: (interests: InterestItem[]) => void;
  setPrompts: (prompts: ProfilePromptItem[]) => void;
  setMedia: (media: MediaItemResponse[]) => void;
  setUploadProgress: (progress: Partial<UploadProgressState>) => void;
  resetUploadProgress: () => void;
  resetAll: () => void;
}

const initialUploadProgress: UploadProgressState = {
  phase: 'IDLE',
  progress: 0,
};

export const useProfileStore = create<ProfileStoreState>((set) => ({
  profile: null,
  preferences: null,
  interests: [],
  prompts: [],
  media: [],
  uploadProgress: initialUploadProgress,

  setProfile: (profile) => set({ profile }),
  setPreferences: (preferences) => set({ preferences }),
  setInterests: (interests) => set({ interests }),
  setPrompts: (prompts) => set({ prompts }),
  setMedia: (media) => set({ media }),
  setUploadProgress: (progress) =>
    set((state) => ({
      uploadProgress: { ...state.uploadProgress, ...progress },
    })),
  resetUploadProgress: () => set({ uploadProgress: initialUploadProgress }),
  resetAll: () =>
    set({
      profile: null,
      preferences: null,
      interests: [],
      prompts: [],
      media: [],
      uploadProgress: initialUploadProgress,
    }),
}));
