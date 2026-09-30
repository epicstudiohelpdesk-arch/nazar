/**
 * Pure, server-authoritative view-model logic for the F7 social experience.
 *
 * Every function in this module is side-effect free and unit testable. The rules
 * encoded here exist for one reason: the backend owns membership, roles,
 * capacity, waitlisting, RSVP transitions and privacy. The client renders the
 * server's answer and never invents a substitute for it.
 */
import type {
  CommunityDto,
  CommunityRole,
  CommunityMembershipStatus,
  EventDto,
  EventRsvpStatus,
  EventStatus,
  PostDto,
  ErrorCode,
  ApiErrorResponse,
  FieldValidationError,
} from '@platform/api-contracts';

// ----------------------------------------------------
// Error handling
// ----------------------------------------------------

/** Thrown by {@link SocialApiClient} for any non-2xx social response. */
export class SocialApiError extends Error {
  readonly code: ErrorCode | string;
  readonly statusCode: number;
  readonly details: readonly FieldValidationError[];
  readonly requestId?: string;

  constructor(params: {
    code: ErrorCode | string;
    statusCode: number;
    message: string;
    details?: readonly FieldValidationError[];
    requestId?: string;
  }) {
    super(params.message);
    this.name = 'SocialApiError';
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.details = params.details ?? [];
    this.requestId = params.requestId;
  }

  static fromEnvelope(error: ApiErrorResponse, requestId?: string): SocialApiError {
    return new SocialApiError({
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
      requestId,
    });
  }
}

export function isSocialApiError(error: unknown): error is SocialApiError {
  return error instanceof SocialApiError;
}

export function getSocialErrorCode(error: unknown): string | undefined {
  return isSocialApiError(error) ? String(error.code) : undefined;
}

/** Field-level validation issues keyed by field name, for composer forms. */
export function getSocialFieldErrors(
  error: unknown
): Record<string, FieldValidationError | undefined> {
  if (!isSocialApiError(error)) return {};
  return error.details.reduce<Record<string, FieldValidationError | undefined>>((acc, detail) => {
    acc[detail.field] = detail;
    return acc;
  }, {});
}

export type SocialErrorKind =
  | 'network'
  | 'auth'
  | 'not_found'
  | 'access_denied'
  | 'rate_limited'
  | 'event_full'
  | 'event_over'
  | 'membership'
  | 'validation'
  | 'entitlement_required'
  | 'conflict'
  | 'unknown';

export interface SocialErrorView {
  readonly kind: SocialErrorKind;
  /** The existing F6 `ErrorState` type so screens reuse the shared component. */
  readonly stateType:
    | 'network_unavailable'
    | 'server_error'
    | 'auth_expired'
    | 'content_unavailable'
    | 'permission_denied'
    | 'rate_limited'
    | 'unknown';
  readonly title: string;
  readonly message: string;
  readonly isRetryable: boolean;
}

const ERROR_CODE_TO_KIND: Readonly<Record<string, SocialErrorKind>> = {
  UNAUTHORIZED: 'access_denied',
  FORBIDDEN: 'access_denied',
  SESSION_EXPIRED: 'auth',
  TOKEN_EXPIRED: 'auth',
  TOKEN_REPLAY_DETECTED: 'auth',
  SESSION_REVOKED: 'auth',
  COMMUNITY_ACCESS_DENIED: 'access_denied',
  COMMUNITY_MEMBER_BANNED: 'membership',
  COMMUNITY_MEMBER_NOT_FOUND: 'membership',
  COMMUNITY_MEMBER_EXISTS: 'membership',
  COMMUNITY_JOIN_PENDING: 'membership',
  COMMUNITY_NOT_FOUND: 'not_found',
  POST_NOT_FOUND: 'not_found',
  POST_DELETED: 'not_found',
  POST_ACCESS_DENIED: 'access_denied',
  COMMENT_NOT_FOUND: 'not_found',
  COMMENT_ACCESS_DENIED: 'access_denied',
  EVENT_NOT_FOUND: 'not_found',
  EVENT_ACCESS_DENIED: 'access_denied',
  EVENT_FULL: 'event_full',
  EVENT_CANCELLED: 'event_over',
  EVENT_COMPLETED: 'event_over',
  RSVP_NOT_ALLOWED: 'event_over',
  RSVP_NOT_FOUND: 'membership',
  RSVP_ALREADY_EXISTS: 'conflict',
  VALIDATION_ERROR: 'validation',
  BAD_REQUEST: 'validation',
  UNPROCESSABLE_ENTITY: 'validation',
  CONFLICT: 'conflict',
  COMMUNITY_NAME_TAKEN: 'conflict',
  RATE_LIMITED: 'rate_limited',
  MESSAGE_RATE_LIMITED: 'rate_limited',
  REPORT_RATE_LIMITED: 'rate_limited',
  USER_BLOCKED: 'access_denied',
  ACCOUNT_BANNED: 'access_denied',
  ACCOUNT_SUSPENDED: 'access_denied',
  ACCOUNT_DELETED: 'access_denied',
  ENTITLEMENT_REQUIRED: 'entitlement_required',
  ENTITLEMENT_NOT_FOUND: 'entitlement_required',
};

