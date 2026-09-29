# Nazar Mobile Navigation QA Test Matrix (F1)

**Version:** 1.0.0 (Frontend F1)  
**Status:** Canonical Quality Assurance Protocol  
**Scope:** Navigation boundaries, lifecycle transitions, hardware inputs, and edge conditions.

---

## Navigation Test Cases

| Case ID | Scenario | Pre-conditions | Test Action | Expected Navigation Outcome | Pass/Fail Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NAV-01** | Cold Launch (Unauthenticated) | No tokens in secure storage. App process killed. | Launch application icon. | App renders splash, determines no session, immediately directs to `/(auth)/welcome`. | Zero flicker of authenticated tabs. Zero console errors. |
| **NAV-02** | Cold Launch (Authenticated) | Valid tokens stored. App process killed. | Launch application icon. | Session director resolves active token and routes straight to `/(tabs)/discovery`. | Smooth transition into discovery deck within 600ms. |
| **NAV-03** | Warm Launch | App backgrounded for 10 minutes on `/(tabs)/messages`. | Bring app to foreground. | App restores exact screen state at `/(tabs)/messages`. TanStack queries invalidate in background. | No unmounting of active list; scroll position preserved. |
| **NAV-04** | Deep Link (Authenticated) | User authenticated. App in background. | Open link: `nazar://chat/c-4902`. | App navigates directly to `/chat/c-4902`. Pressing Back navigates to `/(tabs)/messages`. | Stack order is preserved: `/(tabs)/messages` is parent. |
| **NAV-05** | Deep Link (Unauthenticated) | User logged out. | Open link: `https://nazar.app/profile/p-99`. | App caches target route, redirects to `/(auth)/login`. After login, navigates to target `/profile/p-99`. | User lands on intended resource without having to re-tap link. |
| **NAV-06** | Deep Link (Target Unavailable) | User authenticated. | Open link: `nazar://match/deleted-match-id`. | App detects 404, shows error toast, and safely lands user on `/(tabs)/matches`. | No application freeze or blank white screen. |
| **NAV-07** | Android Hardware Back (Chat) | User inside `/chat/c-123`. | Tap Android system Back button. | App navigates back to `/(tabs)/messages`. | Does NOT exit application. Does NOT jump to discovery. |
| **NAV-08** | Android Hardware Back (Tab Root) | User on `/(tabs)/discovery`. | Tap Android system Back button. | System minimizes app to home screen (default Android OS behavior). | No navigation error; clean OS suspend. |
| **NAV-09** | Modal Dismissal (Filters) | Filter sheet `/modal/filters` open over discovery. | Swipe down on grabber handle or tap scrim. | Modal dismisses smoothly; discovery deck remains unchanged underneath. | Discovery card index preserved without re-fetching feed. |
| **NAV-10** | Session Expiration (401 Disconnect)| User active on `/(tabs)/discovery`. Refresh token revoked on server. | Dispatched API call receives 401 and refresh fails. | `AuthClient` clears tokens, triggers `onSessionExpired()`, and routes to `/(auth)/welcome`. | User informed via polite alert: "Your session has expired. Please sign in again." |
| **NAV-11** | Network Loss (Offline) | User navigating between tabs. | Device enters Airplane Mode. | Top `OfflineBanner` slides down showing "Offline". Cached tab views load instantly. | Interactive CTAs requiring network show graceful disabled or queued states. |
| **NAV-12** | Network Recovery (Reconnected)| Device returns online. | Disable Airplane Mode. | `OfflineBanner` transitions to "Syncing...", invalidates queries, and slides away. | Outbox messages in chat flush automatically. |
| **NAV-13** | Virtual Keyboard Open/Close | In `/chat/c-123`, focus message input. | Tap text input, type, tap background to dismiss. | `KeyboardAvoidingView` offsets message list smoothly without obscuring latest message bubble. | Zero visual jump or header clipping. |
| **NAV-14** | Unsaved Changes Guard | User on `/profile/edit`, modifies bio text without saving. | Tap Back or Cancel button. | System displays confirmation dialog: "Discard changes? You have unsaved profile edits." | If "Discard" chosen, edits discarded and screen exits. If "Keep Editing", user stays. |
| **NAV-15** | Push Notification (New Match)| App in background. | Tap push notification: "It's a Match with Priya!". | App opens `/matches/[matchId]`. | Match detail rendered with immediate "Send Message" action. |
| **NAV-16** | Push Notification (New Message)| App in background. | Tap push notification: "New message from Arjun". | App opens `/chat/[conversationId]`. | Chat screen rendered; conversation marked as read. |
| **NAV-17** | Push Notification (Singles Event)| App in background. | Tap push notification: "Upcoming Mixer in Bandra West". | App opens `/social/event/[eventId]`. | Event detail rendered with RSVP status. |
| **NAV-18** | User Logout | User in `/settings`. | Tap "Log Out", confirm dialog. | Tokens purged from `ITokenStorage`, caches cleared, user redirected to `/(auth)/welcome`. | Root stack reset so pressing back cannot return to authenticated screens. |
| **NAV-19** | Account Deletion | User in `/settings/delete-account`. | Confirm permanent deletion checkbox & submit. | Server purges account, tokens wiped, user redirected to `/(auth)/welcome` with farewell banner. | Completely unauthenticated; back navigation disabled. |
