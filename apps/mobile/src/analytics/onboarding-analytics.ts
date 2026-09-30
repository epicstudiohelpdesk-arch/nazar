import { createAnalyticsClient, type AnalyticsClient } from './analytics-client.js';
import { getDefaultAuthClient } from '../auth/default-client.js';

let defaultAnalyticsClient: AnalyticsClient | null = null;

export function getDefaultAnalyticsClient(): AnalyticsClient {
  if (!defaultAnalyticsClient) {
    defaultAnalyticsClient = createAnalyticsClient({
      authClient: getDefaultAuthClient(),
    });
  }
  return defaultAnalyticsClient;
}

/**
 * Sensitive keys that MUST NEVER be emitted in analytics telemetry.
 */
const FORBIDDEN_PII_KEYS = new Set([
  'phone',
  'phonenumber',
  'phoneNumber',
  'email',
  'emailAddress',
  'code',
  'otp',
  'token',
  'accessToken',
  'refreshToken',
  'password',
  'dob',
  'dateOfBirth',
  'street',
  'address',
  'latitude',
  'longitude',
  'coords',
]);

/**
 * Sanitizes an event properties map by deeply filtering out any PII.
 */
export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (FORBIDDEN_PII_KEYS.has(key) || FORBIDDEN_PII_KEYS.has(key.toLowerCase())) {
      continue; // Drop PII
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeAnalyticsProperties(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export type OnboardingAnalyticsEvent =
  | 'onboarding_started'
  | 'auth_started'
  | 'auth_submitted'
  | 'auth_rate_limited'
  | 'auth_failed'
  | 'auth_succeeded'
  | 'profile_started'
  | 'profile_details_completed'
  | 'photo_added'
  | 'photo_deleted'
  | 'photo_primary_selected'
  | 'photo_upload_failed'
  | 'photos_completed'
  | 'interests_viewed'
  | 'interest_selected'
  | 'interest_deselected'
  | 'interests_completed'
  | 'prompts_viewed'
  | 'prompt_answered'
  | 'prompts_completed'
  | 'preferences_viewed'
  | 'preferences_completed'
  | 'permissions_prompted'
  | 'permission_granted'
  | 'permission_denied'
  | 'permission_skipped'
  | 'preview_viewed'
  | 'onboarding_completed'
  | 'discovery_entered'
  | 'session_restored'
  | 'session_restore_failed';

/**
 * Tracks an onboarding or auth event with guaranteed PII sanitization.
 */
export function trackOnboardingEvent(
  eventName: OnboardingAnalyticsEvent,
  properties: Record<string, unknown> = {}
): string {
  const client = getDefaultAnalyticsClient();
  const cleanProps = sanitizeAnalyticsProperties(properties);
  return client.track(eventName, cleanProps);
}
