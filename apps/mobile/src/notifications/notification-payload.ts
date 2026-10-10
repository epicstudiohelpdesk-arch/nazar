/**
 * Notification payload validation and destination resolution.
 *
 * `NotificationResponseDto.data` is typed `Record<string, unknown> | null` in the
 * shared contract, so it is **untrusted input** on the client. Nothing in it may
 * be interpolated into a route, and it may not decide *which kind* of screen
 * opens. The authoritative `type` column on the row is the only thing that
 * selects a destination; `data` may only supply an opaque identifier, and only
 * after it passes {@link isSafeIdentifier}.
 *
 * Every producer was read from `apps/api/src/modules/notifications/workers/
 * notification-event-consumer.ts`, which is the only place notifications are
 * created. The table below is the contract this file implements; if the server
 * adds a type, this file must be extended rather than the payload trusted.
 *
 * | type                      | data written by the server        | destination              |
 * | ------------------------- | --------------------------------- | ------------------------ |
 * | NEW_MESSAGE               | conversationId?, messageId        | conversation (if id)     |
 * | NEW_MATCH                 | matchId                          | match (if id)            |
 * | NEW_LIKE                  | {}                                | none (server sends no id)|
 * | POST_COMMENT              | postId, commentId                 | post (if id)             |
 * | COMMUNITY_JOIN            | communityId                      | community (if id)        |
 * | EVENT_RSVP                | eventId                          | event (if id)            |
 * | EVENT_WAITLIST_PROMOTED   | eventId                          | event (if id)            |
 * | SYSTEM_NOTICE             | billingEventType?, subscriptionId?| billing (if billing key) |
 * | ACCOUNT_RESTRICTION       | {}                                | account (settings)       |
 * | SECURITY_ALERT            | {} (declared, never emitted)      | account (settings)       |
 */
import type { NotificationType } from '@platform/api-contracts';
import { socialRoutes } from '../social/social-state.js';

export type NotificationDestinationKind =
  'conversation' | 'match' | 'post' | 'community' | 'event' | 'billing' | 'account';

/** Destinations built from a validated entity id. */
export type EntityDestinationKind = Extract<
  NotificationDestinationKind,
  'conversation' | 'match' | 'post' | 'community' | 'event'
>;

/** Destinations that are settings screens and carry no id. */
export type SettingsDestinationKind = Extract<NotificationDestinationKind, 'billing' | 'account'>;

/**
 * The complete set of types the client will act on. The API contract declares
 * these; `SECURITY_ALERT` is declared but the Gate 10 consumer never emits it,
 * and it is kept so a future emitter is handled rather than dropped.
 */
export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'NEW_MATCH',
  'NEW_MESSAGE',
  'NEW_LIKE',
  'SYSTEM_NOTICE',
  'SECURITY_ALERT',
  'ACCOUNT_RESTRICTION',
  'POST_COMMENT',
  'COMMUNITY_JOIN',
  'EVENT_RSVP',
  'EVENT_WAITLIST_PROMOTED',
] as const;

export function isKnownNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export interface NotificationDestination {
  readonly kind: NotificationDestinationKind;
  /** A route from the shared allowlist, already percent-encoded. */
  readonly route: string;
  /**
   * A short verb used in analytics and error copy, e.g. `open conversation`.
   * Never contains payload content.
   */
  readonly label: string;
}

export interface ResolvedNotification {
  readonly destination: NotificationDestination | null;
  /**
   * Why there is no destination, when there is none. Distinguishes "this type
   * never has a target" (not an error) from "the payload was malformed or
   * hostile" (worth an analytics event).
   */
  readonly reason:
    'resolved' | 'no_target_for_type' | 'malformed_target_id' | 'unknown_type' | 'missing_payload';
  readonly notificationId: string;
  readonly type: NotificationType | null;
}

/**
 * Identifiers arrive from a JSON column and are interpolated into a path
 * segment, so the accepted character set is restricted to what the API's UUIDv7
 * keys actually use. `%` is excluded on purpose: it would allow a
 * pre-encoded `%2F` to reach the router and decode into a path separator one
 * layer later.
 */
export function isSafeIdentifier(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    return false;
  }
  if (value.includes('..') || value === '.') {
    return false;
  }
  return /^[A-Za-z0-9_.-]+$/.test(value);
}

/** Reads a validated identifier out of an untrusted payload bag. */
function readId(data: Record<string, unknown> | null, key: string): string | null {
  if (!data) return null;
  const raw = data[key];
  if (raw === undefined || raw === null || raw === '') return null;
  return isSafeIdentifier(raw) ? raw : null;
}

/** True when the id was present but unusable, as opposed to simply absent. */
function hasUnusableId(data: Record<string, unknown> | null, key: string): boolean {
  if (!data) return false;
  const raw = data[key];
  return raw !== undefined && raw !== null && raw !== '' && !isSafeIdentifier(raw);
}

/**
 * Route builders for destinations that already exist in the F1 navigation tree.
 * `socialRoutes` is reused for the F7 surfaces rather than re-deriving paths, so
 * a route rename cannot silently diverge between the Activity Center and the
 * screen it links to.
 *
 * Split into two tables rather than one with an optional id: an entity route
 * cannot be built without a validated id, and only the two settings targets are
 * id-less. Keeping them apart means an id can never be `undefined` inside a path
 * builder.
 */
