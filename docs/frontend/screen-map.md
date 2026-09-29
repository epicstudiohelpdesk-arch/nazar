# Nazar Mobile Screen Map & Navigation Hierarchy (F1)

**Version:** 1.0.0 (Frontend F1)  
**Status:** Canonical Navigation Specification  
**Architecture:** Expo Router file-based routing (`apps/mobile/app/`)  
**Design System:** Built on F0 Tokens & Components (`@/design`, `@platform/ui`)

---

## 1. Information Architecture Overview

Nazar's application structure is organized strictly around user intent and primary jobs rather than internal backend services:

```text
Nazar Mobile App
│
├── Public / Unauthenticated Flow
│   ├── Welcome Landing (`/(auth)/welcome`)
│   ├── Authentication Options (`/(auth)/login`)
│   └── Verification Code (`/(auth)/otp`)
│
├── Onboarding Flow (First-Run Identity Creation)
│   ├── Profile Setup: Basic Info & Age (`/(onboarding)/profile-setup`)
│   ├── Photo Upload & Reorder (`/(onboarding)/photos`)
│   ├── Lifestyle & Cultural Interests (`/(onboarding)/interests`)
│   ├── Personality Prompts (`/(onboarding)/prompts`)
│   └── Contextual Permissions (`/(onboarding)/permissions`)
│
├── Primary Application Shell (`/(tabs)`)
│   ├── Discover: Feed & Spatial Profiles (`/(tabs)/discovery`)
│   ├── Matches: Mutual Matches & Likes (`/(tabs)/matches`)
│   ├── Messages: Active Conversations (`/(tabs)/messages`)
│   ├── Explore: Social Feed, Communities & Events (`/(tabs)/explore`)
│   └── Profile: Identity & Account Hub (`/(tabs)/profile`)
│
├── Full-Screen Stacks
│   ├── Other User Public Profile (`/profile/[userId]`)
│   ├── Edit Own Profile (`/profile/edit`)
│   ├── Preview Own Profile (`/profile/preview`)
│   ├── Match Detail View (`/matches/[matchId]`)
│   ├── Active Direct Message Chat (`/chat/[conversationId]`)
│   ├── Social Post Detail & Comments (`/social/post/[postId]`)
│   ├── Create Social Post (`/social/create-post`)
│   ├── Community Group Detail (`/social/community/[communityId]`)
│   ├── Singles Event Detail (`/social/event/[eventId]`)
│   ├── Settings Hub (`/settings`)
│   ├── Account & Devices (`/settings/account`)
│   ├── Privacy Controls (`/settings/privacy`)
│   ├── Safety & Blocked Users (`/settings/safety`)
│   ├── Notification Preferences (`/settings/notifications`)
│   ├── Delete Account Confirmation (`/settings/delete-account`)
│   ├── Subscription & Paywall (`/billing`)
│   ├── Billing History & Receipts (`/billing/history`)
│   └── Notification Center (`/notifications`)
│
└── Modals & Sheets (Transparent Scrim Overlays)
    ├── Discovery Preference Filters (`/modal/filters`)
    ├── Safety Reporting Flow (`/modal/report`)
    ├── Block User Confirmation (`/modal/block`)
    └── Mutual Match Celebration (`/modal/celebration`)
```

---

## 2. Comprehensive Screen Inventory

### Screen 1: Gateway / Session Director
* **Screen:** Session Director
* **Route:** `/` (`apps/mobile/app/index.tsx`)
* **Parent:** Root Stack (`/`)
* **Entry points:** App cold launch, deep link without explicit path
* **Exit points:** `/(tabs)/discovery`, `/(auth)/welcome`, `/(onboarding)/profile-setup`
* **Authentication requirement:** Public
* **API dependencies:** Existing API: `GET /v1/auth/sessions`, `GET /v1/profiles/me`
* **Query dependencies:** Session validation query
* **Mutation dependencies:** Token refresh mutation
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://`, `https://nazar.app/`
* **Empty state:** Not applicable
* **Loading state:** Shimmering launch splash with Nazar branding
* **Error state:** Session resolution fallback to `/(auth)/welcome`
* **Offline behavior:** Cached token validation via `InMemoryTokenStorage`
* **Analytics event:** `app_opened`, `session_resolved`

---

### Screen 2: Welcome Landing
* **Screen:** Welcome Landing
* **Route:** `/(auth)/welcome`
* **Parent:** Auth Stack (`/(auth)/_layout.tsx`)
* **Entry points:** Unauthenticated launch, logout, session expiration
* **Exit points:** `/(auth)/login`
* **Authentication requirement:** Public
* **API dependencies:** None
* **Query dependencies:** None
* **Mutation dependencies:** None
* **Realtime dependencies:** None
* **Modal dependencies:** Terms & Privacy legal links
* **Deep-link support:** `nazar://welcome`
* **Empty state:** Not applicable
* **Loading state:** Instant render
* **Error state:** Not applicable
* **Offline behavior:** Static offline display with offline indicator
* **Analytics event:** `auth_welcome_viewed`

