# Admin Console Security Architecture (Gate 14)

## 1. Overview & Threat Model

The Admin Console control plane is high-value infrastructure. Its security model assumes zero trust across boundaries, defense-in-depth, and strict isolation from the consumer dating platform.

### Primary Threat Vectors Mitigated

1. **Consumer Privilege Escalation**: A consumer dating user attempting to invoke administrative endpoints or forge admin tokens.
2. **Session Hijacking / Replay**: Stolen session tokens reused after logout or across IP changes.
3. **Internal Operator Abuse**: Unauthorized actions taken without justification or accountability.
4. **Brute Force / Password Guessing**: Automated password spraying against staff accounts.
5. **PII / Secret Leakage**: Exposure of sensitive payment card info, raw passwords, or private encryption keys to console operators.

---

## 2. Authentication & Credential Storage

### Staff Password Security

- Passwords are never stored in plaintext.
- Passwords are encrypted using **scrypt** with a cryptographically random per-user salt:
  - N = 16384 (CPU/memory cost)
  - r = 8 (block size)
  - p = 1 (parallelization)
- Comparisons use `crypto.timingSafeEqual` to eliminate timing side-channel attacks.

### Token & Session Hashing

- Administrative JWT tokens contain `scope: 'admin'`, short lifespans (1 hour), and random jti.
- In `admin_sessions`, tokens are stored as **SHA-256 hashes** (`tokenHash = SHA256(token)`).
- If the database is compromised, raw bearer tokens cannot be recovered from storage.
- Revocation is instantaneous: marking `revokedAt = NOW()` terminates the session immediately across all API servers.

---

## 3. Mutual Isolation from Consumer System

The administrative and consumer layers share the database server but are strictly decoupled at the schema and security levels:

| Security Domain       | Consumer Dating Layer                | Admin Operations Layer                   |
| --------------------- | ------------------------------------ | ---------------------------------------- |
| **Identity Table**    | `users`, `user_identities`           | `admin_users`                            |
| **Session Table**     | `sessions`                           | `admin_sessions`                         |
| **Token Scope**       | Implicit consumer                    | Explicit `scope: "admin"`                |
| **Auth Guard**        | `AuthGuard`                          | `AdminAuthGuard`                         |
| **Authorization**     | User entitlement / profile ownership | Granular RBAC (`admin_permissions`)      |
| **Audit Requirement** | Standard telemetry                   | Mandatory `reason` in `admin_audit_logs` |

Cross-scope token presentation is strictly forbidden:

- An admin token presented to consumer endpoints results in `401 Unauthorized` (no matching hash in `sessions`).
- A consumer token presented to admin endpoints results in `401 Unauthorized` (missing `scope: 'admin'`).

---

## 4. Account Lifecycle & Access Revocation

1. **Immediate Deactivation**: Setting `isActive = false` on `admin_users` terminates all access immediately. `AdminAuthGuard` verifies operator active status on every authenticated request.
2. **Session Invalidation**: When an operator logs out or is suspended, their session is marked revoked.
3. **Short-Lived Access**: Sessions expire after 1 hour by default, requiring re-authentication.

---

## 5. Data Privacy & Minimization

The Admin Console adheres to strict data minimization principles:

- **No Plaintext Secrets**: Passwords, OAuth refresh tokens, and payment tokens are excluded from all admin DTOs and API responses.
- **Payment Masking**: Financial transactions display only transaction reference IDs and payment provider statuses. Raw credit card numbers and CVVs are neither stored nor accessible.
- **Audit Trails**: Inspecting user profiles is logged as a read audit event (`USER_INSPECT`), ensuring internal operators cannot stalk users undetected.
