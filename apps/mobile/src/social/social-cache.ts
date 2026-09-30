/**
 * Social cache invalidation.
 *
 * Every social list is read from more than one screen: the Explore landing page
 * renders a short preview of each collection, and each collection also has a
 * full paginated screen. Those previews have their own query keys because they
 * cache a different shape.
 *
 * That makes it easy to refresh one surface and leave another stale, so all
 * invalidation goes through this module. It lives outside `social-state.ts`
 * because `social-api.ts` already imports `SocialApiError` from there, and a
 * reverse import of `SOCIAL_QUERY_KEYS` would create a module cycle.
 */
import type { QueryClient } from '@tanstack/react-query';
import { SOCIAL_QUERY_KEYS } from './social-api.js';

/**
 * Refetches community lists after a membership, creation, or moderation change.
 * `community(id)` prefixes that community's members and feed keys, so one call
 * covers the detail, roster, and community feed.
 */
export function invalidateCommunityLists(
  queryClient: QueryClient,
  communityId?: string | null
): void {
  void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.communityLists });
  void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.homePreview.myCommunities });
  void queryClient.invalidateQueries({
    queryKey: SOCIAL_QUERY_KEYS.homePreview.discoverCommunities,
  });
  if (communityId) {
    void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.community(communityId) });
  }
}

/**
 * Refetches every feed plus the Explore preview.
 *
 * A post mutation can change the global feed, the community feed, and any
 * community feed that already cached the post, and the client does not track
 * which communities those are. Invalidating the whole feed root is the only way
 * to guarantee no stale copy survives; the cost is a refetch of a few cached
 * lists.
 */
export function invalidateFeedLists(queryClient: QueryClient, communityId?: string | null): void {
  void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.feedLists });
  void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.homePreview.feed });
  if (communityId) {
    void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.communityFeed(communityId) });
  }
}

/** Refetches an event, its attendee roster/preview, and the event collections. */
export function invalidateEventLists(queryClient: QueryClient, eventId: string): void {
  void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.event(eventId) });
  // The events root, not `events()`: the Events screen caches a separate key per
  // community/type filter combination.
  void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.eventLists });
  void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.homePreview.events });
  void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.eventAttendees(eventId) });
  void queryClient.invalidateQueries({ queryKey: SOCIAL_QUERY_KEYS.eventAttendeePreview(eventId) });
}
