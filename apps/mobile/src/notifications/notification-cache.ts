/**
 * Notification cache invalidation.
 *
 * Read state and the unread badge are two caches, not one, so a read mutation
 * that only invalidates the feed leaves the badge stale. Every mutation routes
 * through this module for that reason.
 */
import type { QueryClient } from '@tanstack/react-query';
import { NOTIFICATION_QUERY_KEYS } from './notifications-api.js';

/**
 * After a confirmed read the server is asked for the new total rather than the
 * client guessing it, so `list` is refetched (it returns `totalUnreadCount`) and
 * the badge follows. Marking read is a server mutation; nothing here invents an
 * optimistic count.
 */
export function invalidateNotificationReadState(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.list });
  void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
}

/** Any change to the feed itself, e.g. a realtime `notification.created`. */
export function invalidateNotificationLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.list });
  void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
}
