/**
 * Profile & Media Domain Events
 * Declares domain event types for profile lifecycle, media pipeline, and preferences.
 */

export enum ProfileEventType {
  PROFILE_CREATED = 'profile.created',
  PROFILE_UPDATED = 'profile.updated',
  PROFILE_ACTIVATED = 'profile.activated',
  PROFILE_PAUSED = 'profile.paused',
  PROFILE_HIDDEN = 'profile.hidden',
  PROFILE_MEDIA_ADDED = 'profile.media.added',
  PROFILE_MEDIA_READY = 'profile.media.ready',
  PROFILE_MEDIA_DELETED = 'profile.media.deleted',
  PROFILE_PREFERENCES_UPDATED = 'profile.preferences.updated',
}

export interface ProfileEventPayload {
  readonly profileId: string;
  readonly userId: string;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
}
