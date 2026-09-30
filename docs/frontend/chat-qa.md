# Nazar Mobile · Messaging & Chat Experience QA Matrix

This document defines the production Quality Assurance (QA) verification protocol for the Nazar mobile application's Messaging & Chat experience (F6): Conversation List, Inverted Message History, Cursor Pagination, Optimistic Message Lifecycle, Real-time WebSocket Synchronization, Delivery/Read States, Typing Indicators, Safety Controls (Block, Report, Unmatch), and PII-sanitized telemetry.

---

## QA Test Scenarios

### 1. Conversation List & Cursor Pagination

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **1.1** | Navigate to `/(tabs)/messages` on an active authenticated session. | Displays skeleton loader placeholders while executing `GET /v1/conversations?limit=20`. Emits `conversations_viewed` analytics event. | PASS |
| **1.2** | Render conversation list. | Renders list of `ConversationCard` items displaying other user's avatar, online indicator, verified badge, name, relative timestamp, preview, and unread count badge. | PASS |
| **1.3** | Scroll down to trigger pagination (`onEndReachedThreshold=0.3`). | TanStack `useInfiniteQuery` calls `fetchNextPage()` using `nextCursor` without duplicating existing records. | PASS |
| **1.4** | Pull down on the conversation list. | `RefreshControl` animates with Saffron accent tint and refreshes the first page (`refetch()`). | PASS |
| **1.5** | Account with zero conversations. | Displays empty state: "No messages yet — When you match with someone, your conversations will appear here." with "View Matches" CTA button. | PASS |
| **1.6** | Search filtering in conversation list. | Entering text in `SearchInput` filters conversations in real time by partner's display name or message preview text; clearing input restores full list. | PASS |

---

### 2. Active Chat Screen & Inverted Message History

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **2.1** | Tap a conversation card from `ConversationsScreen`. | Emits `conversation_opened`; navigates cleanly into `/chat/${conversationId}`. | PASS |
| **2.2** | Hydrate conversation details & history. | Loads `ChatHeader` with partner photo, name, age, and socket connection indicator. Loads inverted message history with oldest messages at the top and newest at the bottom. | PASS |
| **2.3** | Inspect date separators. | Visual date boundary pills ("Today", "Yesterday", "MMMM D, YYYY") appear above each day's group of messages. | PASS |
| **2.4** | Scroll up towards older messages in inverted list. | Reaching top of screen triggers `onEndReached`; requests older messages with `nextCursor`; appends seamlessly to the top without viewport jumping. | PASS |
| **2.5** | Automatic read receipt dispatch. | If incoming unread messages exist, dispatches `POST /v1/conversations/:id/read` with the newest incoming message ID; emits `conversation_marked_read`. | PASS |

---

### 3. Composer, Character Counter & Optimistic Send

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **3.1** | Enter text into multiline composer. | Composer height auto-expands cleanly up to max height without obscuring message history. Send button transitions to active Saffron styling. | PASS |
| **3.2** | Character limit approaching (>1800 characters). | Subtle character countdown indicator appears in composer indicating remaining characters out of 2000. | PASS |
| **3.3** | Character limit exceeded (>2000 characters). | Send button becomes disabled; countdown text turns red. | PASS |
| **3.4** | Tap Send with valid text. | Generates UUID `clientMessageId`; prepends optimistic message at index `0` (bottom of viewport) with status `⋯` (sending); emits `message_send_attempted`; clears text input immediately. | PASS |
| **3.5** | Server responds with 201 Created. | Optimistic item is replaced with confirmed server message DTO (`deliveryState: 'SENT'`); status updates to `✓`; emits `message_sent`. | PASS |
| **3.6** | Send failure (network drop / server error). | Optimistic item transitions to `isFailed: true`; displays red `Failed ↺` retry button; emits `message_send_failed`. | PASS |
| **3.7** | Tap `Failed ↺` retry button. | Transitions item back to `isOptimistic: true`; dispatches send request with same `clientMessageId`; emits `message_retried`. | PASS |

