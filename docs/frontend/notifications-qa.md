# Nazar Mobile · Notifications & Activity Center QA & Verification Report

## 1. Executive Summary

This document details the test coverage, verification results, quality assurance matrices, and platform operational guidelines for **Frontend Phase F8: Notifications + Activity Center**.

All unit, integration, and contract tests pass with 100% success rate across the mobile workspace and the platform monorepo.

---

## 2. Automated Test Suite Summary

- **Total Test Files Evaluated**: 19 in `@platform/mobile`, 81 in `@platform/api`, 24 total turbo tasks
- **Total Tests Passed in `@platform/mobile`**: 298 passed (0 failed)
- **Notification-Specific Test Suite (`tests/notifications.test.ts`)**: 52 passed (0 failed)
- **Navigation Regression Suite (`tests/navigation.test.ts`)**: 14 passed (0 failed)
- **Release Candidate Suite (`tests/release-candidate.test.ts`)**: 10 passed (0 failed)

---

## 3. Test Coverage Matrix by Functional Requirement

### A. Notifications API Client
| Scenario / Spec | Test Location | Verification | Result |
| :--- | :--- | :--- | :--- |
| Device registration payload | `tests/notifications.test.ts` | Calls `POST /v1/devices` with device metadata | PASS |
| Redacted token verification | `tests/notifications.test.ts` | Confirms server returns redacted token representation | PASS |
| Device listing and revocation | `tests/notifications.test.ts` | Calls `GET /v1/devices` and `DELETE /v1/devices/:id` | PASS |
| Device ID path injection guard | `tests/notifications.test.ts` | Blocks invalid characters prior to URL interpolation | PASS |
| List notifications with cursor | `tests/notifications.test.ts` | Verifies `limit` and `cursor` query parameters | PASS |
| Query limit boundary clamping | `tests/notifications.test.ts` | Clamps requested limit to `[1, 50]` | PASS |
| Single read mutation | `tests/notifications.test.ts` | Sends `POST /v1/notifications/:id/read` | PASS |
| Read-all mutation | `tests/notifications.test.ts` | Sends `POST /v1/notifications/read-all` | PASS |
| Preferences retrieval & patch | `tests/notifications.test.ts` | Verifies `GET` and `PATCH /v1/notifications/preferences` | PASS |
| Typed API error with code | `tests/notifications.test.ts` | Preserves server error code on HTTP failure | PASS |
| Non-JSON error tolerance | `tests/notifications.test.ts` | Handles non-JSON HTTP responses gracefully | PASS |

### B. Notification Destination Resolution & Security
| Scenario / Spec | Test Location | Verification | Result |
| :--- | :--- | :--- | :--- |
| Message routing | `tests/notifications.test.ts` | Maps `NEW_MESSAGE` to `/chat/:convId` | PASS |
| Match routing | `tests/notifications.test.ts` | Maps `NEW_MATCH` to `/matches/:matchId` | PASS |
| Social post routing | `tests/notifications.test.ts` | Maps `POST_COMMENT` to `/social/post/:postId` | PASS |
| Community routing | `tests/notifications.test.ts` | Maps `COMMUNITY_JOIN` to `/social/community/:communityId` | PASS |
| Event routing | `tests/notifications.test.ts` | Maps `EVENT_RSVP` & `EVENT_WAITLIST_PROMOTED` to `/social/event/:eventId` | PASS |
| Billing notice routing | `tests/notifications.test.ts` | Routes to `/billing` only when billing key exists | PASS |
| Account alerts routing | `tests/notifications.test.ts` | Routes `SECURITY_ALERT` & `ACCOUNT_RESTRICTION` to `/settings/account` | PASS |
| Like anonymity enforcement | `tests/notifications.test.ts` | Does not fabricate actor route for `NEW_LIKE` | PASS |
| Path injection rejection | `tests/notifications.test.ts` | Rejects `../`, `%2F`, script tags, query injections | PASS |
| Identifier percent encoding | `tests/notifications.test.ts` | Safely handles valid dot/dash IDs (e.g. `conv.1_2`) | PASS |
| Unknown type rejection | `tests/notifications.test.ts` | Rejects unsupported types as unroutable | PASS |
| Null data tolerance | `tests/notifications.test.ts` | Does not crash when payload `data` is `null` | PASS |

### C. Push Intent Parsing & Pending Intent Delivery
| Scenario / Spec | Test Location | Verification | Result |
| :--- | :--- | :--- | :--- |
| Push payload extraction | `tests/notifications.test.ts` | Extracts `notificationId`, `type`, and entity data | PASS |
| Malformed body tolerance | `tests/notifications.test.ts` | Retains malformed payload as unroutable intent | PASS |
| Non-notification filtering | `tests/notifications.test.ts` | Returns `null` for non-notification payloads | PASS |
| Exactly-once consumption | `tests/notifications.test.ts` | Second consume call returns `null` | PASS |
| Intent replacement | `tests/notifications.test.ts` | Retains latest intent if multiple taps occur | PASS |
| Explicit intent clearance | `tests/notifications.test.ts` | Clears pending intents upon sign-out / invalid session | PASS |

