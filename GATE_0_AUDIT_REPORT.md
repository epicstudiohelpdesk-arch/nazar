# GATE 0 — Repository Reality Audit & Security Baseline

**Date:** 2026-10-21
**Mode:** Read-only audit. No application code, migrations, configuration, lockfiles, environment files, or deployment resources were modified. Nothing was committed or pushed.
**Scope:** Working tree state, including uncommitted user changes (see §2.1).
**Auditor posture:** Adversarial; documented claims are treated as unverified until contradicted or confirmed by code evidence.

---

## 1. Executive Summary & Repository Maturity Assessment

Nazar is a large, well-structured, _substantially-implemented_ monorepo (3 apps, 5 packages, 4 worker shells, ~72 DB tables, ~15 migrations, ~85 backend test files). The engineering fundamentals — clean module boundaries, default-deny guards, parameterized SQL, transactional match creation, response-envelope hygiene — are materially better than typical pre-launch codebases. **66 tests in 13 security-relevant suites were executed and passed** in this audit.

However, the repository's own launch documentation (`LAUNCH_STATUS.md`, `PRODUCTION_GO_NO_GO.md`, `RELEASE_NOTES.md`, `SYSTEM_SECURITY_AND_DATABASE_SPECIFICATION.md`) claims production readiness ("FINAL DECISION: GO", "ZERO release-blocking issues", "webhook signatures validated", "IAP server verification active", "workers consumer pools active"). **These claims are contradicted by the code.** The gap between documentation and reality is itself the single largest systemic risk in this repository.

**Six Critical findings** make the system unsafe to expose to untrusted traffic in its current state:

1. **OAuth login performs no signature verification** — any attacker can forge a Google/Apple ID token and take over or create any account (`jwt.decode` only).
2. **Passkey/WebAuthn login performs no cryptographic verification** — no assertion signature, origin, or challenge binding is checked; knowing a credential ID suffices to log in.
3. **In-app purchase "verification" trusts the client** — forged Apple JWS, fabricated Google tokens, or `provider:"MOCK"` grant premium entitlements.
4. **Billing webhooks are unauthenticated and unsigned** — anyone can cancel or re-grant subscriptions.
5. **A default SUPER_ADMIN account with a published password and a hard-coded JWT fallback secret is bootstrapped on every boot in every environment**, and the admin login endpoint has no dedicated brute-force control.
6. **No background worker actually runs in any deployed environment** — outbox events, entitlement expiry, push delivery, and webhook retries are dead code paths in deployment.

**Maturity assessment:** _Pre-production._ The codebase is a strong foundation with serious, concentrated security defects in identity federation, payments, admin bootstrap, and operational wiring. It should not pass a launch gate until the Critical and High items in §11 are remediated and re-verified.

---

## 2. Verified Architecture (from code, not documentation)

### 2.1 What actually exists

```text
React Native/Expo (apps/mobile, RN 0.86.3, Expo 57) ──┐
React/Vite Admin (apps/admin, React 18) ──────────────┤
                                                      ▼
                                   NestJS 11 modular monolith (apps/api)
                                   ├── Express 5.2.1 HTTP
                                   ├── Socket.IO 4.8 (in-memory adapter ONLY — no Redis adapter)
                                   ├── Global guards: AppThrottlerGuard, AuthGuard (default-deny)
                                   ├── 15 domain modules (auth, chat, discovery, interactions,
                                   │   matches, payments, safety, social, analytics, admin, …)
                                   └── In-process worker classes (NEVER SCHEDULED/RUN)
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    ▼                     ▼                      ▼
        PostgreSQL 16 + PostGIS 3.4   Redis 7 (declared;      S3/MinIO (presigned PUT;
        Drizzle ORM 0.45.3            UNUSED by API code —    public GET URLs; server
        ~72 tables, 15 migrations     no cache, no sessions,  never proxies bytes)
        (no RLS, forward-only)        no rate-limit storage)
```

### 2.2 Documented but NOT present in code

| Claim (source)                                                                                                                          | Reality                                                                                                                                                                                                              |
| :-------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Socket.IO Redis distributed adapter (`SYSTEM_SECURITY_AND_DATABASE_SPECIFICATION.md:56`; docs/performance/WEBSOCKET_PERFORMANCE.md:133) | No `redis`/`ioredis` dependency, no custom IoAdapter anywhere in `apps/api`                                                                                                                                          |
| "Distributed Redis Rate Limiter" (spec:20)                                                                                              | `@nestjs/throttler` with default **in-memory** storage; per-instance only                                                                                                                                            |
| Redis for sessions/feeds (spec:34)                                                                                                      | Sessions are PostgreSQL; Redis is not referenced by API code at all                                                                                                                                                  |
| Background worker fleets "ACTIVE" (`LAUNCH_STATUS.md` table)                                                                            | No scheduler, cron, or `setInterval` in `apps/api`; staging worker service is `node -e "console.log(...); setInterval(() => {}, 1000)"` (`infra/docker/docker-compose.staging.yml:90`); `workers/*` are empty shells |
| "Webhook signatures validated", "IAP server verification active" (`PRODUCTION_GO_NO_GO.md` §2)                                          | No signature verification exists for either (see C-3, C-4)                                                                                                                                                           |
| Session "family revocation" (spec:124; Gate 04 row)                                                                                     | Replay revokes only the single session whose token was replayed (`auth.service.ts:599`)                                                                                                                              |
| "Weekly automated restore verification drill in CI" (docs/infrastructure/BACKUP_AND_RESTORE.md:118-127)                                 | No scheduled workflow exists; the cited test hard-codes `measuredRpoSeconds = 0`                                                                                                                                     |
| Gate roadmap says Gates 06–13 PENDING (`docs/GATES.md`) while launch docs claim "GATE 20" complete                                      | Internal documentation contradiction                                                                                                                                                                                 |
| "68 tables" (multiple docs)                                                                                                             | ~72 tables in schema/migrations                                                                                                                                                                                      |

### 2.3 In-flight (uncommitted) user changes — audited, preserved, not committed

`git status` shows 10 modified files + 3 untracked additions. These are meaningful security improvements and were audited as part of reality:

- New `apps/api/src/common/crypto/` — `FieldEncryptionService` (AES-256-GCM + HKDF) + `CryptoModule` (design issues in §5, D-1..D-4).
- Message FLE wired into `MessagesRepository`, `InteractionsService`, `NotificationEventConsumer`.
- `SessionRepository.rotateSessionToken` row-lock hardening (`SELECT … FOR UPDATE` + hash re-check).
- Log/exception redaction extensions (`app-logger.service.ts`, `global-exception.filter.ts` — now scrubs DB URIs, JWTs, Bearer tokens from messages).
- Pool resilience (`client.ts` — keepAlive, query_timeout, `pool.on('error')`).

