# Nazar Mobile · Matches & Connection Experience QA Matrix

This document defines the production Quality Assurance (QA) verification protocol for the Nazar mobile application's post-interaction connection experience (F5): Matches list, Match Detail inspection, Unmatch lifecycle, Safety controls (Block & Report), Conversation entry, and Match Celebration consolidation.

---

## QA Test Scenarios

### 1. Matches Feed Initial Load & Cursor Pagination

| Step    | Action                                                            | Expected Behavior                                                                                                                                  | Pass / Fail |
| :------ | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **1.1** | Navigate to `/(tabs)/matches` on an authenticated active session. | Displays branded loading indicator while executing `GET /v1/matches?limit=20`. Emits `matches_viewed` analytics event.                             | PASS        |
| **1.2** | Render matches list.                                              | Renders list of `MatchCard` items displaying other user's primary photo, name, age, city, and formatted match date (e.g. `Sep 30`).                | PASS        |
| **1.3** | Scroll down to trigger pagination (`onEndReachedThreshold=0.5`).  | TanStack `useInfiniteQuery` calls `fetchNextPage()` using opaque `nextCursor` without duplicating existing records.                                | PASS        |
| **1.4** | Pull down on the matches list.                                    | `RefreshControl` animates with Saffron tint and re-queries the first page (`refetch()`), preserving existing scroll offset.                        | PASS        |
| **1.5** | Account with zero mutual connections.                             | Displays dedicated empty state: "Your connections start here" with "Explore Discovery ✨" button. Tapping button navigates to `/(tabs)/discovery`. | PASS        |
| **1.6** | Enter text into search input (e.g. "Ananya" or "Mumbai").         | Matches list filters dynamically in-memory; clears cleanly when input is emptied.                                                                  | PASS        |

---

### 2. Match Detail & Candidate Inspection

| Step    | Action                                              | Expected Behavior                                                                                                                                                                   | Pass / Fail |
| :------ | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **2.1** | Tap a match card item in the Matches list.          | Emits `match_opened` telemetry; navigates to `/matches/[matchId]`.                                                                                                                  | PASS        |
| **2.2** | Hydrate match details (`GET /v1/matches/:matchId`). | Loads multi-photo carousel, name, age, verified badge, matched date ribbon (`Matched on September 30, 2026`), coarse city, bio, prompts, and interest chips.                        | PASS        |
| **2.3** | Swipe horizontally across photo carousel.           | Smooth paging scroll with dynamic active dot indicators.                                                                                                                            | PASS        |
| **2.4** | Verify absence of raw GPS coordinates.              | Public profile never reveals raw latitude/longitude coordinates; coarse locality or distance bucket only.                                                                           | PASS        |
| **2.5** | Access match with invalid or expired ID.            | Displays "Connection Unavailable: This connection is no longer active or has been dissolved" with safe "Go Back" action. Never exposes whether the other user blocked or unmatched. | PASS        |

---

### 3. Conversation Entry & Chat Routing

| Step    | Action                                                | Expected Behavior                                                                                   | Pass / Fail |
| :------ | :---------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------- |
| **3.1** | On Match Detail screen, tap "Send Message 💬" button. | Emits `match_message_clicked` telemetry; looks up active conversation from `GET /v1/conversations`. | PASS        |
| **3.2** | If conversation exists for match.                     | Navigates cleanly into `/chat/${conversationId}` with existing history intact.                      | PASS        |
| **3.3** | If conversation lookup falls back.                    | Navigates into `/chat/${matchId}` where conversation resolver initializes session.                  | PASS        |
| **3.4** | Navigate back from Chat to Matches.                   | Returns to Match Detail or Matches list without desynchronizing connection state.                   | PASS        |

---

### 4. Connection Management: Unmatch Lifecycle

