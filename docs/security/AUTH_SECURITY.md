# Nazar Authentication & Session Security Specification

## 1. Authentication Modalities

Nazar supports four secure consumer authentication modalities:

1. **Phone SMS OTP**: E.164 phone numbers verified via ephemeral 6-digit numeric codes.
2. **Email Magic Code**: Passwordless email verification codes.
3. **Federated OAuth / OIDC**: Google Sign-In and Sign in with Apple.
4. **FIDO2 / WebAuthn Passkeys**: Biometric device passkey authentication.

---

## 2. OTP Security Controls

- **Generation & Entropy**: Cryptographically secure 6-digit codes generated using `crypto.randomInt(100000, 1000000)`.
- **Storage & Hashing**: Codes are NEVER stored in plaintext. They are salted with a 16-byte random salt and hashed using HMAC-SHA256 (`tokenService.hashSecret`).
- **Expiration**: Strict 300-second (5-minute) TTL (`OTP_EXPIRATION_SECONDS`). Expired challenges are rejected with `OTP_EXPIRED`.
- **Max Attempt Bounding**: Maximum 5 failed verification attempts allowed per challenge (`OTP_MAX_ATTEMPTS`). Reaching the limit rejects subsequent attempts with `TOO_MANY_ATTEMPTS`.
- **Single-Use Semantics**: Verification atomically marks the challenge with `consumed_at = NOW()` via a conditional SQL update. Subsequent replay attempts are rejected with `INVALID_CREDENTIALS`.
- **Anti-Flooding Rate Limiting**:
  - Maximum 3 OTP requests per phone number / email within a 10-minute window.
  - Maximum 10 OTP requests per IP address within a 10-minute window.
- **Enumeration Resistance**: Generic response returned on OTP request ("If the phone number is valid, a verification code has been sent").

---

## 3. Token Security & Refresh Token Rotation

### Access Tokens

- **Format**: Signed JSON Web Token (JWT).
- **Lifetime**: 15 minutes (900 seconds) (`JWT_ACCESS_EXPIRATION_SECONDS`).
- **Signing Algorithm**: HMAC-SHA256 with minimum 256-bit secret key (`JWT_ACCESS_SECRET`).
- **Standard Claims**:
  - `sub`: Canonical user ID (UUIDv7).
  - `sid`: Durable session ID.
  - `dev`: Registered device ID.
  - `iss`: Authoritative issuer (`nazar-api`).
  - `aud`: Authorized audience (`nazar-client`).

### Refresh Tokens & Family Rotation

- **Entropy**: 256-bit cryptographically secure random string (`crypto.randomBytes(32).toString('hex')`).
- **Storage**: Only SHA-256 hashes of refresh tokens are stored in `sessions.token_hash`. Plaintext tokens are never persisted.
- **Automatic Rotation**: Every call to `POST /v1/auth/refresh` invalidates the presented refresh token and issues a new access token and new refresh token pair.
- **Reuse Detection & Session Invalidation**:
  - The previous token hash is stored in `session_token_history`.
  - If a rotated refresh token is presented again, the system recognizes a replay attack.
  - The session is immediately revoked in `sessions` with reason `TOKEN_REPLAY_DETECTED`.
  - A `CRITICAL` severity security event is recorded in `security_events`.

---

## 4. Session Revocation & Account Suspension Enforcement

1. **Explicit Logout**:
   - `POST /v1/auth/logout`: Revokes the active session (`revoked_at = NOW()`).
   - `POST /v1/auth/logout-all`: Revokes all sessions belonging to the user (`revokeAllUserSessions`).
2. **Account Suspension & Ban Enforcement**:
   - When an administrator suspends or bans an account, all active sessions are revoked immediately in PostgreSQL.
   - `AuthGuard` queries `users.status` and `user_restrictions` on every authenticated request. Any suspended or banned user is rejected with `403 Forbidden` (`ACCOUNT_SUSPENDED` or `ACCOUNT_BANNED`).
   - `AuthService.refreshSession` verifies that the owning user account is `ACTIVE`. Any refresh attempt on a suspended or deleted account revokes the session and throws 403 Forbidden.
   - `AuthService.resolveOrCreateUserAndSession` rejects login attempts for existing identities whose user record is suspended or banned.