**These changes are not committed; they are at risk of loss and are not covered by CI until committed.**

---

## 3. Feature Matrix (implemented / partial / missing / unverified)

| Area                                                                                   | Status                                                                                    | Evidence                                                                  |
| :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| Dual-token sessions, refresh rotation, replay detection                                | **Implemented** (single-session revocation, not "family")                                 | `auth.service.ts:579-694`, `session.repository.ts:87-150`                 |
| OTP (phone/email): hashed, salted, single-use, attempt-capped, per-identifier throttle | **Implemented**                                                                           | `auth.service.ts:105-395`, `otp-challenge.repository.ts`                  |
| Phone OTP/Email OTP via real providers                                                 | **Partial** — test/dev providers in path; real SMS/EMail config unverified                | `providers/sms.provider.ts`, `email.provider.ts`                          |
| Google/Apple OAuth                                                                     | **Broken (Critical)** — decode-only, no signature verify                                  | `oauth.provider.ts:47,137`                                                |
| Firebase login                                                                         | **Implemented** — real `firebase-admin verifyIdToken`                                     | `firebase.provider.ts:101`                                                |
| Passkeys/WebAuthn                                                                      | **Broken (Critical)** — no attestation/assertion verification                             | `passkey.service.ts:71-239`                                               |
| Admin RBAC (roles/permissions, per-controller guards)                                  | **Implemented**                                                                           | all `admin/controllers/*` have `AdminAuthGuard` + `AdminPermissionsGuard` |
| Admin bootstrap security                                                               | **Broken (Critical)** — default creds, no env guard                                       | `admin-auth.service.ts:265-284`                                           |
| Field-level message encryption                                                         | **Partial (new, uncommitted)** — crypto design flaws (§5)                                 | `field-encryption.service.ts`                                             |
| Match uniqueness & concurrency                                                         | **Implemented** — advisory locks + DB unique + normalized pair                            | `matches.repository.ts:37`, migration 0004                                |
| Outbox pattern                                                                         | **Partial** — claim/retry implemented; **no runner**, no stuck-`PROCESSING` reaper        | `notification-event-consumer.ts:62-133`                                   |
| Push notification delivery                                                             | **Partial** — logic implemented, never scheduled; staging worker is a stub                | `notification-delivery-worker.ts`, staging compose:90                     |
| Media processing/moderation                                                            | **Missing** — `workers/media` and `workers/moderation` are empty shells; no image library | `workers/media/src/index.ts:18-28`                                        |
| Media upload validation                                                                | **Missing** — client-trust only; READY without server checks                              | `media.service.ts:153-221`                                                |
| Media access control                                                                   | **Partial** — public permanent URLs; signed GET implemented but unused                    | `s3-storage.service.ts:79-107`                                            |
| Discovery privacy (distance-only responses)                                            | **Implemented + tested**                                                                  | `discovery.service.ts:159-169`, `discovery-privacy.test.ts`               |
| Discovery geospatial query (ST_DWithin + GIST)                                         | **Implemented**                                                                           | `candidate.repository.ts:94-108`                                          |
| Payments: purchase verification                                                        | **Broken (Critical)** — client trusted / MOCK selectable                                  | `apple-payment.provider.ts:44-62`, `google-payment.provider.ts:45-83`     |
| Payments: webhook authenticity                                                         | **Broken (Critical)** — unsigned, `@Public`                                               | `webhooks.controller.ts:15`                                               |
| Payments: idempotency & dedupe constraints                                             | **Implemented**                                                                           | unique indexes on (provider, event/tx/orig-tx ids)                        |
| Entitlement expiry worker                                                              | **Missing in deployment** — code exists, no scheduler                                     | `entitlement-expiration-worker.ts`                                        |
| HTTP idempotency middleware                                                            | **Missing in practice** — `@Idempotent` decorator used on **zero** routes                 | grep: no controller usages                                                |
| Account deletion                                                                       | **Partial** — soft delete only; promised 30-day purge not implemented                     | `auth.service.ts:847-903`                                                 |
| Rate limiting                                                                          | **Partial** — in-memory, spoofable tracker keys, no `trust proxy`                         | `app-throttler.guard.ts:17-27`, `main.ts`                                 |
| Health/readiness + graceful shutdown                                                   | **Implemented**                                                                           | `health.controller.ts`, `main.ts:74`, `database.service.ts:97`            |
| Backup/restore verification                                                            | **Unverified/claimed falsely**                                                            | `backup-restore.test.ts:110` hard-codes RPO=0                             |
| Observability (OTel/Sentry)                                                            | **Missing server-side** — env vars declared, no deps/code                                 | `apps/api/package.json`                                                   |
| Swagger                                                                                | **Implemented, enabled in prod** (risk)                                                   | `main.ts:71`, `swagger.ts:38-44`                                          |

---

## 4. Critical & High-Severity Findings (first)

### CRITICAL

**C-1 — Account takeover via forged Google/Apple ID tokens (no signature verification)**

- **Evidence:** `apps/api/src/modules/auth/providers/oauth.provider.ts:47-113` (Google) and `:137-198` (Apple) use `jwt.decode(rawToken, { complete: true })` and then validate only `iss`/`aud`/`exp`/`sub` claims **taken from the unverified payload**. No JWKS fetch, no signature check, no `nonce` enforcement for Google, no certificate chain.
- **Attack:** `POST /v1/auth/oauth/google` (public) with a self-signed JWT containing any `sub` → logs in as (or creates) that user. Account takeover for every user who has bound Google/Apple identity; free multi-account creation.
- **Impact:** Systemic authentication bypass.
- **Fix:** Verify signatures against Google/Apple JWKS (`jose` + `createRemoteJWKSet`), enforce `aud`/`iss`/`exp`/`nonce` on verified claims; exchange authorization codes server-side. Remove the hard-coded client IDs (`oauth.provider.ts:69-70`) and the `'mock-google-client-id'` bypass (`:78`).
- **Verify:** unit test asserting a locally self-signed token with correct claims and wrong key is rejected.

**C-2 — Passkey/WebAuthn login has zero cryptographic verification**

- **Evidence:** `apps/api/src/modules/auth/providers/passkey.service.ts:169-239` (`verifyLogin`) validates the challenge record, looks up `payload.credentialId`, increments a counter, and returns the user — **no assertion signature verification, no `clientDataJSON` (origin/challenge) check, no `authenticatorData` parsing, no counter-clone check**. `verifyRegistration` (`:71-148`) stores client-supplied `publicKey`/`credentialId` unverified and does not bind the challenge to the registering userId (`:78-94` vs `:135`).
- **Attack:** Register any credentialId, or simply POST `passkey/login/verify` with a known credentialId and garbage signature → session issued for that user.
- **Impact:** Authentication bypass for any passkey-enabled account.
- **Fix:** Use `@simplewebauthn/server` (as the spec claims) for options + verification; bind challenge→user; validate origin/RP-ID; enforce counter monotonicity; make `@Passkey` registration attestation policy explicit.
- **Verify:** negative tests with tampered signature, wrong origin, replayed challenge, and counter regression.

