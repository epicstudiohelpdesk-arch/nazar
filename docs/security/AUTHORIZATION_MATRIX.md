# Nazar Authorization & Access Control Matrix

## 1. Object-Level Authorization (BOLA / IDOR Defense)

Nazar enforces object-level access controls at the application service layer. Authentication alone is never sufficient to mutate or access private resources:

| Resource          | Action               | Ownership / Authorization Rule                                             | Failure Response                               |
| :---------------- | :------------------- | :------------------------------------------------------------------------- | :--------------------------------------------- |
| **Profile**       | Read Private (`/me`) | Must match authenticated principal `user.userId`.                          | `401 Unauthorized`                             |
| **Profile**       | Update Profile       | Mutates only row where `profiles.user_id = user.userId`.                   | `401 Unauthorized`                             |
| **Profile Media** | Upload Request       | Bound strictly to `profiles.user_id = user.userId`.                        | `404 Profile Not Found`                        |
| **Profile Media** | Delete Media         | Verifies `media.user_id === user.userId`.                                  | `403 Forbidden`                                |
| **Interactions**  | Send Like / Pass     | Actor is `user.userId`; target cannot be self; target must not be blocked. | `400 Bad Request` / `403 Forbidden`            |
| **Match**         | Unmatch              | Actor must be participant `userAId` or `userBId` in the match.             | `404 Not Found` / `403 Forbidden`              |
| **Conversation**  | Open / Read          | Actor must be an active participant in the match conversation.             | `403 Forbidden` (`CONVERSATION_ACCESS_DENIED`) |
| **Conversation**  | Send Message         | Actor must be a conversation member; neither user can have active block.   | `403 Forbidden` (`BLOCKED_USER`)               |
| **Social Post**   | Create Post          | Published by authenticated `user.userId`.                                  | `401 Unauthorized`                             |
| **Social Post**   | Edit / Delete Post   | Verifies `post.author_user_id === user.userId`.                            | `403 Forbidden`                                |
| **Community**     | Join / Leave         | Actor operates on own membership; private spaces require invitation.       | `403 Forbidden`                                |
| **Event**         | RSVP                 | Actor operates on own RSVP; capacity limits strictly enforced.             | `400 Bad Request`                              |
| **Subscription**  | Manage / Cancel      | Only owner of subscription can mutate or query billing records.            | `403 Forbidden`                                |

---

## 2. Administrative Role-Based Access Control (RBAC)

The administrative control plane defines 8 distinct functional roles and 24 granular permissions:

### Canonical Staff Roles

1. `SUPER_ADMIN`: Break-glass authority and full platform access.
2. `PLATFORM_ADMIN`: General technical operations, infrastructure, jobs, and diagnostic inspection.
3. `TRUST_SAFETY_ADMIN`: Safety reports, user investigations, suspensions, bans, and moderation sanctions.
4. `SUPPORT_AGENT`: Customer support, user record viewing, and session revoking (cannot suspend users).
5. `COMMUNITY_ADMIN`: Community space moderation, event management, and content approval.
6. `FINANCE_ADMIN`: Billing status inspection, refunds, subscription overrides, and revenue monitoring.
7. `ANALYTICS_ADMIN`: Telemetry metrics, funnel analysis, retention inspection, and aggregation management.
8. `READ_ONLY_OPERATOR`: Purely read-only platform observation without mutation rights.

---

## 3. Administrative Permission Matrix

| Permission Key          | Description                  | Super Admin | Platform Admin | Trust & Safety | Support Agent | Community Admin | Finance Admin | Analytics Admin | Read-Only |
| :---------------------- | :--------------------------- | :---------: | :------------: | :------------: | :-----------: | :-------------: | :-----------: | :-------------: | :-------: |
| `users.read`            | View user profiles & stats   |     Yes     |      Yes       |      Yes       |      Yes      |       No        |      No       |       No        |    Yes    |
| `users.suspend`         | Suspend user accounts        |     Yes     |      Yes       |      Yes       |    **No**     |       No        |      No       |       No        |  **No**   |
| `users.restore`         | Restore suspended accounts   |     Yes     |      Yes       |      Yes       |    **No**     |       No        |      No       |       No        |  **No**   |
| `users.sessions.revoke` | Force-logout user sessions   |     Yes     |      Yes       |      Yes       |      Yes      |       No        |      No       |       No        |  **No**   |
| `moderation.read`       | View reports & mod cases     |     Yes     |      Yes       |      Yes       |      Yes      |       Yes       |      No       |       No        |    Yes    |
| `moderation.action`     | Apply moderation sanctions   |     Yes     |      Yes       |      Yes       |    **No**     |       Yes       |      No       |       No        |  **No**   |
| `communities.manage`    | Moderate community spaces    |     Yes     |      Yes       |       No       |      No       |       Yes       |      No       |       No        |  **No**   |
| `events.manage`         | Moderate platform events     |     Yes     |      Yes       |       No       |      No       |       Yes       |      No       |       No        |  **No**   |
| `finance.read`          | View subscriptions & billing |     Yes     |      Yes       |       No       |      No       |       No        |      Yes      |       No        |    Yes    |
| `finance.manage`        | Apply refunds & entitlements |     Yes     |       No       |       No       |      No       |       No        |      Yes      |       No        |  **No**   |
| `analytics.read`        | Query operational KPIs & DAU |     Yes     |      Yes       |       No       |      No       |       No        |      No       |       Yes       |    Yes    |
| `analytics.manage`      | Trigger manual rollups       |     Yes     |      Yes       |       No       |    **No**     |       No        |      No       |       Yes       |  **No**   |
| `audit.read`            | Inspect administrative audit |     Yes     |      Yes       |      Yes       |      No       |       No        |      No       |       No        |    Yes    |
| `system.read`           | Inspect health & diagnostics |     Yes     |      Yes       |       No       |      No       |       No        |      No       |       No        |    Yes    |
| `system.manage`         | Manage background workers    |     Yes     |      Yes       |       No       |      No       |       No        |      No       |       No        |  **No**   |

---

## 4. Privilege Escalation Defenses

- **Self-Role Elevation Barred**: No endpoint exists allowing an operator to alter their own roles or grant themselves permissions.
- **Dynamic Role Reloading**: `AdminAuthGuard` re-fetches the admin's active roles and permissions from PostgreSQL on every single request, ensuring that role downgrades or account deactivations take effect immediately.
- **Mandatory Audit Logging**: Every administrative mutation requires a mandatory `reason` string and is recorded in `admin_audit_logs`.
