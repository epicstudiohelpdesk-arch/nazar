# Nazar Mobile · Discovery, Profile Detail & Interaction QA Matrix

This document defines the production Quality Assurance (QA) verification protocol for the Nazar mobile application's core consumer experience: candidate discovery feed, swipe gestures, profile detail inspection, mutual matching celebration, filters, and safety controls (F4).

---

## QA Test Scenarios

### 1. Discovery Feed Initial Load & Cursor Pagination

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **1.1** | Navigate to `/(tabs)/discovery` tab on active member session. | Displays branded loading skeleton while initiating `GET /v1/discovery?limit=10`. Emits `discovery_viewed` analytics event. | PASS |
| **1.2** | Feed response received with candidates. | Renders top candidate `ProfileCard` with primary photo, name, age, verified badge, and coarse distance bucket (`Within 5 km`). Underneath card rendered with slight scale ($0.95$) for depth. | PASS |
| **1.3** | Advance card deck until $\le 3$ candidates remain. | TanStack `useInfiniteQuery` automatically prefetches next page using opaque server cursor (`nextCursor`). | PASS |
| **1.4** | Validate candidate list across multiple paginated responses. | Unique candidate deduplication set ensures no candidate is rendered twice, even across sliding window updates. | PASS |
| **1.5** | Evaluate all candidates in feed (`hasMore: false` and empty items). | Displays "You've Caught Up!" surface card with "Adjust Preferences" and "Refresh Feed" CTAs. | PASS |

---

### 2. Gesture Swiping & Physical Action Controls

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **2.1** | Drag active candidate card to the right ($dx > 28\%$ screen width). | Card translates with slight rotation ($\le 12^\circ$). Saffron "LIKE 💕" overlay badge fades in smoothly. Card flies off right edge on release. | PASS |
| **2.2** | Drag active candidate card to the left ($dx < -28\%$ screen width). | Card translates with rotation ($\le -12^\circ$). Rose "PASS ✕" overlay badge fades in smoothly. Card flies off left edge on release. | PASS |
| **2.3** | Drag active card slightly ($< 28\%$ screen width) and release. | Animated spring physics snaps the card back to center $(0,0)$ with friction damping. | PASS |
| **2.4** | Tap accessible Like button (heart icon) in bottom action bar. | Triggers like mutation; card advances to next candidate; emits `like_sent` event. | PASS |
| **2.5** | Tap accessible Pass button (X icon) in bottom action bar. | Triggers pass mutation; card advances to next candidate; emits `pass_sent` event. | PASS |
| **2.6** | Tap Undo button after liking or passing a candidate. | Dispatches `POST /v1/interactions/undo`; deck index steps back; previous candidate restored to top of deck. | PASS |
| **2.7** | Rapidly tap Like or Pass button multiple times in under 300ms. | In-flight mutation lock prevents redundant submissions; exactly one network request dispatched. | PASS |

---

### 3. Mutual Matching & Celebration Experience

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **3.1** | Like a candidate who has already liked the current user. | Backend returns `{ matched: true, matchId: 'm-...' }`. Emits `match_created` telemetry. Invalidate matches cache. | PASS |
| **3.2** | Automatic modal transition. | App immediately presents `/modal/celebration` modal route with candidate name and both member profile avatars. | PASS |
| **3.3** | Verify avatar rings and celebration badge on celebration dialog. | Left avatar displays current user primary photo from `useProfileStore`; right avatar displays matched member photo. | PASS |
| **3.4** | Tap "Say Hello 💌" on match celebration modal. | Replaces route to conversation `/chat/${matchId}` with pre-populated match context. | PASS |
| **3.5** | Tap "Keep Browsing" on match celebration modal. | Dismisses modal dialog (`router.back()`); user returns directly to candidate deck in Discovery. | PASS |
| **3.6** | Like a candidate who has not yet liked the current user. | Backend returns `{ matched: false, matchId: null }`. Deck smoothly advances without triggering celebration modal. | PASS |

