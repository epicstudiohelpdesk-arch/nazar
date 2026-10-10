import { useCallback, useEffect, useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import type {
  NotificationListResponseDto,
  NotificationResponseDto,
  UpdateNotificationPreferencesDto,
} from '@platform/api-contracts';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';
import { chatSocket } from '../chat/chat-socket.js';
import { NOTIFICATION_QUERY_KEYS, type NotificationsApiClient } from './notifications-api.js';
import {
  invalidateNotificationLists,
  invalidateNotificationReadState,
} from './notification-cache.js';
import {
  applyConfirmedRead,
  applyConfirmedReadAll,
  mergeNotificationPages,
  upsertNotification,
} from './notification-state.js';
import type { NotificationIntent } from './notification-payload.js';
import { applyBadgeCount } from './push-runtime.js';
import {
  consumePendingNotificationIntent,
  setPendingNotificationIntent,
} from './notification-intent.js';

const PAGE_SIZE = 20;

/**
 * The feed is allowed to look fresh for 30s. The global default is 5 minutes,
 * which for an unread count means a badge that can be several notifications out
 * of date after any read elsewhere.
 */
const LIST_STALE_TIME = 30_000;
const UNREAD_STALE_TIME = 20_000;

export interface NotificationsFeed {
  readonly notifications: NotificationResponseDto[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly isFetchingNextPage: boolean;
  /** Full-page failure, i.e. no cached rows to show. */
  readonly error: string | null;
  /** A refresh failed but cached rows are still on screen. */
  readonly isStale: boolean;
  readonly refetch: () => void;
  readonly loadMore: () => void;
}

/**
 * Cursor-paginated feed.
 *
 * Pages accumulate through {@link mergeNotificationPages}, which dedupes by
 * notification id, so a row that arrives twice — repeated cursor, or a socket
 * event followed by a refetch — still renders once.
 */
export function useNotificationsFeed(
  client: NotificationsApiClient,
  options: { readonly enabled?: boolean } = {}
): NotificationsFeed {
  const enabled = options.enabled ?? true;

  const query = useInfiniteQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.list,
    enabled,
    initialPageParam: null as string | null,
    staleTime: LIST_STALE_TIME,
    queryFn: async ({ pageParam }) => {
      const page = await client.listNotifications({
        limit: PAGE_SIZE,
        cursor: pageParam ?? undefined,
      });
      return page;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const notifications = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return pages.reduce<NotificationResponseDto[]>(
      (acc, page) => mergeNotificationPages(acc, page.items),
      []
    );
  }, [query.data]);

  const lastPage = query.data?.pages[query.data.pages.length - 1];

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  return {
    notifications,
    nextCursor: lastPage?.nextCursor ?? null,
    hasMore: Boolean(query.hasNextPage),
    isLoading: query.isPending,
    isRefreshing: query.isRefetching && !query.isFetchingNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    // A full error is only shown when there is nothing cached to fall back to;
    // otherwise it becomes a stale banner.
    error: query.isError && notifications.length === 0 ? 'Could not load your activity.' : null,
    isStale: query.isError && notifications.length > 0,
    refetch: () => void query.refetch(),
    loadMore,
  };
}

export interface UnreadCountState {
  readonly count: number;
  readonly isLoading: boolean;
  readonly isStale: boolean;
}

/**
 * The badge's single source of truth.
 *
 * Nothing in the app keeps its own tally; the header badge, the tab badge and
 * the mark-all-read button all read this value, and the list response's
 * `totalUnreadCount` writes back into it so a feed refresh also corrects it.
 */
export function useUnreadCount(
  client: NotificationsApiClient,
  options: { readonly enabled?: boolean } = {}
): UnreadCountState {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount,
    enabled: options.enabled ?? true,
    staleTime: UNREAD_STALE_TIME,
    queryFn: async () => client.getUnreadCount(),
  });

  // Any feed page carries the authoritative total; adopt it so a refresh of the
  // list alone still fixes the badge.
  const lastPage = queryClient.getQueryData<
    InfiniteData<NotificationListResponseDto, string | undefined>
  >(NOTIFICATION_QUERY_KEYS.list)?.pages?.[0];
  const fromList = lastPage?.totalUnreadCount;

  const count = fromList ?? query.data ?? 0;

  useEffect(() => {
    void applyBadgeCount(count);
  }, [count]);

  return {
    count: Math.max(0, count),
    isLoading: query.isPending,
    isStale: query.isError,
  };
}

/**
 * Marks one notification read.
 *
 * There is no optimistic decrement. The server returns only the notification and
 * its `readAt`, not a new total, so a local `count - 1` would drift the moment
 * another notification arrived or a write failed. The confirmed `readAt` is
 * written into every cached page and the count is refetched.
 */
export function useMarkNotificationRead(client: NotificationsApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => client.markAsRead(notificationId),
    onSuccess: (result, notificationId) => {
      queryClient.setQueryData<InfiniteData<NotificationListResponseDto, string | undefined>>(
        NOTIFICATION_QUERY_KEYS.list,
        (previous) => {
          if (!previous) return previous;
          return {
            ...previous,
            pages: previous.pages.map((page) => ({
              ...page,
              items: applyConfirmedRead(page.items, notificationId, result.readAt),
            })),
          };
        }
      );
      invalidateNotificationReadState(queryClient);
      trackOnboardingEvent('notification_marked_read', { source: 'activity_center' });
    },
  });
}

