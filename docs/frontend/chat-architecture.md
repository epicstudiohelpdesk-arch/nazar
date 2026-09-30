# Nazar Mobile · Messaging & Chat Experience Architecture

## 1. Overview & Mission

Frontend Phase F6 establishes the complete production-grade **Messaging & Chat Experience** for Nazar. It connects the visual design constitution of F0, navigation and information architecture of F1, core UI component system of F2, onboarding foundations of F3, primary candidate interaction of F4, and mutual connection inbox of F5 into an intimate, safe, and fluid real-time communication surface:

```text
Discovery / Mutual Match
          ↓
     Matches Tab
          ↓
   Conversation List (Messages)
          ↓
   Active Conversation (Chat)
          ↓
   Inverted Message History  ←→  Composer & Optimistic Send
          ↓
   WebSocket Realtime Updates (Delivery/Read/Typing)
          ↓
   Safety Controls (Report / Block / Unmatch)
```

The objective is to make direct conversation feel effortless, respectful, emotionally rewarding, and completely synchronized with the server's authoritative state.

---

## 2. Backend Capabilities Audit & Scope Boundaries

A complete audit of the backend REST endpoints (`apps/api/src/modules/chat/chat.controller.ts`), WebSocket gateway (`apps/api/src/modules/chat/chat.gateway.ts`), and shared contracts (`packages/api-contracts/src/chat/chat.contract.ts`) was completed prior to implementation:

### Authoritative Backend REST Endpoints
| Endpoint | Method | Contract Request / Response | Client Integration |
| :--- | :--- | :--- | :--- |
| `/v1/conversations` | `GET` | Query: `limit`, `cursor`<br>Response: `ConversationListResponseDto` | **Fully Integrated** via TanStack `useInfiniteQuery` with cursor pagination |
| `/v1/conversations/:id` | `GET` | Response: `ConversationDetailDto` | **Fully Integrated** for participant profile, verification, and match ID |
| `/v1/conversations/:id/messages` | `GET` | Query: `limit`, `cursor`<br>Response: `MessageListResponseDto` | **Fully Integrated** with descending cursor pagination in inverted list |
| `/v1/conversations/:id/messages` | `POST` | Body: `SendMessageRequestDto`<br>Response: `SendMessageResponseDto` | **Fully Integrated** with optimistic `clientMessageId` lifecycle |
| `/v1/conversations/:id/read` | `POST` | Body: `{ messageId }`<br>Response: `MarkReadResponseDto` | **Fully Integrated** upon chat mount and receipt of incoming messages |
| `/v1/conversations/:id/delivered` | `POST` | Body: `{ messageId }`<br>Response: `MarkDeliveredResponseDto` | Supported for push notification receipts |
| `/v1/conversations/:id/sync` | `GET` | Query: `sinceMessageId`, `limit`<br>Response: `SyncMessagesResponseDto` | **Fully Integrated** for socket reconnection catch-up |

### Authoritative WebSocket Gateway (`/chat` Namespace)
- **Authentication**: JWT Bearer token passed in socket handshake auth (`{ auth: { token } }`).
- **Client Emitters**:
  - `join:conversation`: Join conversation socket room (`conversation:${id}`).
  - `leave:conversation`: Leave conversation socket room.
  - `typing:start`: Emitted when user types (throttled at 2000ms intervals).
  - `typing:stop`: Emitted when user clears text, submits, or blurs input.
  - `message:read`: Realtime read receipt broadcast.
  - `message:delivered`: Realtime delivery receipt broadcast.
- **Server Broadcasts**:
  - `message.created`: Dispatched on new message to conversation room and recipient user room.
  - `message.read`: Dispatched when partner reads up to a given message ID.
  - `message.delivered`: Dispatched when partner client marks delivery.
  - `typing.started`: Dispatched to partner when typing starts.
  - `typing.stopped`: Dispatched to partner when typing stops.