---

### 4. Candidate Profile Detail Inspection

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **4.1** | Tap Info button or candidate card body in discovery feed. | Emits `profile_opened` telemetry; navigates to `/profile/[userId]`. | PASS |
| **4.2** | Load public profile details (`GET /v1/profiles/:userId`). | Displays full profile: name, age, verified badge, coarse city/country, occupation, and education. | PASS |
| **4.3** | Inspect multi-photo carousel on profile detail screen. | Horizontal paging scroll with pagination dot indicators for each photo in candidate's `media` array. | PASS |
| **4.4** | Inspect prompts and interests. | Displays structured prompt cards (question + answer in Nazar warm saffron accent) and interest chips. | PASS |
| **4.5** | Verify absence of raw GPS coordinates. | Public profile never reveals raw latitude/longitude coordinates; coarse distance bucket or city only. | PASS |
| **4.6** | Tap Like button in profile detail bottom action bar. | Dispatches like mutation. If mutual match occurs, replaces to `/modal/celebration`; otherwise returns to deck. | PASS |
| **4.7** | Tap Pass button in profile detail bottom action bar. | Dispatches pass mutation and returns back to discovery deck. | PASS |

---

### 5. Discovery Preferences & Filter Management

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **5.1** | Tap Filter button in Discovery top navigation header. | Emits `filter_opened` telemetry; opens `/modal/filters`. | PASS |
| **5.2** | Verify preference hydration. | Hydrates sliders and selects from server preferences (`GET /v1/profiles/me/preferences`). | PASS |
| **5.3** | Modify sliders (Distance: 15 km $\to$ 75 km, Age: 24–30). | Live value labels update reactively. Minimum age is clamped below maximum age. | PASS |
| **5.4** | Tap "Reset" in header action. | Reverts state to canonical defaults: 50 km distance, 21–35 age range, Everyone, and Long-term intent. | PASS |
| **5.5** | Tap "Apply Preferences". | Dispatches `PUT /v1/profiles/me/preferences`; invalidates `DISCOVERY_QUERY_KEYS.feed`; emits `filter_applied`; dismisses modal. | PASS |
| **5.6** | Return to Discovery feed. | Feed automatically refetches with new preference criteria applied on the server. | PASS |

---

### 6. Safety Moderation Controls (Block & Report)

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **6.1** | On candidate profile, tap flag icon in top navigation header. | Opens confidential report modal at `/modal/report?targetId=${userId}`. | PASS |
| **6.2** | Select violation reason code (e.g. `HARASSMENT`, `FAKE_PROFILE`) and enter optional details. | Dispatches `POST /v1/reports` with canonical `CreateReportRequestDto`; emits `report_submitted`. | PASS |
| **6.3** | Submit report confirmation. | Displays alert confirming confidential receipt by Trust & Safety; dismisses modal. | PASS |
| **6.4** | On candidate profile, tap more/block icon in top navigation header. | Opens destructive confirmation dialog at `/modal/block?targetUserId=${userId}`. | PASS |
| **6.5** | Confirm account block. | Dispatches `POST /v1/users/:userId/block`; invalidates discovery feed query; emits `block_completed`. | PASS |
| **6.6** | Verify feed post-block. | Blocked member is immediately evicted from the user's visible candidate deck and excluded from future feeds. | PASS |

---

### 7. Network Fault Recovery & Edge Cases

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **7.1** | Loss of network connectivity when loading feed. | Displays error card with "Check your network connection and try again" and accessible "Retry" button. | PASS |
| **7.2** | Like/Pass mutation fails due to server error (500 or timeout). | Candidate index does not advance; active card remains on top of deck; inline error notice displayed. | PASS |
| **7.3** | Rate limit reached (429 Too Many Requests). | Error notice explains quota limit; candidate card is preserved in place. | PASS |