---

### Screen 3: Login Options
* **Screen:** Login Options
* **Route:** `/(auth)/login`
* **Parent:** Auth Stack (`/(auth)/_layout.tsx`)
* **Entry points:** `/(auth)/welcome`
* **Exit points:** `/(auth)/otp`, `/(auth)/welcome`
* **Authentication requirement:** Public
* **API dependencies:** Existing API: `POST /v1/auth/otp/request`, `POST /v1/auth/oauth/google`, `POST /v1/auth/oauth/apple`
* **Query dependencies:** None
* **Mutation dependencies:** Request OTP mutation, OAuth login mutation
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://login`
* **Empty state:** Not applicable
* **Loading state:** Button spinner on submit (`Button` loading state)
* **Error state:** Inline validation error below phone/email input
* **Offline behavior:** Error banner: "Internet connection required to sign in"
* **Analytics event:** `auth_login_initiated`

---

### Screen 4: Verification Code (OTP)
* **Screen:** OTP Verification
* **Route:** `/(auth)/otp`
* **Parent:** Auth Stack (`/(auth)/_layout.tsx`)
* **Entry points:** `/(auth)/login`
* **Exit points:** `/(onboarding)/profile-setup` (if new user), `/(tabs)/discovery` (if existing user)
* **Authentication requirement:** Public (in-flight verification)
* **API dependencies:** Existing API: `POST /v1/auth/otp/verify`
* **Query dependencies:** None
* **Mutation dependencies:** Verify OTP mutation (`setAccessToken`, `setRefreshToken`)
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** None (sensitive transient state)
* **Empty state:** 6-digit cell input initialized empty
* **Loading state:** `OtpInput` verifying state with disabled input
* **Error state:** "Incorrect code entered. 3 attempts remaining."
* **Offline behavior:** Block submission until reconnect
* **Analytics event:** `auth_otp_submitted`, `auth_otp_success`

---

### Screen 5: Onboarding Profile Setup
* **Screen:** Profile Setup
* **Route:** `/(onboarding)/profile-setup`
* **Parent:** Onboarding Stack (`/(onboarding)/_layout.tsx`)
* **Entry points:** Successful OTP verification for new users
* **Exit points:** `/(onboarding)/photos`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `PUT /v1/profiles/me`
* **Query dependencies:** None
* **Mutation dependencies:** Update profile basic info
* **Realtime dependencies:** None
* **Modal dependencies:** Date picker sheet (DD/MM/YYYY)
* **Deep-link support:** `nazar://onboarding/setup`
* **Empty state:** Clean form with placeholders
* **Loading state:** Button loading indicator
* **Error state:** "You must be at least 18 years old to use Nazar"
* **Offline behavior:** Cached in Zustand `useProfileStore` until online
* **Analytics event:** `onboarding_step_profile_setup`

---

### Screen 6: Onboarding Photos
* **Screen:** Photo Upload & Ordering
* **Route:** `/(onboarding)/photos`
* **Parent:** Onboarding Stack (`/(onboarding)/_layout.tsx`)
* **Entry points:** `/(onboarding)/profile-setup`
* **Exit points:** `/(onboarding)/interests`, `/(onboarding)/profile-setup`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `POST /v1/profiles/me/media/upload-url`, `POST /v1/profiles/me/media/:id/complete`, `PATCH /v1/profiles/me/media/reorder`
* **Query dependencies:** None
* **Mutation dependencies:** Upload photo, delete photo, reorder media
* **Realtime dependencies:** None
* **Modal dependencies:** Image source picker (Camera vs Gallery)
* **Deep-link support:** `nazar://onboarding/photos`
* **Empty state:** 6 placeholder photo slots with "+" trigger
* **Loading state:** Per-slot `ProgressBar` and uploading spinner
* **Error state:** "Photo must be at least 800x800px and contain your face"
* **Offline behavior:** Queue photo upload until connectivity restored
* **Analytics event:** `onboarding_step_photos`

---

### Screen 7: Onboarding Interests
* **Screen:** Cultural & Lifestyle Interests
* **Route:** `/(onboarding)/interests`
* **Parent:** Onboarding Stack (`/(onboarding)/_layout.tsx`)
* **Entry points:** `/(onboarding)/photos`
* **Exit points:** `/(onboarding)/prompts`, `/(onboarding)/photos`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/profiles/interests`, `PUT /v1/profiles/me/interests`
* **Query dependencies:** `useQuery(['interests'])`
* **Mutation dependencies:** Save selected interests
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://onboarding/interests`
* **Empty state:** Category sections (Culture, Music, Food, Travel, Ambition)
* **Loading state:** `SkeletonBox` chips placeholder
* **Error state:** Retry button on failed interest catalog fetch
* **Offline behavior:** Read-only cached chips
* **Analytics event:** `onboarding_step_interests`

