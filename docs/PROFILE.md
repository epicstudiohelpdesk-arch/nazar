# Dating Profile, Preferences & Discovery Identity Architecture

## Overview

The Profile and Preferences domain transforms an authenticated identity account into a structured, editable dating profile. It establishes the authoritative server-side model for dating visibility, personal preferences, curated interest taxonomy, prompts, and server-calculated profile completeness.

---

## 1. Architectural Principles

1. **Backend is Authoritative**: Age and profile completeness are calculated on the backend. The mobile client is untrusted and cannot set age directly or claim arbitrary completion percentages.
2. **Data Minimization & Public Obfuscation**:
   - `dateOfBirth` is strictly private and never exposed on public profiles; only server-derived `age` is returned.
   - Exact geographic coordinates (`latitude`, `longitude`) are stored in PostGIS on the backend but never disclosed in public profile DTOs.
   - Private storage keys (`objectKey`) and presigned upload URLs are stripped from public responses; only CDN URLs are returned.
3. **Idempotency & Safe Updates**:
   - Profile creation/updates use idempotent PUT / PATCH operations.
   - Interest and prompt updates execute atomic full-replacement within a database transaction.
4. **Append-Only Audit & Outbox**:
   - Every lifecycle transition, profile mutation, preference update, and media operation writes an outbox domain event and an audit log row.

---

## 2. Profile Lifecycle State Machine

A profile transitions through four explicit lifecycle states:

```text
       ┌──────────┐
       │  DRAFT   │
       └────┬─────┘
            │  activateProfile()
            │  (requires 100% minimum completeness:
            │   name, DOB, gender, >=1 ready photo,
            │   preferences, >=3 interests, >=1 prompt)
            ▼
       ┌──────────┐   pauseProfile()    ┌──────────┐
       │  ACTIVE  │ ──────────────────> │  PAUSED  │
       │          │ <────────────────── │          │
       └────┬─────┘   activateProfile() └──────────┘
            │
            │ hideProfile()
            ▼
       ┌──────────┐
       │  HIDDEN  │ ──> activateProfile() ──> ACTIVE
       └──────────┘
```

### State Definitions

- **DRAFT**: Initial state upon account creation. Cannot be paused or hidden. Ineligible for social discovery feeds.
- **ACTIVE**: Fully discoverable in recommendation/discovery decks. Eligible to match and interact.
- **PAUSED**: Temporarily paused by the user. Retains matches and chats, but removed from discovery feeds.
- **HIDDEN**: Completely hidden from all discovery mechanisms.

---

## 3. Date of Birth & Age Derivation

- Users must be at least **18 years of age** at the time of profile creation.
- Maximum allowable age is **120 years**.
- Age is derived dynamically from `dateOfBirth` (format: `YYYY-MM-DD`) on the server.
- The derived age accurately accounts for whether the birth date has occurred in the current calendar year.

---

## 4. Preferences Model

The `profile_preferences` entity governs discovery filtering and matchmaking eligibility:

- `minAge` (int, min: 18, max: 99)
- `maxAge` (int, min: 18, max: 99, must be >= `minAge`)
- `genderPreferences` (array of `MAN`, `WOMAN`, `NON_BINARY`, `OTHER`; minimum 1 item)
- `maxDistanceKm` (int, min: 1, max: 500)
- `relationshipIntent` (`LONG_TERM`, `SHORT_TERM`, `CASUAL`, `FRIENDSHIP`, `NOT_SURE`)

---

## 5. Curated Taxonomies

### Curated Interests

- A managed taxonomy of interests organized by category (`ARTS`, `OUTDOORS`, `FOOD`, `SPORTS`, `MUSIC`, `TECH`, `LIFESTYLE`).
- Profiles can select up to 10 interests (minimum 3 required for activation).
- Updating interests performs idempotent replacement in `profile_interests`.

### Curated Dating Prompts

- A managed taxonomy of questions (`profile_prompt_definitions`).
- Profiles can answer up to 3 prompts (minimum 1 required for activation).
- Answers must be between 2 and 500 characters.

---

## 6. Profile Completeness Formula

Completeness score (0% to 100%) is calculated deterministically on the server:

| Requirement                   | Weight | Mandatory for Activation |
| ----------------------------- | ------ | ------------------------ |
| Display Name                  | 15%    | Yes                      |
| Date of Birth (Age >= 18)     | 15%    | Yes                      |
| Gender                        | 10%    | Yes                      |
| At least 1 READY photo        | 20%    | Yes                      |
| Dating Preferences set        | 15%    | Yes                      |
| At least 3 Interests selected | 10%    | Yes                      |
| At least 1 Prompt answered    | 10%    | Yes                      |
| Bio provided                  | 5%     | Recommended              |

Total score: **100%**. Minimum activation threshold requires all mandatory criteria to be satisfied.
