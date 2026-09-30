# Nazar Mobile · Social, Communities & Events Experience Architecture

## 1. Overview & Mission

Frontend Phase F7 establishes the complete production-grade **Social, Communities & Events** experience for Nazar. It builds on the design constitution of F0, the navigation and information architecture of F1, the component system of F2, onboarding of F3, candidate interaction of F4, mutual connections of F5, and messaging of F6:

```text
Explore (Social Home)
   ├── Global Feed ──────────────→ Post Detail ──→ Comments
   ├── My / Discover Communities → Community Detail ──→ Community Feed
   │                                    ├── Members (moderate)
   │                                    └── Events
   └── Upcoming Events ───────────→ Event Detail ──→ Attendees
```

The objective is to make the public half of Nazar feel coherent and safe: a viewer must always be able to tell what the server actually knows, what they are allowed to do, and what is merely a preview of data they cannot yet see.

**Design rule applied throughout:** the server is the only source of truth for membership, roles, ordering, pagination, capacity, RSVP outcome, privacy, and permissions. The client derives _presentation_ from server state and never invents state the API did not return.

---

## 2. Backend Capabilities Audit & Scope Boundaries

Audited from `apps/api/src/modules/social/controllers/{posts,communities,events}.controller.ts` and `packages/api-contracts/src/social/social.contract.ts`.

### Authoritative Endpoints

| Endpoint                                         | Method             | Response                                        | Client Integration                                                       |
| :----------------------------------------------- | :----------------- | :---------------------------------------------- | :----------------------------------------------------------------------- |
| `/v1/social/feed`                                | `GET`              | `PostFeedResponseDto`                           | **Integrated** · `useInfiniteQuery`, cursor pagination, community filter |
| `/v1/social/community/:id/feed`                  | `GET`              | `PostFeedResponseDto`                           | **Integrated** · separate query key, standalone route                    |
| `/v1/social/posts`                               | `POST`             | `PostDto`                                       | **Integrated** · text-only composer                                      |
| `/v1/social/posts/:id`                           | `GET`              | `PostDto`                                       | **Integrated** · the only endpoint that hydrates `userReaction`          |
| `/v1/social/posts/:id`                           | `PATCH` / `DELETE` | `PostDto` / `{success}`                         | **Integrated** · author-only, with confirmation                          |
| `/v1/social/posts/:id/comments`                  | `GET` / `POST`     | `PostCommentListResponseDto` / `PostCommentDto` | **Integrated**                                                           |
| `/v1/social/comments/:id`                        | `PATCH` / `DELETE` | `PostCommentDto` / `{success}`                  | **Integrated** · author or post author                                   |
| `/v1/social/posts/:id/reactions`                 | `POST`             | `PostReactionDto`                               | **Integrated** · five types, idempotent                                  |
| `/v1/social/posts/:id/reactions/:type`           | `DELETE`           | `{success}`                                     | **Integrated**                                                           |
| `/v1/social/communities`                         | `GET`              | `CommunityListResponseDto`                      | **Integrated** · "my communities"                                        |
| `/v1/social/communities/discover`                | `GET`              | `CommunityListResponseDto`                      | **Integrated** · suggestions                                             |
| `/v1/social/communities`                         | `POST`             | `CommunityDto`                                  | **Integrated** · free tier limit 3, then premium                         |
| `/v1/social/communities/:id`                     | `GET`              | `CommunityDto`                                  | **Integrated**                                                           |
| `/v1/social/communities/:id`                     | `PATCH`            | `CommunityDto`                                  | **Integrated** · OWNER/ADMIN, shared form with create                    |
| `/v1/social/communities/:id/join`                | `POST`             | `{status}`                                      | **Integrated** · outcome is `ACTIVE` or `PENDING`                        |
| `/v1/social/communities/:id/leave`               | `DELETE`           | `{success}`                                     | **Integrated**                                                           |
| `/v1/social/communities/:id/members`             | `GET`              | `CommunityMemberListResponseDto`                | **Integrated** · paginated roster                                        |
| `/v1/social/communities/:id/members/:userId/ban` | `POST`             | `{success}`                                     | **Integrated** · OWNER/ADMIN, never self or owner                        |
| `/v1/events`                                     | `GET`              | `EventListResponseDto`                          | **Integrated** · filter by community and type                            |
| `/v1/events`                                     | `POST`             | `EventDto`                                      | **Integrated** · no premium gate                                         |
| `/v1/events/:id`                                 | `GET`              | `EventDto`                                      | **Integrated** · privacy-aware                                           |
| `/v1/events/:id`                                 | `PATCH`            | `EventDto`                                      | Client wrapped, **no edit UI** (see gaps)                                |
| `/v1/events/:id`                                 | `DELETE`           | `{success}`                                     | **Integrated** · organiser-only cancel                                   |
| `/v1/events/:id/rsvp`                            | `POST` / `PATCH`   | `{status}`                                      | **Integrated** · authoritative `WAITLISTED`                              |
| `/v1/events/:id/rsvp`                            | `DELETE`           | `{success}`                                     | **Integrated** · FIFO promotion is server-side                           |
| `/v1/events/:id/attendees`                       | `GET`              | `EventAttendeeListResponseDto`                  | **Integrated** · `GOING` only                                            |

