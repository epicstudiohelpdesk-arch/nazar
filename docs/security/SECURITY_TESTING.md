# Nazar Security Testing & Verification Runbook

## 1. Automated Security Toolchain

Nazar leverages an automated multi-tier security testing toolchain integrated into CI/CD:

```text
┌────────────────────────────────────────────────────────┐
│               SECURITY VERIFICATION SUITE              │
├──────────────────────┬─────────────────────────────────┤
│ Verification Area    │ Tool & Command                  │
├──────────────────────┼─────────────────────────────────┤
│ Dependency Scanning  │ pnpm audit                      │
│ Secret Detection     │ Custom Git Regex Secret Scanner │
│ Static Code Analysis │ eslint src --ext .ts            │
│ Type Safety          │ tsc --noEmit (turbo typecheck)  │
│ Security Regressions │ vitest run security-hardening   │
│ Ingestion Governance │ vitest run analytics-governance │
│ Auth Regressions     │ vitest run auth-api             │
│ Admin RBAC Tests     │ vitest run admin-auth           │
└──────────────────────┴─────────────────────────────────┘
```

---

## 2. Core Security Regression Test Suites

1. **Platform Security Hardening Suite** (`apps/api/tests/security-hardening.test.ts`):
   - Verifies account suspension blocks authenticated API access with `403 ACCOUNT_SUSPENDED`.
   - Verifies account banning blocks API access with `403 ACCOUNT_BANNED`.
   - Verifies session refresh is blocked and revoked for suspended users.
   - Verifies refresh token family rotation and replay attack detection revoking sessions with `TOKEN_REPLAY_DETECTED`.
   - Verifies consumer access tokens cannot access `/v1/admin/*`.
   - Verifies unauthenticated access to protected routes is rejected with 401.
   - Verifies log sanitization masks Bearer tokens, JWTs, and passwords.
   - Verifies Admin RBAC prevents unauthorized mutations (e.g. `SUPPORT_AGENT` cannot suspend users or trigger rollups).

2. **Analytics Governance & Privacy Suite** (`apps/api/tests/analytics-governance-privacy.test.ts`):
   - Verifies authoritative session binding blocks client `actorUserId` spoofing.
   - Verifies unapproved taxonomy names are quarantined (`INVALID_TAXONOMY_NAME`).
   - Verifies prohibited secrets (JWTs, card numbers, passwords) in properties are quarantined (`PROHIBITED_PAYLOAD_CONTENT`).
   - Verifies clients cannot emit server-authoritative events (`UNAUTHORIZED_PRODUCER`).
   - Verifies timestamps older than 7 days or more than 15 minutes ahead are rejected.

---

## 3. Running Security Tests Locally

```bash
# 1. Run Dependency Audit
pnpm audit

# 2. Run Type Safety & Linting
pnpm typecheck
pnpm lint

# 3. Run Dedicated Security Hardening Test Suite
pnpm --filter @platform/api test tests/security-hardening.test.ts

# 4. Run Full Platform Test Suite
pnpm test
```
