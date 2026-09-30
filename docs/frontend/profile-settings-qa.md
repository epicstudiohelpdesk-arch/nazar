# Nazar · Frontend QA Test Plan · Profile + Settings + Privacy + Safety (F10)

## Overview

This document details verification protocols and test coverage for the Profile, Settings, Privacy, and Safety experiences implemented in Frontend Phase F10.

---

## 1. Test Suite Coverage

### Unit & Integration Tests (`apps/mobile/tests/profile-settings.test.ts`)

| Test Suite | Scenario | Expected Behavior | Status |
| :--- | :--- | :--- | :--- |
| **Profile Queries** | `getMyProfile()` | Authoritative profile, visibility, and completeness returned | ✅ Passed |
| **Profile Mutation** | `updateMyProfile()` | Bio, city, occupation, and education updated via PUT `/v1/profiles/me` | ✅ Passed |
| **Visibility Transitions** | `activateProfile()` | State transitions to `ACTIVE`, discovery cache invalidated | ✅ Passed |
| **Visibility Transitions** | `pauseProfile()` | State transitions to `PAUSED`, discovery cache invalidated | ✅ Passed |
| **Visibility Transitions** | `hideProfile()` | State transitions to `HIDDEN`, discovery cache invalidated | ✅ Passed |
| **Taxonomy & Selections** | `updateMyInterests()` | Updates selected interests via PUT `/v1/profiles/me/interests` | ✅ Passed |
| **Taxonomy & Selections** | `updateMyPrompts()` | Updates answered prompts via PUT `/v1/profiles/me/prompts` | ✅ Passed |
| **Media Operations** | Full photo workflow | Request URL -> complete upload -> set primary -> delete photo | ✅ Passed |
| **Session Listing** | `listSessions()` | Lists active sessions and identifies current device | ✅ Passed |
| **Session Revocation** | `revokeSession()` | Revokes non-current session via DELETE `/v1/auth/sessions/:id` | ✅ Passed |
| **Global Revocation** | `logoutAll()` | Terminates all other devices via POST `/v1/auth/logout-all` | ✅ Passed |
| **Device Push Tokens** | `listDevices()`, `revokeDevice()` | Lists registered push devices and deletes registration | ✅ Passed |
| **Safety Blocks** | `getBlockedUsers()` | Retrieves list of blocked members with metadata | ✅ Passed |
| **Safety Blocks** | `unblockUser()` | Unblocks user via DELETE `/v1/users/:id/block` | ✅ Passed |
| **Safety Cache Invalidation** | `invalidateSafetyCaches()` | Synchronizes blocks, discovery, matches, chat, and social queries | ✅ Passed |
| **Account Logout Purge** | `purgeAccountSessionAndCaches()` | Clears tokens, resets profile/onboarding store, wipes query cache | ✅ Passed |
| **Account Deletion Purge** | `purgeDeletedAccount()` | Calls deletion endpoint, clears tokens, resets stores, wipes query cache | ✅ Passed |
| **PII Sanitization** | `sanitizeAnalyticsProperties()` | Strips GPS, phone numbers, tokens, and raw message bodies | ✅ Passed |

---

## 2. Interactive QA Validation Scenarios

### Scenario A: Profile Editing & Unsaved Changes Guard
1. Navigate to `My Profile` tab (`/(tabs)/profile`).
2. Verify completeness percentage and missing required items reflect backend state.
3. Tap `Edit Profile`.
4. Modify Bio text. Tap the `< Back` arrow in header without tapping Save.
5. **Expected**: Alert prompt appears: *"Discard Unsaved Changes? You have unsaved changes that will be lost if you leave now."*
6. Tap `Keep Editing`. Modify City, select new Interest, tap `Save Changes`.
7. **Expected**: Changes saved to backend, query cache invalidated, success alert displayed, navigates back with updated details.

### Scenario B: Profile Preview
1. In `Edit Profile`, tap `Preview` in the top right header.
2. **Expected**: Renders `ProfileCard` with user's verified name, age, city, bio, photos, interests, and prompt cards.

### Scenario C: Active Sessions & Multi-Device Governance
1. Navigate to `Settings -> Account & Devices`.
2. Verify list displays active sessions. Current device displays `Current Device` badge.
3. Tap `Revoke` on a secondary session. Confirm dialog.
4. **Expected**: Backend terminates session token; session disappears from list.
5. Tap `Log Out Others`. Confirm dialog.
6. **Expected**: Calls `/v1/auth/logout-all`, terminates all other active sessions while preserving current session.

### Scenario D: Privacy & Discovery Visibility
1. Navigate to `Settings -> Privacy Controls`.
2. Toggle `Show Me in Discovery` off.
3. **Expected**: Profile pauses immediately. Candidate discovery ceases to serve profile.
4. Attempt to toggle `Incognito Mode` without active Nazar Gold entitlement.
5. **Expected**: Paywall modal / alert offers upgrade to Nazar Gold.

### Scenario E: Safety & Blocked Accounts
1. Navigate to `Settings -> Safety & Trust`.
2. Verify safe dating rules and photo verification status display clearly.
3. Tap `Blocked Accounts`.
4. **Expected**: Displays blocked members with blocked date.
5. Tap `Unblock` on a member and confirm dialog.
6. **Expected**: Calls `unblockUser()`, invalidates safety, discovery, chat, and matches caches. User removed from blocked list.

### Scenario F: Destructive Account Deletion
1. Navigate to `Settings -> Delete Account`.
2. Verify policy disclosures explain what will be permanently wiped.
3. Verify `Permanently Delete Account` button is disabled until the user types `DELETE`.
4. Type `DELETE` and tap button. Confirm destructive warning dialog.
5. **Expected**:
   - `DELETE /v1/auth/account` executed.
   - Tokens cleared from secure storage.
   - Profile store and onboarding store reset to defaults.
   - TanStack query cache purged.
   - User navigated to Welcome screen (`/(auth)/welcome`).

---

## 3. Physical Device Verification Note

* Physical device execution status: **Not physically verified in CI environment** (simulated via unit and integration test harness under Vitest).