/**
 * Maps a transport/API error to user-facing copy.
 *
 * Raw server strings are intentionally never surfaced: they are developer-facing
 * and can leak internals. Only known, deliberately-worded messages are shown.
 */
export function describeSocialError(error: unknown): SocialErrorView {
  const kind = classifySocialError(error);

  switch (kind) {
    case 'network':
      return {
        kind,
        stateType: 'network_unavailable',
        title: 'No connection',
        message: 'You appear to be offline. Check your connection and try again.',
        isRetryable: true,
      };
    case 'auth':
      return {
        kind,
        stateType: 'auth_expired',
        title: 'Session expired',
        message: 'Your session has expired. Sign in again to continue.',
        isRetryable: false,
      };
    case 'not_found':
      return {
        kind,
        stateType: 'content_unavailable',
        title: 'Not available',
        message: 'This content is no longer available.',
        isRetryable: false,
      };
    case 'access_denied':
      return {
        kind,
        stateType: 'permission_denied',
        title: 'Not accessible',
        message: 'You do not have permission to view this right now.',
        isRetryable: false,
      };
    case 'event_full':
      return {
        kind,
        stateType: 'content_unavailable',
        title: 'Event is full',
        message: 'This event has reached capacity, so RSVPs are closed.',
        isRetryable: false,
      };
    case 'event_over':
      return {
        kind,
        stateType: 'content_unavailable',
        title: 'RSVP closed',
        message: 'RSVPs are closed for this event.',
        isRetryable: false,
      };
    case 'membership':
      return {
        kind,
        stateType: 'permission_denied',
        title: 'Action unavailable',
        message: 'This action is not available for your membership status.',
        isRetryable: false,
      };
    case 'entitlement_required':
      return {
        kind,
        stateType: 'permission_denied',
        title: 'Limit reached',
        message:
          'You have reached the free limit for this action. A premium plan is required to continue.',
        isRetryable: false,
      };
    case 'rate_limited':
      return {
        kind,
        stateType: 'rate_limited',
        title: 'Slow down',
        message: 'You are doing that a little too fast. Please wait and try again.',
        isRetryable: true,
      };
    case 'validation':
      return {
        kind,
        stateType: 'server_error',
        title: 'Check your input',
        message: 'Some of the details provided could not be accepted.',
        isRetryable: false,
      };
    case 'conflict':
      return {
        kind,
        stateType: 'server_error',
        title: 'Already done',
        message: 'That has already been applied.',
        isRetryable: false,
      };
    default:
      return {
        kind: 'unknown',
        stateType: 'server_error',
        title: 'Something went wrong',
        message: 'We could not complete that. Please try again in a moment.',
        isRetryable: true,
      };
  }
}

export function classifySocialError(error: unknown): SocialErrorKind {
  if (isSocialApiError(error)) {
    return ERROR_CODE_TO_KIND[String(error.code)] ?? 'unknown';
  }
  // Fetch/network layer throws TypeError; anything else is treated as unknown.
  if (error instanceof TypeError) return 'network';
  return 'unknown';
}

/** Inline banner copy for failed mutations, which should not blank the screen. */
export function getMutationErrorMessage(error: unknown): string {
  return describeSocialError(error).message;
}

