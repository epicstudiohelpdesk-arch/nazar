# Nazar Mobile · Notifications & Activity Center Architecture

## 1. Overview & Mission

Frontend Phase F8 implements the complete production-grade **Notifications + Activity Center** experience for Nazar, bridging backend Gate 10 notification infrastructure with the mobile client application.

```text
Backend Notification (Gate 10)
        │
        ├── Push delivery payload (APNs / FCM)
        │
        └── Activity Center item
                 │
                 ↓
          Notification Router (Allowlisted, Validated)
                 │
                 ↓
       Authoritative Destination (Chat, Matches, Social, Settings)
```

The system ensures:

- **Server Authority**: The backend owns ordering, unread count tallies, and permissions. The client never invents synthetic states, fake tokens, or speculative counter decrements.
- **Security & Route Safety**: Every notification identifier and target ID is strictly validated against allowlists and path traversal patterns before navigation.
- **Cold-Start Resilience**: Push notification navigation taps are preserved during bootstrap session restoration and dispatched only once an authenticated active session is verified.

---

## 2. Backend Capabilities Audit & Contract Surface

Inspection of `@platform/api-contracts` (Gate 10) and `@platform/validation`:

| Feature / Resource              | HTTP Method / Endpoint                | Contract / Schema                                                         | Status in Mobile                                                     |
| :------------------------------ | :------------------------------------ | :------------------------------------------------------------------------ | :------------------------------------------------------------------- |
| **Activity Center Feed**        | `GET /v1/notifications`               | `NotificationListResponseDto`, `listNotificationsQuerySchema`             | **Fully Integrated** with cursor pagination & limit clamping (1-50)  |
| **Unread Notification Count**   | `GET /v1/notifications/unread-count`  | `UnreadNotificationCountDto`                                              | **Fully Integrated** with system badge synchronization               |
| **Mark Notification Read**      | `POST /v1/notifications/:id/read`     | `MarkNotificationReadResponseDto`                                         | **Fully Integrated** with server `readAt` adoption                   |
| **Mark All Notifications Read** | `POST /v1/notifications/read-all`     | `MarkAllNotificationsReadResponseDto`                                     | **Fully Integrated** across all cached feed pages                    |
| **Get Preferences**             | `GET /v1/notifications/preferences`   | `NotificationPreferencesDto`                                              | **Fully Integrated**                                                 |
| **Update Preferences**          | `PATCH /v1/notifications/preferences` | `UpdateNotificationPreferencesDto`, `updateNotificationPreferencesSchema` | **Fully Integrated** with server-authoritative error rollback        |
| **Register Device**             | `POST /v1/devices`                    | `RegisterDeviceRequestDto`, `DeviceResponseDto`                           | **Fully Integrated** with hashed device identifier & token redaction |
| **List Devices**                | `GET /v1/devices`                     | `readonly DeviceResponseDto[]`                                            | **Fully Integrated**                                                 |
| **Revoke Device**               | `DELETE /v1/devices/:deviceId`        | `{ revoked: boolean }`                                                    | **Fully Integrated**                                                 |

### Supported Notification Types (Gate 10 Contract)

1. `NEW_MATCH`: Navigates to `/matches/:matchId` (or `/matches` if ID omitted).
2. `NEW_MESSAGE`: Navigates to `/chat/:conversationId` (or `/conversations` if ID omitted).
3. `NEW_LIKE`: Generic notice ("Like"); no actor recorded by server to preserve anonymity; non-routable or fallback.
4. `SYSTEM_NOTICE`: System advisory or billing update (routes to `/billing` if billing key present).
5. `SECURITY_ALERT`: Security warning (routes to `/settings/account`).
6. `ACCOUNT_RESTRICTION`: Account warning/restriction (routes to `/settings/account`).
7. `POST_COMMENT`: Social post update (routes to `/social/post/:postId`).
8. `COMMUNITY_JOIN`: Community activity (routes to `/social/community/:communityId`).
9. `EVENT_RSVP`: Event update (routes to `/social/event/:eventId`).
10. `EVENT_WAITLIST_PROMOTED`: Event promotion (routes to `/social/event/:eventId`).

---