---

### Screen 8: Onboarding Prompts
* **Screen:** Personality Prompts
* **Route:** `/(onboarding)/prompts`
* **Parent:** Onboarding Stack (`/(onboarding)/_layout.tsx`)
* **Entry points:** `/(onboarding)/interests`
* **Exit points:** `/(onboarding)/permissions`, `/(onboarding)/interests`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/profiles/prompt-definitions`, `PUT /v1/profiles/me/prompts`
* **Query dependencies:** `useQuery(['prompt-definitions'])`
* **Mutation dependencies:** Save prompt answers
* **Realtime dependencies:** None
* **Modal dependencies:** Prompt selector bottom sheet
* **Deep-link support:** `nazar://onboarding/prompts`
* **Empty state:** 3 prompt slots requiring minimum 1 response
* **Loading state:** Skeleton cards for prompt prompts
* **Error state:** "Prompt answer cannot be empty"
* **Offline behavior:** Local draft saved to `useProfileStore`
* **Analytics event:** `onboarding_step_prompts`

---

### Screen 9: Contextual Permissions
* **Screen:** Permissions Gate
* **Route:** `/(onboarding)/permissions`
* **Parent:** Onboarding Stack (`/(onboarding)/_layout.tsx`)
* **Entry points:** `/(onboarding)/prompts`
* **Exit points:** `/(tabs)/discovery`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `POST /v1/notifications/devices`, `POST /v1/profiles/me/activate`
* **Query dependencies:** None
* **Mutation dependencies:** Register push token, activate profile
* **Realtime dependencies:** None
* **Modal dependencies:** Native OS permission dialogs
* **Deep-link support:** `nazar://onboarding/permissions`
* **Empty state:** Not applicable
* **Loading state:** Activating profile spinner
* **Error state:** Non-blocking permission grant
* **Offline behavior:** Proceed with local flags
* **Analytics event:** `onboarding_completed`

---

### Screen 10: Discover Feed
* **Screen:** Discover Feed
* **Route:** `/(tabs)/discovery` (`/discovery`)
* **Parent:** Tab Shell (`/(tabs)/_layout.tsx`)
* **Entry points:** Tab bar press, app launch, match celebration dismiss
* **Exit points:** `/profile/[userId]`, `/modal/filters`, `/modal/celebration`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/discovery`, `POST /v1/interactions/:userId/like`, `POST /v1/interactions/:userId/pass`, `POST /v1/interactions/undo`
* **Query dependencies:** `useInfiniteQuery(['discovery'])`
* **Mutation dependencies:** Like, Pass, Undo mutations
* **Realtime dependencies:** Socket match event (trigger celebration)
* **Modal dependencies:** `/modal/filters`, `/modal/celebration`
* **Deep-link support:** `nazar://discovery`, `https://nazar.app/discovery`
* **Empty state:** `EmptyState` type `noMatches` ("No more profiles in your area")
* **Loading state:** `ProfileCardSkeleton` with pulsing image shimmer
* **Error state:** `ErrorState` type `network` with retry CTA
* **Offline behavior:** Show offline banner; interaction queues optimistic actions
* **Analytics event:** `discovery_feed_viewed`, `discovery_like`, `discovery_pass`

---

### Screen 11: Likes & Matches
* **Screen:** Matches & Likes
* **Route:** `/(tabs)/matches` (`/matches`)
* **Parent:** Tab Shell (`/(tabs)/_layout.tsx`)
* **Entry points:** Tab bar press, notification tap for match
* **Exit points:** `/matches/[matchId]`, `/chat/[conversationId]`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/matches`, `GET /v1/interactions?direction=RECEIVED`
* **Query dependencies:** `useInfiniteQuery(['matches'])`
* **Mutation dependencies:** None directly
* **Realtime dependencies:** Socket `match_created` event
* **Modal dependencies:** None
* **Deep-link support:** `nazar://matches`, `https://nazar.app/matches`
* **Empty state:** `EmptyState` type `noMatches` with CTA "Start Discovery"
* **Loading state:** Grid of match avatar skeletons
* **Error state:** `ErrorState` with retry button
* **Offline behavior:** Cached match list from TanStack Query
* **Analytics event:** `matches_screen_viewed`

---