> [!IMPORTANT]
> **Scope Boundaries & Server Authority**:
> - The server remains strictly authoritative for conversation membership, persistence, message ordering, message IDs, and safety state.
> - Client-side state is purely transient: optimistic message placeholders (`isOptimistic: true`), local draft text, typing throttle timers, and keyboard offsets.
> - The client does not invent unsupported message types (only supported `TEXT`), attachments, reactions, or audio notes.

---

## 3. Information Architecture & Navigation Structure

```text
apps/mobile/app/
├── (tabs)/
│   └── messages/
│       └── index.tsx          # Canonical Messages Tab Destination
├── conversations/
│   └── index.tsx              # Deep link / Alternate route to ConversationsScreen
└── chat/
    └── [conversationId].tsx   # Canonical Conversation Route (ChatScreen)
```

### Deep Link Specifications
- **Scheme**: `nazar://`
- **Pattern**: `nazar://chat/:conversationId`
- **Routing**: Expo Router dynamically routes to `app/chat/[conversationId].tsx`.
- **Error Boundary**: If `conversationId` is invalid, expired, or belongs to another user, `ChatScreen` gracefully presents the F2 `ErrorState` ("Conversation Unavailable: This conversation could not be found or has ended") with a "Go Back" action.

---

## 4. Query Architecture & Realtime Reconciliation

Predictable, structured TanStack Query keys ensure seamless cache invalidation:

```typescript
export const CHAT_QUERY_KEYS = {
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
};
```

### Inverted FlatList & Descending Order Architecture
1. **Ordering**:
   - The server returns messages in chronological descending order (`items[0]` is newest).
   - Inverted FlatList (`inverted={true}`) renders index `0` at the **bottom** of the screen.
   - Older messages extend upward towards the top of the viewport.
2. **Scroll & Cursor Pagination**:
   - As the user scrolls up towards older messages, the list reaches the end of the array, triggering `onEndReached`.
   - `fetchNextPage()` requests the next batch of older messages using the opaque `nextCursor` without causing any layout jitter.
3. **Optimistic Insertions**:
   - When the user taps send, an optimistic message is immediately created with a UUID-based `clientMessageId` and prepended to the top of the local array (`index 0`).
   - It appears instantaneously at the bottom of the chat viewport with status `⋯` (pending).
   - Upon REST response confirmation or `message.created` socket event, the server message replaces the optimistic item seamlessly.
   - If the request fails, the item transitions to `isFailed: true` with a `Failed ↺` retry button.

### Realtime Socket Event Matrix
| Socket Event | Client Cache / State Action |
| :--- | :--- |
| `message.created` | Replaces matching optimistic message (by `clientMessageId`) or appends incoming message to cache. If incoming from partner, dispatches `chatApi.markRead`. Invalidates `CHAT_QUERY_KEYS.conversations`. |
| `message.read` | Updates delivery states of all outgoing messages up to `lastReadMessageId` to `'READ'`. |
| `message.delivered` | Updates delivery states of outgoing messages up to `messageId` to `'DELIVERED'`. |
| `typing.started` | Sets `isPartnerTyping = true` with animated typing pill. |
| `typing.stopped` | Sets `isPartnerTyping = false`. |
| `reconnect` | Updates connection badge to connected. Re-queries conversation messages to reconcile any missed messages while disconnected. |

---

## 5. UI Component Hierarchy & Design Token Conformance

All messaging screens and components are 100% compliant with the Nazar F0 design system tokens (`useTheme()`) and F2 component primitives:

### A. Conversations Screen (`ConversationsScreen.tsx`)
- **TopNavHeader**: Title "Messages", transparent background, accessible back action if modal.
- **SearchInput**: Live client-side filtering by partner display name or message preview.
- **ConversationCard**: Avatar ($56\times56$) with presence ring and verified badge, partner name, timestamp, bold preview for unread, Saffron unread badge (`colors.accent`).
- **LoadingSkeleton**: Smooth skeleton card placeholders during initial query load.
- **EmptyState**: Branded empty states:
  - Default: "No messages yet — When you match with someone, your conversations will appear here." CTA: "View Matches".
  - Filtered: "No conversations found" with "Clear Search" button.
