/**
 * Push Notification & Device Contracts
 * Gate 10: APNs/FCM delivery, device tokens, user notification preferences, and durable notification feeds.
 */

export type PlatformType = 'IOS' | 'ANDROID';
export type PushProviderType = 'APNS' | 'FCM';

export type NotificationType =
  | 'NEW_MATCH'
  | 'NEW_MESSAGE'
  | 'NEW_LIKE'
  | 'SYSTEM_NOTICE'
  | 'SECURITY_ALERT'
  | 'ACCOUNT_RESTRICTION'
  | 'POST_COMMENT'
  | 'COMMUNITY_JOIN'
  | 'EVENT_RSVP'
  | 'EVENT_WAITLIST_PROMOTED';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type PushProviderErrorCategory =
  | 'TOKEN_INVALID'
  | 'TOKEN_UNREGISTERED'
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMITED'
  | 'TEMPORARY_PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'BAD_PAYLOAD'
  | 'UNKNOWN_PROVIDER_ERROR';

export type NotificationDeliveryStatus =
  'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRYING' | 'CANCELLED';

// ----------------------------------------------------
// Device Registration
// ----------------------------------------------------

export interface RegisterDeviceRequestDto {
  readonly deviceIdentifier: string;
  readonly platform: PlatformType;
  readonly pushToken: string;
  readonly pushProvider?: PushProviderType;
  readonly appVersion?: string;
  readonly osVersion?: string;
  readonly locale?: string;
  readonly timezone?: string;
}

export interface DeviceResponseDto {
  readonly id: string;
  readonly userId: string;
  readonly deviceIdentifier: string;
  readonly platform: PlatformType;
  readonly pushProvider: PushProviderType;
  readonly pushTokenRedacted: string;
  readonly appVersion: string | null;
  readonly osVersion: string | null;
  readonly locale: string | null;
  readonly timezone: string | null;
  readonly lastSeenAt: string;
  readonly createdAt: string;
  readonly revokedAt: string | null;
}

// ----------------------------------------------------
// Notification Preferences
// ----------------------------------------------------

export interface NotificationPreferencesDto {
  readonly matchNotificationsEnabled: boolean;
  readonly messageNotificationsEnabled: boolean;
  readonly likeNotificationsEnabled: boolean;
  readonly safetyNotificationsEnabled: boolean;
  readonly systemNotificationsEnabled: boolean;
  readonly messagePreviewEnabled: boolean;
  readonly updatedAt: string;
}

export interface UpdateNotificationPreferencesDto {
  readonly matchNotificationsEnabled?: boolean;
  readonly messageNotificationsEnabled?: boolean;
  readonly likeNotificationsEnabled?: boolean;
  readonly safetyNotificationsEnabled?: boolean;
  readonly systemNotificationsEnabled?: boolean;
  readonly messagePreviewEnabled?: boolean;
}

// ----------------------------------------------------
// Notifications Feed & State
// ----------------------------------------------------

export interface NotificationResponseDto {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly data: Record<string, unknown> | null;
  readonly priority: NotificationPriority;
  readonly readAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

export interface NotificationListResponseDto {
  readonly items: readonly NotificationResponseDto[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly totalUnreadCount: number;
}

export interface UnreadNotificationCountDto {
  readonly count: number;
}

export interface MarkNotificationReadResponseDto {
  readonly id: string;
  readonly readAt: string;
}

export interface MarkAllNotificationsReadResponseDto {
  readonly updatedCount: number;
}

// ----------------------------------------------------
// Push Provider Internal Result
// ----------------------------------------------------

export interface PushDeliveryResult {
  readonly success: boolean;
  readonly providerMessageId?: string;
  readonly errorCategory?: PushProviderErrorCategory;
  readonly errorMessage?: string;
  readonly isPermanentFailure: boolean;
}