// ----------------------------------------------------
// Pagination
// ----------------------------------------------------

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

/**
 * Page extraction for `useInfiniteQuery`. Returns `undefined` when the page
 * must not be used as the next page param, which is what stops React Query from
 * looping forever on a server that reports `hasMore: true` with a null cursor.
 */
export function getNextCursorPageParam(lastPage: CursorPage<unknown>): string | undefined {
  if (!lastPage.hasMore) return undefined;
  const cursor = lastPage.nextCursor;
  if (!cursor) return undefined;
  return cursor;
}

/**
 * Flattens infinite-query pages, de-duplicating by a stable id.
 *
 * Cursor pagination over a mutable feed can return an item twice across page
 * boundaries when new content shifts the window. Keys must be unique, so we
 * de-duplicate while preserving server order.
 */
export function flattenPages<T, K extends keyof T>(
  pages: readonly CursorPage<T>[] | undefined,
  getKey: (item: T) => T[K]
): T[] {
  if (!pages) return [];
  const seen = new Set<T[K]>();
  const result: T[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      const key = getKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export const byId = <T extends { readonly id: string }>(item: T): string => item.id;

// ----------------------------------------------------
// Membership / role
// ----------------------------------------------------

export type CommunityAction = 'join' | 'request_to_join' | 'leave' | 'pending' | 'banned' | 'none';

export interface MembershipView {
  readonly isMember: boolean;
  readonly role: CommunityRole | null;
  readonly isStaff: boolean;
  readonly canModerate: boolean;
  readonly canCreatePost: boolean;
  readonly canModerateComments: boolean;
  readonly action: CommunityAction;
  readonly statusLabel: string | null;
  readonly primaryActionLabel: string;
  readonly primaryActionHint: string;
}

/** OWNER and ADMIN are the only roles the API accepts moderation requests from. */
const STAFF_ROLES: readonly CommunityRole[] = ['OWNER', 'ADMIN'];

const ROLE_LABELS: Readonly<Record<CommunityRole, string>> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  MEMBER: 'Member',
};

export function getRoleLabel(role: CommunityRole): string {
  return ROLE_LABELS[role];
}

export function isStaffRole(role: CommunityRole | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/**
 * Derives every community action from the server's `currentUserRole` and
 * `currentUserMembershipStatus`. No client-side inference from privacy alone:
 * a PRIVATE community still returns ACTIVE for an approved member.
 */
export function deriveMembershipView(
  community: Pick<CommunityDto, 'currentUserRole' | 'currentUserMembershipStatus'>
): MembershipView {
  const role = community.currentUserRole ?? null;
  const status: CommunityMembershipStatus | null = community.currentUserMembershipStatus ?? null;
  const isMember = status === 'ACTIVE';
  const isStaff = isStaffRole(role);
  // Posting into a community is gated by the server on ACTIVE membership only.
  const canCreatePost = isMember;
  // A role without ACTIVE membership cannot exercise it: the API authorises
  // moderation from the caller's membership, so offering a Remove control to
  // someone who is not an active member would only produce a rejection.
  const canModerate = isStaff && isMember;

  let action: CommunityAction;
  let primaryActionLabel: string;
  let primaryActionHint: string;

  switch (status) {
    case 'ACTIVE':
      action = 'leave';
      primaryActionLabel = 'Leave community';
      primaryActionHint =
        'Leaving removes you from this community. You can re-join later if the community allows it.';
      break;
    case 'PENDING':
      action = 'pending';
      primaryActionLabel = 'Request pending';
      primaryActionHint = 'A moderator still needs to approve your request to join this community.';
      break;
    case 'BANNED':
      action = 'banned';
      primaryActionLabel = 'Access restricted';
      primaryActionHint =
        'You cannot re-join this community. Contact the moderators if you believe this is a mistake.';
      break;
    case 'LEFT':
      action = 'join';
      primaryActionLabel = 'Rejoin community';
      primaryActionHint = 'Rejoin this community to see its posts and events.';
      break;
    default:
      // null / undefined means the caller is not a member and no request is open.
      action = 'join';
      primaryActionLabel = 'Join community';
      primaryActionHint = 'Join this community to see its posts and events.';
      break;
  }

  return {
    isMember,
    role,
    isStaff,
    canModerate,
    canCreatePost,
    canModerateComments: canModerate,
    action,
    statusLabel: status ? getMembershipStatusLabel(status) : null,
    primaryActionLabel,
    primaryActionHint,
  };
}

export function getMembershipStatusLabel(status: CommunityMembershipStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Member';
    case 'PENDING':
      return 'Pending approval';
    case 'BANNED':
      return 'Restricted';
    case 'LEFT':
      return 'Not a member';
  }
}

/**
 * Whether a join should be presented as a request (PENDING) rather than an
 * immediate join. The server decides the outcome; the client only reflects the
 * returned membership status.
 */
export function getJoinOutcomeLabel(status: CommunityMembershipStatus | undefined): string {
  switch (status) {
    case 'PENDING':
      return 'Request to join sent. A moderator will review it.';
    case 'ACTIVE':
      return 'You have joined this community.';
    case 'BANNED':
      return 'You cannot join this community. Contact the moderators if you believe this is a mistake.';
    case 'LEFT':
      return 'You did not join this community.';
    default:
      return 'Your membership is unchanged. Pull to refresh to see the latest status.';
  }
}

// ----------------------------------------------------
// Events
// ----------------------------------------------------

export type RsvpTarget = 'GOING' | 'INTERESTED' | 'cancel';

export interface RsvpActionView {
  readonly target: RsvpTarget;
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
  readonly isPrimary: boolean;
}

export interface RsvpView {
  /** The RSVP exactly as the server reported it. `null` means no RSVP. */
  readonly status: EventRsvpStatus | null;
  readonly statusLabel: string;
  /** True when the server has explicitly closed RSVP (cancelled/completed). */
  readonly isClosed: boolean;
  readonly closedReason: string | null;
  readonly actions: readonly RsvpActionView[];
  readonly canRespond: boolean;
  readonly summary: string;
}

const RSVP_STATUS_LABELS: Readonly<Record<EventRsvpStatus, string>> = {
  GOING: "You're going",
  INTERESTED: "You're interested",
  WAITLISTED: 'On the waitlist',
  CANCELLED: 'Not responding',
};

const RSVP_STATUS_SUMMARIES: Readonly<Record<EventRsvpStatus, string>> = {
  GOING: 'Your place is confirmed.',
  INTERESTED: 'You have not confirmed a place yet.',
  WAITLISTED: 'You will be moved up automatically if a place opens up.',
  CANCELLED: 'You are not on the list for this event.',
};

export function getRsvpStatusLabel(status: EventRsvpStatus): string {
  return RSVP_STATUS_LABELS[status];
}

function getClosedReason(event: Pick<EventDto, 'status'>): string | null {
  if (event.status === 'CANCELLED') return 'This event was cancelled by the organiser.';
  if (event.status === 'COMPLETED') return 'This event has already taken place.';
  if (event.status === 'ARCHIVED') return 'This event is no longer accepting responses.';
  if (event.status === 'DRAFT') return 'This event has not been published yet.';
  return null;
}

/**
 * Builds the RSVP control set from server state alone.
 *
 * Critically, this never inspects `attendeeCount`/`capacity` to decide whether
 * an RSVP is possible. Capacity and waitlisting are server decisions surfaced as
 * `EVENT_FULL` / authoritative `WAITLISTED` results.
 */
export function deriveRsvpView(event: Pick<EventDto, 'status' | 'currentUserRsvp'>): RsvpView {
  const status = event.currentUserRsvp ?? null;
  const closedReason = getClosedReason(event);
  const isClosed = closedReason !== null;

  if (isClosed) {
    return {
      status,
      statusLabel: status ? RSVP_STATUS_LABELS[status] : 'Not responding',
      isClosed: true,
      closedReason,
      actions: [],
      canRespond: false,
      summary: closedReason,
    };
  }

  const actions: RsvpActionView[] = [];

  if (status === 'GOING') {
    actions.push({
      target: 'INTERESTED',
      label: 'Change to interested',
      accessibilityLabel: "You're going. Change your response to interested.",
      accessibilityHint:
        'This releases your confirmed place. If someone is waiting, the next person is moved up automatically.',
      isPrimary: false,
    });
  } else {
    actions.push({
      target: 'GOING',
      label: status === 'INTERESTED' ? 'Confirm my place' : 'Go',
      accessibilityLabel:
        status === 'INTERESTED'
          ? "You're interested. Confirm your place at this event."
          : status === 'WAITLISTED'
            ? "You're on the waitlist. Try to take a confirmed place."
            : 'Respond that you are going to this event.',
      accessibilityHint:
        'The organiser decides availability. If the event is full you may be added to the waitlist.',
      isPrimary: true,
    });
  }

  if (status === 'GOING' || status === 'INTERESTED' || status === 'WAITLISTED') {
    actions.push({
      target: 'cancel',
      label: status === 'WAITLISTED' ? 'Leave waitlist' : 'Cancel my RSVP',
      accessibilityLabel:
        status === 'WAITLISTED'
          ? 'Leave the waitlist for this event.'
          : 'Cancel your response to this event.',
      accessibilityHint:
        status === 'WAITLISTED'
          ? 'You will give up your waitlist position.'
          : 'If you are on the waitlist your place is released to someone else.',
      isPrimary: false,
    });
  } else {
    // `INTERESTED` is a real, separate response that does not hold a place, so it
    // is offered to viewers who have not responded or have cancelled. It is not
    // offered to a waitlisted viewer, where it would silently drop their
    // position.
    actions.push({
      target: 'INTERESTED',
      label: 'Interested',
      accessibilityLabel: 'Let the organiser know you are interested in this event.',
      accessibilityHint: 'Interested does not hold you a place and does not affect the waitlist.',
      isPrimary: false,
    });
  }

  const statusLabel = status ? RSVP_STATUS_LABELS[status] : 'Not responding';
  const summary = status
    ? RSVP_STATUS_SUMMARIES[status]
    : 'Let the organiser know if you plan to attend.';

  return {
    status,
    statusLabel,
    isClosed: false,
    closedReason: null,
    actions,
    canRespond: actions.length > 0,
    summary,
  };
}

export interface CapacityView {
  readonly hasCapacity: boolean;
  readonly attendeeCount: number;
  readonly waitlistCount: number;
  readonly capacity: number | null;
  readonly waitlistEnabled: boolean;
  /** Human summary of server-reported numbers. Never used to gate an action. */
  readonly summary: string;
  readonly accessibilityLabel: string;
  readonly remainingSeats: number | null;
}

/** Informational only: mirrors server counters without deriving eligibility. */
export function deriveCapacityView(
  event: Pick<EventDto, 'attendeeCount' | 'waitlistCount' | 'capacity' | 'isWaitlistEnabled'>
): CapacityView {
  const hasCapacity = typeof event.capacity === 'number' && event.capacity > 0;
  const capacity = hasCapacity ? (event.capacity as number) : null;
  const remainingSeats = capacity === null ? null : Math.max(0, capacity - event.attendeeCount);

  const parts: string[] = [];
  if (capacity === null) {
    parts.push(`${formatCount(event.attendeeCount)} going`);
  } else {
    parts.push(`${formatCount(event.attendeeCount)} of ${formatCount(capacity)} places filled`);
  }
  if (event.waitlistCount > 0) {
    parts.push(
      event.isWaitlistEnabled
        ? `${formatCount(event.waitlistCount)} on the waitlist`
        : `${formatCount(event.waitlistCount)} waitlisted (organiser disabled the waitlist)`
    );
  }
  if (remainingSeats === 0 && event.isWaitlistEnabled) {
    parts.push('a waitlist is available');
  }

  return {
    hasCapacity,
    attendeeCount: event.attendeeCount,
    waitlistCount: event.waitlistCount,
    capacity,
    waitlistEnabled: event.isWaitlistEnabled,
    summary: parts.join(' \u00b7 '),
    accessibilityLabel: parts.join('. '),
    remainingSeats,
  };
}

// ----------------------------------------------------
// Event location privacy
// ----------------------------------------------------

export interface EventLocationView {
  readonly isOnline: boolean;
  /** Always present in the DTO; a coarse label safe to show everyone. */
  readonly locationName: string;
  /** Null unless the viewer is GOING or the organiser. */
  readonly address: string | null;
  readonly url: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  /** True when the server withheld exact details from this viewer. */
  readonly isRestricted: boolean;
  readonly restrictionNotice: string | null;
}

/**
 * The API nulls `locationAddress`/`locationUrl` for anyone who is not a confirmed
 * attendee or the organiser. We surface that as an explicit, non-error state so
 * it is never mistaken for an event without a venue.
 */
export function deriveLocationView(
  event: Pick<
    EventDto,
    'type' | 'locationName' | 'locationAddress' | 'locationUrl' | 'latitude' | 'longitude'
  >
): EventLocationView {
  const isOnline = event.type === 'ONLINE';
  const address = event.locationAddress ?? null;
  const url = event.locationUrl ?? null;
  // The withheld detail is the address for physical events and the joining URL
  // for online events. Coordinates are redacted with the address by the API, so
  // they are never used to decide whether this viewer may see the location.
  const isRestricted = isOnline ? !url : !address;

  return {
    isOnline,
    locationName: event.locationName,
    address,
    url,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    isRestricted,
    restrictionNotice: isRestricted
      ? isOnline
        ? 'The joining link is only shared with confirmed attendees.'
        : 'The exact address is only shared with confirmed attendees.'
      : null,
  };
}

/**
 * Maps the server's RSVP status onto the vocabulary the event card understands.
 * `WAITLISTED` has no card representation, so it maps to null rather than being
 * mislabelled as "interested" or "not going"; the detail screen states it.
 */
export function toEventCardRsvp(
  status: EventRsvpStatus | null | undefined
): 'attending' | 'interested' | 'not_going' | null {
  switch (status) {
    case 'GOING':
      return 'attending';
    case 'INTERESTED':
      return 'interested';
    case 'CANCELLED':
      return 'not_going';
    default:
      return null;
  }
}

// ----------------------------------------------------
// Post visibility
// ----------------------------------------------------

const VISIBILITY_LABELS = {
  PUBLIC: 'Public',
  COMMUNITY: 'Community only',
  FOLLOWERS: 'Followers only',
} as const;

export function getVisibilityLabel(visibility: PostDto['visibility']): string {
  return VISIBILITY_LABELS[visibility];
}

export function getVisibilityHint(visibility: PostDto['visibility']): string {
  switch (visibility) {
    case 'PUBLIC':
      return 'Visible to everyone on Nazar.';
    case 'COMMUNITY':
      return 'Only members of this community can see this post.';
    case 'FOLLOWERS':
      return 'Only your accepted followers can see this post.';
  }
}

// ----------------------------------------------------
// Current user
// ----------------------------------------------------

/**
 * `PostDto` has no `isOwnPost` flag and comment DTOs have no ownership marker,
 * so the client has to compare ids. The signed-in id comes from the profile
 * store that `session-service` hydrates on every session bootstrap.
 */
export function isOwnedByViewer(
  ownerId: string,
  currentUserId: string | null | undefined
): boolean {
  return !!currentUserId && ownerId === currentUserId;
}

// ----------------------------------------------------
// Formatting
// ----------------------------------------------------

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const thousands = value / 1000;
    return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, '') : Math.round(thousands)}k`;
  }
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
}

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

function safeDate(iso: string): Date | null {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatEventDateLabel(startAt: string): string {
  const date = safeDate(startAt);
  if (!date) return 'Date to be announced';
  return new Intl.DateTimeFormat(undefined, DATE_TIME_FORMAT).format(date);
}

export function formatEventDateRange(startAt: string, endAt: string): string {
  const start = safeDate(startAt);
  const end = safeDate(endAt);
  if (!start) return 'Date to be announced';
  if (!end) return formatEventDateLabel(startAt);

  const startLabel = new Intl.DateTimeFormat(undefined, DATE_TIME_FORMAT).format(start);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const time = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${startLabel} \u2013 ${time.format(end)}`;
  }
  return `${startLabel} \u2013 ${new Intl.DateTimeFormat(undefined, DATE_FORMAT).format(end)}`;
}