const ENTITY_DESTINATIONS: {
  readonly [K in EntityDestinationKind]: (id: string) => NotificationDestination;
} = {
  conversation: (id) => ({
    kind: 'conversation',
    route: `/chat/${encodeURIComponent(id)}`,
    label: 'open conversation',
  }),
  match: (id) => ({
    kind: 'match',
    route: `/matches/${encodeURIComponent(id)}`,
    label: 'open match',
  }),
  post: (id) => ({ kind: 'post', route: socialRoutes.post(id), label: 'open post' }),
  community: (id) => ({
    kind: 'community',
    route: socialRoutes.community(id),
    label: 'open community',
  }),
  event: (id) => ({ kind: 'event', route: socialRoutes.event(id), label: 'open event' }),
};

const SETTINGS_DESTINATIONS: {
  readonly [K in SettingsDestinationKind]: NotificationDestination;
} = {
  billing: { kind: 'billing', route: '/billing', label: 'open subscription' },
  account: { kind: 'account', route: '/settings/account', label: 'open account settings' },
};

/**
 * Maps a notification to at most one destination.
 *
 * The type drives the choice; the payload only supplies the id. When the type
 * has no id, `reason` is `no_target_for_type` and the row is shown as
 * informational rather than actionable, which is the truthful rendering for
 * `NEW_LIKE` and `ACCOUNT_RESTRICTION`.
 */
export function resolveNotificationDestination(input: {
  readonly id: string;
  readonly type: NotificationType;
  readonly data: Record<string, unknown> | null;
}): ResolvedNotification {
  const { id, type, data } = input;

  if (!isKnownNotificationType(type)) {
    return { destination: null, reason: 'unknown_type', notificationId: id, type: null };
  }

  const resolveEntity = (kind: EntityDestinationKind, key: string): ResolvedNotification => {
    const targetId = readId(data, key);
    if (targetId) {
      return {
        destination: ENTITY_DESTINATIONS[kind](targetId),
        reason: 'resolved',
        notificationId: id,
        type,
      };
    }
    return {
      destination: null,
      reason: hasUnusableId(data, key) ? 'malformed_target_id' : 'no_target_for_type',
      notificationId: id,
      type,
    };
  };

  const resolveSettings = (kind: SettingsDestinationKind): ResolvedNotification => ({
    destination: SETTINGS_DESTINATIONS[kind],
    reason: 'resolved',
    notificationId: id,
    type,
  });

  switch (type) {
    case 'NEW_MESSAGE':
      return resolveEntity('conversation', 'conversationId');
    case 'NEW_MATCH':
      return resolveEntity('match', 'matchId');
    case 'POST_COMMENT':
      return resolveEntity('post', 'postId');
    case 'COMMUNITY_JOIN':
      return resolveEntity('community', 'communityId');
    case 'EVENT_RSVP':
    case 'EVENT_WAITLIST_PROMOTED':
      return resolveEntity('event', 'eventId');
    case 'SYSTEM_NOTICE': {
      // `billingEventType` is written by every billing branch of the consumer.
      // Without it the notice is generic, so there is no honest target.
      const hasBillingKey =
        data !== null &&
        typeof data.billingEventType === 'string' &&
        data.billingEventType.length > 0;
      return hasBillingKey
        ? resolveSettings('billing')
        : { destination: null, reason: 'no_target_for_type', notificationId: id, type };
    }
    case 'NEW_LIKE':
      // The consumer writes `{ type: 'NEW_LIKE' }` with no actor or profile id,
      // so there is nothing truthful to deep link to.
      return { destination: null, reason: 'no_target_for_type', notificationId: id, type };
    case 'ACCOUNT_RESTRICTION':
    case 'SECURITY_ALERT':
      return resolveSettings('account');
    default:
      return { destination: null, reason: 'unknown_type', notificationId: id, type: null };
  }
}

/**
 * Pulls a push/cold-start payload down to the same shape the feed returns.
 *
 * A push body is only `{ notificationId, type, ...data }`; it carries no title,
 * body or timestamps. The Activity Center row is therefore always re-fetched
 * from the API, and these fields are used only to decide *where* to send the
 * user and which row to mark read.
 */
export interface NotificationIntent {
  readonly notificationId: string;
  readonly type: NotificationType | null;
  readonly data: Record<string, unknown> | null;
}

export function parseNotificationIntent(payload: unknown): NotificationIntent | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const bag = payload as Record<string, unknown>;
  const rawId = bag.notificationId ?? bag.id;
  const rawType = bag.type;

  if (rawId === undefined && rawType === undefined) {
    return null;
  }

  const notificationId = typeof rawId === 'string' && isSafeIdentifier(rawId) ? rawId : '';
  // The Gate 10 delivery worker passes `notification.data` through as the push
  // data payload, so target ids arrive **flat** next to `type`. A nested `data`
  // bag is also accepted so a future sender that wraps them still resolves.
  const nested =
    bag.data !== null && typeof bag.data === 'object' && !Array.isArray(bag.data)
      ? (bag.data as Record<string, unknown>)
      : null;
  const data = nested ?? bag;
  return {
    notificationId,
    // An unrecognised type is preserved as `null` so the caller can report it
    // rather than guessing a destination from the payload.
    type: isKnownNotificationType(rawType)
      ? rawType
      : isKnownNotificationType(data.type)
        ? (data.type as NotificationType)
        : null,
    data,
  };
}