### D. Activity Feed & Read State Reconciliation
| Scenario / Spec | Test Location | Verification | Result |
| :--- | :--- | :--- | :--- |
| Pagination page merging | `tests/notifications.test.ts` | Deduplicates rows across cursor pages | PASS |
| Immutable read state | `tests/notifications.test.ts` | Stale event cannot overwrite confirmed `readAt` | PASS |
| Server ordering preservation | `tests/notifications.test.ts` | Pages merged strictly in received server order | PASS |
| Confirmed read isolation | `tests/notifications.test.ts` | Applies `readAt` only to target row ID | PASS |
| Read-all update | `tests/notifications.test.ts` | Applies server timestamp to unread rows only | PASS |
| Ingress deduplication | `tests/notifications.test.ts` | Existing item is not duplicated on socket delivery | PASS |
| New item insertion | `tests/notifications.test.ts` | Prepend genuinely new notification at index 0 | PASS |

### E. Accessibility & Presentation
| Scenario / Spec | Test Location | Verification | Result |
| :--- | :--- | :--- | :--- |
| Screen reader unread state | `tests/notifications.test.ts` | Announces "Unread notification" explicitly | PASS |
| Screen reader read state | `tests/notifications.test.ts` | Announces "Read notification" | PASS |
| Routable action hint | `tests/notifications.test.ts` | Announces "Double tap to open [target]" | PASS |
| Unroutable row hint | `tests/notifications.test.ts` | Suppresses open hint for non-routable notices | PASS |
| Relative time formatting | `tests/notifications.test.ts` | Formats "2 minutes ago", "1 hour ago", etc. | PASS |
| Absolute date fallback | `tests/notifications.test.ts` | Includes year for older timestamps | PASS |
| Spoken accessible timestamp | `tests/notifications.test.ts` | Spells out time for screen readers | PASS |

### F. Push Permission Mapping & Foreground Policy
| Scenario / Spec | Test Location | Verification | Result |
| :--- | :--- | :--- | :--- |
| OS status mapping | `tests/notifications.test.ts` | Maps `granted`, `provisional`, `denied`, `undetermined` | PASS |
| Unknown status safety | `tests/notifications.test.ts` | Unknown statuses resolve to `not_requested` | PASS |
| No false authorization | `tests/notifications.test.ts` | Platform permission is strictly verified | PASS |
| Blocked distinction | `tests/notifications.test.ts` | Distinguishes blocked state for settings routing | PASS |
| Foreground suppression | `tests/notifications.test.ts` | Suppresses banner/sound while app is active | PASS |
| Foreground cache update | `tests/notifications.test.ts` | Reconciles feed cache during banner suppression | PASS |
| Background presentation | `tests/notifications.test.ts` | Presents banner when app is background/inactive | PASS |

### G. Device Identity & Privacy
| Scenario / Spec | Test Location | Verification | Result |
| :--- | :--- | :--- | :--- |
| Stable digest generation | `tests/notifications.test.ts` | Generates identical digest for identical token | PASS |
| Unique digests | `tests/notifications.test.ts` | Generates distinct digests for distinct tokens | PASS |
| Token credential privacy | `tests/notifications.test.ts` | Device identifier never contains raw push token | PASS |
| Empty token fallback | `tests/notifications.test.ts` | Generates unique fallback ID when token is empty | PASS |

---

## 4. Physical-Device QA Protocol

### iOS Device Matrix (Physical Hardware Verification)
*Status: Unexecuted on physical device in this build step; validated via simulated environment and automated suite.*

Verification Checklist for Physical Hardware:
1. **Permission Prompt**: Verify that native OS authorization dialog displays Nazar branding when "Enable notifications" is pressed.
2. **APNs Device Registration**: Verify that device push token is generated by APNs and registered via `POST /v1/devices`.
3. **Background Notification Tap**: Tap push notification while phone is locked; confirm Nazar launches, restores session, and deep-links directly to target conversation/match.
4. **Foreground Delivery**: Receive notification while browsing feed; confirm native banner is suppressed and Activity Center unread badge increments.
5. **App Icon Badge**: Verify app badge matches server unread count.

### Android Device Matrix (Physical Hardware Verification)
*Status: Unexecuted on physical device in this build step; validated via simulated environment and automated suite.*

Verification Checklist for Physical Hardware:
1. **Android 13+ Permission Prompt**: Verify `POST_NOTIFICATIONS` runtime dialog appears on trigger.
2. **FCM Registration**: Verify FCM token is sent to backend.
3. **Notification Channel**: Verify Android settings show "Matches, messages & activity" notification channel with high importance.
4. **Background Delivery**: Verify heads-up notification displays while app is backgrounded and launches correct deep-link when tapped.

---

## 5. Security & Privacy Validation

- **Credential Exposure**: Push tokens are never stored in localStorage, never logged to console or crash reporters, and never sent in unredacted API payloads.
- **Deep-Link Hijacking**: All route paths are constructed from allowlisted destination generators using strict alphanumeric and delimiter sanitization.
- **Session Bleed Prevention**: If an intent arrives when the app is in an unauthenticated or expired state, the pending intent is immediately wiped to avoid cross-account notification access.

---

## 6. Known Limitations & Upstream Dependencies

1. **Backend Gateway Event**:
   The Gate 10 chat gateway does not currently emit `notification.created` socket events. The client's socket listener is implemented and connected, but realtime ingress currently relies on the app resume reconciliation hook (`useNotificationResumeSync`) until the API gateway begins emitting notification events.
2. **Physical Device Verification**:
   As recorded above, physical APNs/FCM delivery requires physical provisioning profiles and device hardware, which remains unexecuted in this CI/automated testing environment.