**C-3 — Purchase verification trusts the client; free premium**

- **Evidence:** `apple-payment.provider.ts:44-62,72-74` decodes JWS **without signature verification** (comment admits it); `google-payment.provider.ts:45-83` performs **no Google Play Developer API validation** and fabricates orderId/expiry; `payment-provider.factory.ts:24-28` returns the **MOCK provider whenever `providerType === 'MOCK'`**, regardless of environment, and `verifyPurchaseSchema` (`packages/validation/src/payments.ts:3-12`) accepts `MOCK` (the env guard at `server-env.ts:124-131` only blocks the env var, not the request field).
- **Attack:** Authenticated `POST /v1/billing/purchases/verify` with `provider:"MOCK"` (or forged Apple JWS / fabricated Google purchaseToken) → entitlements granted (`purchases.service.ts:130-237`).
- **Impact:** Revenue loss, entitlement fraud, privilege escalation into premium features.
- **Fix:** Server-side validation — Apple: App Store Server API / JWS x5c chain verification with Apple root CA; Google: `androidpublisher` purchases.get/acknowledge with service account. Reject `MOCK`/sandbox payloads when `NODE_ENV=production`. Wire entitlement granting only to verified results and webhook-confirmed state.

**C-4 — Billing webhooks are unauthenticated and unsigned**

- **Evidence:** `webhooks.controller.ts:15` marks the controller `@Public`; Apple handler decodes only (`apple-payment.provider.ts:108-158`); Google handler base64-decodes Pub/Sub messages with no OIDC bearer verification (`google-payment.provider.ts:85-103`); timestamps come from the payload (replayable). Tests codify this: `billing-webhooks.test.ts:37-42` builds a JWS with `'mock-sig'` and asserts HTTP 200.
- **Attack:** Replay or fabricate `RENEWAL`/`REFUND`/`REVOKE`/`EXPIRE` events for any known `originalTransactionId` → cancel/re-grant other users' subscriptions (fraud + targeted DoS).
- **Fix:** Verify Apple signed server notifications (same chain as C-3); verify Google Pub/Sub push OIDC tokens (audience/issuer); capture raw body for signature verification (`main.ts` currently provides none — see M-18); enforce replay windows and store `payloadHash` over provider bytes.

**C-5 — Hard-coded bootstrap SUPER_ADMIN with published password + hard-coded admin JWT fallback**

- **Evidence:** `admin-auth.service.ts:268-284` creates `admin@nazar.internal` with password `SuperAdmin123!` (literal at `:271`), `role SUPER_ADMIN`, `mfaEnabled: false`, invoked on **every boot in every environment** via `AdminModule.onModuleInit` (`admin.module.ts:105-112`, errors swallowed). `admin-auth.service.ts:48-50` falls back to `ADMIN_JWT_SECRET_FALLBACK = 'nazar-dev-super-secure-admin-secret-2026-production'` (`admin.constants.ts:7`) whenever `jwtAccessSecret` is unset — a secret committed to git that can forge admin tokens if the fallback is ever active. Password is also published in `docs/admin/ADMIN_RUNBOOK.md:16` (which references a non-existent `ADMIN_BOOTSTRAP_PASSWORD` env var).
- **Attack:** Credential stuffing of a known super-admin email with a published password; JWT forgery if fallback secret is live; admin login (`@Public`) has no dedicated brute-force control beyond the spoofable global throttle.
- **Impact:** Full administrative compromise (user data, moderation, operations).
- **Fix:** Remove the bootstrap entirely from application boot; provision the first admin via an audited CLI/migration with a one-time random password and forced rotation; fail startup (not warn) if `NODE_ENV=production` and no explicit admin config exists; delete the fallback secret and hard-fail when `jwtAccessSecret` is missing; add dedicated admin login throttling + mandatory MFA.

**C-6 — No background worker runs in any deployed environment**

- **Evidence:** No `@Cron`/`setInterval`/scheduler anywhere in `apps/api/src`; `processPendingEvents`, `processJobs`, `processExpirations`, `processPendingWebhooks` are referenced only by tests. `Dockerfile:50,78` deploys only the API. `workers/*/package.json` have no start scripts; `workers/media` and `workers/moderation` are empty stubs. Staging `worker` service is a `setInterval(() => {}, 1000)` no-op (`docker-compose.staging.yml:90`) sharing the API's `DATABASE_URL`.
- **Impact:** Outbox events accumulate `PENDING` forever → no push notifications, **no entitlement expiry**, no webhook retry, no safety-notice delivery, unbounded backlog growth. This directly undermines billing integrity (C-3/C-4 mitigations that depend on expiry/revocation workers).

### HIGH