### Deliberate Gaps — Not Implemented, Not Advertised

These are absent because the backend cannot support them truthfully. The UI never simulates them.

| Gap                         | Reason                                              | Consequence in UI                             |
| :-------------------------- | :-------------------------------------------------- | :-------------------------------------------- |
| Post media upload           | No presigned-URL or attachment endpoint             | Composer is text-only and says so             |
| Community search            | No search endpoint on `discover`                    | No search field; discovery is server-ranked   |
| Pending member approval     | `listMembers` returns `ACTIVE` only                 | No approval queue; `approveMembership` unused |
| Event edit                  | `PATCH /events/:id` exists, no editor surface in F7 | No edit control; cancel is offered instead    |
| Social notification routing | Notification enums for social do not exist          | No notification deep links to social routes   |

---

## 3. Route Map

All social routes live under `app/social/`. Collections are plural, details singular — `/social/communities` and `/social/community/[communityId]`.

| Route File                                   | Screen                   | Purpose                                |
| :------------------------------------------- | :----------------------- | :------------------------------------- |
| `app/(tabs)/explore/index.tsx`               | `SocialHomeScreen`       | Tab landing with four previews         |
| `social/feed.tsx`                            | `SocialFeedScreen`       | Global feed                            |
| `social/communities.tsx`                     | `CommunitiesScreen`      | My / discover switch                   |
| `social/communities/create.tsx`              | `CreateCommunityScreen`  | Create community                       |
| `social/community/[communityId]/index.tsx`   | `CommunityDetailScreen`  | Detail with feed / events / about tabs |
| `social/community/[communityId]/feed.tsx`    | `CommunityFeedScreen`    | Standalone community feed              |
| `social/community/[communityId]/members.tsx` | `CommunityMembersScreen` | Roster and moderation                  |
| `social/events.tsx`                          | `EventsScreen`           | Event discovery with filters           |
| `social/events/create.tsx`                   | `CreateEventScreen`      | Host an event                          |
| `social/event/[eventId]/index.tsx`           | `EventDetailScreen`      | Event detail, RSVP, cancel             |
| `social/event/[eventId]/attendees.tsx`       | `EventAttendeesScreen`   | Paginated attendees                    |
| `social/post/[postId].tsx`                   | `PostDetailScreen`       | Post, reactions, comments              |
| `social/create-post.tsx`                     | `CreatePostScreen`       | Composer                               |

Route building is centralised in `socialRoutes` (`social-state.ts`). Every dynamic segment is percent-encoded there, so a crafted id cannot inject a path segment or query parameter.

---

## 4. State Architecture

### Query Keys

`SOCIAL_QUERY_KEYS` (`social-api.ts`) defines the cache namespace. Keys that cache **different response shapes** are deliberately distinct:

```text
event(id)          ['social','event',id]                  // detail
eventAttendees(id) ['social','event',id,'attendees']       // infinite roster
eventAttendeePreview(id) [..., 'attendee-preview']         // 8-row preview
homePreview.feed   ['social','home','feed']                // Explore preview
```

Three **prefix** keys exist purely for invalidation: `feedLists`, `communityLists`, `eventLists`. They are required because `events({communityId})` and `events({type})` are _siblings_ of `events()`, not children, so invalidating one filtered list would leave the others stale.