## 3. Information Architecture & Routes

```text
apps/mobile/app/
├── notifications/
│   └── index.tsx              # Primary Activity Center route (/notifications)
├── settings/
│   └── notifications.tsx      # Notification Preferences route (/settings/notifications)
├── (tabs)/
│   └── profile/
│       └── index.tsx          # Unread badge trigger in TopNavHeader
└── index.tsx                  # App launch & cold-start pending intent consumer
```

---

## 4. Query Architecture & Cache Reconciliation

Notifications employ TanStack Query with structured hierarchical query keys:

```typescript
export const NOTIFICATION_QUERY_KEYS = {
  root: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  preferences: ['notifications', 'preferences'] as const,
  devices: ['notifications', 'devices'] as const,
};
```

### Stale Time & Cache Strategy

- **Feed (`list`)**: `staleTime = 30_000ms` (30 seconds) to ensure recent deliveries surface quickly without constant thrashing.
- **Unread Count**: `staleTime = 20_000ms` (20 seconds). When a list page arrives, its `totalUnreadCount` immediately synchronizes into the unread count state.
- **Preferences**: `staleTime = 300_000ms` (5 minutes).

### Reconciliation Matrix

| Action                           | Cache Invalidation Target | Behavior                                                                                                                                 |
| :------------------------------- | :------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Mark One Read**                | `list`, `unreadCount`     | Updates local `readAt` on the matching row in all cached pages; refetches unread count from server. Never locally decrements.            |
| **Mark All Read**                | `list`, `unreadCount`     | Sets `readAt` on all unread rows across all pages; refetches authoritative count.                                                        |
| **Incoming Push / Socket Event** | `list`, `unreadCount`     | Upserts row into the front of the first page using `upsertNotification(existing, item)`; preserves server ordering; invalidates queries. |
| **Preference Mutation**          | `preferences`             | Optimistic update with automatic query invalidation and rollback on mutation error.                                                      |
| **App Resume (Foreground)**      | `list`, `unreadCount`     | Triggers background refresh of notification list and unread count only (does not blindly refetch entire app).                            |

---

## 5. Unread State & System Badge Synchronization

1. **Unread Count Single Source of Truth**:
   The unread count is always sourced from backend queries (`GET /v1/notifications/unread-count` or `totalUnreadCount` in `NotificationListResponseDto`).
2. **Tab & Header Badges**:
   Rendered using `<UnreadBadge count={unread.count} />` with accessible ARIA announcements (`"Open Activity, 3 unread items"`).
3. **OS Badge Count (`applyBadgeCount`)**:
   Synced to the native OS app icon via `expo-notifications` (`setBadgeCountAsync(safeCount)`).

---

## 6. Realtime Ingress & WebSocket Integration

The client integrates notification events over the existing `ChatSocketManager` (`apps/mobile/src/chat/chat-socket.ts`) rather than creating a competing socket connection:

- **Socket Event**: `notification.created`
- **Handler**: `useNotificationIngress()` registers a listener that deduplicates incoming payloads by ID and upserts into the active TanStack Query cache.
- **Backend Reality**: The Gate 10 chat gateway does not currently emit notification events; this listener is prepared and inert until the backend gateway begins broadcasting them. App resume sync (`useNotificationResumeSync`) acts as the primary synchronization trigger in the interim.

---

## 7. Push Runtime & Device Registration (FCM / APNs)

Push notification capabilities are encapsulated in `apps/mobile/src/notifications/push-runtime.ts` with progressive degradation:

### Native Runtime Detection

If `expo-notifications` or `expo-device` is not available (e.g. Node tests, Web, Expo Go without native build), `isPushRuntimeAvailable()` returns `false`, and the UI seamlessly operates in Activity-Center-only mode without crashing.

### Device Identifier Cryptographic Hashing

To prevent leaking sensitive push delivery credentials into unredacted database columns:

```typescript
deriveDeviceIdentifier({ pushToken });
```

Derives a stable 64-character SHA-256 digest from the push token. Raw tokens are never used as device identifiers and are only passed to the backend in the `pushToken` field (which the server redacts on responses).

### Android Notification Channel

Configured on Android runtime startup:

