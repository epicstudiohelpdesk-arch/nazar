import { describe, it, expect } from 'vitest';
import {
  byId,
  deriveCapacityView,
  deriveLocationView,
  deriveMembershipView,
  deriveRsvpView,
  describeSocialError,
  flattenPages,
  formatEventDateRange,
  formatRelativeTime,
  getJoinOutcomeLabel,
  getMutationErrorMessage,
  getNextCursorPageParam,
  getRsvpStatusLabel,
  getRoleLabel,
  getSocialFieldErrors,
  getVisibilityHint,
  getVisibilityLabel,
  isOwnedByViewer,
  isStaffRole,
  SocialApiError,
  socialRoutes,
  toEventCardRsvp,
  type CursorPage,
} from '../src/social/social-state.js';
import type {
  CommunityMembershipStatus,
  CommunityRole,
  EventDto,
  EventRsvpStatus,
  PostDto,
} from '@platform/api-contracts';

const error = (params: {
  code: string;
  statusCode: number;
  message: string;
  details?: { field: string; message: string }[];
}) => new SocialApiError(params);

function makeEvent(
  overrides: Partial<EventDto> = {}
): Pick<
  EventDto,
  | 'status'
  | 'currentUserRsvp'
  | 'type'
  | 'locationName'
  | 'locationAddress'
  | 'locationUrl'
  | 'latitude'
  | 'longitude'
  | 'attendeeCount'
  | 'waitlistCount'
  | 'capacity'
  | 'isWaitlistEnabled'
> {
  return {
    status: 'PUBLISHED',
    currentUserRsvp: null,
    type: 'PHYSICAL',
    locationName: 'Cubbon Park Gate 3',
    locationAddress: 'Sampangi Rama Nagar, Bengaluru',
    locationUrl: null,
    latitude: 12.9767,
    longitude: 77.5929,
    capacity: 30,
    attendeeCount: 12,
    waitlistCount: 0,
    isWaitlistEnabled: true,
    ...overrides,
  } as ReturnType<typeof makeEvent>;
}

describe('pagination', () => {
  const page = (over: Partial<CursorPage<unknown>> = {}): CursorPage<unknown> => ({
    items: [],
    hasMore: false,
    ...over,
  });

  it('uses the next cursor while the server says more pages exist', () => {
    expect(getNextCursorPageParam(page({ hasMore: true, nextCursor: 'c1' }))).toBe('c1');
  });

  it('stops when the server reports the last page', () => {
    expect(getNextCursorPageParam(page({ hasMore: false, nextCursor: 'c1' }))).toBeUndefined();
  });

  it('stops on a null cursor even when hasMore is wrong', () => {
    // A server that says "more" with no cursor must not make React Query loop.
    expect(getNextCursorPageParam(page({ hasMore: true, nextCursor: null }))).toBeUndefined();
    expect(getNextCursorPageParam(page({ hasMore: true }))).toBeUndefined();
  });
});