| ID   | Finding                                                                                                                                                                                                                                                                                                                                 | Evidence                                                                                                                               | Impact                                                                                                                                          |
| :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1  | Production deploy ignores the promoted `image_tag` (only echoes it); actual deploy is `--force-new-deployment`; "Automated Rollback" targets a task-definition tag `PREVIOUS_STABLE` that is never created anywhere                                                                                                                     | `.github/workflows/deploy-production.yml:6-8,58-70,90-97`                                                                              | Deployed artifact is not the reviewed artifact; rollback fails on demand                                                                        |
| H-2  | No Socket.IO Redis adapter while staging runs 2 API replicas → rooms exist per-node; cross-node message fanout silently lost                                                                                                                                                                                                            | no `createAdapter`/`redis` deps; `docker-compose.staging.yml:20-81`                                                                    | Realtime correctness/availability                                                                                                               |
| H-3  | `outbox_events` and `billing_webhook_events` claims have no lease/visibility timeout and no stuck-`PROCESSING` reaper; `processed_at` written at claim time; docs claim recovery SQL that does not exist                                                                                                                                | `notification-event-consumer.ts:62-87`; `billing-webhook-events.repository.ts:83-119`; `docs/performance/WORKER_PERFORMANCE.md:98-121` | Silent permanent event loss on crash                                                                                                            |
| H-4  | Nest global guards/pipes do not apply to WS message handlers (framework constructs WS contexts without `ApplicationConfig`) → no WS rate limiting, no `AppValidationPipe` on message bodies                                                                                                                                             | `@nestjs/websockets@11.2.6` `socket-module.js:81` (static analysis of installed source)                                                | WS abuse, unvalidated payloads, DB-amplification via `message:send`                                                                             |
| H-5  | Field-encryption key derived from JWT signing secrets (`access + refresh`); no key versioning/rotation path; same key reused for HMAC blind-index; no AAD binding ciphertext to conversation/sender                                                                                                                                     | `field-encryption.service.ts:21-28,133-138`                                                                                            | Key-rotation = permanent message data loss; DB-write attacker can swap ciphertexts between messages; signing/encryption key separation violated |
| H-6  | Media upload pipeline performs **zero** server-side content validation (no HeadObject, no magic bytes, no decode, no size re-check, no AV); `PENDING→READY` on client call; no image library exists; media/moderation workers are stubs                                                                                                 | `media.service.ts:153-221`; repo-wide grep `sharp` = 0                                                                                 | Malware/polyglot serving from app origin; unmoderated content                                                                                   |
| H-7  | Media GETs are permanent unauthenticated public URLs (`getPublicUrl`) used across all surfaces; signed GET exists but is never called; "blurred" liker photo returns the same unblurred public URL plus the liker's userId to non-premium users                                                                                         | `s3-storage.service.ts:103-107`; `interactions.service.ts:527-544`                                                                     | Privacy failure (blur bypass, URL leak via caches/referrers); no revocation of access                                                           |
| H-8  | Account deletion is soft-only; media objects, messages, analytics, and social content are never purged; no purge job exists despite the published "purged within 30 days" policy                                                                                                                                                        | `auth.service.ts:847-903`; `compliance.controller.ts:92-96`                                                                            | App Store / Google Play data-deletion policy violation; GDPR/CCPA exposure                                                                      |
| H-9  | CI security scanning is decorative: Trivy `exit-code: '0'` (non-blocking), action pinned to `@master`; no `pnpm audit`, no CodeQL, no secret scanner, no Dependabot; no workflow `permissions:` blocks; all actions tag-pinned, not SHA-pinned                                                                                          | `.github/workflows/ci.yml:68-75`; `release-candidate.yml:87-92`; grep confirmations                                                    | Vulnerable/supply-chain-compromised deps pass the gate silently                                                                                 |
| H-10 | Committed staging secrets: JWT secrets, DB/Redis/MinIO credentials as literals in git; data-store ports published on the staging stack; worker stub                                                                                                                                                                                     | `infra/docker/docker-compose.staging.yml:29-36,61-69,93-94,109-150`                                                                    | Staging compromise → credential reuse; direct DB access from internet if reachable                                                              |
| H-11 | Backup/restore claims are unsubstantiated: no scheduled restore drill; the "empirical" test copies from the live DB into a scratch schema and hard-codes `measuredRpoSeconds = 0`                                                                                                                                                       | `tests/infra/backup-restore.test.ts:76-110`; `BACKUP_AND_RESTORE.md:9-14,118-127`                                                      | False confidence in recoverability; no evidence PITR works                                                                                      |
| H-12 | Rate limiting is in-memory per instance; tracker prioritizes client-controlled `x-device-id` and first `X-Forwarded-For` hop with no trusted-proxy validation; `trust proxy` is never set, so behind nginx/ALB `req.ip` is the proxy → per-IP OTP limits (3/10 per phone is safe, but the 10/10-min IP cap) become global or bypassable | `app-throttler.guard.ts:17-27`; `main.ts` (no `set('trust proxy')`); `auth.service.ts:135-151`                                         | Unlimited anonymous requests by rotating headers; collective OTP lockout behind proxy                                                           |
| H-13 | Swagger UI mounted unconditionally in production at `/docs` with `persistAuthorization: true`; tests assert `/docs` is served                                                                                                                                                                                                           | `main.ts:71`; `swagger.ts:38-44`; `health-and-readiness.test.ts:51-52`                                                                 | Attack surface mapping; stolen-token replay via persisted auth in UI                                                                            |
| H-14 | `db:perf:purge` deletes data with **no production environment guard** (unlike `db:seed`/`db:reset` which have one)                                                                                                                                                                                                                      | `tools/perf-purge-cli.ts` (no NODE_ENV check); `apps/api/package.json:17`                                                              | Accidental production data destruction                                                                                                          |

---

## 5. Detailed Findings (Medium / Low / Informational)

### C. Authorization & application security

- **M-1 Account enumeration by design.** `POST /v1/auth/check-identifier` (`auth.controller.ts:140-151`, `auth.service.ts:401-437`) is `@Public` and returns `exists` + `provider` for any phone/email, with only 50–70 ms random jitter as "anti-enumeration". On a dating app this discloses who is registered. _Remediation:_ remove, or return indistinguishable responses and gate behind strong anti-abuse controls.
- **M-2 Fragile admin auth bypass in the global guard.** `auth.guard.ts:61-64` short-circuits `return true` for any URL starting `/v1/admin`, delegating entirely to per-controller `AdminAuthGuard`. Today every admin controller does apply it (verified: audit/auth/health/moderation/operations/users/analytics controllers), but any future admin route missing the decorator is instantly public, and the prefix check is string-based (`startsWith`), not route-based. _Remediation:_ delete the special case; keep default-deny.
- **M-3 Call signaling bypasses safety model.** `chat.gateway.ts:370-422` (`call:signal`, `call:hangup`) accept any `targetUserId` with no relationship, match, or block verification (contrast REST `calling.service.ts:30,40`). Block bypass → harassment channel. _Remediation:_ `assertConversationAccess` + `assertCanInteract` before relaying.
- **M-4 No live session invalidation.** Revocation/ban/logout are checked at WS handshake and HTTP guard only; no `fetchSockets`/disconnect on revocation, and no room eviction when a participant is blocked or conversation closed (`chat.gateway.ts` has none). _Remediation:_ on safety events, disconnect sockets by userId and evict rooms.
- **M-5 HTTP idempotency is effectively absent and mis-scoped.** The `@Idempotent` decorator is used on **zero** controller routes (grep), so the interceptor is dead code despite Gate-07 documentation. Additionally, `idempotency.interceptor.ts:64` scopes by `req.user?.id`, but the authenticated principal is `{ userId, sessionId, deviceId }` → scope silently degrades to `'global'` for all users; if idempotency were enabled, keys would be a shared cross-user namespace (response replay/conflict across tenants). An `InMemoryIdempotencyStore` test double also coexists with the Postgres store. _Remediation:_ fix scope to `req.user?.userId`, apply `@Idempotent` to state-changing endpoints, delete/ quarantine the in-memory store from production paths.
- **M-6 Stored "poison envelope" DoS on conversations.** `FieldEncryptionService.encrypt` short-circuits when input already starts with `enc:v1:` (`field-encryption.service.ts:45`), and `decrypt` throws on malformed envelopes with no per-row catch in `MessagesRepository.decryptMessageRow`. A participant can send a message body beginning with `enc:v1:` and permanently break decryption (and thus history reads) for that conversation. _Remediation:_ never trust client content for the envelope prefix (store plaintext flag separately or always re-encrypt); catch per-row decrypt failures and return a tombstone.
- **M-7 Stored XSS in public share preview.** `profiles.controller.ts:432-463` interpolates `displayName`/`city` unescaped into HTML `<title>`/OG tags on a `@Public` route. _Remediation:_ HTML-escape all interpolations.
- **M-8 Unauthenticated profile reads & taxonomy writes.** `GET /v1/profiles/:profileId`, `/card`, `/share` are `@Public` (`profiles.controller.ts:418,425,472`); `POST /v1/profiles/interests` is a `@Public` unauthenticated write to the shared taxonomy (`interests.controller.ts:34-50`) — spam/DB-bloat vector. _Remediation:_ require auth for profile reads (or strict field-limited public view); make interest creation authenticated + rate-limited + moderated.
- **M-9 Analytics `context` bypasses documented scrubbing.** `packages/validation/src/analytics.ts:73` allows free-form `context` records stored verbatim; `docs/analytics/PRIVACY_CLASSIFICATION.md:32-42` claims `context` scrubbing plus JWT/Luhn checks that do not exist (grep: zero). `POST /v1/analytics/experiments/exposure` is `@Public` and records arbitrary `subjectId` (poisoning). _Remediation:_ enforce the documented schema on `context`; authenticate exposure ingestion.

