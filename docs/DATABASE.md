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
- `security_events`: Tracks security-relevant occurrences (failed logins, rate limit breaches, token revocations, privilege escalations).

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
