# Nazar · Frontend Architecture · Profile + Settings + Privacy + Safety (F10)

## Overview

The Profile, Settings, Privacy, and Safety system provides the central account control center for Nazar mobile members. It unifies profile self-expression, identity verification, account security, cross-device session governance, privacy controls, and safety boundaries.

Authoritative state resides on the backend (`@platform/api`), while the frontend (`@platform/mobile`) maintains optimistic responsiveness, form dirty-checking, client-side validation UX, and strict cache synchronization via TanStack Query.

---

## 1. Information Architecture & Route Hierarchy

```text
Settings Hub (/settings)
├── Account & Devices (/settings/account)
│   ├── Active Sessions (with Current Device badge)
│   ├── Push Notification Devices
│   ├── Revoke Session / Revoke Device Actions
│   └── Log Out All Other Devices
│
├── Privacy Controls (/settings/privacy)
│   ├── Discovery Visibility Toggle (Active vs. Paused)
│   ├── Incognito Mode Toggle (Gated to Nazar Gold)
│   ├── Coarse Location Privacy Explanations
│   └── Link to Blocked Accounts
│
├── Safety & Trust (/settings/safety)
│   ├── Blocked Accounts Entry Point (with live counter)
│   ├── Photo Verification Biometric Status
│   ├── Safe Dating Rules (Public meetings, transportation, financial safety)
│   └── Zero Tolerance Policy & Escalations
│
├── Blocked Accounts (/settings/blocked)
│   ├── Blocked Member Cards (Avatar, Name, Date)
│   ├── Unblock Mutation with Confirmation Dialog
│   └── Centralized Cache Invalidation
│
├── App Permissions (/settings/permissions)
│   ├── Push Notifications, Camera/Photos, Coarse Location
│   ├── Privacy Protections Breakdown
│   └── Direct Link to Device Settings (`Linking.openSettings()`)
│
├── Nazar Premium Subscription (/billing)
├── Notification Preferences (/settings/notifications)
│
└── Account Deletion (/settings/delete-account)
    ├── Destructive Warning & Policy Disclosure
    ├── Strict "DELETE" Confirmation Input Guard
    ├── Complete Cache & Storage Purge (`purgeDeletedAccount`)
    └── Navigation to Welcome Screen
```

### Profile Hierarchy

```text
My Profile Tab (/(tabs)/profile -> ProfileOverviewScreen)
├── Profile Header (Avatar, Name, Age, Verification Badge)
├── Completeness Status & Missing Requirements Card
├── Media Grid (Primary photo badge, set primary, delete photo)
├── Passions & Interests Chips
├── Personality Prompts Preview
├── Discovery Preferences Summary
├── Lifecycle Actions (Activate / Pause / Hide)
│
├── Edit Profile (/profile/edit)
│   ├── Photo Management (Add, Delete, Set Primary)
│   ├── About Me (Bio with 300 char counter)
│   ├── Location & Background (City, Occupation, Education)
│   ├── Passions & Interests Picker (Taxonomy-driven, max 10)
│   ├── Personality Prompts Editor (Max 3, question switcher modal, 200 char answers)
│   └── Unsaved Changes Guard Dialog
│
└── Profile Preview (/profile/preview)
    └── Live ProfileCard rendering exact public presentation
```

---

## 2. Server Contracts & Query Keys

### Centralized Query Keys

```typescript
export const PROFILE_QUERY_KEYS = {
  me: ['profile', 'me'] as const,
  preferences: ['profile', 'preferences'] as const,
  interestsTaxonomy: ['interests', 'taxonomy'] as const,
  myInterests: ['profile', 'interests'] as const,
  promptsTaxonomy: ['prompts', 'taxonomy'] as const,
  myPrompts: ['profile', 'prompts'] as const,
  media: ['profile', 'media'] as const,
};

export const AUTH_QUERY_KEYS = {
  sessions: ['auth', 'sessions'] as const,
  devices: ['auth', 'devices'] as const,
};

export const SAFETY_QUERY_KEYS = {
  blocks: ['safety', 'blocks'] as const,
  report: (id: string) => ['safety', 'report', id] as const,
};
```

---

## 3. Account Boundary & Security Lifecycle

When a member logs out or purges their account, state isolation must guarantee zero data leakage across user boundaries:

```typescript
export async function purgeAccountSessionAndCaches(
  queryClient?: QueryClient,
  authClient?: AuthClient
): Promise<void> {
  const service = authClient ? new SessionService(authClient) : getDefaultSessionService();
  await service.purgeAccountSessionAndCaches(queryClient);
}
```

The purge sequence:
1. Revoke access tokens on server via `POST /v1/auth/logout`.
2. Clear tokens from secure storage (`ITokenStorage.clearTokens()`).
3. Reset Zustand Profile store (`useProfileStore.getState().resetAll()`).
4. Reset Zustand Onboarding store (`useOnboardingStore.getState().resetOnboardingDraft()`).
5. Clear Billing and Entitlement caches (`clearBillingCaches(queryClient)`).
6. Clear entire TanStack Query cache (`queryClient.clear()`).
7. Emit sanitized analytics event (`logout` or `account_deleted`).

---

## 4. Safety & Trust Cache Synchronization

Blocking a user triggers cascading safety updates across all active surfaces:

```typescript
export function invalidateSafetyCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: SAFETY_QUERY_KEYS.blocks });
  void queryClient.invalidateQueries({ queryKey: ['discovery'] });
  void queryClient.invalidateQueries({ queryKey: ['matches'] });
  void queryClient.invalidateQueries({ queryKey: ['chat'] });
  void queryClient.invalidateQueries({ queryKey: ['social'] });
}
```

This guarantees:
- Blocked members vanish immediately from discovery decks.
- Active matches with the blocked member are removed.
- Chat conversation threads are severed.
- Social community feeds and comments by the blocked member are suppressed.
- Blocked Accounts settings screen reflects current block state.

---

## 5. Telemetry & Zero-PII Policy

All analytics emitted during profile editing, settings adjustments, safety operations, and account management pass through deep PII sanitization:
- **Forbidden**: `latitude`, `longitude`, `phoneNumber`, `email`, `token`, `password`, `body`, `message`, `dob`.
- **Allowed**: Enums, counts, IDs, booleans, and sanitized categories.
