# Admin Roles & Permissions (Gate 14)

## 1. Overview

Nazar uses a fine-grained, Role-Based Access Control (RBAC) model. Permissions represent atomic operational capabilities, while Roles represent predefined bundles of permissions corresponding to operational job functions.

---

## 2. Canonical Roles

Gate 14 establishes eight canonical administrative roles:

| Role Name               | Slug                  | Purpose & Responsibilities                                                                               |
| ----------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| **Super Admin**         | `super_admin`         | Unrestricted administrative control; staff provisioning, role assignment, emergency actions.             |
| **Admin**               | `admin`               | General administrative control; user management, moderation escalations, operational diagnostics.        |
| **Moderator**           | `moderator`           | Content moderation, report triage, case decisions, user warning/suspension, content takedown.            |
| **Trust & Safety**      | `trust_and_safety`    | Safety investigations, block analysis, emergency bans, safety interventions, harassment review.          |
| **Support Agent**       | `support_agent`       | Customer support investigations, account inspection, session revocation, basic triage.                   |
| **Operations Engineer** | `operations_engineer` | Outbox event monitoring, worker diagnostics, notification job inspection, system telemetry.              |
| **Compliance Officer**  | `compliance_officer`  | Legal inquiries, audit log review, compliance inspection, regulatory reporting.                          |
| **Read-Only Auditor**   | `read_only_auditor`   | Read-only inspection of platform metrics, user records, and moderation queues. No mutation capabilities. |

---

## 3. Granular Permission Catalog

### User Management

- `users.read`: Search and view detailed user profiles, verification status, blocks, and activity.
- `users.suspend`: Temporarily or permanently suspend a user account (requires mandatory reason).
- `users.restore`: Remove active suspensions and reinstate a user account (requires mandatory reason).
- `users.sessions.revoke`: Force terminate all active consumer sessions for a user (requires mandatory reason).
- `users.anonymize`: Execute account data erasure / GDPR anonymization requests.

### Moderation & Safety

- `moderation.read`: View the moderation queue, reports, evidence, and case histories.
- `moderation.decide`: Execute decisions on moderation cases (warning, content removal, suspension).
- `moderation.escalate`: Escalate complex or severe cases to higher tier safety staff.
- `moderation.content.remove`: Takedown abusive media, post, comment, or message content.

### Platform Operations & Communities

- `operations.read`: View community, event, outbox, and delivery job operational queues.
- `operations.communities.manage`: Modify community status (suspend, restore, lock).
- `operations.events.manage`: Modify event status (cancel, suspend, capacity override).
- `operations.jobs.retry`: Manually requeue dead-letter or failed outbox and notification jobs.

### System Diagnostics & Health

- `diagnostics.read`: View database connectivity, redis metrics, memory, and uptime status.
- `diagnostics.recommendations.read`: Inspect recommendation candidate pools, scores, and feature distributions.
- `diagnostics.notifications.read`: Inspect delivery latency, provider bounce rates, and push failure metrics.

### Audit & Compliance

- `audit.read`: View the immutable administrative audit log with search and filtering.
- `audit.export`: Generate cryptographically verified compliance export bundles.

### Staff Administration

- `admin.staff.manage`: Create, edit, activate, or deactivate administrative staff accounts.
- `admin.roles.manage`: Assign or revoke administrative roles.

---

## 4. Role-to-Permission Matrix

| Permission                         | Super Admin | Admin | Moderator | Trust & Safety | Support Agent | Operations | Compliance | Read-Only |
| ---------------------------------- | :---------: | :---: | :-------: | :------------: | :-----------: | :--------: | :--------: | :-------: |
| `users.read`                       |      ✓      |   ✓   |     ✓     |       ✓        |       ✓       |     ✗      |     ✓      |     ✓     |
| `users.suspend`                    |      ✓      |   ✓   |     ✓     |       ✓        |       ✗       |     ✗      |     ✗      |     ✗     |
| `users.restore`                    |      ✓      |   ✓   |     ✗     |       ✓        |       ✗       |     ✗      |     ✗      |     ✗     |
| `users.sessions.revoke`            |      ✓      |   ✓   |     ✓     |       ✓        |       ✓       |     ✗      |     ✗      |     ✗     |
| `users.anonymize`                  |      ✓      |   ✗   |     ✗     |       ✗        |       ✗       |     ✗      |     ✓      |     ✗     |
| `moderation.read`                  |      ✓      |   ✓   |     ✓     |       ✓        |       ✗       |     ✗      |     ✓      |     ✓     |
| `moderation.decide`                |      ✓      |   ✓   |     ✓     |       ✓        |       ✗       |     ✗      |     ✗      |     ✗     |
| `moderation.escalate`              |      ✓      |   ✓   |     ✓     |       ✓        |       ✗       |     ✗      |     ✗      |     ✗     |
| `moderation.content.remove`        |      ✓      |   ✓   |     ✓     |       ✓        |       ✗       |     ✗      |     ✗      |     ✗     |
| `operations.read`                  |      ✓      |   ✓   |     ✗     |       ✗        |       ✗       |     ✓      |     ✗      |     ✓     |
| `operations.communities.manage`    |      ✓      |   ✓   |     ✗     |       ✗        |       ✗       |     ✗      |     ✗      |     ✗     |
| `operations.events.manage`         |      ✓      |   ✓   |     ✗     |       ✗        |       ✗       |     ✗      |     ✗      |     ✗     |
| `operations.jobs.retry`            |      ✓      |   ✗   |     ✗     |       ✗        |       ✗       |     ✓      |     ✗      |     ✗     |
| `diagnostics.read`                 |      ✓      |   ✓   |     ✗     |       ✗        |       ✗       |     ✓      |     ✗      |     ✓     |
| `diagnostics.recommendations.read` |      ✓      |   ✓   |     ✗     |       ✗        |       ✗       |     ✓      |     ✗      |     ✗     |
| `diagnostics.notifications.read`   |      ✓      |   ✓   |     ✗     |       ✗        |       ✗       |     ✓      |     ✗      |     ✗     |
| `audit.read`                       |      ✓      |   ✓   |     ✗     |       ✗        |       ✗       |     ✗      |     ✓      |     ✓     |
| `audit.export`                     |      ✓      |   ✗   |     ✗     |       ✗        |       ✗       |     ✗      |     ✓      |     ✗     |
| `admin.staff.manage`               |      ✓      |   ✗   |     ✗     |       ✗        |       ✗       |     ✗      |     ✗      |     ✗     |
| `admin.roles.manage`               |      ✓      |   ✗   |     ✗     |       ✗        |       ✗       |     ✗      |     ✗      |     ✗     |

---

## 5. Principle of Least Privilege

- Support agents have inspection and session revocation permissions to remediate compromised devices, but cannot modify profile data or issue account bans.
- Moderators can issue suspensions and decide cases, but cannot alter community settings, system jobs, or audit records.
- Operations engineers can view queues and retry failed outbox/notification jobs, but cannot inspect private user profiles or decide moderation cases.
- Read-Only Auditors have zero mutating capabilities across the entire API surface.
