/**
 * Canonical Dating Profile & Media API Contracts
 * Definitions for profile entities, preferences, prompts, interests, media, and state lifecycles.
 */

export type Gender = 'MAN' | 'WOMAN' | 'NON_BINARY' | 'OTHER';

export type ProfileVisibility = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'HIDDEN';

export type RelationshipIntent = 'LONG_TERM' | 'SHORT_TERM' | 'CASUAL' | 'FRIENDSHIP' | 'NOT_SURE';

export type MediaStatus = 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'READY' | 'REJECTED' | 'DELETED';

export type MediaType = 'IMAGE' | 'VIDEO';

export interface LocationCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface ProfileCompleteness {
  readonly percentage: number;
  readonly missingRequired: readonly string[];
  readonly recommended: readonly string[];
}

export interface CreateProfilePayload {
  readonly displayName: string;
  readonly dateOfBirth: string; // YYYY-MM-DD
  readonly gender: Gender;
  readonly bio?: string;
  readonly occupation?: string;
  readonly education?: string;
  readonly city?: string;
  readonly countryCode?: string;
  readonly location?: LocationCoordinates;
}

export interface UpdateProfilePayload {
  readonly displayName?: string;
  readonly dateOfBirth?: string;
  readonly gender?: Gender;
  readonly bio?: string;
  readonly occupation?: string;
  readonly education?: string;
  readonly city?: string;
  readonly countryCode?: string;
  readonly location?: LocationCoordinates;
}

export interface PreferencesResponse {
  readonly id: string;
  readonly userId: string;
  readonly minAge: number;
  readonly maxAge: number;
  readonly genderPreferences: readonly Gender[];
  readonly maxDistanceKm: number;
  readonly relationshipIntent: RelationshipIntent;
  readonly updatedAt: string;
}

export interface UpdatePreferencesPayload {
  readonly minAge?: number;
  readonly maxAge?: number;
  readonly genderPreferences?: readonly Gender[];
  readonly maxDistanceKm?: number;
  readonly relationshipIntent?: RelationshipIntent;
}

export interface InterestItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly category: string;
}

export interface UpdateInterestsPayload {
  readonly interestIds: readonly string[];
}

export interface PromptDefinitionItem {
  readonly id: string;
  readonly prompt: string;
  readonly category: string;
  readonly sortOrder: number;
}

export interface ProfilePromptItem {
  readonly id: string;
  readonly promptDefinitionId: string;
  readonly prompt: string;
  readonly answer: string;
  readonly position: number;
}

export interface PromptAnswerInput {
  readonly promptDefinitionId: string;
  readonly answer: string;
  readonly position?: number;
}

export interface UpdatePromptsPayload {
  readonly prompts: readonly PromptAnswerInput[];
}

export interface MediaUploadRequestPayload {
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface MediaUploadResponse {
  readonly mediaId: string;
  readonly uploadUrl: string;
  readonly storageKey: string;
  readonly expiresAt: string;
}

export interface MediaItemResponse {
  readonly id: string;
  readonly url: string;
  readonly mediaType: MediaType;
  readonly mimeType: string;
  readonly status: MediaStatus;
  readonly position: number;
  readonly isPrimary: boolean;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly sizeBytes?: number | null;
  readonly createdAt: string;
}

export interface ReorderMediaPayload {
  readonly mediaIds: readonly string[];
}

export interface PrivateProfileResponse {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly dateOfBirth: string;
  readonly age: number;
  readonly gender: Gender;
  readonly bio?: string | null;
  readonly occupation?: string | null;
  readonly education?: string | null;
  readonly city?: string | null;
  readonly countryCode?: string | null;
  readonly location?: LocationCoordinates | null;
  readonly visibility: ProfileVisibility;
  readonly completionStatus: ProfileCompleteness;
  readonly preferences?: PreferencesResponse | null;
  readonly interests: readonly InterestItem[];
  readonly prompts: readonly ProfilePromptItem[];
  readonly media: readonly MediaItemResponse[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicMediaItem {
  readonly id: string;
  readonly url: string;
  readonly position: number;
  readonly isPrimary: boolean;
}

export interface PublicPromptItem {
  readonly id: string;
  readonly prompt: string;
  readonly answer: string;
}

export interface PublicProfileResponse {
  readonly id: string;
  readonly userId?: string;
  readonly displayName: string;
  readonly age: number;
  readonly gender: Gender;
  readonly bio?: string | null;
  readonly occupation?: string | null;
  readonly education?: string | null;
  readonly city?: string | null;
  readonly countryCode?: string | null;
  readonly interests: readonly InterestItem[];
  readonly prompts: readonly PublicPromptItem[];
  readonly media: readonly PublicMediaItem[];
}

export interface ProfileStateChangeResponse {
  readonly id: string;
  readonly visibility: ProfileVisibility;
  readonly message: string;
}
