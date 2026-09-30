/**
 * Notification presentation and cache reconciliation.
 *
 * Two rules shape everything here:
 *
 * 1. **The server owns ordering and counts.** Rows arrive newest-first
 *    (`ORDER BY createdAt DESC, id DESC`) and are never re-sorted on the client,
 *    because a locally sorted list disagrees with the server the moment two
 *    notifications share a `createdAt` millisecond.
 * 2. **The unread count is a server value, not a local tally.** Marking read
 *    returns the notification but not a new total, so the count is refetched
 *    rather than decremented. Decrementing locally is what produces badges that
 *    drift permanently out of sync after a single failed write.
 */
import type { NotificationResponseDto } from '@platform/api-contracts';
import type { IconName } from '../design/primitives/Icon.js';
import {
  resolveNotificationDestination,
  type NotificationDestination,
  type ResolvedNotification,
} from './notification-payload.js';

export type NotificationCategory =
  | 'match'
  | 'message'
  | 'like'
  | 'social'
  | 'community'
  | 'event'
  | 'safety'
  | 'system';

/** Visual tone of a category's leading icon chip. */
export type NotificationTone = 'accent' | 'info' | 'success' | 'warning' | 'error' | 'neutral';

export interface CategoryDescriptor {
  readonly category: NotificationCategory;
  readonly label: string;
  readonly icon: IconName;
  /** Drives the tint of the leading icon chip. */
  readonly tone: NotificationTone;
  /**
   * High-priority categories get a stronger unread treatment and are announced
   * by screen readers without needing the dot.
   */
  readonly emphasised: boolean;
}

/**
 * One entry per contract type. The `NEW_LIKE` copy is deliberately generic:
 * the server records no liker identity, so the UI must not imply one.
 */
const CATEGORY_BY_TYPE: { readonly [K in NotificationType]: CategoryDescriptor } = {
  NEW_MATCH: {
    category: 'match',
    label: 'Match',
    icon: 'heart',
    tone: 'accent',
    emphasised: true,
  },
  NEW_MESSAGE: {
    category: 'message',
    label: 'Message',
    icon: 'message',
    tone: 'info',
    emphasised: true,
  },
  NEW_LIKE: {
    category: 'like',
    label: 'Like',
    icon: 'sparkles',
    tone: 'accent',
    emphasised: false,
  },
  POST_COMMENT: {
    category: 'social',
    label: 'Comment',
    icon: 'message',
    tone: 'neutral',
    emphasised: false,
  },
  COMMUNITY_JOIN: {
    category: 'community',
    label: 'Community',
    icon: 'compass',
    tone: 'neutral',
    emphasised: false,
  },
  EVENT_RSVP: {
    category: 'event',
    label: 'Event',
    icon: 'calendar',
    tone: 'success',
    emphasised: false,
  },
  EVENT_WAITLIST_PROMOTED: {
    category: 'event',
    label: 'Event',
    icon: 'calendar',
    tone: 'success',
    emphasised: true,
  },
  SYSTEM_NOTICE: {
    category: 'system',
    label: 'Nazar',
    icon: 'info',
    tone: 'neutral',
    emphasised: false,
  },
  SECURITY_ALERT: {
    category: 'safety',
    label: 'Security',
    icon: 'shield',
    tone: 'error',
    emphasised: true,
  },
  ACCOUNT_RESTRICTION: {
    category: 'safety',
    label: 'Account',
    icon: 'warning',
    tone: 'error',
    emphasised: true,
  },
};

type NotificationType = NotificationResponseDto['type'];

export function getCategoryForType(type: NotificationType): CategoryDescriptor {
  return CATEGORY_BY_TYPE[type] ?? CATEGORY_BY_TYPE.SYSTEM_NOTICE;
}

export interface NotificationViewModel {
  readonly notification: NotificationResponseDto;
  readonly resolved: ResolvedNotification;
  readonly category: CategoryDescriptor;
  readonly isUnread: boolean;
  /** Rendered relative timestamp, e.g. `2m`, `3h`, `Tue`. */
  readonly relativeTime: string;
  /** Spoken timestamp for screen readers, e.g. `2 minutes ago`. */
  readonly accessibleTime: string;
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
}

/**
 * A row is "unavailable" when it expired, or when the type is unknown to the
 * client. Expired rows are filtered out by the server, so this normally only
 * fires for a type added server-side before the app is updated.
 */
