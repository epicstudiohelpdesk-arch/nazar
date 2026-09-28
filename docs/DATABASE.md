# Database Engine, Drizzle ORM & PostGIS Foundation

## 1. Overview & Architecture

The Nazar platform establishes PostgreSQL 16 with PostGIS 3.4 as the authoritative, durable source of truth. All transactional state, aggregate roots, domain events, and audit records reside in PostgreSQL.

- **Primary Database**: PostgreSQL 16.4
- **Spatial Extension**: PostGIS 3.4
- **ORM & Query Layer**: Drizzle ORM (type-safe TypeScript SQL toolkit)
- **Driver**: `node-postgres` (`pg` 8.23.0) with native connection pooling
- **Spatial Coordinate Reference System**: WGS 84 (`SRID 4326`), evaluated using geodesic `geography(Point, 4326)`

```
┌──────────────────────────────────────────────────────────┐
│                   NestJS Application                     │
│  (Controllers -> Application Services -> Repositories)   │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                   DatabaseService                        │
│   • Drizzle ORM Instance (`client` / `drizzle`)          │
│   • Transaction Manager (`withTransaction`)              │
│   • Native Connection Pool (`rawPool` / `dbPool`)        │
│   • Health Check Indicator (`healthCheck`)               │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│             PostgreSQL 16 + PostGIS 3.4                  │
│   • Foundational relational tables (UUIDv7 PKs)          │
│   • PostGIS spherical geodesic functions (SRID 4326)     │
│   • Transactional outbox for event durability            │
│   • Composite primary key idempotency store              │
│   • Drizzle migration journal (`drizzle` schema)         │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Foundational Schemas

Gate 03 implements foundational persistence schemas. No speculative domain tables (profiles, swipes, chats, matches) are implemented ahead of their designated gates.

### 2.1 `users`

Authoritative user identity root:

- `id` (`uuid`, PK): UUIDv7 monotonically increasing identifier.
- `status` (`varchar(32)`): Account state (`active`, `suspended`, `deleted`, `pending_verification`).
- `metadata` (`jsonb`): Extensible metadata payload.
- `created_at`, `updated_at`: UTC timestamps.
- `deleted_at`: Soft-deletion timestamp.

### 2.2 `devices`

Client installation tracking:

- `id` (`uuid`, PK): UUIDv7.
- `user_id` (`uuid`, FK -> `users.id`, `ON DELETE CASCADE`): Associated user.
- `platform` (`varchar(16)`): Client platform (`ios`, `android`, `web`).
- `device_model`, `os_version`, `app_version`: Device metadata.
- `push_token`: FCM / APNs device token.
- `last_active_at`: Last seen timestamp.

### 2.3 `sessions`

Authentication session records:

- `id` (`uuid`, PK): UUIDv7.
- `user_id` (`uuid`, FK -> `users.id`, `ON DELETE CASCADE`).
- `device_id` (`uuid`, FK -> `devices.id`, `ON DELETE SET NULL`).
- `token_hash` (`varchar(64)`): SHA-256 hash of refresh token (plaintext is never stored).
- `ip_address`, `user_agent`: Client session context.
- `expires_at`, `revoked_at`: Session validity timestamps.

### 2.4 `idempotency_keys`

Durable API mutation idempotency:

- `(scope, key)` (Composite PK): Supports per-user or global scoping.
- `request_fingerprint` (`varchar(64)`): SHA-256 hash of `HTTP_METHOD:PATH:PAYLOAD` to detect tampering or conflicting payloads.
- `status` (`varchar(16)`): `PENDING` or `COMPLETED`.
- `status_code` (`smallint`): HTTP status code of the completed response.
- `response_payload` (`jsonb`): Cached JSON response body.
- `created_at`, `expires_at`, `completed_at`: TTL management timestamps.

### 2.5 `outbox_events`

Transactional outbox for reliable asynchronous side effects:

- `id` (`uuid`, PK): UUIDv7.
- `event_type` (`varchar(128)`): Canonical domain event identifier.
- `aggregate_type`, `aggregate_id`: Aggregate origin.
- `payload` (`jsonb`): Serialized domain event payload.
- `status` (`varchar(16)`): `PENDING`, `PROCESSING`, `PUBLISHED`, `FAILED`.
- `attempts` (`integer`): Retry count.
- `available_at`, `processed_at`: Scheduling timestamps.
- `last_error` (`text`): Diagnostic error message.

### 2.6 `audit_logs` & `security_events`

Immutable compliance and security auditing:

- `audit_logs`: Records administrative actions, entity mutations, and compliance requests.
- `security_events`: Tracks security-relevant occurrences (failed logins, rate limit breaches, token revocations, privilege escalations, replay detection).

---

## 3. Gate 04 Authentication & Identity Schemas

Gate 04 introduces production tables for identity federation, multi-factor OTP verification, session rotation history, and WebAuthn/passkey support.

### 3.1 `user_identities`

Federated identity providers linked to a canonical user account:

- `id` (`uuid`, PK): UUIDv7.
- `user_id` (`uuid`, FK -> `users.id`, `ON DELETE CASCADE`): Associated canonical user.
- `provider` (`varchar(32)`): Provider type (`PHONE`, `EMAIL`, `GOOGLE`, `APPLE`, `PASSKEY`).
- `provider_subject` (`varchar(255)`): Unique identity key per provider (e.g. E.164 phone, email, Google `sub`, Apple `sub`).
- `email` (`varchar(255)`): Optional associated email.
- `email_verified` (`boolean`): Whether provider verified the email.
- `metadata` (`jsonb`): Provider claims and profile hints.
- Unique constraint: `(provider, provider_subject)`.

### 3.2 `otp_challenges`

Ephemeral verification challenges for Phone OTP and Email:

- `id` (`uuid`, PK): UUIDv7.
- `identifier` (`varchar(255)`): Phone number or email.
- `identifier_type` (`varchar(16)`): `PHONE` or `EMAIL`.
- `otp_hash` (`varchar(64)`): SHA-256 HMAC of 6-digit OTP code.
- `salt` (`varchar(32)`): 16-byte random hex salt per challenge.
- `attempt_count` (`integer`): Number of verification attempts (max 5).
- `max_attempts` (`integer`): 5.
- `expires_at` (`timestamptz`): Challenge expiration timestamp (5 minutes).
- `consumed_at` (`timestamptz`): Timestamp when redeemed (prevents reuse).
- `ip_address`, `device_id`: Request origin context.

### 3.3 `passkeys` & `passkey_challenges`

WebAuthn FIDO2 credentials and assertion challenges:

- `passkeys`:
  - `id` (`uuid`, PK): UUIDv7.
  - `user_id` (`uuid`, FK -> `users.id`, `ON DELETE CASCADE`).
  - `credential_id` (`varchar(255)`, UNIQUE): Base64URL-encoded credential ID.
  - `public_key` (`text`): Base64URL-encoded public key.
  - `counter` (`integer`): Sign counter for clone detection.
  - `aaguid`, `transports`: Authenticator metadata.
- `passkey_challenges`:
  - `id` (`uuid`, PK): UUIDv7.
  - `challenge` (`varchar(255)`, UNIQUE): Ephemeral cryptographic challenge.
  - `user_id` (`uuid`): Bound user (for registration).
  - `purpose` (`varchar(32)`): `registration` or `login`.
  - `expires_at`, `consumed_at`: Challenge lifecycle timestamps.

### 3.4 `session_token_history`

Durable token family ledger for refresh token replay detection:

- `id` (`uuid`, PK): UUIDv7.
- `session_id` (`uuid`, FK -> `sessions.id`, `ON DELETE CASCADE`): Owning session.
- `token_hash` (`varchar(64)`, UNIQUE): SHA-256 digest of invalidated/rotated refresh token.
- `created_at` (`timestamptz`): Invalidation timestamp.

---

## 3. PostGIS Geospatial Engine

Location-based discovery requires accurate distance calculation across the globe.

- **Coordinate System**: WGS 84 (`SRID 4326`).
- **Storage & Computation**: Calculations use `geography(Point, 4326)` for spherical geodesic distance on the Earth's ellipsoid.
- **Geodesic Distance**:
  ```sql
  SELECT ST_Distance(
    ST_SetSRID(ST_MakePoint(lng1, lat1), 4326)::geography,
    ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)::geography
  ) AS distance_meters;
  ```
- **Proximity Filtering**:
  ```sql
  SELECT ST_DWithin(
    location_geography,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
    radius_meters
  );
  ```
- **Indexing**: Future profile location columns will utilize spatial GiST indexes (`USING GIST (location)`).

---

## 4. Connection Pooling & Resource Configuration

Database connection pooling is handled by `pg.Pool` and strictly configured via `@platform/config`:

| Configuration Variable           | Default | Purpose                                    |
| :------------------------------- | :------ | :----------------------------------------- |
| `DATABASE_POOL_MIN`              | `2`     | Minimum idle connections kept warm in pool |
| `DATABASE_POOL_MAX`              | `20`    | Maximum simultaneous database connections  |
| `DATABASE_CONNECTION_TIMEOUT_MS` | `5000`  | Connection acquisition timeout             |
| `DATABASE_IDLE_TIMEOUT_MS`       | `30000` | Inactive connection reclamation timeout    |
| `DATABASE_STATEMENT_TIMEOUT_MS`  | `10000` | Query execution deadline timeout           |

### Lifecycle & Graceful Draining

`DatabaseService` implements `OnApplicationShutdown`. When the NestJS process receives `SIGTERM` or `SIGINT`, it logs shutdown progress and awaits `pool.end()`, draining active queries before exiting cleanly.

---

## 5. Migration System

Migrations are managed with Drizzle Kit and stored as deterministic SQL files in `apps/api/src/infrastructure/database/drizzle/migrations/`.

- **Migration Table**: Drizzle stores migration state in the `drizzle.__drizzle_migrations` table.
- **CLI Scripts**:
  - `pnpm --filter @platform/api db:generate`: Generates SQL migration from schema diffs.
  - `pnpm --filter @platform/api db:migrate`: Executes pending migrations against PostgreSQL.
  - `pnpm --filter @platform/api db:seed`: Seeds development database with deterministic initial data.
  - `pnpm --filter @platform/api db:reset`: Drops all schemas, reapplies migrations from zero, and reseeds.

### Production Guard

Both `db:reset` and `db:seed` verify `NODE_ENV !== 'production'`. Attempting to run either in production immediately throws an unhandled exception, preventing accidental data loss.

---

## 6. Transaction & Unit of Work Boundaries

Transactions are managed through `DatabaseService.withTransaction`:

```typescript
const result = await databaseService.withTransaction(async (tx) => {
  // All operations inside this callback execute in a single ACID transaction.
  const [user] = await tx.insert(users).values(...).returning();
  await tx.insert(outboxEvents).values(...);
  return user;
});
```

- **Automatic Rollback**: Any uncaught exception thrown inside the transaction callback automatically triggers a `ROLLBACK` and bubbles the error up.
- **Unit of Work**: The `IUnitOfWork` interface provides explicit `start()`, `commit()`, and `rollback()` semantics for multi-step coordinator patterns.

---

## 7. Database Driver Error Mapping

Internal database driver errors are mapped to standardized HTTP exceptions by `mapDatabaseError`:

| PostgreSQL Code   | Condition             | Mapped HTTP Exception                          |
| :---------------- | :-------------------- | :--------------------------------------------- |
| `23505`           | Unique violation      | `409 ConflictException`                        |
| `23503`           | Foreign key violation | `400 BadRequestException`                      |
| `23502`           | Not null violation    | `400 BadRequestException` (`VALIDATION_ERROR`) |
| `40001`           | Serialization failure | `409 ConflictException` (retryable)            |
| `08000` / `08006` | Connection loss       | `503 ServiceUnavailableException`              |
| `57014`           | Statement timeout     | `503 ServiceUnavailableException`              |

**Security Guarantee**: Raw SQL queries, table structures, connection parameters, and credentials are never exposed in error responses.

---

## 8. Health & Readiness Decoupling

- **Liveness (`/health`, `/v1/health`)**: Process-level liveness probe. Verifies process responsiveness and memory without performing database queries.
- **Readiness (`/ready`, `/v1/ready`)**: Subsystem readiness probe. Queries PostgreSQL (`SELECT 1 as alive`). If the database connection drops or times out, `/ready` responds with `503 Service Unavailable`, preventing traffic routing while allowing container orchestrators to preserve the container.

---

## 9. Gate 05 Profile, Preferences & Media Schemas

Gate 05 establishes the authoritative dating profile, preferences, taxonomy, and media persistence tables:

### 9.1 `profiles`

- `id` (`uuid`, PK): UUIDv7 identifier.
- `user_id` (`uuid`, FK -> `users.id`, `ON DELETE CASCADE`, UNIQUE): Canonical user account owner.
- `display_name` (`varchar(64)`): Public display name.
- `date_of_birth` (`date`): Private birth date used for authoritative server-side age derivation.
- `gender` (`varchar(32)`): User gender (`MAN`, `WOMAN`, `NON_BINARY`, `OTHER`).
- `bio` (`text`): Self-description (up to 500 chars).
- `occupation`, `education`, `city` (`varchar(128)`): Extended biographical details.
- `country_code` (`varchar(2)`): 2-letter ISO country code.
- `latitude`, `longitude` (`double precision`): Internal coordinates.
- `location` (`geography`): PostGIS 4326 geodesic Point with GiST spatial indexing (`idx_profiles_location_gist`).
- `visibility` (`varchar(32)`): Profile state machine (`DRAFT`, `ACTIVE`, `PAUSED`, `HIDDEN`).
- `completion_status` (`jsonb`): Cached server-calculated completeness metrics.

### 9.2 `profile_preferences`

- `id` (`uuid`, PK): UUIDv7 identifier.
- `user_id` (`uuid`, FK -> `users.id`, `ON DELETE CASCADE`, UNIQUE): Associated user.
- `min_age`, `max_age` (`integer`): Discovery age bounds (18 to 99, `min_age <= max_age`).
- `gender_preferences` (`jsonb`): Array of desired genders.
- `max_distance_km` (`integer`): Discovery radius (1 to 500 km).
- `relationship_intent` (`varchar(32)`): Long term, short term, casual, friendship, etc.

### 9.3 `interests` & `profile_interests`

- `interests`: Curated active taxonomy with unique slug and category.
- `profile_interests`: Composite PK `(profile_id, interest_id)` junction table enabling idempotent complete replacements.

### 9.4 `profile_prompt_definitions` & `profile_prompts`

- `profile_prompt_definitions`: Curated active dating prompts.
- `profile_prompts`: User answers (2 to 500 characters) tied to profile with unique `(profile_id, prompt_definition_id)`.

### 9.5 `profile_media`

- `id` (`uuid`, PK): UUIDv7 identifier.
- `profile_id`, `user_id` (`uuid`, FKs): Profile and user association.
- `object_key` (`varchar(512)`): S3/MinIO storage path.
- `media_type` (`varchar(32)`): `IMAGE` or `VIDEO`.
- `mime_type` (`varchar(64)`): Validated MIME format.
- `status` (`varchar(32)`): `PENDING`, `UPLOADING`, `PROCESSING`, `READY`, `REJECTED`, `DELETED`.
- `position` (`integer`): Display order (0 to 5).
- `is_primary` (`boolean`): Primary avatar flag (enforced single primary photo per profile).
