# Nazar Threat Model & Risk Analysis

## 1. Overview & Methodology

This threat model identifies potential threats, attack vectors, existing security controls, and residual risks across the Nazar social-discovery platform (Gates 01-16). It adopts the STRIDE methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) across all platform assets.

---

## 2. Threat Actor Personas

1. **Unauthenticated External Attacker**:
   - Capabilities: Internet access to public HTTP `/v1/*` routes, WebSocket handshakes, and CDN edge.
   - Motivations: Credential stuffing, phone/email flooding, user enumeration, automated bot scraping, API denial of service.

2. **Authenticated Malicious Consumer**:
   - Capabilities: Valid consumer account with active JWT access token.
   - Motivations: BOLA/IDOR (accessing other users' profiles, photos, or private conversations), location spoofing, interaction spam, bypassing safety blocks, forging client analytics.

3. **Compromised Administrative Staff**:
   - Capabilities: Possesses valid staff credentials with an assigned role (e.g., `SUPPORT_AGENT` or `READ_ONLY_OPERATOR`).
   - Motivations: Horizontal/vertical privilege escalation, unauthorized data dumping, unlogged user suspensions, tampering with audit logs.

4. **Malicious Dependency / Supply Chain Attacker**:
   - Capabilities: Malicious package introduced via npm transitive dependencies or compromised CI runner.
   - Motivations: Secret exfiltration, arbitrary remote code execution (RCE) in build or worker pipelines.

---

## 3. Formal Threat Matrix (STRIDE Mapping)

| Threat ID | STRIDE Category        | Asset & Attack Surface                     | Threat Description                                                        | Existing Control                           | Hardening Implemented (Gate 16)                                                                                  | Residual Risk                                                  |
| :-------- | :--------------------- | :----------------------------------------- | :------------------------------------------------------------------------ | :----------------------------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **TM-01** | Spoofing               | Consumer Session / Auth API                | Attacker rotates IPs to brute-force 6-digit phone OTP                     | 5-minute expiry, salt+hash, max 5 attempts | Multi-factor rate-limiting by phone, device, and IP in `AppThrottlerGuard`                                       | Low (SMS carrier interception outside platform control)        |
| **TM-02** | Spoofing               | Analytics Ingestion `/v1/analytics/events` | Client sends forged `actorUserId` to claim another user's activity        | None in early gates                        | `AnalyticsIngestionService` authoritatively overwrites `actorUserId = request.user.id`                           | None (Client identity strictly server-bound)                   |
| **TM-03** | Tampering              | Refresh Token / Session Storage            | Attacker captures stolen refresh token and replays after rotation         | None                                       | Token family rotation & replay detection revokes session immediately on reuse                                    | Low (Compromise of client physical device storage)             |
| **TM-04** | Tampering              | User Lifecycle / Suspended Accounts        | Suspended user continues making API requests using existing JWT           | `userRestrictions` table                   | `AuthGuard` queries `user.status !== 'ACTIVE'` on every request; `refreshSession` revokes session                | None (Suspension blocks in-flight and refresh tokens)          |
| **TM-05** | Repudiation            | Admin Actions / Audit Log                  | Operator denies performing unauthorized user account suspension           | Application logging                        | Mandatory `reason` field, immutable append-only `admin_audit_logs` table                                         | None (Audit rows have no update/delete endpoints)              |
| **TM-06** | Information Disclosure | Server Logs / Exception Filter             | Stack traces, SQL errors, or JWTs leak into server logs or HTTP responses | `GlobalExceptionFilter`                    | `GlobalExceptionFilter` masks 500s; `AppLoggerService` redacts Bearer tokens, JWTs, and passwords via regex      | Very Low (Ephemeral memory inspection during active debugging) |
| **TM-07** | Information Disclosure | Profile Media / Object Storage             | Attacker enumerates private profile photos via guessable S3 keys          | MinIO / S3 ACLs                            | Object keys are random server-generated UUIDv7 paths; presigned URLs expire in 15m                               | Low (Recipient sharing downloaded media externally)            |
| **TM-08** | Denial of Service      | Public Ingestion & Discovery APIs          | Botnet floods expensive endpoints (e.g. recommendation candidate ranker)  | Single IP throttler                        | `AppThrottlerGuard` tracks `usr_${userId}`, `dev_${deviceId}`, and `ip_${ip}`                                    | Low (Volumetric L3/L4 DDoS mitigated at Cloudflare WAF edge)   |
| **TM-09** | Elevation of Privilege | Admin API `/v1/admin/*`                    | Consumer token or low-privilege operator escalates role to `SUPER_ADMIN`  | Scope check in JWT                         | `AdminAuthGuard` verifies admin session DB state; `AdminPermissionsGuard` enforces explicit granular permissions | None (No self-role mutation endpoints exist)                   |
| **TM-10** | Elevation of Privilege | Chat & Messaging / WebSockets              | User A joins User B's conversation room without match or membership       | Gateway connection auth                    | `assertConversationAccess` checks active match membership; `assertCanMessage` checks blocks                      | None (WebSocket join strictly authorized per conversation)     |