export function formatRelativeTime(iso: string): string {
  const date = safeDate(iso);
  if (!date) return '';
  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(deltaSeconds);

  const units: readonly { limit: number; seconds: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { limit: 60, seconds: 1, unit: 'second' },
    { limit: 3600, seconds: 60, unit: 'minute' },
    { limit: 86400, seconds: 3600, unit: 'hour' },
    { limit: 604800, seconds: 86400, unit: 'day' },
    { limit: 2629800, seconds: 604800, unit: 'week' },
    { limit: 31557600, seconds: 2629800, unit: 'month' },
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const { limit, seconds, unit } of units) {
    if (absolute < limit) {
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return formatter.format(Math.round(deltaSeconds / 31557600), 'year');
}

export function isPastEvent(startAt: string, status: EventStatus): boolean {
  if (status === 'COMPLETED' || status === 'ARCHIVED' || status === 'CANCELLED') return true;
  const date = safeDate(startAt);
  return date ? date.getTime() < Date.now() : false;
}

export function getEventStatusLabel(status: EventStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'PUBLISHED':
      return 'Published';
    case 'CANCELLED':
      return 'Cancelled';
    case 'COMPLETED':
      return 'Completed';
    case 'ARCHIVED':
      return 'Archived';
  }
}

// ----------------------------------------------------
// Accessibility labels
// ----------------------------------------------------

export function describeEventForScreenReader(event: EventDto): string {
  const parts = [
    event.title,
    formatEventDateRange(event.startAt, event.endAt),
    event.type === 'ONLINE' ? 'Online event' : `In person at ${event.locationName}`,
  ];
  if (event.communityName) parts.push(`Hosted by ${event.communityName}`);
  parts.push(deriveCapacityView(event).accessibilityLabel);
  if (event.currentUserRsvp) parts.push(RSVP_STATUS_LABELS[event.currentUserRsvp]);
  return parts.join('. ');
}

export function describeCommunityForScreenReader(
  community: Pick<CommunityDto, 'name' | 'description' | 'memberCount' | 'privacy'>
): string {
  const privacy = {
    PUBLIC: 'Public community',
    PRIVATE: 'Private community, approval required to join',
    HIDDEN: 'Hidden community, not publicly listed',
  }[community.privacy];
  return [
    community.name,
    privacy,
    `${formatCount(community.memberCount)} members`,
    community.description,
  ].join('. ');
}

export function describePostForScreenReader(
  post: Pick<PostDto, 'author' | 'content' | 'likeCount' | 'commentCount' | 'visibility'>
): string {
  const author = post.author?.displayName ?? 'Someone';
  return `${author} posted. ${post.content}. ${formatCount(post.likeCount)} reactions, ${formatCount(
    post.commentCount
  )} comments. ${getVisibilityLabel(post.visibility)}.`;
}

// ----------------------------------------------------
// Route builders
// ----------------------------------------------------

/**
 * Single source of truth for social navigation. Screens must never hand-write
 * paths, which previously allowed singular/plural drift between call sites.
 */
/**
 * Ids reach these builders from API responses and query params. They are UUIDs
 * in practice, but interpolating them raw would let a crafted id inject a path
 * segment or a query parameter, so every dynamic segment is encoded once here.
 */
const seg = (id: string) => encodeURIComponent(id);

export const socialRoutes = {
  home: () => '/(tabs)/explore',
  feed: () => '/social/feed',
  communities: () => '/social/communities',
  createCommunity: () => '/social/communities/create',
  community: (id: string) => `/social/community/${seg(id)}`,
  communityMembers: (id: string) => `/social/community/${seg(id)}/members`,
  communityFeed: (id: string) => `/social/community/${seg(id)}/feed`,
  events: () => '/social/events',
  createEvent: (communityId?: string) =>
    communityId ? `/social/events/create?communityId=${seg(communityId)}` : '/social/events/create',
  event: (id: string) => `/social/event/${seg(id)}`,
  eventAttendees: (id: string) => `/social/event/${seg(id)}/attendees`,
  post: (id: string) => `/social/post/${seg(id)}`,
  createPost: (communityId?: string) =>
    communityId ? `/social/create-post?communityId=${seg(communityId)}` : '/social/create-post',
} as const;
