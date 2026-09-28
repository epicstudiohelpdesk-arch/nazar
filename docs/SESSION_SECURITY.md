# Session Security, Token Rotation & Replay Detection (Gate 04)

## 1. Dual-Token Architecture

Nazar employs a zero-trust, dual-token session architecture:

```text
+-----------------------+     +------------------------+
|   Short-Lived JWT     |     |   Long-Lived Refresh   |
|   Access Token        |     |   Token                |
+-----------------------+     +------------------------+
| - 15 minutes validity |     | - 30 days validity     |
| - Stateless payload   |     | - Opaque 32-byte hex   |
| - Fast verification   |     | - SHA-256 hashed in DB |
| - Contains:           |     | - Single-use rotating  |
|   * sub (userId)      |     | - Replay detection     |
|   * sid (sessionId)   |     +------------------------+
|   * dev (deviceId)    |
+-----------------------+
```

### Access Token Claims

Access tokens are signed using HMAC-SHA256 (`HS256`) with a cryptographically secure 256-bit secret.
Claims:

- `sub`: Canonical UUIDv7 user ID.
- `sid`: UUIDv7 session ID in `sessions` table.
- `dev`: Optional UUIDv7 device ID in `devices` table.
- `iat`: Issued-at Unix timestamp.
- `exp`: Expiry Unix timestamp (15 minutes).
- `iss`: `nazar-api`.
- `aud`: `nazar-client`.

---

## 2. Refresh Token Rotation & Replay Protection

### Token Family Lifecycle

1. **Session Establishment**:
   - A new session row is inserted into `sessions` table.
   - `refresh_token_hash` stores the SHA-256 hash of the generated refresh token.
2. **Session Rotation (`POST /v1/auth/refresh`)**:
   - Client sends plaintext refresh token.
   - The server computes `SHA-256(token)` and queries the session:
     ```sql
     SELECT * FROM sessions WHERE refresh_token_hash = $hash;
     ```
   - If not found in `sessions`, the server checks `session_token_history`:
     ```sql
     SELECT * FROM session_token_history WHERE token_hash = $hash;
     ```
   - **Replay Detected**: If found in `session_token_history`, an attacker or stale client is attempting to reuse an invalidated refresh token!
     - The server immediately revokes the session:
       ```sql
       UPDATE sessions SET revoked_at = NOW(), revocation_reason = 'TOKEN_REPLAY_DETECTED' WHERE id = $sessionId;
       ```
     - A `CRITICAL` severity security event is recorded in `security_events`:
       ```json
       {
         "eventType": "SESSION_REPLAY_DETECTED",
         "severity": "CRITICAL",
         "sessionId": "...",
         "ipAddress": "..."
       }
       ```
     - The request is terminated with `401 Unauthorized` and error code `TOKEN_REPLAY_DETECTED`.
   - **Normal Rotation**:
     - The old `refresh_token_hash` is appended to `session_token_history`.
     - A new 32-byte refresh token is generated.
     - The session is updated with the new `refresh_token_hash` and new expiration.
     - A new JWT access token and new refresh token are returned to the client.

```text
Client                              API Gateway                           PostgreSQL
  |                                      |                                    |
  |--- POST /v1/auth/refresh (TokenA) -->|                                    |
  |                                      |-- Compute SHA256(TokenA) --------->|
  |                                      |-- Active in sessions table? ------>|
  |                                      |<-- YES ----------------------------|
  |                                      |-- Move TokenA to token_history --->|
  |                                      |-- Save TokenB in sessions -------->|
  |<-- 200 OK (TokenB, New AccessToken) -|                                    |
  |                                      |                                    |
  | ... Attacker replays TokenA ........ |                                    |
  |--- POST /v1/auth/refresh (TokenA) -->|                                    |
  |                                      |-- Compute SHA256(TokenA) --------->|
  |                                      |-- Active in sessions table? ------>|
  |                                      |<-- NO (Not found) -----------------|
  |                                      |-- Check session_token_history ---->|
  |<-- 401 TOKEN_REPLAY_DETECTED --------|<-- FOUND in history! (REPLAY!) ----|
  |                                      |-- Revoke session immediately ----->|
  |                                      |-- Log CRITICAL security event ---->|
```

---

## 3. Global AuthGuard Verification Flow

All protected routes are guarded by `AuthGuard` registered as global `APP_GUARD`.
Endpoints marked with `@Public()` decorator bypass authentication.

For protected endpoints, `AuthGuard` executes:

1. **Header Parsing**: Extracts `Authorization: Bearer <token>`. Returns `401 UNAUTHORIZED` if missing.
2. **Signature & Expiration Verification**: Verifies JWT signature and expiry. Returns `401 TOKEN_EXPIRED` if expired, or `401 UNAUTHORIZED` if forged.
3. **Session Verification (Database Hook)**: Checks if the session (`sid` claim) is active and not revoked in `sessions` table:
   - If session does not exist: returns `401 SESSION_EXPIRED`.
   - If `revokedAt` is populated: returns `401 SESSION_REVOKED`.
4. **User Status Verification**: Checks if user account is `ACTIVE`. Returns `403 ACCOUNT_SUSPENDED` or `403 ACCOUNT_DELETED` if deactivated.
5. **Request Decoration**: Injects `AuthenticatedPrincipal` (`userId`, `sessionId`, `deviceId`) onto `request.user` for consumption by `@CurrentUser()`.

---

## 4. Mobile Client Token Mutex & Concurrency Safety

The mobile client (`apps/mobile/src/auth/auth-client.ts`) implements single-flight refresh token mutex serialization:

- If multiple parallel requests encounter a 401 or require refreshed access tokens simultaneously, only one network request to `POST /v1/auth/refresh` is dispatched.
- All other concurrent callers await the active refresh promise.
- This prevents race conditions where parallel requests might otherwise attempt to refresh with the same token and trigger false-positive replay detection.
