# Nazar Secrets Management & Cryptographic Keys

## 1. Secrets Inventory

| Secret Identifier           | Classification | Purpose                                 | Injected Via         | Rotation Frequency |
| :-------------------------- | :------------: | :-------------------------------------- | :------------------- | :----------------: |
| `DATABASE_URL`              |    CRITICAL    | PostgreSQL connection & credentials     | Environment Variable |      90 Days       |
| `REDIS_URL`                 |      HIGH      | Redis cache password & connection       | Environment Variable |      90 Days       |
| `JWT_ACCESS_SECRET`         |    CRITICAL    | Access token signing (HS256)            | Environment Variable |      90 Days       |
| `JWT_REFRESH_SECRET`        |    CRITICAL    | Refresh token hash verification         | Environment Variable |      90 Days       |
| `S3_SECRET_ACCESS_KEY`      |      HIGH      | Object storage (MinIO / S3) credentials | Environment Variable |      180 Days      |
| `GOOGLE_CLIENT_ID` / Secret |      HIGH      | Google OIDC token validation            | Environment Variable |     As needed      |
| `APPLE_PRIVATE_KEY`         |    CRITICAL    | Sign in with Apple client secret        | Environment Variable |      180 Days      |
| `APNS_PRIVATE_KEY`          |      HIGH      | Apple Push Notification service token   | Environment Variable |      365 Days      |
| `FCM_PRIVATE_KEY`           |      HIGH      | Firebase Cloud Messaging credentials    | Environment Variable |      365 Days      |
| `BILLING_WEBHOOK_SECRET`    |    CRITICAL    | In-App purchase webhook verification    | Environment Variable |      180 Days      |

---

## 2. Secrets Handling Invariants

1. **Zero Plaintext Secrets in Version Control**:
   - `.env` files are ignored via `.gitignore`.
   - `.env.example` contains only clear placeholders with non-functional mock keys.
   - Git pre-commit hooks and CI scan for leaked API keys, PEM private keys, and AWS access keys.
2. **Environment Variable Injection**:
   - Production secrets are injected via container orchestration secrets management or cloud secrets managers (e.g. AWS Secrets Manager, Google Secret Manager).
3. **No Secrets in Client Bundles**:
   - Client applications (`apps/mobile`, `apps/admin`) have no access to server private keys, database URLs, or webhook secrets.
4. **Log Redaction**:
   - `AppLoggerService` filters any key matching passwords, tokens, API keys, private keys, or JWT strings from application logs.

---

## 3. Emergency Key Rotation Runbook

### JWT Secret Rotation

1. Update `JWT_ACCESS_SECRET` in secret manager and trigger zero-downtime rolling restart.
2. Existing access tokens expire naturally within 15 minutes (`JWT_ACCESS_EXPIRATION_SECONDS = 900`).
3. Refresh tokens re-authenticate users transparently via `POST /v1/auth/refresh`.

### Database Credential Rotation

1. Provision a secondary database role with equivalent permissions in PostgreSQL.
2. Update application `DATABASE_URL` to point to the new user credentials.
3. Drain existing connection pools and terminate the old database role.
