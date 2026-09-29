# Admin & Operations Workflows (Gate 14)

## 1. Overview

The Nazar Admin Console provides operational interfaces for managing users, triaging moderation reports, managing communities and events, and diagnosing platform subsystems.

All operations execute through authoritative backend services rather than direct database queries.

---

## 2. User Investigation & Action Workflows

### User Lookup & Inspection

Operators with `users.read` permission can search users by:

- UUIDv7 user ID
- Primary email address
- Phone number
- Social handle / profile nickname

The inspection endpoint (`GET /v1/admin/users/:id`) aggregates:

- **Identity details**: Email, phone, verification status, registration date.
- **Profile information**: Completion state, bio, interests, age, PostGIS location coordinates.
- **Media & Prompts**: Approved photos, avatar images, prompt responses.
- **Safety status**: Active restrictions, warning history, block list, received reports.
- **Session state**: Active devices, last seen timestamps, IP geolocation.
- **Entitlements**: Active subscriptions, tier status, lifetime purchases.

### Account Action Workflows

Mutating operations require explicit operator credentials and a **mandatory reason** (minimum 3 characters).

#### 1. Account Suspension (`POST /v1/admin/users/:id/suspend`)

- **Required Permission**: `users.suspend`
- **Payload**:
  ```json
  {
    "type": "temporary", // or "permanent"
    "durationHours": 72,
    "reason": "Repeated harassment reported in community discussion"
  }
  ```
- **Execution Flow**:
  1. Validates reason presence and length.
  2. Inserts or updates record in `user_restrictions`.
  3. Invalidates all active consumer sessions in `sessions` table.
  4. Dispatches audit event: `USER_SUSPENDED`.

#### 2. Account Restoration (`POST /v1/admin/users/:id/restore`)

- **Required Permission**: `users.restore`
- **Payload**:
  ```json
  {
    "reason": "Successful identity verification appeal cleared by Tier 2 safety"
  }
  ```
- **Execution Flow**:
  1. Validates reason presence and length.
  2. Clears active restriction in `user_restrictions`.
  3. Dispatches audit event: `USER_RESTORED`.

#### 3. Session Revocation (`POST /v1/admin/users/:id/sessions/revoke`)

- **Required Permission**: `users.sessions.revoke`
- **Payload**:
  ```json
  {
    "reason": "User reported stolen phone / suspected account compromise"
  }
  ```
- **Execution Flow**:
  1. Marks all active consumer sessions as revoked.
  2. Dispatches audit event: `SESSIONS_REVOKED`.

---

## 3. Moderation & Trust & Safety Operations

The admin console reuses the domain logic established in **Gate 09 (Safety & Moderation)**.

### Queue Triage (`GET /v1/admin/moderation/cases`)

Moderators can filter cases by:

- Status: `pending`, `under_review`, `resolved`, `dismissed`.
- Category: `harassment`, `inappropriate_media`, `spam`, `underage`, `hate_speech`.
- Severity: `low`, `medium`, `high`, `critical`.

### Case Decisioning (`POST /v1/admin/moderation/cases/:id/decide`)

- **Required Permission**: `moderation.decide`
- **Actions**:
  - `dismiss`: Report dismissed as unfounded.
  - `warn`: Formal warning issued to user notification inbox.
  - `remove_content`: Abusive media/post hidden and flagged for deletion.
  - `suspend`: User account restricted for specified duration.
- **Audit Logging**: Every decision records the moderator ID, action type, decision timestamp, and rationale.

---

## 4. Community & Event Management

### Community Operations (`POST /v1/admin/operations/communities/:id/action`)

- **Required Permission**: `operations.communities.manage`
- **Actions**:
  - `suspend`: Hides community from public discovery and disables posting.
  - `restore`: Re-enables suspended community.
  - `lock`: Disables new posts and comments while preserving existing discussions.

### Event Operations (`POST /v1/admin/operations/events/:id/action`)

- **Required Permission**: `operations.events.manage`
- **Actions**:
  - `cancel`: Forcefully cancels an event, revokes pending RSVPs, and notifies participants.
  - `override_capacity`: Adjusts maximum RSVP limits for high-demand gatherings.

---

## 5. System Diagnostics & Telemetry

### Infrastructure Health (`GET /v1/admin/health`)

Provides real-time health checks:

- **Database**: PostgreSQL connection pool status and read/write ping latency.
- **Redis**: Connection state, cache hit ratios, and memory usage.
- **Workers**: Outbox processor status, polling intervals, and dead-letter count.

### Queue Diagnostics (`GET /v1/admin/operations/diagnostics`)

Inspects asynchronous workers:

- **Outbox Queue**: Pending events count, processing lag, and failed event retries.
- **Notification Queue**: FCM/APNS job statuses, delivery latency, and bounce rates.
- **Recommendation Telemetry**: Candidate pool retrieval performance and feature freshness.
