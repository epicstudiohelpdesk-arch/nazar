# Admin & Operations Console Architecture (Gate 14)

## 1. System Overview & Boundaries

The Nazar Admin & Operations Console is the centralized, internal control plane for authorized Nazar staff, operators, and trust & safety investigators.

### Architecture Invariant

The Admin Console is an **operations system**, not a second product backend or parallel database. All administrative operations:

1. Communicate over authenticated HTTP APIs (`/v1/admin/*`).
2. Must never bypass domain business boundaries or safety rules without audited authority.
3. Completely segregate staff credentials from consumer mobile dating credentials.
4. Execute mutations through authoritative domain services and transactional repositories.

```text
┌────────────────────────────────────────────────────────┐
│               Admin Web Application                    │
│             (React 18 + Vite + TypeScript)             │
└───────────────────────────┬────────────────────────────┘
                            │ Bearer Token (Admin Scoped)
                            ▼
┌────────────────────────────────────────────────────────┐
│           Admin Authorization Gateway                  │
│       (AdminAuthGuard + AdminPermissionsGuard)         │
└───────────────────────────┬────────────────────────────┘
                            │ Validated Principal (AdminContext)
                            ▼
┌────────────────────────────────────────────────────────┐
│            Canonical Nazar Backend Services            │
│   ├── AdminAuthService       ├── AdminModerationService│
│   ├── AdminUsersService      ├── AdminOperationsService│
│   ├── AdminAuditService      ├── AdminHealthService    │
└───────────────────────────┬────────────────────────────┘
                            │ Mutating Action + Mandatory Reason
                            ▼
┌────────────────────────────────────────────────────────┐
│           PostgreSQL Schema & Immutable Audit          │
│   ├── admin_users            ├── admin_audit_logs      │
│   ├── admin_sessions         ├── moderation_cases      │
│   ├── admin_roles            ├── user_restrictions     │
│   └── admin_permissions      └── sessions              │
└────────────────────────────────────────────────────────┘
```

---

## 2. Dedicated Staff Identity Model

Staff accounts are stored exclusively in dedicated tables, preventing token re-use, identity confusion, or privilege escalation across consumer accounts:

- **`admin_users`**: Master staff registry storing email, scrypt password hash, name, active status, and MFA flags.
- **`admin_roles`**: Canonical RBAC role definitions.
- **`admin_permissions`**: Granular operational capabilities (e.g. `users.suspend`, `moderation.decide`).
- **`admin_role_permissions`**: Declarative mapping of roles to authorized permissions.
- **`admin_user_roles`**: Junction table assigning staff members to specific operational roles.
- **`admin_sessions`**: Durable session registry with SHA-256 token hashing, expiration, and revoking support.
- **`admin_audit_logs`**: Append-only audit trail logging every administrative mutation with mandatory operator reason.

---

## 3. Data Flow & Security Lifecycle

1. **Authentication**: Operator logs in via `POST /v1/admin/auth/login`. Password verified via constant-time scrypt comparison. A short-lived (1 hour) JWT is signed with `scope: 'admin'`. An active row is recorded in `admin_sessions`.
2. **Access Control**: Every request to `/v1/admin/*` passes through `AdminAuthGuard` and `AdminPermissionsGuard`.
3. **Session Verification**: The guard checks that the session exists in `admin_sessions`, is unexpired, and has not been revoked.
4. **Principal Attachment**: The request context receives an `AuthenticatedAdminPrincipal` containing operator ID, email, active roles, and resolved permissions.
5. **Audited Mutation**: Any mutating operation requires a descriptive `reason` (minimum 3 characters) and writes an immutable record to `admin_audit_logs`.