### Screen 12: Match Detail
* **Screen:** Match Detail
* **Route:** `/matches/[matchId]`
* **Parent:** Root Stack
* **Entry points:** Tap match in `/(tabs)/matches`
* **Exit points:** `/chat/[conversationId]`, `/profile/[userId]`, `/modal/block`, `/modal/report`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/matches/:matchId`, `DELETE /v1/matches/:matchId` (Unmatch)
* **Query dependencies:** `useQuery(['match', matchId])`
* **Mutation dependencies:** Unmatch mutation
* **Realtime dependencies:** Match status updates
* **Modal dependencies:** Unmatch confirmation dialog
* **Deep-link support:** `nazar://match/:matchId`, `https://nazar.app/match/:matchId`
* **Empty state:** Not applicable
* **Loading state:** Full profile detail skeleton
* **Error state:** `ErrorState` type `notFound` ("Match is no longer active")
* **Offline behavior:** Cached match metadata
* **Analytics event:** `match_detail_viewed`, `match_unmatched`

---

### Screen 13: Conversations List (Messages)
* **Screen:** Conversations List
* **Route:** `/(tabs)/messages` (with `/conversations` alias)
* **Parent:** Tab Shell (`/(tabs)/_layout.tsx`)
* **Entry points:** Tab bar press, notification tap for message
* **Exit points:** `/chat/[conversationId]`, `/profile/[userId]`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/chat`
* **Query dependencies:** `useQuery(['conversations'])`
* **Mutation dependencies:** None
* **Realtime dependencies:** Chat Gateway WebSocket (`chat.gateway.ts`) for message unread counts
* **Modal dependencies:** None
* **Deep-link support:** `nazar://conversations`, `https://nazar.app/messages`
* **Empty state:** `EmptyState` type `noConversations` ("No messages yet. Say hi to a match!")
* **Loading state:** `ConversationListSkeleton` (shimmering rows)
* **Error state:** `ErrorState` with retry
* **Offline behavior:** Renders cached SQLite/TanStack conversations
* **Analytics event:** `conversations_list_viewed`

---

### Screen 14: Active Chat
* **Screen:** Chat Screen
* **Route:** `/chat/[conversationId]`
* **Parent:** Root Stack (Back returns to `/(tabs)/messages`)
* **Entry points:** Tap row in Messages, Start Chat from Match Detail
* **Exit points:** `/(tabs)/messages`, `/profile/[userId]`, `/modal/report`, `/modal/block`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/chat/:id/messages`, `POST /v1/chat/:id/messages`, `POST /v1/chat/:id/read`
* **Query dependencies:** `useInfiniteQuery(['messages', conversationId])`
* **Mutation dependencies:** Send message mutation
* **Realtime dependencies:** WebSocket `message_received`, `typing_indicator`, `message_read`
* **Modal dependencies:** Media attachment sheet, report dialog
* **Deep-link support:** `nazar://chat/:conversationId`, `https://nazar.app/chat/:conversationId`
* **Empty state:** "You matched with {Name}. Break the ice!"
* **Loading state:** Shimmering message bubbles
* **Error state:** Message delivery failure retry banner
* **Offline behavior:** Outbox queue: messages stored locally and marked pending
* **Analytics event:** `chat_conversation_viewed`, `chat_message_sent`

---

### Screen 15: Explore Hub (Social Feed, Communities, Events)
* **Screen:** Explore Hub
* **Route:** `/(tabs)/explore`
* **Parent:** Tab Shell (`/(tabs)/_layout.tsx`)
* **Entry points:** Tab bar press
* **Exit points:** `/social/post/[postId]`, `/social/create-post`, `/social/community/[communityId]`, `/social/event/[eventId]`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/social/feed`, `GET /v1/social/communities/discover`, `GET /v1/social/events`
* **Query dependencies:** `useQuery(['social-feed'])`, `useQuery(['communities-discover'])`, `useQuery(['events'])`
* **Mutation dependencies:** Like post, react
* **Realtime dependencies:** None
* **Modal dependencies:** Segmented control for switching Feed / Communities / Events
* **Deep-link support:** `nazar://explore`, `https://nazar.app/explore`
* **Empty state:** `EmptyState` type `communityEmpty`
* **Loading state:** Post card skeletons
* **Error state:** Retry banner
* **Offline behavior:** Cached posts from local cache
* **Analytics event:** `explore_feed_viewed`

---

### Screen 16: Post Detail & Comments
* **Screen:** Post Detail
* **Route:** `/social/post/[postId]`
* **Parent:** Root Stack
* **Entry points:** Tap post card in Explore
* **Exit points:** `/(tabs)/explore`, `/profile/[userId]`, `/modal/report`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/social/posts/:id`, `GET /v1/social/posts/:id/comments`, `POST /v1/social/posts/:id/comments`
* **Query dependencies:** `useQuery(['post', postId])`, `useQuery(['comments', postId])`
* **Mutation dependencies:** Create comment mutation, reaction mutation
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://post/:postId`, `https://nazar.app/post/:postId`
* **Empty state:** "Be the first to comment"
* **Loading state:** Post shimmer & comment placeholders
* **Error state:** `ErrorState` ("Post was deleted or removed")
* **Offline behavior:** Read-only view
* **Analytics event:** `post_detail_viewed`, `comment_created`