| Step    | Action                                             | Expected Behavior                                                                                                                                                                                 | Pass / Fail |
| :------ | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------- |
| **4.1** | On Match Detail screen, tap "Unmatch this member". | Presents confirmation dialog: "Unmatch this connection? You will no longer be able to view their profile, message each other, or see each other in match lists." Actions: "Cancel" and "Unmatch". | PASS        |
| **4.2** | Tap "Cancel".                                      | Dialog closes immediately; connection remains intact and active.                                                                                                                                  | PASS        |
| **4.3** | Tap "Unmatch" (destructive action).                | Dispatches `DELETE /v1/matches/:matchId` with `{ reason: 'USER_INITIATED' }`; invalidates `MATCHES_QUERY_KEYS.all`; emits `unmatch_started` and `unmatch_completed`.                              | PASS        |
| **4.4** | Unmatch confirmation alert.                        | Displays alert: "Connection Ended: You have unmatched this user." On dismissal, navigates back to `/(tabs)/matches`.                                                                              | PASS        |
| **4.5** | Verify Matches list post-unmatch.                  | Dissolved match is immediately absent from the Matches list.                                                                                                                                      | PASS        |
| **4.6** | Network error during unmatch.                      | Mutation failure alert is displayed; match remains visible in UI without false positive removal.                                                                                                  | PASS        |

---

### 5. Safety Moderation: Block & Report from Match

| Step    | Action                                                       | Expected Behavior                                                                                                                             | Pass / Fail |
| :------ | :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **5.1** | On Match Detail screen, tap the more/block button in header. | Navigates to `/modal/block?targetUserId=${otherUser.userId}` with destructive confirmation dialog.                                            | PASS        |
| **5.2** | Confirm user block.                                          | Dispatches `POST /v1/users/:userId/block`; invalidates `MATCHES_QUERY_KEYS.all` and `DISCOVERY_QUERY_KEYS.feed`; redirects back to discovery. | PASS        |
| **5.3** | On Match Detail screen, tap the flag icon in header.         | Navigates to `/modal/report?targetId=${otherUser.userId}` with confidential reporting form.                                                   | PASS        |
| **5.4** | Select reason code and submit report.                        | Dispatches `POST /v1/reports` with canonical `CreateReportRequestDto`; displays confidential receipt alert.                                   | PASS        |

---

### 6. Consolidated Match Celebration

| Step    | Action                                                                   | Expected Behavior                                                                          | Pass / Fail |
| :------ | :----------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :---------- |
| **6.1** | Receive mutual match from Like action (`matched: true, matchId: '...'`). | App presents `/modal/celebration` modal route with both member avatars and candidate name. | PASS        |
| **6.2** | Tap "Say Hello 💌".                                                      | Navigates directly into `/chat/${matchId}`.                                                | PASS        |
| **6.3** | Tap "Keep Browsing".                                                     | Dismisses celebration dialog (`router.back()`); user returns directly to browsing.         | PASS        |
| **6.4** | Check Matches list after celebration dismissal.                          | The newly formed match appears at the top of `/(tabs)/matches`.                            | PASS        |

---

### 7. Deep Linking & Notification Navigation

| Step    | Action                                                           | Expected Behavior                                                                                            | Pass / Fail |
| :------ | :--------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :---------- |
| **7.1** | Open URI `nazar://match/:matchId` or `nazar://matches/:matchId`. | Deep link forwarder in `app/match/[matchId].tsx` redirects to `/matches/[matchId]`.                          | PASS        |
| **7.2** | Authenticated user opens valid match deep link.                  | Match detail screen loads authorized candidate data.                                                         | PASS        |
| **7.3** | Unauthenticated user opens match deep link.                      | Root auth gate intercepts request, presents `/(auth)/login`, and redirects upon successful session creation. | PASS        |
| **7.4** | Open deep link for unmatched or deleted match.                   | Displays "Connection Unavailable" card without crashing or exposing private information.                     | PASS        |

---

### 8. Network Fault Tolerance & Session Expiry

| Step    | Action                                | Expected Behavior                                                                                  | Pass / Fail |
| :------ | :------------------------------------ | :------------------------------------------------------------------------------------------------- | :---------- |
| **8.1** | Disable network and open Matches tab. | Shows error card with "Check your network connection and try again" and accessible "Retry" button. | PASS        |
| **8.2** | Token expires while viewing match.    | Client automatically invokes token refresh; re-executes query seamlessly.                          | PASS        |