### D. Cryptography & secret management

- **D-1 Key derivation from signing secrets (also H-5).** `masterSecret = jwtAccessSecret + ':' + jwtRefreshSecret` → HKDF. Rotation of either JWT secret makes all historical messages undecryptable; envelope has a fixed `v1` tag and no key-id to support dual-key decrypt. _Remediation:_ dedicated `FIELD_ENCRYPTION_KEY` (or KMS/KMS-derived DEKs), `enc:v2:<keyId>:…` envelopes, decrypt tries all active key-ids.
- **D-2 No AAD.** AES-GCM is used without associated data; ciphertexts are portable across rows/conversations if an attacker can write the DB. _Remediation:_ `cipher.setAAD(Buffer.from(conversationId))`.
- **D-3 Key reuse.** The same derived key serves AES-GCM encryption and HMAC-SHA256 blind indexing (`blindIndex`, `:133-138`). _Remediation:_ HKDF with distinct `info` per purpose.
- **D-4 FLE is field-level, not E2E.** The server can read all messages; documentation should not imply E2E. Push previews decrypt message bodies and send plaintext to FCM/APNs (`notification-event-consumer.ts:255-265`) — inherent, but must be an explicit, disclosed design decision (preview opt-in exists).
- **D-5 Hard-coded secret fallbacks (beyond C-5):** KYC challenge secret `'nazar-kyc-…2026'` (`verification.service.ts:32`); discovery cursor signing fallback (`discovery-cursor.service.ts:23`, HMAC truncated to 64 bits at `:113`); built-in dev JWT/S3/DB/Redis defaults in `server-env.ts:17-51` (production refine-guard covers JWT/CORS/DB host but **not** the S3 credential pair, and **staging is not covered by the dev-secret guard**). _Remediation:_ fail fast in all non-dev environments when secrets are missing/default.
- **D-6 Secrets management is aspirational.** `docs/infrastructure/SECRETS_MANAGEMENT.md` describes AWS Secrets Manager/KMS rotation; `infra/terraform/` contains **zero** `aws_secretsmanager`/`aws_ssm` resources.
- **D-7 Hard-coded developer-machine path.** `firebase.provider.ts:51` embeds `/Users/subhamdas/Downloads/nazar-85664-firebase-adminsdk-fbsvc-…json`; the audit run confirmed this local file is actively loaded (project id `nazar-85664` disclosed in source and logs). _Remediation:_ remove all absolute local paths; use `GOOGLE_APPLICATION_CREDENTIALS`/Workload Identity.
- **Positive:** no live private keys/tokens found in git (scan negative for `AKIA*`, `sk_live*`, PEM blocks); `.env` is untracked and never committed; JWT algorithms pinned HS256 both directions; OTP/password hashing uses per-record salts with `timingSafeEqual` (note: plain SHA-256, not scrypt/argon2, for user OTP — acceptable given short TTL and attempt caps, but consider KDF hardening for longer-lived secrets).

### E. Database & transaction integrity

- **E-1** Match-pair uniqueness is enforced at DB level (`uniqueIndex idx_matches_user_a_user_b` + `CHECK user_a_id < user_b_id`, migration 0004) _and_ via transaction-scoped advisory locks (`matches.repository.ts:37`, `interactions.service.ts:124-128`) — verified correct; normalized-pair deadlock avoidance confirmed. Interaction upserts use `(actor,target)` unique + `onConflictDoUpdate`. **This area is strong.**
- **E-2** No RLS anywhere (defense-in-depth gap only, given all access is through one DB role).
- **E-3** Forward-only migrations; no down-migrations, no rollback runbook tested. Migration `0007` contains a data-deleting `DELETE FROM reports …` dedupe.
- **E-4** Single shared DB credential for API and (future) workers — no least-privilege roles (`docker-compose.staging.yml:93`).
- **E-5** ~72 tables vs documented 68; `subscriptions.product_id` uses `NO ACTION` where siblings cascade (potential write-path errors, not orphans).
- **E-6** Account deletion leaves messages/matches/posts/media/analytics intact (see H-8); soft-delete + session/device revocation is correctly transactional otherwise.
- **E-7** Pool hardening (uncommitted): statement/query timeouts, keepalive, `pool.on('error')`, prod TLS `rejectUnauthorized` — good; committed state pending.

### F. Realtime & background jobs

- **F-1** WS handshake does verify JWT + session revocation + safety status (`chat.gateway.ts:74-98`) — good; token also accepted via query string (`:56-61`, token-in-URL leak into logs; Low).
- **F-2** Room joins are server-verified against match membership + blocks (`conversations.service.ts:240-261`) — good; message send re-verifies authorization and DB-uniqueness idempotency (`messages.schema.ts:45-49`) — good.
- **F-3** WS CORS hardcoded `origin: '*'`; no `maxHttpBufferSize`/`pingTimeout` tuning (1 MB default payload); no pre-auth connection limits → cheap DB-amplification on handshake.
- **F-4** Outbox dead-letter: after 5 attempts events go `FAILED` with read-only admin visibility and **no requeue endpoint or alert** (`admin-operations.controller.ts:50-52`). Several emitted event types (e.g. `entitlement.expired`) have no consumer (no-op default, `notification-event-consumer.ts:181-184`).
- **F-5** Notification fanout crash window: on retry after notification insert, `isDuplicate=true` returns before `createJobs` → push permanently lost (`:596-602`).
- **F-6** Billing webhook retry path replays stored events with `rawBody:''`, which the Apple provider rejects by construction — broken-by-design retry (`billing-webhook.service.ts:124-131`).
- **F-7** No per-conversation ordering guarantee for pushes (retries reorder); delivery backoff labeled exponential but is flat ~30 s (`notification-delivery-worker.ts:167-171`).