---

### Screen 17: Create Post
* **Screen:** Create Post
* **Route:** `/social/create-post`
* **Parent:** Root Stack
* **Entry points:** "+" action in Explore feed
* **Exit points:** `/(tabs)/explore`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `POST /v1/social/posts`
* **Query dependencies:** None
* **Mutation dependencies:** Create post mutation
* **Realtime dependencies:** None
* **Modal dependencies:** Discard changes confirmation dialog
* **Deep-link support:** None
* **Empty state:** Multiline text input with photo attachment triggers
* **Loading state:** Submitting spinner
* **Error state:** "Post could not be published. Try again."
* **Offline behavior:** Block submission until reconnect
* **Analytics event:** `post_created`

---

### Screen 18: Community Detail
* **Screen:** Community Detail
* **Route:** `/social/community/[communityId]`
* **Parent:** Root Stack
* **Entry points:** Tap community in Explore
* **Exit points:** `/(tabs)/explore`, `/social/post/[postId]`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/social/communities/:id`, `GET /v1/social/communities/:id/feed`, `POST /v1/social/communities/:id/join`, `DELETE /v1/social/communities/:id/leave`
* **Query dependencies:** `useQuery(['community', communityId])`
* **Mutation dependencies:** Join/Leave community
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://community/:communityId`, `https://nazar.app/community/:communityId`
* **Empty state:** "No posts in this community yet"
* **Loading state:** Community header and feed skeletons
* **Error state:** `ErrorState` with retry
* **Offline behavior:** Cached community metadata
* **Analytics event:** `community_detail_viewed`, `community_joined`

---

### Screen 19: Event Detail
* **Screen:** Event Detail
* **Route:** `/social/event/[eventId]`
* **Parent:** Root Stack
* **Entry points:** Tap event card in Explore
* **Exit points:** `/(tabs)/explore`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/social/events/:id`, `POST /v1/social/events/:id/rsvp`, `DELETE /v1/social/events/:id/rsvp`
* **Query dependencies:** `useQuery(['event', eventId])`
* **Mutation dependencies:** RSVP mutation (Going / Interested / Cancel)
* **Realtime dependencies:** None
* **Modal dependencies:** RSVP confirmation sheet
* **Deep-link support:** `nazar://event/:eventId`, `https://nazar.app/event/:eventId`
* **Empty state:** Not applicable
* **Loading state:** Event cover and detail skeleton
* **Error state:** `ErrorState` with retry
* **Offline behavior:** Cached event details
* **Analytics event:** `event_detail_viewed`, `event_rsvp_changed`

---

### Screen 20: My Profile Hub
* **Screen:** My Profile Overview
* **Route:** `/(tabs)/profile`
* **Parent:** Tab Shell (`/(tabs)/_layout.tsx`)
* **Entry points:** Tab bar press
* **Exit points:** `/profile/edit`, `/profile/preview`, `/settings`, `/billing`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/profiles/me`
* **Query dependencies:** `useQuery(['my-profile'])`
* **Mutation dependencies:** None
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://profile`, `https://nazar.app/profile`
* **Empty state:** Profile completeness prompt card
* **Loading state:** Profile hero shimmer
* **Error state:** Retry button
* **Offline behavior:** Renders local profile from `useProfileStore`
* **Analytics event:** `my_profile_viewed`

---

### Screen 21: Edit Profile
* **Screen:** Edit Profile
* **Route:** `/profile/edit`
* **Parent:** Root Stack
* **Entry points:** Edit button in `/(tabs)/profile`
* **Exit points:** `/(tabs)/profile`, `/profile/preview`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `PUT /v1/profiles/me`, `PUT /v1/profiles/me/interests`, `PUT /v1/profiles/me/prompts`
* **Query dependencies:** Profile, interests, prompts queries
* **Mutation dependencies:** Update profile, reorder media
* **Realtime dependencies:** None
* **Modal dependencies:** Unsaved changes confirmation dialog
* **Deep-link support:** `nazar://profile/edit`
* **Empty state:** Editable sections with existing profile fields
* **Loading state:** Section shimmers
* **Error state:** Form validation inline warnings
* **Offline behavior:** Warn user before discarding unsaved edits
* **Analytics event:** `profile_edit_saved`

---

