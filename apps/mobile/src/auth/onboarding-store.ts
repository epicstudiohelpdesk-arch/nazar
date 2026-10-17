import { create } from 'zustand';
import type {
  Gender,
  RelationshipIntent,
  PrivateProfileResponse,
  MediaStatus,
} from '@platform/api-contracts';

export type OnboardingStep =
  | 'intro'
  | 'profile-setup'
  | 'photos'
  | 'interests'
  | 'prompts'
  | 'preferences'
  | 'permissions'
  | 'preview';

export const ONBOARDING_STEPS_ORDER: readonly OnboardingStep[] = [
  'intro',
  'profile-setup',
  'photos',
  'interests',
  'prompts',
  'preferences',
  'permissions',
  'preview',
] as const;

export function getStepProgress(step: OnboardingStep): number {
  const index = ONBOARDING_STEPS_ORDER.indexOf(step);
  if (index === -1) return 0;
  return Number(((index + 1) / ONBOARDING_STEPS_ORDER.length).toFixed(2));
}

/**
 * Computes the exact onboarding resume step based on authoritative backend profile data.
 */
export function determineNextStepFromProfile(
  profile: PrivateProfileResponse | null
): OnboardingStep {
  if (!profile) {
    return 'intro';
  }

  // 1. Basic profile details
  if (!profile.displayName || !profile.dateOfBirth || !profile.gender) {
    return 'profile-setup';
  }

  // 2. Photos (at least 2 photos required)
  const readyPhotos = (profile.media || []).filter(
    (m) => m.status === 'READY' || m.status === 'PROCESSING'
  );
  if (readyPhotos.length < 2) {
    return 'photos';
  }

  // 3. Interests (at least 3 required)
  if (!profile.interests || profile.interests.length < 3) {
    return 'interests';
  }

  // 4. Prompts (at least 1 required)
  if (!profile.prompts || profile.prompts.length < 1) {
    return 'prompts';
  }

  // 5. Preferences
  if (!profile.preferences) {
    return 'preferences';
  }

  // All core profile requirements met -> preview
  return 'preview';
}

export interface DraftPhotoItem {
  id: string;
  url: string;
  isPrimary: boolean;
  status: MediaStatus;
}

export interface DraftPromptItem {
  promptDefinitionId: string;
  prompt: string;
  answer: string;
}

export interface DraftPreferences {
  minAge: number;
  maxAge: number;
  genderPreferences: Gender[];
  maxDistanceKm: number;
  relationshipIntent: RelationshipIntent;
}

export interface DraftProfile {
  displayName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: Gender;
  genderIdentity?: string; // Specific modern gender identity (e.g. Transgender Woman, Genderfluid, Non-binary)
  intent: RelationshipIntent;
  city: string;
  coordinates?: { latitude: number; longitude: number };
  bio: string;
  occupation: string;
  education: string;
}

export interface OnboardingState {
  // Auth state
  authMethod: 'phone' | 'email' | 'google' | 'passkey';
  pendingIdentifier: string; // E.g. "+91 9876543210" or "user@example.com"

  // Current active step
  currentStep: OnboardingStep;

  // Form drafts preserved across navigation and network retries
  draftProfile: DraftProfile;
  draftPhotos: DraftPhotoItem[];
  draftInterests: string[]; // List of interest IDs
  draftPrompts: DraftPromptItem[];
  draftPreferences: DraftPreferences;
  permissionsStatus: {
    location: 'prompt' | 'granted' | 'denied';
    push: 'prompt' | 'granted' | 'denied';
    photos: 'prompt' | 'granted' | 'denied';
  };

  // Actions
  setAuthIdentifier: (method: 'phone' | 'email' | 'google' | 'passkey', identifier: string) => void;
  setCurrentStep: (step: OnboardingStep) => void;
  updateDraftProfile: (updates: Partial<DraftProfile>) => void;
  setDraftPhotos: (photos: DraftPhotoItem[]) => void;
  addDraftPhoto: (photo: DraftPhotoItem) => void;
  removeDraftPhoto: (id: string) => void;
  setPrimaryDraftPhoto: (id: string) => void;
  setDraftInterests: (interestIds: string[]) => void;
  toggleDraftInterest: (interestId: string) => void;
  setDraftPrompts: (prompts: DraftPromptItem[]) => void;
  updateDraftPromptAnswer: (promptDefinitionId: string, answer: string) => void;
  updateDraftPreferences: (updates: Partial<DraftPreferences>) => void;
  setPermissionStatus: (
    type: 'location' | 'push' | 'photos',
    status: 'prompt' | 'granted' | 'denied'
  ) => void;
  hydrateFromProfile: (profile: PrivateProfileResponse) => void;
  resetOnboardingDraft: () => void;
}