- **ErrorState**: Server error illustration with retry callback.

### B. Chat Screen (`ChatScreen.tsx`)
- **ChatHeader**:
  - Avatar with online presence indicator (Green for active, Yellow for reconnecting, Muted for offline).
  - Partner name and age.
  - Action buttons: Unmatch (`trash`), Report (`flag`), Block (`shield`).
- **OfflineBanner**:
  - Automatically mounts when socket disconnects or reconnects, providing clear network transparency.
- **MessageBubble**:
  - Outgoing bubble: Nazar Saffron (`colors.accent`), text `colors.textInverse`, rounded with tail.
  - Incoming bubble: Muted surface (`colors.surfaceMuted`), text `colors.textPrimary`.
  - Delivery indicators: `⋯` (sending), `✓` (sent), `✓✓` (delivered), `✓✓` blue/accent (read), `Failed ↺` (retry CTA).
- **Date Separator**:
  - Dynamic pill inserted between message date boundaries ("Today", "Yesterday", "MMMM D, YYYY").
- **TypingIndicator**:
  - Subtle, pulsing dots animation with partner's display name.
- **MessageComposer**:
  - Multiline auto-expanding TextInput (up to 2000 characters).
  - Character counter displayed when nearing limit (>1800 characters).
  - Saffron Send button with `send` icon, disabled when empty or sending.
  - Handles keyboard avoidance cleanly on iOS (`KeyboardAvoidingView`).

---

## 6. Safety & Connection Management Integration

Direct conversation provides comprehensive Trust & Safety protections:

1. **Unmatch Flow**:
   - Tapping the Unmatch button presents a destructive native alert: "Unmatch with [PartnerName]? You will no longer be able to message each other, and this chat will be removed."
   - On confirmation: calls `matchesApi.unmatch(conversation.matchId)`, invalidates conversation and match caches, emits `chat_unmatch_completed`, and navigates back to the conversation list.
2. **Block Flow**:
   - Tapping the Block button opens `BlockModal` with customizable reason.
   - On confirmation: calls `safetyApi.blockUser(targetUserId)`, purges conversation from client cache, emits `chat_block_completed`, and navigates back.
3. **Report Flow**:
   - Tapping the Report button opens `ReportModal` with canonical report reason codes (`HARASSMENT`, `ABUSE`, `SEXUAL_CONTENT`, etc.).
   - On submission: calls `safetyApi.createReport()`, provides confidential confirmation toast, and emits `chat_report_completed`.

---

## 7. Telemetry & Strict PII Sanitization

Analytics telemetry is tracked using `trackOnboardingEvent()` with strict automated PII scrubbing:

```typescript
const FORBIDDEN_PII_KEYS = new Set([
  'body',
  'text',
  'message',
  'content',
  'preview',
  'phone',
  'email',
  'token',
  ...
]);
```

### Tracked Chat Events
| Event Name | Key Properties | PII Scrubbed |
| :--- | :--- | :--- |
| `conversations_viewed` | `{ timestamp }` | None |
| `conversation_opened` | `{ conversationId }` | None |
| `conversation_closed` | `{ conversationId }` | None |
| `message_send_attempted` | `{ conversationId, clientMessageId }` | Message text stripped |
| `message_sent` | `{ conversationId, messageId }` | Message text stripped |
| `message_send_failed` | `{ conversationId, clientMessageId }` | Message text stripped |
| `message_retried` | `{ conversationId, clientMessageId }` | Message text stripped |
| `conversation_marked_read` | `{ conversationId, messageId }` | Message text stripped |
| `chat_block_started` / `completed` | `{ conversationId, targetUserId }` | Reason notes sanitized |
| `chat_report_started` / `completed`| `{ conversationId, reasonCode }` | Notes sanitized |
| `chat_unmatch_started` / `completed`| `{ conversationId, matchId }` | None |