### Invalidation

All invalidation goes through `social-cache.ts`:

| Helper                     | Covers                                                                              |
| :------------------------- | :---------------------------------------------------------------------------------- |
| `invalidateFeedLists`      | Every feed (global + all community) and the Explore preview                         |
| `invalidateCommunityLists` | My communities, discovery, Explore previews, and one community's detail/roster/feed |
| `invalidateEventLists`     | Event detail, its roster and preview, and every filtered event list                 |

This module deliberately sits outside `social-state.ts`: `social-api.ts` already imports `SocialApiError` from there, and a reverse import of the query keys would create a cycle.

### Server-Derived View Models

`social-state.ts` holds pure functions with no React and no network, so each rule is unit-testable:

| Function                 | Guarantees                                                                                                                                                                                 |
| :----------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deriveMembershipView`   | Derives join/leave/pending/restricted from `currentUserRole` + `currentUserMembershipStatus` only. Never infers from privacy. `canModerate` requires OWNER/ADMIN **and** ACTIVE membership |
| `deriveRsvpView`         | Builds the RSVP control set. Never inspects `attendeeCount`/`capacity` — capacity is a server decision surfaced as `EVENT_FULL` or `WAITLISTED`                                            |
| `deriveCapacityView`     | Mirrors server counters for display. `remainingSeats` is informational and never gates an action                                                                                           |
| `deriveLocationView`     | States that a location is withheld rather than showing an event as venue-less                                                                                                              |
| `describeSocialError`    | Maps API codes to deliberate copy. Raw server strings are never shown                                                                                                                      |
| `getNextCursorPageParam` | Stops on a null cursor even when the server claims more pages                                                                                                                              |
| `flattenPages`           | De-duplicates across page boundaries while preserving server order                                                                                                                         |

---

## 5. Screen Behaviour

### 5.1 Explore (`SocialHomeScreen`)

Four independent previews (upcoming events, my communities, suggested communities, latest posts). Each section resolves **its own** state:

```text
isLoading → skeleton
isError   → ErrorRow with the mapped message and a per-section Try again
ready + 0 items → empty state with a real next action
ready + n items → cards
```

One failing request never blanks the page, and a failed request is never rendered as "nothing here". Emits `social_home_opened`.

### 5.2 Feeds (`SocialPostList`)

Shared by the global feed, the community feed, and the community detail feed.

- **Reactions are not mutable here.** `getFeed` hardcodes `userReaction: null`; only `getPost` hydrates it. The heart therefore opens the post rather than showing a toggle it cannot honour. A filled heart can never appear without justification.
- **Stale, not silent.** When a refresh fails while rows are on screen, the list keeps the rows and shows "Could not refresh" with a retry. With no rows at all, the error is rendered in full. This distinction is computed inside the list from `error && rows.length > 0`, so no caller can get it wrong.
- `hasMore` guards `onEndReached` to prevent duplicate cursor requests on every scroll frame.
- De-duplication by id across pages, because a mutable feed can return the same row twice when new content shifts the window.

### 5.3 Community Detail

Tabs for feed, events, and about. The membership button is the single source of truth for what the viewer may do, and it is disabled with an explanation for `pending` and `banned` states.

- **Join outcome is not assumed.** A join returns `ACTIVE` or `PENDING`; `getJoinOutcomeLabel` describes each, and `community_joined` / `community_join_requested` are distinguished. "Request sent" is never reported as "you have joined".
- **Editing** reuses `CreateCommunityScreen` in edit mode — one form, one set of validation rules, one error surface. Visible only when `canModerate`, which is exactly the API's OWNER/ADMIN + ACTIVE rule. The community limit and its premium upsell are hidden while editing, because a limit on creation does not apply to an edit.
- Hosting an event is offered in the empty events state.

### 5.4 Members (`CommunityMembersScreen`)

Identity comes from `useProfileStore`, not a hardcoded string. A Remove control appears only when the viewer is staff, is not removing themselves, and is not removing the owner. The server re-checks all three. Blocked users are excluded by the API. Emits `community_members_viewed` and ban attempted / success / failure.

### 5.5 Events and RSVP

- The RSVP control set is derived from the viewer's own status. A waitlisted viewer is offered "Go" and "Leave waitlist" but **not** "Interested", because downgrading would silently drop their waitlist position.
- A full event still offers "Go". The server decides between a confirmed place, a waitlist place, and `EVENT_FULL`; the client never pre-computes eligibility.
- The confirmed `status` from the server is written into the cached event before lists are refetched, so the button reflects the real outcome immediately.
- **Location privacy** is presented as a state, not an error: the coarse `locationName` always shows, and a withheld address or joining link is explained in words. Venue URLs open through `Linking.openURL` with a failure path.
- **Organiser controls** (cancel event) appear only for the organiser and re-check ownership server-side, with a destructive confirmation. Cancelling notifies attendees by removing the RSVP path entirely.

### 5.6 Post Detail

Owner controls (Edit, Delete) and Block Author appear only when `isOwnedByViewer(post.authorId, currentUserId)` is true, which is false when the viewer is unknown — an unidentified viewer is never shown control of content. Comment deletion is offered to the comment author and the post author, matching the API. `LIKE` is tracked as `post_liked`/`post_unliked`; the other four reaction types are tracked as `post_reacted`.

---

## 6. Safety Integration

- `ReportModal` is reused with canonical target types (`POST`, `COMMENT`, `COMMUNITY`, `EVENT`, `USER`, `PROFILE`) and canonical reason codes.
- `BlockModal` is used for blocking a post author.
- Both emit `social_report_submitted` and `social_block_submitted`, and both flow through the existing safety API and rate-limit handling.

---

## 7. Telemetry & PII Sanitization

All events go through `trackOnboardingEvent()` with the existing automated PII scrubber. No post content, comment text, community description, event description, or location address is ever sent.

| Event                                                                                         | Key Properties                           |
| :-------------------------------------------------------------------------------------------- | :--------------------------------------- |
| `social_home_opened`                                                                          | `{ tab }`                                |
| `community_viewed` / `community_feed_viewed` / `community_members_viewed`                     | `{ communityId }`                        |
| `community_join_attempted` / `community_joined` / `community_join_requested`                  | `{ communityId }`                        |
| `community_leave_attempted` / `community_left`                                                | `{ communityId }`                        |
| `community_creation_attempted` / `community_created` / `community_updated`                    | `{ privacy }`, `{ communityId }`         |
| `community_member_ban_attempted` / `community_member_banned` / `community_member_ban_failed`  | `{ communityId, targetRole }`            |
| `event_viewed` / `event_attendees_viewed`                                                     | `{ eventId }`                            |
| `event_creation_attempted` / `event_created` / `event_cancelled`                              | `{ type, has_community }`, `{ eventId }` |
| `event_rsvp_attempted` / `event_rsvp_confirmed` / `event_waitlisted` / `event_rsvp_cancelled` | `{ eventId, targetStatus }`              |
| `event_rsvp_failed`                                                                           | `{ eventId, targetStatus, errorKind }`   |
| `post_viewed` / `post_create_attempted` / `post_created` / `post_edited` / `post_deleted`     | `{ postId }`, `{ visibility, hasMedia }` |
| `post_liked` / `post_unliked` / `post_reacted` / `post_reaction_failed`                       | `{ postId, reactionType }`               |
| `social_report_submitted` / `social_block_submitted`                                          | `{ targetType, reasonCode }`             |

---

## 8. Verification

| Check           | Command                                           | Result                                                                                                                           |
| :-------------- | :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------- |
| Type check      | `npx tsc --noEmit -p apps/mobile/tsconfig.json`   | Pass                                                                                                                             |
| Type check      | `npx tsc --noEmit -p apps/api/tsconfig.json`      | Pass                                                                                                                             |
| Client tests    | `npx vitest run tests/social.test.ts`             | 19 passing                                                                                                                       |
| Logic tests     | `npx vitest run tests/social-state.test.ts`       | 70 passing                                                                                                                       |
| Lint            | `npx eslint src/social app/social --ext .ts,.tsx` | Clean                                                                                                                            |
| Format          | `npx prettier --check` on social paths            | Clean                                                                                                                            |
| API integration | `tests/social-events.test.ts`                     | Requires a local Postgres; covers address **and coordinate** redaction for organiser, outsider, `INTERESTED` and `GOING` viewers |