### Screen 22: Profile Preview
* **Screen:** Profile Preview (Self-View)
* **Route:** `/profile/preview`
* **Parent:** Root Stack
* **Entry points:** Preview button in My Profile or Edit Profile
* **Exit points:** `/profile/edit`, `/(tabs)/profile`
* **Authentication requirement:** Authenticated
* **API dependencies:** Local `useProfileStore` state
* **Query dependencies:** None
* **Mutation dependencies:** None
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** None
* **Empty state:** Not applicable
* **Loading state:** Instant render
* **Error state:** Not applicable
* **Offline behavior:** Fully supported offline
* **Analytics event:** `profile_preview_viewed`

---

### Screen 23: Other User Public Profile
* **Screen:** Public Profile Detail
* **Route:** `/profile/[userId]`
* **Parent:** Root Stack
* **Entry points:** Tap card in Discovery, Match Detail, Chat Header, or Community author
* **Exit points:** Previous route, `/modal/report`, `/modal/block`, `/chat/[conversationId]`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/profiles/:profileId`, `POST /v1/interactions/:userId/like`, `POST /v1/interactions/:userId/pass`
* **Query dependencies:** `useQuery(['profile', userId])`
* **Mutation dependencies:** Like, Pass, Block, Report mutations
* **Realtime dependencies:** None
* **Modal dependencies:** Report modal, block modal
* **Deep-link support:** `nazar://profile/:userId`, `https://nazar.app/profile/:userId`
* **Empty state:** Not applicable
* **Loading state:** Full-bleed portrait image skeleton with name placeholder
* **Error state:** `ErrorState` type `notFound` ("This profile is no longer available")
* **Offline behavior:** Cached profile if previously viewed
* **Analytics event:** `public_profile_viewed`

---

### Screen 24: Settings Hub
* **Screen:** Settings Hub
* **Route:** `/settings`
* **Parent:** Root Stack
* **Entry points:** Gear icon in My Profile
* **Exit points:** `/(tabs)/profile`, `/settings/account`, `/settings/privacy`, `/settings/safety`, `/settings/notifications`, `/billing`
* **Authentication requirement:** Authenticated
* **API dependencies:** None
* **Query dependencies:** None
* **Mutation dependencies:** Logout mutation (`authClient.logout()`)
* **Realtime dependencies:** None
* **Modal dependencies:** Logout confirmation dialog
* **Deep-link support:** `nazar://settings`, `https://nazar.app/settings`
* **Empty state:** Categorized settings rows
* **Loading state:** Instant render
* **Error state:** Not applicable
* **Offline behavior:** Fully available offline
* **Analytics event:** `settings_opened`

---

### Screen 25: Account Settings
* **Screen:** Account & Sessions
* **Route:** `/settings/account`
* **Parent:** Root Stack
* **Entry points:** Tap Account in Settings
* **Exit points:** `/settings`, `/settings/delete-account`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/:sessionId`
* **Query dependencies:** `useQuery(['sessions'])`
* **Mutation dependencies:** Revoke session mutation
* **Realtime dependencies:** None
* **Modal dependencies:** Revoke session confirm dialog
* **Deep-link support:** `nazar://settings/account`
* **Empty state:** Active session list
* **Loading state:** Session row skeleton
* **Error state:** Retry button
* **Offline behavior:** Read-only view
* **Analytics event:** `settings_account_viewed`

---

### Screen 26: Privacy Settings
* **Screen:** Privacy Settings
* **Route:** `/settings/privacy`
* **Parent:** Root Stack
* **Entry points:** Tap Privacy in Settings
* **Exit points:** `/settings`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/profiles/me/preferences`, `PUT /v1/profiles/me/preferences`, `POST /v1/profiles/me/hide`, `POST /v1/profiles/me/pause`
* **Query dependencies:** `useQuery(['preferences'])`
* **Mutation dependencies:** Update discovery visibility, toggle ghost mode
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://settings/privacy`
* **Empty state:** Toggle switches for discovery visibility and location precision
* **Loading state:** Switch skeletons
* **Error state:** Revert toggle with error toast
* **Offline behavior:** Prevent toggling when offline
* **Analytics event:** `settings_privacy_viewed`

---

### Screen 27: Safety & Blocked Users
* **Screen:** Safety Hub
* **Route:** `/settings/safety`
* **Parent:** Root Stack
* **Entry points:** Tap Safety in Settings
* **Exit points:** `/settings`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/safety/blocking/blocks`, `DELETE /v1/safety/blocking/:userId/block` (Unblock)
* **Query dependencies:** `useQuery(['blocks'])`
* **Mutation dependencies:** Unblock user mutation
* **Realtime dependencies:** None
* **Modal dependencies:** Unblock confirmation dialog
* **Deep-link support:** `nazar://settings/safety`
* **Empty state:** "You haven't blocked anyone"
* **Loading state:** Blocked users list skeleton
* **Error state:** Retry button
* **Offline behavior:** Cached blocked users list
* **Analytics event:** `settings_safety_viewed`, `safety_unblock`