---

### 4. Real-time WebSocket Synchronization & Reconnection

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **4.1** | Client connects to `/chat` socket gateway. | Socket connects with JWT bearer token; joins room `conversation:${id}`; header indicates "Active now". | PASS |
| **4.2** | Partner sends message (`message.created` broadcast). | Socket receives event; if matching clientMessageId exists, confirms it; if incoming, appends to bottom of screen and automatically triggers read receipt. Invalids conversation list cache. | PASS |
| **4.3** | Partner reads message (`message.read` broadcast). | Outgoing message checks update in real time from `✓` (sent) or `✓✓` (delivered) to blue double checks `✓✓` (read). | PASS |
| **4.4** | Partner client marks delivery (`message.delivered` broadcast). | Outgoing message checks update to double check `✓✓`. | PASS |
| **4.5** | Temporary network interruption. | Header dot turns yellow ("Reconnecting..."); `OfflineBanner` mounts showing reconnect status. | PASS |
| **4.6** | Reconnection established. | Banner dismisses; socket re-joins room; automatically triggers `syncMessages` to fetch any missed messages while offline. | PASS |

---

### 5. Typing Indicator Protocols

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **5.1** | User types in composer. | Client emits throttled `typing:start` socket event (at most once every 2 seconds). | PASS |
| **5.2** | User stops typing, sends, or blurs input. | Client emits `typing:stop` socket event. | PASS |
| **5.3** | Partner starts typing (`typing.started` broadcast). | Subtly animated typing pill appears above composer: "[Partner Name] is typing...". | PASS |
| **5.4** | Partner stops typing (`typing.stopped` broadcast) or 3s timer expires. | Typing pill smoothly disappears. | PASS |

---

### 6. Safety & Connection Management Controls

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **6.1** | Tap Unmatch icon in `ChatHeader`. | Destructive native alert appears: "Unmatch with [PartnerName]?". | PASS |
| **6.2** | Confirm Unmatch. | Calls `DELETE /v1/matches/:matchId`; invalidates match and conversation queries; emits `chat_unmatch_completed`; navigates back to conversation list. | PASS |
| **6.3** | Tap Block icon in `ChatHeader`. | Opens `BlockModal` with customizable reason input. | PASS |
| **6.4** | Confirm Block. | Calls `POST /v1/users/:targetUserId/block`; removes conversation from client cache; emits `chat_block_completed`; navigates back. | PASS |
| **6.5** | Tap Report icon in `ChatHeader`. | Opens `ReportModal` with canonical report reason codes. | PASS |
| **6.6** | Submit Report. | Calls `POST /v1/reports`; displays confidential confirmation alert; emits `chat_report_completed`. | PASS |

---

### 7. Deep Linking & Edge Cases

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **7.1** | Open URI `nazar://chat/:conversationId`. | App opens directly to `ChatScreen` for that conversation ID. | PASS |
| **7.2** | Open deep link with invalid or unauthorized ID (403/404). | Displays `ErrorState` "Conversation Unavailable" with "Go Back" action without crashing or exposing private information. | PASS |
| **7.3** | Conversation closed (`status: 'CLOSED'`). | Composer is disabled with message "This conversation is closed". | PASS |
| **7.4** | Keyboard appearance on iOS. | `KeyboardAvoidingView` offsets composer smoothly above software keyboard without covering message bubbles. | PASS |

---

### 8. Telemetry & Strict PII Sanitization

| Step | Action | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **8.1** | Send message containing sensitive text, phone numbers, or emails. | `sanitizeAnalyticsProperties()` scrubs `body`, `text`, `message`, `content`, `preview`, `phone`, and `email` before passing to analytics client. | PASS |
| **8.2** | Inspect telemetry logs. | Telemetry records event name, `conversationId`, and `clientMessageId`; message body is 100% omitted. | PASS |
