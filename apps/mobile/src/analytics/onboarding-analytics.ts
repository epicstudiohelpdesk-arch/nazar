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
  'body',
  'text',
  'message',
  'content',
  'preview',
  'receipt',
  'receiptData',
  'purchaseToken',
  'signedPayload',
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
  | 'lifestyle_viewed'
  | 'lifestyle_completed'
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
  | 'session_restore_failed'
  // Discovery & Interactions (F4)
  | 'discovery_viewed'
  | 'candidate_impression'
  | 'profile_opened'
  | 'profile_media_opened'
  | 'like_sent'
  | 'pass_sent'
  | 'match_created'
  | 'match_celebration_viewed'
  | 'match_message_clicked'
  | 'filter_opened'
  | 'filter_applied'
  | 'report_started'
  | 'report_submitted'
  | 'block_started'
  | 'block_completed'
  // Matches & Connections (F5)
  | 'matches_viewed'
  | 'likes_viewed'
  | 'incoming_like_opened'
  | 'like_back_sent'
  | 'match_opened'
  | 'match_profile_opened'
  | 'unmatch_started'
  | 'unmatch_completed'
  // Messaging & Chat (F6)
  | 'conversations_viewed'
  | 'conversation_opened'
  | 'conversation_closed'
  | 'message_send_attempted'
  | 'message_sent'
  | 'message_send_failed'
  | 'message_retried'
  | 'conversation_marked_read'
  | 'chat_block_started'
  | 'chat_block_completed'
  | 'chat_report_started'
  | 'chat_report_completed'
  | 'chat_unmatch_started'
  | 'chat_unmatch_completed'
  | 'toxic_intervention_triggered'
  | 'call_initiated'
  | 'call_ended'
  // Social + Communities + Events (F7)
  | 'social_home_opened'
  | 'community_viewed'
  | 'community_join_attempted'
  | 'community_joined'
  | 'community_leave_attempted'
  | 'community_left'
  | 'community_feed_viewed'
  | 'community_members_viewed'
  | 'event_viewed'
  | 'event_rsvp_attempted'
  | 'event_rsvp_confirmed'
  | 'event_waitlisted'
  | 'event_rsvp_cancelled'
  | 'event_attendees_viewed'
  | 'post_viewed'
  | 'post_create_attempted'
  | 'post_created'
  | 'post_liked'
  | 'post_unliked'
  | 'post_reacted'
  | 'comment_created'
  | 'community_join_requested'
  | 'community_creation_attempted'
  | 'community_created'
  | 'community_member_banned'
  | 'community_member_ban_attempted'
  | 'community_member_ban_failed'
  | 'community_updated'
  | 'event_rsvp_failed'
  | 'event_cancelled'
  | 'event_creation_attempted'
  | 'event_created'
  | 'post_edited'
  | 'post_deleted'
  | 'post_reaction_failed'
  | 'social_report_submitted'
  | 'social_block_submitted'
  // Notifications & Activity Center (F8)
  | 'notifications_center_viewed'
  | 'notification_opened'
  | 'notification_marked_read'
  | 'notifications_marked_all_read'
  | 'notification_settings_viewed'
  | 'notification_preference_changed'
  | 'push_permission_prompted'
  | 'push_permission_granted'
  | 'push_permission_denied'
  | 'push_permission_unavailable'
  | 'push_registered'
  | 'push_registration_failed'
  | 'notification_navigation_failed'
  | 'notification_received_foreground'
  // Subscription & Premium UX (F9)
  | 'premium_paywall_viewed'
  | 'premium_feature_locked'
  | 'premium_product_selected'
  | 'purchase_started'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'purchase_pending'
  | 'purchase_validated'
  | 'purchase_restored'
  | 'entitlement_activated'
  | 'subscription_management_opened'
  // Profile + Settings + Privacy + Safety (F10)
  | 'logout'
  | 'delete_account_confirmed'
  | 'profile_viewed_self'
  | 'profile_updated'
  | 'profile_visibility_changed'
  | 'session_revoked'
  | 'all_sessions_revoked'
  | 'device_revoked'
  | 'user_unblocked'
  | 'account_deletion_started'
  | 'account_deleted'
  | 'privacy_viewed'
  | 'safety_viewed'
  | 'blocked_users_viewed'
  | 'permissions_viewed';

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