### G. Media, discovery & privacy

- **G-1** Discovery responses correctly expose only `distanceBucket`, never coordinates/DOB/objectKeys (verified in code + `discovery-privacy.test.ts:50-188`) — strong.
- **G-2** Block/exclusion/incognito enforced server-side in SQL (`interaction-exclusion.service.ts:18-72`; `candidate.repository.ts:165-174`) — strong.
- **G-3** Full-precision coordinates stored at rest with no coarsening or retention job (`profile.service.ts:134-157`); candidate pool selection is `ORDER BY updated_at` not distance (`candidate.repository.ts:190`) — scraping/enumeration over time is feasible with rotating identities (per-account feed caps bound single-session abuse).
- **G-4** SSRF/path-traversal surface: none found (no outbound HTTP client in API; object keys server-generated) — verified negative.

### H. Payments

- **H-a** Positive: unique DB constraints on `(provider, provider_event_id)`, `(provider, provider_transaction_id)`, `(provider, provider_original_transaction_id)`; ingest dedupe; out-of-order regression guard; cross-user replay IDOR guard (`purchases.service.ts:83-90`).
- **H-b** Hardcoded `19900 INR` amounts in providers/ledger; `environment` is client-supplied and unchecked for sandbox-in-production; `BillingReconciliationService` is a no-op (no provider implements `getSubscription`); `providerEventId` falls back to `Date.now()` when `signedDate` absent → unreliable dedupe.

### I. Reliability & deployment

- **I-1** Positive: non-root multi-stage Docker with healthcheck + `dumb-init`; graceful shutdown + pool drain; RDS encrypted/non-public/backed-up; ElastiCache TLS in IaC; OIDC deploys with environment gates; production env validation hard-fails on dev JWT secrets, wildcard CORS, localhost DB/Redis, mock providers (`server-env.ts:98-199`).
- **I-2** No `.dockerignore` → `.env` and `.git` enter the build context and GHA build cache.
- **I-3** CORS wildcard→reflect (`origin: true`) with `credentials: true` outside production; the zod guard forbids wildcard only when `NODE_ENV === 'production'`, so `NODE_ENV=staging` boots legally with wildcard+credentials (`server-env.ts:98-109`; staging compose sets no CORS var).
- **I-4** Alerting drift: IaC has 4 CloudWatch alarms → email-only SNS, no `ok_actions`, no outbox-lag alarm; `ALERTING.md` claims PagerDuty/Slack + 6 alarms.
- **I-5** `.gitignore` does not cover `.env.production` / `.env.staging` filenames.
- **I-6** "Store Submission Approval Gate" job only `echo`es; no signing/verification happens in CI. Release workflow uploads unsigned export bundles.
- **I-7** Root `pnpm clean` = `git clean -xdf` (deletes all untracked files, incl. this report and the uncommitted crypto module) — operational foot-gun.
- **I-8** Env key drift: `.env(.example)` uses `JWT_ACCESS_EXPIRES_IN`, `RATE_LIMIT_TTL_SECONDS`, `RATE_LIMIT_MAX_REQUESTS`, `SENTRY_DSN`, `OTEL_*`, `S3_PUBLIC_URL` — **none exist in the zod schema** and are silently ignored; there is no dotenv loader, so the API actually runs on schema defaults.
- **I-9** Compose: DB/Redis/MinIO ports published without bind-to-localhost; no resource limits; Redis password on CLI args (process-list leak) — dev-only risk.

### Dependency risk (A)

- Versions are modern (Nest 11.2.6, RN 0.86/Expo 57, Drizzle 0.45.3, pg 8.23, helmet 8.3, jsonwebtoken 9.0.3 patched major, zod single-version). `request` absent. Build-script deny-list present.
- Duplications: socket.io 4.8.3+4.8.4; ws ×3; esbuild ×3; React 18 (admin) + 19 (mobile); TypeScript 5.9 + 6.0.
- **Known-CVE status UNVERIFIED** — `pnpm audit` was not run (networked command prohibited in Gate 0). No `engines` field; Node pinned only in CI/Dockerfile.

---

## 6. Authentication & Authorization Route Matrix (summary)

Global: `AppThrottlerGuard` → `AuthGuard` (default-deny; `@Public()` opt-in). Admin: `AdminAuthGuard` + `AdminPermissionsGuard` per controller (verified on all 7 admin/analytics controllers).

| Surface                                                                                                                                                                 | Endpoints | Auth                                                               | Notes                                                                                                                 |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------- | :----------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `/health`, `/ready`, `/v1/health`, `/v1/ready`                                                                                                                          | 4         | `@Public`                                                          | Version/uptime disclosure (Low)                                                                                       |
| `/v1/auth/*` OTP request/verify, email request/verify, refresh                                                                                                          | 5         | `@Public`                                                          | Correct (refresh token in body); no dedicated throttle beyond global                                                  |
| `/v1/auth/oauth/google`, `/oauth/apple`                                                                                                                                 | 2         | `@Public`                                                          | **C-1: no signature verification**                                                                                    |
| `/v1/auth/firebase`                                                                                                                                                     | 1         | `@Public`                                                          | Real firebase-admin verification                                                                                      |
| `/v1/auth/passkey/login/*`                                                                                                                                              | 2         | `@Public`                                                          | **C-2: no assertion verification**                                                                                    |
| `/v1/auth/passkey/register/*`                                                                                                                                           | 2         | Bearer                                                             | **C-2: registration unverified; challenge not bound to user**                                                         |
| `/v1/auth/check-identifier`                                                                                                                                             | 1         | `@Public`                                                          | **M-1: account enumeration**                                                                                          |
| `/v1/auth/logout*`, `sessions*`, `devices*`, `account`                                                                                                                  | 8         | Bearer                                                             | Ownership checks verified (`auth.service.ts:743-841`)                                                                 |
| `/v1/admin/auth/login`                                                                                                                                                  | 1         | `@Public`                                                          | **C-5: known creds, no dedicated throttle**                                                                           |
| `/v1/admin/**` (audit, users, moderation, operations, system, analytics)                                                                                                | ~30       | AdminAuthGuard + RBAC                                              | Guards consistent; MFA not enforced at login                                                                          |
| `/v1/webhooks/apple`, `/v1/webhooks/google`                                                                                                                             | 2         | `@Public`                                                          | **C-4: unsigned**                                                                                                     |
| `/v1/billing/purchases/verify`                                                                                                                                          | 1         | Bearer                                                             | **C-3: client-trusted**                                                                                               |
| `/v1/billing/products`, `/products/:id`                                                                                                                                 | 2         | `@Public`                                                          | Acceptable (catalog)                                                                                                  |
| `/v1/billing/entitlements`, subscriptions                                                                                                                               | N         | Bearer                                                             | Premium gating read server-side                                                                                       |
| `/v1/profiles/:id`, `/card`, `/share`                                                                                                                                   | 3         | `@Public`                                                          | Unauthenticated profile reads (M-8); share HTML XSS (M-7)                                                             |
| `/v1/profiles/interests` GET/POST                                                                                                                                       | 2         | `@Public`                                                          | POST = unauthenticated taxonomy write (M-8)                                                                           |
| `/v1/profiles/prompts`                                                                                                                                                  | 1         | `@Public`                                                          | Catalog read, acceptable                                                                                              |
| `/v1/discovery`, `/v1/interactions/*`, `/v1/matches/*`, `/v1/conversations/*`, `/v1/users/blocks`, safety, notifications, social, recommendations, analytics (consumer) | all       | Bearer (global default-deny)                                       | Service-level ownership checks verified in chat/discovery/matches; conversations public profile route exception noted |
| `/v1/analytics/events`, `/experiments/exposure`                                                                                                                         | 2         | `@Public`                                                          | M-9 exposure poisoning                                                                                                |
| `/.well-known/*`, `/v1/compliance/*`                                                                                                                                    | 6         | `@Public`                                                          | Static documents, acceptable                                                                                          |
| Socket.IO `join:conversation`, `message:send`, `message:read/delivered`, `typing:*`                                                                                     | WS        | JWT + session check at handshake; membership re-verified per event | `call:signal`/`call:hangup` lack authorization (M-3); no WS throttle (H-4)                                            |