/** Marks everything read, then refetches for the authoritative total. */
export function useMarkAllNotificationsRead(client: NotificationsApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => client.markAllAsRead(),
    onSuccess: (result) => {
      const readAt = new Date().toISOString();
      queryClient.setQueryData<InfiniteData<NotificationListResponseDto, string | undefined>>(
        NOTIFICATION_QUERY_KEYS.list,
        (previous) => {
          if (!previous) return previous;
          return {
            ...previous,
            pages: previous.pages.map((page) => ({
              ...page,
              items: applyConfirmedReadAll(page.items, readAt),
            })),
          };
        }
      );
      invalidateNotificationReadState(queryClient);
      trackOnboardingEvent('notifications_marked_all_read', { updated_count: result.updatedCount });
    },
  });
}

export function useNotificationPreferences(client: NotificationsApiClient) {
  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.preferences,
    staleTime: 5 * 60_000,
    queryFn: async () => client.getPreferences(),
  });
}

/**
 * Applies a single preference.
 *
 * The switch follows the server response, never the gesture. On failure the
 * query is invalidated so the visual state snaps back to what the server
 * actually holds, which is what stops a switch appearing enabled after a
 * rejected write.
 */
export function useUpdateNotificationPreference(client: NotificationsApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UpdateNotificationPreferencesDto) => client.updatePreferences(patch),
    onSuccess: (preferences, patch) => {
      queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.preferences, preferences);
      const key = Object.keys(patch)[0];
      const value = key ? patch[key as keyof UpdateNotificationPreferencesDto] : undefined;
      trackOnboardingEvent('notification_preference_changed', {
        preference: key,
        enabled: typeof value === 'boolean' ? value : undefined,
      });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.preferences });
    },
  });
}

/**
 * Reconciles a notification that arrived outside an HTTP fetch.
 *
 * Identical whether the source was a socket event or a foreground push, and
 * keyed on the notification id, so the same notification delivered twice is
 * still one row.
 */
export function useReconcileIncomingNotification() {
  const queryClient = useQueryClient();

  return useCallback(
    (notification: NotificationResponseDto) => {
      queryClient.setQueryData<InfiniteData<NotificationListResponseDto, string | undefined>>(
        NOTIFICATION_QUERY_KEYS.list,
        (previous) => {
          if (!previous || previous.pages.length === 0) return previous;
          const [first, ...rest] = previous.pages;
          if (!first) return previous;
          return {
            ...previous,
            pages: [{ ...first, items: upsertNotification(first.items, notification) }, ...rest],
          };
        }
      );
      invalidateNotificationLists(queryClient);
    },
    [queryClient]
  );
}

/**
 * Subscribes to realtime and foreground-push notifications.
 *
 * The Gate 10 chat gateway emits no notification event, so the socket half of
 * this hook is currently inert; it is registered through the existing
 * `ChatSocketManager` rather than a second connection. App resume is the
 * mechanism that actually updates the feed today.
 */
export function useNotificationIngress(options: { readonly enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const reconcile = useReconcileIncomingNotification();

  useEffect(() => {
    if (!enabled) return;
    const off = chatSocket.onNotificationCreated((event) => {
      const notification = (event as { data?: NotificationResponseDto }).data;
      if (!notification?.id) return;
      reconcile(notification);
    });
    return off;
  }, [enabled, reconcile]);

  return useMemo(() => ({ reconcile }), [reconcile]);
}

/**
 * Reconciles on resume and reconnect.
 *
 * Only the notification queries are refreshed. A blanket `invalidateQueries()`
 * here would refetch discovery, chat and social, which is exactly the "blindly
 * refetch the entire application" behaviour this avoids.
 */
export function useNotificationResumeSync(options: { readonly enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const handler = (state: AppStateStatus) => {
      if (state !== 'active') return;
      invalidateNotificationLists(queryClient);
    };
    const subscription = AppState.addEventListener('change', handler);
    return () => subscription.remove();
  }, [enabled, queryClient]);
}

export interface NotificationDestinationOutcome {
  readonly navigated: boolean;
  /** Set when a push intent could not be honoured. */
  readonly failure:
    | 'unauthenticated'
    | 'malformed_payload'
    | 'unknown_type'
    | 'no_destination'
    | 'navigation_failed'
    | null;
}

/**
 * Consumes a cold-start intent exactly once and reports what happened.
 *
 * `navigate` is injected so this stays testable and free of a router import.
 */
export function consumeNotificationIntent(
  intent: NotificationIntent | null,
  navigate: (route: string) => void | Promise<void>,
  resolveRoute: (intent: NotificationIntent) => string | null,
  options: { readonly isAuthenticated: boolean } = { isAuthenticated: true }
): NotificationDestinationOutcome {
  if (!options.isAuthenticated) {
    // A previous account's notification must never open in this session.
    return { navigated: false, failure: 'unauthenticated' };
  }
  if (!intent) {
    return { navigated: false, failure: null };
  }

  const route = resolveRoute(intent);
  if (!route) {
    return {
      navigated: false,
      failure: intent.type === null ? 'unknown_type' : 'no_destination',
    };
  }

  try {
    void navigate(route);
    return { navigated: true, failure: null };
  } catch {
    return { navigated: false, failure: 'navigation_failed' };
  }
}

export { consumePendingNotificationIntent, setPendingNotificationIntent };
