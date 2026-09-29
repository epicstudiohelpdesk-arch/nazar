# Administrative Audit Logging (Gate 14)

## 1. Overview & Non-Negotiable Invariants

Accountability and auditability are foundational to Nazar's internal control plane. Every administrative action that reads sensitive data or mutates user, moderation, community, or platform state must be immutably recorded.

### Core Principles

1. **Append-Only Immutability**: The `admin_audit_logs` table has no `UPDATE` or `DELETE` endpoints. Records are permanent.
2. **Mandatory Reason Requirement**: All mutating administrative operations **strictly require** a non-empty, human-readable explanation (`reason` string with minimum 3 characters). Any mutation submitted without a valid reason is rejected with HTTP 400 Bad Request before execution.
3. **Non-Repudiation**: Every record ties an operation to a verified `adminUserId`, request IP address, user agent, and correlation ID.

---

## 2. Schema Definition

Audit records are persisted in PostgreSQL via the `admin_audit_logs` table:

```sql
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id),
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    reason TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_admin_user ON admin_audit_logs(admin_user_id);
CREATE INDEX idx_admin_audit_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX idx_admin_audit_action ON admin_audit_logs(action);
CREATE INDEX idx_admin_audit_created ON admin_audit_logs(created_at DESC);
```

---

## 3. Audited Event Actions

| Action                 | Target Type       | Description                                                 |
| ---------------------- | ----------------- | ----------------------------------------------------------- |
| `AUTH_LOGIN`           | `admin_user`      | Operator successfully authenticated                         |
| `AUTH_LOGOUT`          | `admin_user`      | Operator session revoked                                    |
| `USER_INSPECT`         | `user`            | Operator inspected complete user profile and safety history |
| `USER_SUSPEND`         | `user`            | Operator suspended user account                             |
| `USER_RESTORE`         | `user`            | Operator restored previously suspended account              |
| `USER_SESSIONS_REVOKE` | `user`            | Operator force-terminated consumer active sessions          |
| `MODERATION_DECIDE`    | `moderation_case` | Operator executed decision on flagged content/case          |
| `COMMUNITY_ACTION`     | `community`       | Operator modified community status (suspended/locked)       |
| `EVENT_ACTION`         | `event`           | Operator cancelled or modified event capacity               |
| `JOB_RETRY`            | `outbox_event`    | Operator manually requeued a failed worker job              |

---

## 4. Reason Enforcement Pipeline

The requirement for an audit reason is enforced across three independent defensive layers:

```text
HTTP Request
     │
     ▼
[Layer 1: Zod Schema Validation]
     └── Rejects missing/empty reason (< 3 chars) with 400
     │
     ▼
[Layer 2: Service Layer Assertion]
     └── AdminAuditService asserts reason is present before executing domain mutation
     │
     ▼
[Layer 3: Database Column Constraint]
     └── `reason TEXT NOT NULL` prevents null persistence
```

---

## 5. Audit Log Inspection & Export

Authorized operators with `audit.read` permission query the log trail via:

`GET /v1/admin/audit/logs`

### Supported Filters

- `adminUserId`: Filter by operator ID.
- `action`: Filter by specific action code (e.g. `USER_SUSPEND`).
- `targetType`: Filter by entity type (`user`, `community`, etc.).
- `targetId`: Filter by target entity ID.
- `startDate` & `endDate`: ISO 8601 timestamp range.
- `limit` (default 50, max 100) & `offset`: Standard pagination.
