/**
 * Notifications + Activity Center.
 *
 * The barrel previously re-exported `NotificationsScreen` and a
 * `notificationManager` whose `requestPermission()` returned `'AUTHORIZED'`
 * without asking the OS. Both are replaced: permission state now comes only from
 * the platform, and routing goes through the allowlist in
 * `notification-payload.ts`.
 */
export * from './notification-payload.js';
export * from './notification-state.js';
export * from './notification-cache.js';
export * from './notification-intent.js';
export * from './notifications-api.js';
export * from './push-permissions.js';
export * from './device-identity.js';
export * from './NotificationsScreen.js';
export * from './NotificationSettingsScreen.js';
export * from './components/NotificationRow.js';
export * from './components/UnreadBadge.js';
export * from './components/PushPermissionCard.js';
export * from './notification-manager.js';