---

## 7. Sensitive-Data Inventory & Lifecycle Gaps

| Data                   | Storage                                          | Protection                                                              | Lifecycle gap                                                            |
| :--------------------- | :----------------------------------------------- | :---------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| Message bodies         | Postgres `messages.body` (text)                  | AES-256-GCM FLE (uncommitted; design issues D-1..D-3)                   | No purge on account deletion; previews sent plaintext to push providers  |
| Phone numbers / emails | `user_identities.provider_subject`               | Plain (identity key)                                                    | Never anonymized post-deletion                                           |
| OTP codes              | `otp_challenges`                                 | SHA-256 + per-row salt; attempt caps; single-use consume                | Expired rows not purged (no retention job found)                         |
| Refresh tokens         | `sessions.token_hash`                            | SHA-256 only; rotation + replay history                                 | History table grows unbounded                                            |
| Precise location       | `profiles.location` geography + lat/long doubles | GIST-indexed; **full precision at rest**; responses expose buckets only | No coarsening, no retention job                                          |
| Photos                 | S3/MinIO objects                                 | Public permanent URLs                                                   | **Not deleted on account deletion** (H-8); EXIF/GPS never stripped (H-6) |
| Push tokens            | `devices.push_token`                             | DB                                                                      | Deleted on account deletion ✔                                            |
| Payment identifiers    | subscriptions/transactions                       | Unique-indexed                                                          | Verified (subject to C-3/C-4)                                            |
| Analytics events       | `analytics_events`                               | Governance layer; lat/lng prohibited in `properties`                    | `context` passthrough bypass (M-9); no actor nullification               |
| Admin credentials      | `admin_users.password_hash`                      | scrypt + timingSafeEqual ✔                                              | Default super-admin bootstrap (C-5); MFA flag exists but not enforced    |
| Audit/security events  | `audit_logs`, `security_events`                  | Append-only; actor FK SET NULL on delete                                | Retention unbounded                                                      |

---

## 8. Existing Test Coverage & Verification Gaps

**Executed this session (safe, local docker infra only):**

```bash
cd apps/api && npx vitest run --fileParallelism=false \
  tests/crypto-field-encryption.test.ts tests/auth-otp.test.ts tests/auth-session.test.ts \
  tests/auth-concurrency.test.ts tests/auth-guard.test.ts tests/security-hardening.test.ts
# → 6 files passed, 36/36 tests passed

cd apps/api && npx vitest run --fileParallelism=false \
  tests/chat-websocket.test.ts tests/cors-and-security.test.ts tests/profile-security-adversarial.test.ts \
  tests/billing-purchases.test.ts tests/matches-concurrency.test.ts tests/discovery-privacy.test.ts \
  tests/idempotency.test.ts
# → 7 files passed, 30/30 tests passed
```

**Total: 13 files, 66/66 tests passed.** Notable: no tests were skipped or blocked in these runs. During execution the app booted the Firebase provider from a developer-local service-account path (evidence for D-7).