- Channel Identifier: `nazar-activity`
- Channel Name: `Matches, messages & activity`
- Importance: `4` (`IMPORTANCE_HIGH`)

### Foreground Policy

When a push arrives while the app is in `active` foreground:

- Native banners and sounds are suppressed (`showBanner: false, playSound: false`).
- Feed cache and badge are silently updated (`shouldReconcile: true`).
- This prevents triple-competing notifications (native banner + in-app toast + activity center update).

---

## 8. Permission UX & Lifecycle

1. **Contextual Permission Prompt**:
   Permission is requested in response to explicit user interaction via `<PushPermissionCard />` or Settings ("Stay in the loop").
2. **State Machine (`PushPermissionState`)**:
   - `not_requested`: Initial undetermined state; shows explanation and "Enable notifications" CTA.
   - `granted`: Device is registered; displays confirmation copy.
   - `provisional`: Quiet notifications active on iOS; prompts user that notifications arrive quietly.
   - `denied`: Platform denied; does not spam the user; displays instructions to visit OS Settings.
   - `blocked`: OS permanently blocked; provides "Open Settings" link.
   - `unsupported`: Graceful fallback on simulators and non-mobile runtimes.
3. **Session Demarcation**:
   On logout, session expiration, or switching accounts, device registration is cleared and pending notification intents are wiped.

---

## 9. Notification Router & Deep-Link Resolution

Deep-link navigation is centralized in `notification-payload.ts` (`resolveNotificationDestination`).

### Safe Route Construction

- Identifiers are validated against `/^[A-Za-z0-9_.-]+$/` (1-128 characters), explicitly disallowing path traversals (`..`), slashes, whitespace, and special characters.
- Path parameters are strictly URI-encoded via `encodeURIComponent`.
- Validated destination map:
  - Conversation: `/chat/${encodeURIComponent(conversationId)}`
  - Match: `/matches/${encodeURIComponent(matchId)}`
  - Social Post: `/social/post/${encodeURIComponent(postId)}`
  - Community: `/social/community/${encodeURIComponent(communityId)}`
  - Event: `/social/event/${encodeURIComponent(eventId)}`
  - Billing: `/billing`
  - Account: `/settings/account`

### Cold-Start Intent Queue

To prevent the common navigation race condition where a cold-start push tap navigates before session restore completes (and is destroyed by the bootstrap route replacement):

1. Launch tap payload is captured in `app/index.tsx` via `getColdStartIntent()`.
2. Parsed intent is queued via `setPendingNotificationIntent()`.
3. `sessionService.restoreSession()` runs authoritatively.
4. Only if session is `ACTIVE`, the pending intent is consumed (`consumePendingNotificationIntent()`) and dispatched via `router.replace(deepLink)`.
5. If session is `UNAUTHENTICATED`, `INCOMPLETE`, or `EXPIRED`, the intent is discarded immediately (`clearPendingNotificationIntent()`).

---

## 10. Notification Preferences Architecture

Implemented in `apps/mobile/src/notifications/NotificationSettingsScreen.tsx`:

- **Categories**:
  1. `matchNotificationsEnabled`
  2. `messageNotificationsEnabled`
  3. `likeNotificationsEnabled`
  4. `safetyNotificationsEnabled`
  5. `systemNotificationsEnabled`
  6. `messagePreviewEnabled`
- **Mutations**:
  Updates are server-authoritative (`PATCH /v1/notifications/preferences`). If the server rejects an update or the network fails, the switch reverts to the verified server state with an error banner. No fake local switches persist.

---

## 11. Accessibility & Design Primitives

- **Typography & Semantic Labels**: Unread states use explicit wording (`"Unread notification. Match. Alex..."`) rather than relying on color alone.
- **Dynamic Text**: Respects OS text scaling without truncation in `NotificationRow`.
- **Screen Reader Hints**: Routable items announce `"Double tap to open [conversation/match/post/community/event]"`. Non-routable items omit the hint.
- **Relative Time**: Uses human-readable relative time (`"2 minutes ago"`, `"1 hour ago"`, `"Jan 1, 2020"`).
- **Touch Targets**: All interactive rows exceed standard $44\times44$ pt touch requirements.