export function isNotificationAvailable(notification: NotificationResponseDto, now: number): boolean {
  if (notification.expiresAt && Date.parse(notification.expiresAt) <= now) {
    return false;
  }
  return CATEGORY_BY_TYPE[notification.type] !== undefined;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact stamp for the row itself. Absolute date once it is no longer "recent". */
export function formatRelativeTime(
  createdAt: string,
  now: number,
  locale?: string
): string {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return '';
  const delta = Math.max(0, now - created);

  if (delta < MINUTE) return 'now';
  if (delta < HOUR) {
    const mins = Math.floor(delta / MINUTE);
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  }
  if (delta < DAY) {
    const hours = Math.floor(delta / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (delta < 7 * DAY) {
    const days = Math.floor(delta / DAY);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  const date = new Date(created);
  const nowDate = new Date(now);
  const includeYear = date.getFullYear() !== nowDate.getFullYear();
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' } : {}),
    }).format(date);
  } catch {
    return `${date.getMonth() + 1}/${date.getDate()}${includeYear ? `/${date.getFullYear()}` : ''}`;
  }
}

const MINUTE_NAMES: [limit: number, seconds: number, singular: string, plural: string][] = [
  [HOUR, 60, 'minute', 'minutes'],
  [DAY, HOUR, 'hour', 'hours'],
  [7 * DAY, DAY, 'day', 'days'],
];

/** Spoken form of {@link formatRelativeTime}, for the accessibility label. */
export function formatAccessibleTime(createdAt: string, now: number): string {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return '';
  const delta = Math.max(0, now - created);

  if (delta < MINUTE) return 'just now';
  for (const [limit, unitMs, singular, plural] of MINUTE_NAMES) {
    if (delta < limit) {
      const value = Math.floor(delta / unitMs);
      return `${value} ${value === 1 ? singular : plural} ago`;
    }
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(created));
}

/**
 * Builds one accessibility label per row.
 *
 * Unread is stated in words rather than left to the dot, which is invisible to a
 * screen reader and unreadable at small text sizes.
 */
export function buildAccessibilityLabel(
  notification: NotificationResponseDto,
  isUnread: boolean,
  accessibleTime: string
): string {
  const category = getCategoryForType(notification.type);
  const parts = [
    isUnread ? 'Unread notification' : 'Read notification',
    category.label,
    notification.title,
    notification.body,
    accessibleTime,
  ];
  return parts.filter((part) => part.length > 0).join('. ');
}

export function buildAccessibilityHint(
  resolved: ResolvedNotification
): string {
  if (resolved.destination) {
    return `Double tap to ${resolved.destination.label}.`;
  }
  if (resolved.reason === 'malformed_target_id') {
    return 'This item has an invalid destination and cannot be opened.';
  }
  return 'This item has no destination to open.';
}

export function buildNotificationViewModel(
  notification: NotificationResponseDto,
  now: number,
  locale?: string
): NotificationViewModel {
  const resolved = resolveNotificationDestination({
    id: notification.id,
    type: notification.type,
    data: notification.data,
  });
  const isUnread = notification.readAt === null;
  const accessibleTime = formatAccessibleTime(notification.createdAt, now);

  return {
    notification,
    resolved,
    category: getCategoryForType(notification.type),
    isUnread,
    relativeTime: formatRelativeTime(notification.createdAt, now, locale),
    accessibleTime,
    accessibilityLabel: buildAccessibilityLabel(notification, isUnread, accessibleTime),
    accessibilityHint: buildAccessibilityHint(resolved),
  };
}

// ---------------------------------------------------------------------------
// Cache reconciliation
// ---------------------------------------------------------------------------

/**
 * Merges an incoming page into an accumulated list.
 *
 * A cursor page can repeat a row when a notification is inserted between two
 * page requests (`createdAt` sorts ahead of the cursor, but a row already
 * fetched and re-sent by a realtime event can land again). Dedupe is by
 * authoritative id, and existing rows are **not** replaced, so a stale realtime
 * copy cannot overwrite fresher server data such as `readAt`.
 */
export function mergeNotificationPages(
  existing: readonly NotificationResponseDto[],
  incoming: readonly NotificationResponseDto[]
): NotificationResponseDto[] {
  if (incoming.length === 0) return existing as NotificationResponseDto[];

  const seen = new Set(existing.map((n) => n.id));
  const appended: NotificationResponseDto[] = [];

  for (const notification of incoming) {
    if (seen.has(notification.id)) continue;
    seen.add(notification.id);
    appended.push(notification);
  }

  return appended.length === 0 ? (existing as NotificationResponseDto[]) : [...existing, ...appended];
}

/**
 * Inserts a single notification at the head of the list.
 *
 * Used for realtime and push. The id is the dedupe key, so an HTTP refresh that
 * already contains the row, followed by a socket event for the same row, still
 * yields exactly one entry.
 */
export function upsertNotification(
  existing: readonly NotificationResponseDto[],
  notification: NotificationResponseDto
): NotificationResponseDto[] {
  const index = existing.findIndex((n) => n.id === notification.id);
  if (index === -1) {
    return [notification, ...existing];
  }
  const current = existing[index];
  if (!current) return existing as NotificationResponseDto[];
  if (notification.readAt && !current.readAt) {
    const merged = [...existing];
    merged[index] = { ...current, readAt: notification.readAt };
    return merged;
  }
  return existing as NotificationResponseDto[];
}

/** Applies a confirmed read to every cached page, using the server's `readAt`. */
export function applyConfirmedRead(
  existing: readonly NotificationResponseDto[],
  notificationId: string,
  readAt: string
): NotificationResponseDto[] {
  let changed = false;
  const next = existing.map((n) => {
    if (n.id !== notificationId || n.readAt !== null) return n;
    changed = true;
    return { ...n, readAt };
  });
  return changed ? next : (existing as NotificationResponseDto[]);
}

/** Applies a confirmed mark-all-read. `readAt` comes from the server clock. */
export function applyConfirmedReadAll(
  existing: readonly NotificationResponseDto[],
  readAt: string
): NotificationResponseDto[] {
  let changed = false;
  const next = existing.map((n) => {
    if (n.readAt !== null) return n;
    changed = true;
    return { ...n, readAt };
  });
  return changed ? next : (existing as NotificationResponseDto[]);
}

/**
 * Reconciles a list response's `totalUnreadCount` against a cached count.
 *
 * The list endpoint returns the authoritative total with every page, so a
 * refresh corrects the badge without a second round trip. The cached value is
 * only replaced when it is genuinely stale, which keeps a concurrent refetch
 * from flickering the badge between two equivalent values.
 */
export function reconcileUnreadCount(
  cached: number | undefined,
  authoritative: number
): number {
  const safe = Math.max(0, Math.trunc(authoritative));
  return cached === safe ? cached : safe;
}

export type { NotificationDestination };