---

### Screen 28: Notification Preferences
* **Screen:** Notification Preferences
* **Route:** `/settings/notifications`
* **Parent:** Root Stack
* **Entry points:** Tap Notifications in Settings
* **Exit points:** `/settings`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/notifications/preferences`, `PATCH /v1/notifications/preferences`
* **Query dependencies:** `useQuery(['notification-preferences'])`
* **Mutation dependencies:** Patch notification toggles
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://settings/notifications`
* **Empty state:** Toggles for Matches, Messages, Likes, Social, System
* **Loading state:** Toggles shimmer
* **Error state:** Error toast
* **Offline behavior:** Block toggle changes when offline
* **Analytics event:** `settings_notifications_viewed`

---

### Screen 29: Delete Account
* **Screen:** Delete Account
* **Route:** `/settings/delete-account`
* **Parent:** Root Stack
* **Entry points:** Tap Delete Account in Account Settings
* **Exit points:** `/settings/account`, `/(auth)/welcome` (on complete)
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `DELETE /v1/auth/account`
* **Query dependencies:** None
* **Mutation dependencies:** Delete account mutation (`authClient.deleteAccount()`)
* **Realtime dependencies:** None
* **Modal dependencies:** Critical irreversible confirmation dialog
* **Deep-link support:** None
* **Empty state:** Warning explainer and re-authentication trigger
* **Loading state:** Deletion in progress spinner
* **Error state:** Error dialog explaining failure
* **Offline behavior:** Disabled when offline
* **Analytics event:** `account_deletion_initiated`, `account_deleted`

---

### Screen 30: Subscription & Premium (Nazar Gold)
* **Screen:** Subscription & Paywall
* **Route:** `/billing`
* **Parent:** Root Stack
* **Entry points:** Nazar Gold badge in Profile, Discovery likes teaser, Settings
* **Exit points:** Previous route, `/billing/history`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/billing/products`, `GET /v1/billing/entitlements`, `POST /v1/billing/purchases/verify`, `POST /v1/billing/purchases/restore`
* **Query dependencies:** `useQuery(['billing-products'])`, `useQuery(['entitlements'])`
* **Mutation dependencies:** Verify purchase mutation, Restore purchases mutation
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://billing`, `https://nazar.app/billing`
* **Empty state:** Tier comparison cards (Nazar Free vs Nazar Gold)
* **Loading state:** Tier card skeletons
* **Error state:** "Unable to connect to App Store / Google Play"
* **Offline behavior:** Cached current entitlement status
* **Analytics event:** `subscription_opened`, `purchase_initiated`

---

### Screen 31: Billing History
* **Screen:** Billing History
* **Route:** `/billing/history`
* **Parent:** Root Stack
* **Entry points:** Tap History in Subscription screen
* **Exit points:** `/billing`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/billing/transactions`, `GET /v1/billing/subscriptions`
* **Query dependencies:** `useQuery(['transactions'])`
* **Mutation dependencies:** None
* **Realtime dependencies:** None
* **Modal dependencies:** None
* **Deep-link support:** `nazar://billing/history`
* **Empty state:** "No previous transactions"
* **Loading state:** Transaction row skeletons
* **Error state:** Retry button
* **Offline behavior:** Cached transactions
* **Analytics event:** `billing_history_viewed`

---

### Screen 32: Notifications Center
* **Screen:** Notifications Center
* **Route:** `/notifications`
* **Parent:** Root Stack
* **Entry points:** Bell icon in navigation headers, push notification tap
* **Exit points:** Previous route, target resource (`/matches/[id]`, `/chat/[id]`)
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/notifications`, `POST /v1/notifications/:id/read`, `POST /v1/notifications/read-all`
* **Query dependencies:** `useQuery(['notifications'])`
* **Mutation dependencies:** Mark as read mutation
* **Realtime dependencies:** Push notifications & in-app alerts
* **Modal dependencies:** None
* **Deep-link support:** `nazar://notifications`, `https://nazar.app/notifications`
* **Empty state:** `EmptyState` type `noNotifications` ("All caught up!")
* **Loading state:** Notification row shimmer
* **Error state:** Retry button
* **Offline behavior:** Cached notification items
* **Analytics event:** `notifications_center_viewed`

---

### Screen 33: Discovery Filters Modal
* **Screen:** Discovery Filters Sheet
* **Route:** `/modal/filters`
* **Parent:** Root Stack (Presentation: `'modal'`)
* **Entry points:** Filter icon in Discovery header
* **Exit points:** Dismiss back to `/(tabs)/discovery`
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `GET /v1/profiles/me/preferences`, `PUT /v1/profiles/me/preferences`
* **Query dependencies:** Preferences query
* **Mutation dependencies:** Save preferences mutation
* **Realtime dependencies:** None
* **Modal dependencies:** BottomSheet modal presentation
* **Deep-link support:** None
* **Empty state:** Slider controls for Age (18–60+), Distance (1–100km), Gender, Intent
* **Loading state:** Skeleton controls
* **Error state:** Validation toast
* **Offline behavior:** Local state adjustments; saved on reconnect
* **Analytics event:** `discovery_filter_opened`, `discovery_filter_applied`

