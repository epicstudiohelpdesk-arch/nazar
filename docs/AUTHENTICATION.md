# Authentication & Identity Architecture (Gate 04)

## 1. Overview & Architectural Principles

The Nazar Authentication and Identity system provides a secure, unified identity layer designed for high-scale mobile discovery. The system guarantees:

1. **Backend Authoritative**: The backend alone verifies proof-of-possession, establishes sessions, evaluates token validity, and revokes access.
2. **Canonical User Identity**: A single canonical user account (`users` table) can link multiple authentication identities (`user_identities` table): Phone OTP, Email Passwordless, Google Sign In, Apple Sign In, and WebAuthn / Passkeys.
3. **Defense-in-Depth Session Topology**: Dual-token architecture combining short-lived JWT access tokens (15 minutes) with opaque cryptographically random refresh tokens (30 days) and single-use rotation.
4. **Immediate Replay Detection & Revocation**: Refresh tokens are single-use. Replay of an already rotated refresh token triggers automatic, instantaneous invalidation of the entire session and generates a critical security audit event.
5. **Device Binding & Ownership**: Sessions and tokens are tied to registered physical device records (`devices` table). Users can inspect active devices and revoke unauthorized access.
6. **Object-Level Authorization**: Direct session and device deletion endpoints enforce ownership rules (`record.userId === principal.userId`). Cross-tenant deletion attempts are rejected with `403 FORBIDDEN`.

---

## 2. Identity Resolution & Multi-Provider Architecture

```text
               +-------------------------------------------------+
               |             Client Request                      |
               |  (Phone OTP / Email / Google / Apple / Passkey) |
               +-----------------------+-------------------------+
                                       |
                                       v
               +-------------------------------------------------+
               |             Identity Resolution                 |
               |        (provider + providerSubject)             |
               +-----------------------+-------------------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
         [Existing Identity]                       [New Identity]
                   |                                       |
                   v                                       v
        +---------------------+               +-------------------------+
        | Load Canonical User |               | Transactional Creation: |
        | Check Account Status|               | 1. users (UUIDv7)       |
        +----------+----------+               | 2. user_identities      |
                   |                          +------------+------------+
                   |                                       |
                   +-------------------+-------------------+
                                       |
                                       v
               +-------------------------------------------------+
               |            Create Device & Session              |
               | 1. Register/Update Device Record                |
               | 2. Issue 32-byte Refresh Token (SHA-256 hashed) |
               | 3. Issue Short-Lived JWT Access Token           |
               | 4. Record Audit & Security Telemetry            |
               +-------------------------------------------------+
```

### Supported Authentication Methods

| Provider                | Inbound Payload                                 | Verification Mechanism                                                     | Identity Subject Key              |
| :---------------------- | :---------------------------------------------- | :------------------------------------------------------------------------- | :-------------------------------- |
| **Phone OTP**           | `phoneNumber` (E.164), `code` (6 digits)        | Cryptographic salt + SHA-256 HMAC comparison against `otp_challenges`      | Normalized E.164 phone string     |
| **Email Verification**  | `email`, `code` (6 digits)                      | Cryptographic salt + SHA-256 HMAC comparison against `otp_challenges`      | Normalized lowercase email string |
| **Google Sign In**      | `idToken` or `authorizationCode`                | OIDC JWT verification (iss, aud, exp, signature) via `GoogleOAuthProvider` | Google `sub` claim                |
| **Apple Sign In**       | `idToken` or `authorizationCode`                | OIDC JWT verification (iss, aud, exp, signature) via `AppleOAuthProvider`  | Apple `sub` claim                 |
| **Passkeys / WebAuthn** | `challenge`, `credentialId`, WebAuthn assertion | WebAuthn assertion challenge verification via `PasskeyService`             | Passkey `credentialId`            |

---

## 3. Cryptographic Storage & Verification

- **OTP Challenges**:
  - OTP codes are 6 numeric digits generated using secure random byte modulo operations.
  - Plaintext OTPs are NEVER written to disk or database.
  - Challenges are stored with a unique 16-byte random hex salt and hashed with SHA-256 (`HMAC-SHA256(otp, salt)`).
  - Challenges expire after 5 minutes (`OTP_EXPIRY_SECONDS = 300`).
  - Max failed attempts: 5 (`OTP_MAX_ATTEMPTS = 5`). Exceeding this marks the challenge consumed and rejects further attempts with `TOO_MANY_ATTEMPTS`.
  - Atomicity: Verification uses conditional SQL updates (`WHERE id = $1 AND consumed_at IS NULL`) to eliminate concurrent double-redemption race conditions.
- **Refresh Tokens**:
  - Refresh tokens are generated as 32 cryptographically secure random bytes (64-character hex strings).
  - Refresh tokens are never stored in plaintext. The database `sessions.refresh_token_hash` stores the SHA-256 digest (`crypto.createHash('sha256').update(token).digest('hex')`).
- **Passkeys**:
  - Registered credentials are stored in `passkeys` table with public key, credential ID, user verification state, counter, and transports.

---

## 4. API Endpoints

### Public Endpoints (`@Public()`)

- `POST /v1/auth/otp/request`: Request a 6-digit phone verification challenge. Rate-limited (3 per 10m per phone, 10 per 10m per non-localhost IP).
- `POST /v1/auth/otp/verify`: Verify phone OTP, resolve identity, and establish session.
- `POST /v1/auth/email/request-verification`: Request an email verification code. Rate-limited.
- `POST /v1/auth/email/verify`: Verify email code, resolve identity, and establish session.
- `POST /v1/auth/oauth/google`: Verify Google OIDC credentials, resolve identity, and establish session.
- `POST /v1/auth/oauth/apple`: Verify Apple OIDC credentials, resolve identity, and establish session.
- `POST /v1/auth/passkey/login/options`: Generate WebAuthn assertion challenge for passwordless passkey login.
- `POST /v1/auth/passkey/login/verify`: Verify WebAuthn assertion and establish session.
- `POST /v1/auth/refresh`: Rotate refresh token and issue a new short-lived access token.

### Protected Endpoints (`@ApiBearerAuth()`)

- `POST /v1/auth/passkey/register/options`: Generate WebAuthn creation options for the authenticated user.
- `POST /v1/auth/passkey/register/verify`: Verify and bind a new passkey credential to the authenticated user.
- `GET /v1/auth/sessions`: List all active sessions for the current authenticated user.
- `DELETE /v1/auth/sessions/:sessionId`: Revoke a specific session owned by the authenticated user (enforces ownership).
- `POST /v1/auth/logout`: Revoke current session.
- `POST /v1/auth/logout-all`: Revoke all sessions belonging to the authenticated user.
- `GET /v1/auth/devices`: List all registered devices for the authenticated user.
- `POST /v1/auth/devices`: Register or update device metadata (platform, push token, app version).
- `DELETE /v1/auth/devices/:deviceId`: Revoke a registered device owned by the authenticated user.