const initialDraftProfile: DraftProfile = {
  displayName: '',
  dateOfBirth: '',
  gender: 'WOMAN',
  genderIdentity: 'Woman',
  intent: 'LONG_TERM',
  city: '',
  bio: '',
  occupation: '',
  education: '',
};

const initialDraftPreferences: DraftPreferences = {
  minAge: 21,
  maxAge: 35,
  genderPreferences: ['MAN'],
  maxDistanceKm: 50,
  relationshipIntent: 'LONG_TERM',
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  authMethod: 'phone',
  pendingIdentifier: '',
  currentStep: 'intro',
  draftProfile: initialDraftProfile,
  draftPhotos: [],
  draftInterests: [],
  draftPrompts: [],
  draftPreferences: initialDraftPreferences,
  permissionsStatus: {
    location: 'prompt',
    push: 'prompt',
    photos: 'prompt',
  },

  setAuthIdentifier: (method, identifier) =>
    set({ authMethod: method, pendingIdentifier: identifier }),

  setCurrentStep: (step) => set({ currentStep: step }),

  updateDraftProfile: (updates) =>
    set((state) => ({
      draftProfile: { ...state.draftProfile, ...updates },
    })),

  setDraftPhotos: (photos) => set({ draftPhotos: photos }),

  addDraftPhoto: (photo) =>
    set((state) => ({
      draftPhotos: [...state.draftPhotos, photo],
    })),

  removeDraftPhoto: (id) =>
    set((state) => {
      const remaining = state.draftPhotos.filter((p) => p.id !== id);
      const first = remaining[0];
      if (first && !remaining.some((p) => p.isPrimary)) {
        remaining[0] = { ...first, isPrimary: true };
      }
      return { draftPhotos: remaining };
    }),

  setPrimaryDraftPhoto: (id) =>
    set((state) => ({
      draftPhotos: state.draftPhotos.map((p) => ({
        ...p,
        isPrimary: p.id === id,
      })),
    })),

  setDraftInterests: (interestIds) => set({ draftInterests: interestIds }),

  toggleDraftInterest: (id) =>
    set((state) => {
      const current = state.draftInterests;
      if (current.includes(id)) {
        return { draftInterests: current.filter((item) => item !== id) };
      }
      if (current.length >= 10) return state; // Cap at 10
      return { draftInterests: [...current, id] };
    }),

  setDraftPrompts: (prompts) => set({ draftPrompts: prompts }),

  updateDraftPromptAnswer: (promptDefinitionId, answer) =>
    set((state) => {
      const existing = state.draftPrompts.find((p) => p.promptDefinitionId === promptDefinitionId);
      if (existing) {
        return {
          draftPrompts: state.draftPrompts.map((p) =>
            p.promptDefinitionId === promptDefinitionId ? { ...p, answer } : p
          ),
        };
      }
      return state;
    }),

  updateDraftPreferences: (updates) =>
    set((state) => ({
      draftPreferences: { ...state.draftPreferences, ...updates },
    })),

  setPermissionStatus: (type, status) =>
    set((state) => ({
      permissionsStatus: { ...state.permissionsStatus, [type]: status },
    })),

  hydrateFromProfile: (profile) =>
    set((state) => ({
      draftProfile: {
        displayName: profile.displayName || state.draftProfile.displayName,
        dateOfBirth: profile.dateOfBirth || state.draftProfile.dateOfBirth,
        gender: profile.gender || state.draftProfile.gender,
        intent: profile.preferences?.relationshipIntent || state.draftProfile.intent,
        city: profile.city || state.draftProfile.city,
        bio: profile.bio || state.draftProfile.bio,
        occupation: profile.occupation || state.draftProfile.occupation,
        education: profile.education || state.draftProfile.education,
      },
      draftPhotos: (profile.media || []).map((m) => ({
        id: m.id,
        url: m.url,
        isPrimary: m.isPrimary,
        status: m.status,
      })),
      draftInterests: (profile.interests || []).map((i) => i.id),
      draftPrompts: (profile.prompts || []).map((p) => ({
        promptDefinitionId: p.promptDefinitionId,
        prompt: p.prompt,
        answer: p.answer,
      })),
      draftPreferences: profile.preferences
        ? {
            minAge: profile.preferences.minAge,
            maxAge: profile.preferences.maxAge,
            genderPreferences: [...profile.preferences.genderPreferences],
            maxDistanceKm: profile.preferences.maxDistanceKm,
            relationshipIntent: profile.preferences.relationshipIntent,
          }
        : state.draftPreferences,
    })),

  resetOnboardingDraft: () =>
    set({
      pendingIdentifier: '',
      currentStep: 'intro',
      draftProfile: initialDraftProfile,
      draftPhotos: [],
      draftInterests: [],
      draftPrompts: [],
      draftPreferences: initialDraftPreferences,
      permissionsStatus: {
        location: 'prompt',
        push: 'prompt',
        photos: 'prompt',
      },
    }),
}));