---

### Screen 34: Safety Report Modal
* **Screen:** Safety Report Sheet
* **Route:** `/modal/report`
* **Parent:** Root Stack (Presentation: `'modal'`)
* **Entry points:** "Report" button on Profile, Chat Header, or Social Post
* **Exit points:** Dismiss back to calling screen
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `POST /v1/safety/reporting`
* **Query dependencies:** None
* **Mutation dependencies:** Submit report mutation
* **Realtime dependencies:** None
* **Modal dependencies:** BottomSheet modal presentation
* **Deep-link support:** None
* **Empty state:** Reason selector (Inappropriate photos, Harassment, Scam, Underage, Other)
* **Loading state:** Submitting spinner
* **Error state:** "Report submission failed. Please try again."
* **Offline behavior:** Require internet connection
* **Analytics event:** `safety_report_submitted`

---

### Screen 35: Block User Confirmation Modal
* **Screen:** Block Confirmation Dialog
* **Route:** `/modal/block`
* **Parent:** Root Stack (Presentation: `'modal'`)
* **Entry points:** "Block" button on Profile or Chat Header
* **Exit points:** Calling screen dismissed, user unlinked
* **Authentication requirement:** Authenticated
* **API dependencies:** Existing API: `POST /v1/safety/blocking/:userId/block`
* **Query dependencies:** None
* **Mutation dependencies:** Block user mutation
* **Realtime dependencies:** None
* **Modal dependencies:** Dialog presentation
* **Deep-link support:** None
* **Empty state:** Confirmation prompt explainer
* **Loading state:** Blocking spinner
* **Error state:** "Failed to block user. Try again."
* **Offline behavior:** Require internet connection
* **Analytics event:** `safety_user_blocked`

---

### Screen 36: Match Celebration Modal
* **Screen:** Mutual Match Celebration
* **Route:** `/modal/celebration`
* **Parent:** Root Stack (Presentation: `'modal'`)
* **Entry points:** Triggered immediately when Like mutation returns `{ matched: true, matchId }`
* **Exit points:**
  * "Start Conversation" → `/chat/[conversationId]`
  * "Keep Browsing" → Dismiss back to `/(tabs)/discovery`
  * "Close" → Dismiss back to `/(tabs)/discovery`
* **Authentication requirement:** Authenticated
* **API dependencies:** Match data passed from interaction response
* **Query dependencies:** None
* **Mutation dependencies:** None
* **Realtime dependencies:** Triggered by interaction response or socket event
* **Modal dependencies:** Full-bleed celebratory dialog
* **Deep-link support:** None
* **Empty state:** Not applicable
* **Loading state:** Instant render
* **Error state:** Not applicable
* **Offline behavior:** Fully supported offline
* **Analytics event:** `match_celebration_viewed`, `match_celebration_start_chat`

---

## 3. Screen Priority Tiers

To govern engineering focus and visual fidelity in subsequent phases:

### Tier 1 (Core Daily Experience)
* Discover Feed (`/(tabs)/discovery`)
* Public Profile Detail (`/profile/[userId]`)
* Matches & Likes (`/(tabs)/matches`)
* Match Detail (`/matches/[matchId]`)
* Messages (`/(tabs)/messages`)
* Active Chat (`/chat/[conversationId]`)
* My Profile Hub (`/(tabs)/profile`)
* Mutual Match Celebration (`/modal/celebration`)

### Tier 2 (Important Supporting Experience)
* Authentication (`/(auth)/login`, `/(auth)/otp`)
* Onboarding Flow (`/(onboarding)/*`)
* Edit Profile (`/profile/edit`)
* Discovery Filters Sheet (`/modal/filters`)
* Notifications Center (`/notifications`)
* Settings Hub (`/settings`)
* Safety & Block/Report (`/modal/report`, `/modal/block`, `/settings/safety`)
* Subscription & Paywall (`/billing`)

### Tier 3 (Secondary Ecosystem)
* Explore Social Feed (`/(tabs)/explore`)
* Social Post Detail (`/social/post/[postId]`)
* Create Post (`/social/create-post`)
* Community Detail (`/social/community/[communityId]`)
* Event Detail (`/social/event/[eventId]`)
* Privacy Settings (`/settings/privacy`)
* Account & Devices (`/settings/account`)
* Billing History (`/billing/history`)
* Account Deletion (`/settings/delete-account`)