describe('flattenPages', () => {
  it('concatenates pages in server order without duplicates', () => {
    const pages: CursorPage<{ id: string; joinedAt: string }>[] = [
      { items: [{ id: 'a', joinedAt: '2026-09-01' }], hasMore: true },
      { items: [{ id: 'b', joinedAt: '2026-09-02' }], hasMore: false },
    ];
    // The client must not re-sort: the server already orders by `joinedAt DESC`.
    expect(flattenPages(pages, byId).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('de-duplicates a row repeated across a page boundary', () => {
    const pages: CursorPage<{ id: string }>[] = [
      { items: [{ id: 'a' }, { id: 'b' }], hasMore: true },
      { items: [{ id: 'b' }, { id: 'c' }], hasMore: false },
    ];
    expect(flattenPages(pages, byId).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list for missing or empty pages', () => {
    expect(flattenPages(undefined, byId)).toEqual([]);
    expect(flattenPages([], byId)).toEqual([]);
  });
});

describe('deriveMembershipView', () => {
  const view = (role: CommunityRole | null, status: CommunityMembershipStatus | null) =>
    deriveMembershipView({ currentUserRole: role, currentUserMembershipStatus: status });

  it('offers an immediate join to a non-member', () => {
    const result = view(null, null);
    expect(result.action).toBe('join');
    expect(result.isMember).toBe(false);
    expect(result.statusLabel).toBeNull();
    expect(result.primaryActionLabel).toMatch(/join/i);
  });

  it('never infers the join outcome from privacy alone', () => {
    // A PRIVATE community still returns ACTIVE for an approved member, so the
    // action must be derived from status only.
    expect(view('MEMBER', 'ACTIVE').action).toBe('leave');
  });

  it('offers rejoin after leaving', () => {
    const result = view(null, 'LEFT');
    expect(result.action).toBe('join');
    expect(result.primaryActionLabel).toMatch(/rejoin/i);
  });

  it('reports a pending request instead of offering another one', () => {
    const result = view(null, 'PENDING');
    expect(result.action).toBe('pending');
    expect(result.isMember).toBe(false);
    expect(result.canCreatePost).toBe(false);
    expect(result.statusLabel).toMatch(/pending/i);
  });

  it('restricts a banned member', () => {
    const result = view(null, 'BANNED');
    expect(result.action).toBe('banned');
    expect(result.canCreatePost).toBe(false);
    expect(result.canModerate).toBe(false);
  });

  it('allows an active member to post', () => {
    const result = view('MEMBER', 'ACTIVE');
    expect(result.canCreatePost).toBe(true);
    expect(result.action).toBe('leave');
  });

  it('treats the creator of a private community as an active member', () => {
    expect(view('OWNER', 'ACTIVE').isMember).toBe(true);
  });

  it('grants moderation to owner and admin only', () => {
    expect(view('OWNER', 'ACTIVE').canModerate).toBe(true);
    expect(view('ADMIN', 'ACTIVE').canModerate).toBe(true);
    expect(view('MODERATOR', 'ACTIVE').canModerate).toBe(false);
    expect(view('MEMBER', 'ACTIVE').canModerate).toBe(false);
    expect(view(null, 'ACTIVE').canModerate).toBe(false);
  });

  it('does not offer moderation to a role without active membership', () => {
    // A role is only meaningful with an ACTIVE membership; offering a Remove
    // control here would produce a guaranteed server rejection.
    expect(view('ADMIN', 'PENDING').canModerate).toBe(false);
    expect(view('OWNER', 'BANNED').canModerate).toBe(false);
  });

  it('mirrors the moderation gate in comment permissions', () => {
    expect(view('ADMIN', 'ACTIVE').canModerateComments).toBe(true);
    expect(view('MODERATOR', 'ACTIVE').canModerateComments).toBe(false);
  });

  it('recognises staff roles', () => {
    expect(isStaffRole('OWNER')).toBe(true);
    expect(isStaffRole('ADMIN')).toBe(true);
    expect(isStaffRole('MODERATOR')).toBe(false);
    expect(isStaffRole('MEMBER')).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });

  it('labels every role', () => {
    expect(getRoleLabel('OWNER')).toMatch(/owner/i);
    expect(getRoleLabel('ADMIN')).toMatch(/admin/i);
    expect(getRoleLabel('MODERATOR')).toMatch(/moderator/i);
    expect(getRoleLabel('MEMBER')).toMatch(/member/i);
  });
});

describe('deriveRsvpView', () => {
  const targets = (rsvp: EventRsvpStatus | null) =>
    deriveRsvpView({ status: 'PUBLISHED', currentUserRsvp: rsvp }).actions.map((a) => a.target);

  it('offers going and interested to a viewer who has not responded', () => {
    const view = deriveRsvpView({ status: 'PUBLISHED', currentUserRsvp: null });
    expect(targets(null)).toEqual(['GOING', 'INTERESTED']);
    expect(view.actions[0].isPrimary).toBe(true);
    expect(view.statusLabel).toBe('Not responding');
    expect(view.canRespond).toBe(true);
  });

  it('lets a confirmed attendee downgrade or cancel', () => {
    expect(targets('GOING')).toEqual(['INTERESTED', 'cancel']);
  });

  it('lets an interested viewer confirm a place or cancel', () => {
    const view = deriveRsvpView({ status: 'PUBLISHED', currentUserRsvp: 'INTERESTED' });
    expect(targets('INTERESTED')).toEqual(['GOING', 'cancel']);
    expect(view.actions[0].label).toMatch(/confirm/i);
  });

  it('lets a waitlisted viewer take a place or leave the waitlist', () => {
    const view = deriveRsvpView({ status: 'PUBLISHED', currentUserRsvp: 'WAITLISTED' });
    // Downgrading to interested is deliberately absent: it would silently drop
    // the waitlist position.
    expect(targets('WAITLISTED')).toEqual(['GOING', 'cancel']);
    expect(view.actions[1].label).toMatch(/waitlist/i);
  });

  it('never does capacity arithmetic of its own', () => {
    // A full event still offers "Go"; the server decides between a confirmed
    // place, a waitlist place, and EVENT_FULL.
    const full = deriveRsvpView(makeEvent({ capacity: 10, attendeeCount: 10 }));
    expect(full.actions.some((a) => a.target === 'GOING')).toBe(true);
    expect(full.actions.some((a) => a.isDisabled)).toBe(false);
  });

  it('closes RSVPs for non-published event states', () => {
    for (const status of ['CANCELLED', 'COMPLETED', 'ARCHIVED', 'DRAFT'] as const) {
      const view = deriveRsvpView({ status, currentUserRsvp: null });
      expect(view.isClosed).toBe(true);
      expect(view.actions).toEqual([]);
      expect(view.canRespond).toBe(false);
      expect(view.closedReason).toBeTruthy();
    }
  });

  it('keeps the confirmed status visible on a closed event', () => {
    const view = deriveRsvpView({ status: 'CANCELLED', currentUserRsvp: 'GOING' });
    expect(view.status).toBe('GOING');
    expect(view.statusLabel).toBe("You're going");
  });

  it('labels and explains every RSVP status', () => {
    expect(getRsvpStatusLabel('GOING')).toMatch(/going/i);
    expect(getRsvpStatusLabel('INTERESTED')).toMatch(/interested/i);
    expect(getRsvpStatusLabel('WAITLISTED')).toMatch(/waitlist/i);
    expect(getRsvpStatusLabel('CANCELLED')).toBeTruthy();
    expect(deriveRsvpView({ status: 'PUBLISHED', currentUserRsvp: 'GOING' }).summary).toBe(
      'Your place is confirmed.'
    );
  });
});

describe('deriveCapacityView', () => {
  it('mirrors server counters for a capped event', () => {
    const view = deriveCapacityView(makeEvent({ capacity: 30, attendeeCount: 12 }));
    expect(view.hasCapacity).toBe(true);
    expect(view.remainingSeats).toBe(18);
    expect(view.summary).toMatch(/12 of 30/);
  });

  it('reports a full event with no remaining seats', () => {
    const view = deriveCapacityView(makeEvent({ capacity: 10, attendeeCount: 10 }));
    expect(view.remainingSeats).toBe(0);
    expect(view.summary).toMatch(/waitlist is available/);
  });

  it('describes an unlimited event without inventing a limit', () => {
    const view = deriveCapacityView(makeEvent({ capacity: null, attendeeCount: 8 }));
    expect(view.hasCapacity).toBe(false);
    expect(view.remainingSeats).toBeNull();
    expect(view.summary).toMatch(/8/);
    expect(view.summary).not.toMatch(/undefined|NaN/);
  });

  it('treats a zero capacity as unlimited rather than sold out', () => {
    const view = deriveCapacityView(makeEvent({ capacity: 0, attendeeCount: 5 }));
    expect(view.hasCapacity).toBe(false);
    expect(view.summary).not.toMatch(/NaN/);
  });

  it('never reports a negative number of seats', () => {
    const view = deriveCapacityView(makeEvent({ capacity: 5, attendeeCount: 9 }));
    expect(view.remainingSeats).toBe(0);
    expect(view.summary).not.toMatch(/-/);
  });

  it('mentions the waitlist only when people are on it', () => {
    expect(
      deriveCapacityView(makeEvent({ waitlistCount: 3, isWaitlistEnabled: true })).summary
    ).toMatch(/waitlist/i);
    expect(
      deriveCapacityView(makeEvent({ waitlistCount: 0, isWaitlistEnabled: true })).summary
    ).not.toMatch(/waitlist/i);
  });

  it('explains waitlisted people even when the organiser disabled the waitlist', () => {
    // Existing waitlist entries survive the organiser turning the waitlist off,
    // so the count must still be explained rather than described as "waiting".
    const summary = deriveCapacityView(
      makeEvent({ waitlistCount: 2, isWaitlistEnabled: false })
    ).summary;
    expect(summary).toMatch(/waitlisted/i);
    expect(summary).not.toMatch(/waiting/i);
  });
});

describe('deriveLocationView', () => {
  it('shows the address to a confirmed attendee', () => {
    const view = deriveLocationView(makeEvent());
    expect(view.isRestricted).toBe(false);
    expect(view.address).toBe('Sampangi Rama Nagar, Bengaluru');
    expect(view.restrictionNotice).toBeNull();
  });

  it('explains a withheld address without calling the event broken', () => {
    const view = deriveLocationView(makeEvent({ locationAddress: null }));
    expect(view.isRestricted).toBe(true);
    expect(view.address).toBeNull();
    expect(view.restrictionNotice).toMatch(/confirmed attendees/i);
  });

  it('does not let leftover coordinates make the location look available', () => {
    // Coordinates identify the venue as precisely as the address does.
    const view = deriveLocationView(makeEvent({ locationAddress: null }));
    expect(view.isRestricted).toBe(true);
  });

  it('treats the joining link as the withheld detail for online events', () => {
    const view = deriveLocationView(
      makeEvent({ type: 'ONLINE', locationAddress: 'ignored', locationUrl: null })
    );
    expect(view.isOnline).toBe(true);
    expect(view.isRestricted).toBe(true);
    expect(view.restrictionNotice).toMatch(/joining link/i);
  });

  it('shows the joining link when the server released it', () => {
    const view = deriveLocationView(
      makeEvent({ type: 'ONLINE', locationUrl: 'https://meet.nazar.app/event-1' })
    );
    expect(view.isRestricted).toBe(false);
    expect(view.url).toBe('https://meet.nazar.app/event-1');
  });

  it('always keeps the coarse location name', () => {
    expect(deriveLocationView(makeEvent({ locationAddress: null })).locationName).toBe(
      'Cubbon Park Gate 3'
    );
  });
});

describe('toEventCardRsvp', () => {
  it('maps the states the card can express', () => {
    expect(toEventCardRsvp('GOING')).toBe('attending');
    expect(toEventCardRsvp('INTERESTED')).toBe('interested');
    expect(toEventCardRsvp('CANCELLED')).toBe('not_going');
  });

  it('omits a waitlisted viewer rather than mislabelling them', () => {
    expect(toEventCardRsvp('WAITLISTED')).toBeNull();
    expect(toEventCardRsvp(null)).toBeNull();
    expect(toEventCardRsvp(undefined)).toBeNull();
  });
});

describe('error presentation', () => {
  it('maps a network failure to a retryable state', () => {
    const view = describeSocialError(new TypeError('Network request failed'));
    expect(view.kind).toBe('network');
    expect(view.stateType).toBe('network_unavailable');
    expect(view.isRetryable).toBe(true);
  });

  it('never surfaces a raw server string for an unexpected error', () => {
    const message = getMutationErrorMessage(new Error('SQLSTATE 42P01 relation does not exist'));
    expect(message).not.toMatch(/SQLSTATE/);
    expect(message.length).toBeGreaterThan(0);
  });

  it('does not tell the user to retry a full event', () => {
    const view = describeSocialError(
      error({ code: 'EVENT_FULL', statusCode: 409, message: 'Event is at capacity' })
    );
    expect(view.kind).toBe('event_full');
    expect(view.isRetryable).toBe(false);
  });

  it('distinguishes the free community limit from a permission failure', () => {
    const view = describeSocialError(
      error({
        code: 'ENTITLEMENT_REQUIRED',
        statusCode: 403,
        message: 'This feature requires active PREMIUM',
      })
    );
    expect(view.kind).toBe('entitlement_required');
  });

  it('maps an expired session to a sign-in problem', () => {
    const view = describeSocialError(
      error({ code: 'SESSION_EXPIRED', statusCode: 401, message: 'expired' })
    );
    expect(view.stateType).toBe('auth_expired');
    expect(view.isRetryable).toBe(false);
  });

  it('maps missing content and denied access differently', () => {
    expect(
      describeSocialError(error({ code: 'POST_NOT_FOUND', statusCode: 404, message: 'x' })).kind
    ).toBe('not_found');
    expect(
      describeSocialError(error({ code: 'POST_ACCESS_DENIED', statusCode: 403, message: 'x' })).kind
    ).toBe('access_denied');
  });

  it('maps a cancelled event to a terminal state', () => {
    const view = describeSocialError(
      error({ code: 'EVENT_CANCELLED', statusCode: 400, message: 'cancelled' })
    );
    expect(view.kind).toBe('event_over');
  });

  it('maps membership conflicts to the membership state', () => {
    for (const code of [
      'COMMUNITY_JOIN_PENDING',
      'COMMUNITY_MEMBER_BANNED',
      'COMMUNITY_MEMBER_EXISTS',
    ]) {
      expect(describeSocialError(error({ code, statusCode: 400, message: 'x' })).kind).toBe(
        'membership'
      );
    }
  });

  it('maps a taken community name to a conflict', () => {
    expect(
      describeSocialError(error({ code: 'COMMUNITY_NAME_TAKEN', statusCode: 409, message: 'x' }))
        .kind
    ).toBe('conflict');
  });

  it('falls back to an unknown state for an unrecognised code', () => {
    expect(describeSocialError(error({ code: 'WAT', statusCode: 500, message: 'x' })).kind).toBe(
      'unknown'
    );
  });

  it('maps server field details onto field keys', () => {
    const err = error({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Invalid body',
      details: [{ field: 'name', message: 'Community name is taken' }],
    });
    expect(getSocialFieldErrors(err).name?.message).toBe('Community name is taken');
  });

  it('returns no field errors for a non-social error', () => {
    expect(getSocialFieldErrors(new Error('boom'))).toEqual({});
    expect(getSocialFieldErrors(undefined)).toEqual({});
  });
});

describe('post visibility', () => {
  it('labels and explains every visibility value', () => {
    for (const visibility of ['PUBLIC', 'COMMUNITY', 'FOLLOWERS'] as const) {
      expect(getVisibilityLabel(visibility)).toBeTruthy();
      expect(getVisibilityHint(visibility)).toBeTruthy();
    }
  });

  it('does not describe community-only posts as visible to everyone', () => {
    expect(getVisibilityLabel('COMMUNITY')).not.toMatch(/public|everyone/i);
    expect(getVisibilityHint('COMMUNITY')).toMatch(/members/i);
  });
});

describe('isOwnedByViewer', () => {
  it('matches only the signed-in author', () => {
    expect(isOwnedByViewer('user-1', 'user-1')).toBe(true);
    expect(isOwnedByViewer('user-1', 'user-2')).toBe(false);
  });

  it('treats an unknown viewer as a non-owner', () => {
    // Showing Edit/Delete to an unknown viewer would be a false claim of control.
    expect(isOwnedByViewer('user-1', null)).toBe(false);
    expect(isOwnedByViewer('user-1', undefined)).toBe(false);
    expect(isOwnedByViewer('user-1', '')).toBe(false);
  });
});

describe('getJoinOutcomeLabel', () => {
  it('distinguishes an approved join from a pending request', () => {
    expect(getJoinOutcomeLabel('PENDING')).toMatch(/moderator/i);
    expect(getJoinOutcomeLabel('ACTIVE')).toMatch(/joined/i);
  });

  it('does not claim a successful join for a refusal', () => {
    expect(getJoinOutcomeLabel('BANNED')).not.toMatch(/you have joined/i);
    expect(getJoinOutcomeLabel('BANNED')).toMatch(/cannot join/i);
    expect(getJoinOutcomeLabel('LEFT')).not.toMatch(/you have joined/i);
  });

  it('falls back to a neutral statement for an absent status', () => {
    expect(getJoinOutcomeLabel(undefined)).not.toMatch(/you have joined/i);
  });
});

describe('formatting', () => {
  it('describes recent time in the past', () => {
    expect(formatRelativeTime(new Date(Date.now() - 3 * 60 * 1000).toISOString())).toMatch(/min/i);
  });

  it('does not crash on an unparsable timestamp', () => {
    expect(() => formatRelativeTime('not-a-date')).not.toThrow();
  });

  it('formats a same-day range as one line', () => {
    const label = formatEventDateRange('2026-10-04T00:15:00.000Z', '2026-10-04T02:00:00.000Z');
    expect(label).toMatch(/[–-]|to/i);
  });

  it('includes both dates in a multi-day range', () => {
    const label = formatEventDateRange('2026-10-04T00:15:00.000Z', '2026-10-05T02:00:00.000Z');
    expect(label).toContain(',');
  });

  it('does not print NaN for a missing end time', () => {
    const label = formatEventDateRange('2026-10-04T00:15:00.000Z', null);
    expect(label).not.toMatch(/NaN|Invalid/);
  });
});

describe('socialRoutes', () => {
  it('uses plural collections and singular details', () => {
    expect(socialRoutes.communities()).toBe('/social/communities');
    expect(socialRoutes.community('c1')).toBe('/social/community/c1');
    expect(socialRoutes.events()).toBe('/social/events');
    expect(socialRoutes.event('e1')).toBe('/social/event/e1');
  });

  it('keeps sub-resources under their parent', () => {
    expect(socialRoutes.communityMembers('c1')).toBe('/social/community/c1/members');
    expect(socialRoutes.communityFeed('c1')).toBe('/social/community/c1/feed');
    expect(socialRoutes.eventAttendees('e1')).toBe('/social/event/e1/attendees');
  });

  it('escapes an id so a crafted id cannot rewrite the route', () => {
    expect(socialRoutes.community('a/b?x=1')).not.toContain('?x=1');
    expect(socialRoutes.community('a/b?x=1')).toContain('%2F');
  });

  it('passes the community to the composers only when there is one', () => {
    expect(socialRoutes.createPost('c1')).toBe('/social/create-post?communityId=c1');
    expect(socialRoutes.createPost()).toBe('/social/create-post');
    expect(socialRoutes.createEvent('c1')).toBe('/social/events/create?communityId=c1');
    expect(socialRoutes.createEvent()).toBe('/social/events/create');
  });
});

describe('ownership of a post DTO', () => {
  it('drives the owner controls from the DTO author id', () => {
    // `PostDto` has no `isOwnPost` flag, so the screen compares ids.
    const post = { authorId: 'user-1' } as PostDto;
    expect(isOwnedByViewer(post.authorId, 'user-1')).toBe(true);
    expect(isOwnedByViewer(post.authorId, 'user-2')).toBe(false);
  });
});