**Coverage gaps (tests that should exist and don't):**

- No negative tests for OAuth signature verification (none possible — feature absent); no test that `provider:"MOCK"` is rejected in production; `billing-webhooks.test.ts` **asserts forged JWS succeeds** (codifies C-4).
- No test for outbox `PROCESSING` reaper (feature absent), webhook poison replay, multi-instance WS fanout, session revocation mid-WS-connection, `call:signal` abuse, eviction-on-block.
- No server-side media content-validation test (feature absent).
- Backup "restore" test does not restore from a backup artifact (H-11).
- No migration rollback tests (no down-migrations exist).
- Not executed in this audit (safe but time/environment-bounded): the remaining ~72 test files, full `pnpm verify`, Trivy output inspection, and `pnpm audit` (prohibited/networked).

---

## 9. Prioritized Remediation Backlog (Gate 1 input)

Ordered by risk and dependency. Each item has an acceptance criterion.

**P0 — Stop the bleeding (before any external exposure):**

1. **C-1/C-2: Fix identity verification.** JWKS signature verification for Google/Apple; `@simplewebauthn/server` for passkeys. _AC:_ negative tests for wrong signature/origin/replay fail; no `jwt.decode`-only path remains.
2. **C-3/C-4: Fix payments.** Server-side Apple/Google validation; reject MOCK/sandbox in production; webhook signature + raw-body capture; remove client-supplied `environment` trust. _AC:_ forged JWS and unsigned webhooks rejected in tests (invert current tests); raw bytes preserved for verification.
3. **C-5: Remove admin bootstrap & fallback secret.** CLI/migration-provisioned admin, forced password + MFA, startup failure in production when secrets missing. _AC:_ grep for `SuperAdmin123` and `ADMIN_JWT_SECRET_FALLBACK` returns nothing; boot in prod config without admin secret exits non-zero.
4. **C-6: Run the workers.** Real scheduler (Nest `@nestjs/schedule` or separate worker entrypoint in the image) for outbox, delivery, webhook consumer, entitlement expiry; replace staging stub. _AC:_ integration test proving events flow `PENDING→PUBLISHED` in a deployed-like process.
5. **H-1: Fix production deploy immutability + real rollback.** _AC:_ deploy uses the reviewed tag; rollback target exists and is exercised.

**P1 — Core hardening:** 6. H-3 outbox/webhook leases + reaper + requeue tooling + dead-letter alerting. 7. H-5/D-1..D-3: dedicated FLE key, key-id versioned envelopes, AAD binding, separate blind-index key (design before committing current FLE). 8. H-6/H-7: server-side media validation (sharp decode, size re-check via HeadObject, AV) and signed/short-lived GETs; blur server-side or stop returning liker identity. 9. H-8: real deletion pipeline (media objects, messages, analytics erasure) matching the published policy. 10. M-1: remove/lock down `check-identifier`. 11. H-12/H-4: `trust proxy`, `ThrottlerStorageRedis`, trusted-proxy validation, WS guards/pipes wiring + WS rate limit; M-3 call-signal authorization; M-4 live eviction. 12. C-5-adjacent: dedicated admin-login throttling; enforce MFA for admin roles.

**P2 — Supply chain, deployment, privacy:** 13. H-9: blocking Trivy, SHA-pinned actions, `pnpm audit` gate, secret scanning, workflow `permissions:`, Dependabot. 14. H-10/H-13/I-2/I-3/I-5: purge staging secrets from git (rotate them), restrict ports, `.dockerignore`, Swagger off in production, staging CORS guard, `.gitignore` env gaps. 15. M-2/M-5/M-6/M-7/M-8/M-9: admin guard short-circuit removal, idempotency scope+usage fix, poison-envelope handling, share-HTML escaping, profile-read auth, analytics context schema. 16. H-2: Socket.IO Redis adapter before any multi-replica deploy. 17. D-5/D-6/D-7: environment-complete secret validation, real Secrets Manager wiring, remove machine-local paths. 18. H-11/I-4: genuine restore drill (scheduled, evidence-producing), alert parity with docs. 19. E-3/E-4/E-5: migration rollback plan, least-privilege DB roles, doc/schema reconciliation. 20. H-14/I-7: guard `db:perf:purge`; add confirmation prompts to destructive scripts.

---

## 10. Items Requiring Manual Review / Staging Access / External Testing / Operational Evidence

1. **Live environment state:** whether production actually runs this code, at which commit, with which secrets (AWS/GitHub state not inspectable).
2. **Production bucket/CDN ACLs** for `MEDIA_PUBLIC_URL_PREFIX` (public vs signed).
3. **GitHub environment protections**, branch rules, org-level secret scanning/Dependabot.
4. **AWS-side reality:** ECS task definitions (`PREVIOUS_STABLE`), Secrets Manager/KMS existence, SNS subscriptions, RDS/PITR configuration vs Terraform.
5. **Real SMS/Email/APNs/FCM delivery** and quota/cost controls (mock providers active in tests).
6. **`pnpm audit` / SCA results** and Trivy history (prohibited in Gate 0).
7. **TLS termination at the edge** (nginx listens :80 only in repo config).
8. **Mobile app posture:** cert pinning, SecureStore usage, jailbreak detection, binary obfuscation, store-signing pipeline.
9. **Third-party pen test** for OWAST L1/2/3, WebSocket abuse, and payment fraud paths.
10. **Legal/privacy review** of the enumeration endpoint, precise-location retention, and the deletion policy vs implementation gap (H-8).
11. **Load/soak testing** (none run in Gate 0) for pool sizing, outbox throughput, WS fanout.
12. **Whether any external orchestrator** (k8s CronJob etc.) runs the worker code — none found in-repo, cannot be ruled out.

---

## 11. Proposed Gate 1 Plan

**Gate 1 — "Identity, Payments & Operations Truth" (4–6 weeks)**

1. **Week 1:** P0 items 1–5 (identity verification, payments verification, admin bootstrap removal, worker runner, deploy immutability). All with adversarial negative tests. Rotate every secret ever committed (admin fallback, staging JWT/DB/Redis/MinIO, KYC secret) and purge from git history.
2. **Week 2:** P1 items 6–9 (outbox leases/reaper, FLE key redesign — decide E2E vs FLE explicitly, media validation + signed GET, deletion pipeline).
3. **Week 3:** P1 items 10–12 + P2 13–14 (rate limiting/WS hardening, admin MFA, CI blocking gates, staging secret purge, Swagger/CORS hardening).
4. **Week 4:** P2 15–20 + documentation truth pass: rewrite `LAUNCH_STATUS.md`, `PRODUCTION_GO_NO_GO.md`, `SYSTEM_SECURITY_AND_DATABASE_SPECIFICATION.md`, `BACKUP_AND_RESTORE.md`, `ALERTING.md`, `SECRETS_MANAGEMENT.md` and `docs/GATES.md` to match verified reality; delete or clearly mark aspirational claims.
5. **Continuous:** commit the in-flight hardening changes (§2.3) early so CI covers them; run full `pnpm verify` in CI on every PR with blocking scanners.
6. **Gate 1 exit criteria:** all P0/P1 items closed with tests; a staged rehearsal of (a) restore-from-backup, (b) worker crash-recovery, (c) admin-provisioning, (d) webhook forgery rejection; SCA/DAST reports triaged; external pen-test scheduled.

**Explicit Gate 0 conclusion:** Gate 0 is complete per its criteria (structure inspected, findings evidence-tied, unverified claims identified, safe vs skipped checks distinguished, backlog ordered, no code changed). **The application is NOT secure and NOT production-ready.** No security claim in the repository's documentation should be relied upon without the verification steps listed above.

---

### Appendix A — Severity tally

| Severity   | Count | IDs                                                                                                                                             |
| :--------- | :---- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical   | 6     | C-1 … C-6                                                                                                                                       |
| High       | 14    | H-1 … H-14                                                                                                                                      |
| Medium     | ~20   | M-1 … M-18, E-2/E-3, F-4…F-7, D-5…D-7, I-3…I-5                                                                                                  |
| Low / Info | ~15   | token-in-URL, health disclosure, duplicate deps, compose limits, doc drift (68 vs 72 tables), scryptSync blocking, cursor HMAC truncation, etc. |

### Appendix B — Positive controls verified (for balance)

Default-deny global AuthGuard + throttler; consistent admin RBAC guards; refresh rotation with `SELECT … FOR UPDATE` + replay history + atomic single-use OTP; DB-enforced match/interaction uniqueness with normalized advisory locks; parameterized SQL throughout; discovery response privacy with dedicated tests; presigned direct-to-bucket uploads (server never proxies bytes); non-root Docker with healthcheck and graceful shutdown; production env validation hard-fails on several dev-default classes; no secrets committed as live keys; structured log redaction + exception masking (improved further by in-flight changes); 66/66 targeted security tests passing.
