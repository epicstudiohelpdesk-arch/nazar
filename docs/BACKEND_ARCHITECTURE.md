# Backend Architecture & Engineering Foundation

This document details the architecture, design principles, module boundaries, and cross-cutting layers of the Nazar backend (`apps/api`), established in Gate 02.

---

## 1. High-Level Modular Monolith Design

The backend is built as an authoritative **Modular Monolith** using NestJS and TypeScript.

```text
[Mobile Client (RN/Expo)]     [Admin Web (Vite)]
             \                      /
              \                    /
        [Ingress / WAF / Cloudflare CDN]
                      │
           [NestJS API (apps/api)]
   ┌──────────────────┴──────────────────┐
   │ Global Filters, Pipes & Interceptors │
   ├──────────────────┬──────────────────┤
   │ Cross-Cutting    │ Domain Modules   │
   │  • RequestContext│  • Auth          │
   │  • Structured Log│  • Users         │
   │  • Idempotency   │  • Profiles      │
   │  • Throttler     │  • Discovery     │
   │  • Health/Ready  │  • Interactions  │
   │                  │  • Matches       │
   │                  │  • Chat          │
   │                  │  • Safety        │
   │                  │  • Notifications │
   │                  │  • Payments      │
   │                  │  • Social        │
   │                  │  • Admin         │
   └──────────────────┴──────────────────┘
                      │
           [Infrastructure Interfaces]
   ┌──────────┬──────────┬──────────┬──────────┐
   │ Database │  Cache   │  Queue   │ Storage  │
   │(Postgres)│ (Redis)  │(BullMQ)  │   (S3)   │
   └──────────┴──────────┴──────────┴──────────┘
```

---

## 2. Cross-Cutting Foundation Layers

### 2.1 Request Context & Tracing

- **AsyncLocalStorage**: Encapsulated within `RequestContextService`.
- **RequestIdMiddleware**: Automatically validates or assigns a UUIDv7 to incoming requests, injecting it into the context and response headers (`x-request-id`).
- All loggers, interceptors, and error handlers automatically pull the current `requestId` without manual parameter plumbing.

### 2.2 Structured JSON Logging (`AppLoggerService`)

- Formats all logs as single-line JSON with standard fields: `timestamp`, `level`, `service`, `environment`, `requestId`, `context`, `message`.
- Automatic recursive redaction of sensitive keys (`password`, `token`, `authorization`, `secret`, `otp`, `cookie`, `cvv`, etc.).

### 2.3 Global Exception Filter (`GlobalExceptionFilter`)

- Catches all exceptions, including unhandled errors and NestJS `HttpException` instances.
- Translates them into the canonical `ApiFailureEnvelope`.
- Suppresses stack traces and raw error messages in production.

### 2.4 Validation Pipeline (`AppValidationPipe`)

- Deep prototype pollution protection checking own properties for `__proto__`, `constructor`, and `prototype`.
- Executes Zod schema validation and transforms errors into structured `FieldValidationError[]`.

### 2.5 Idempotency Guarding (`IdempotencyInterceptor`)

- Applies to state mutations decorated with `@Idempotent()`.
- Enforces presence of `Idempotency-Key` header.
- Manages `STARTED`, `COMPLETED`, and `FAILED` states.
- Replays cached responses with `x-idempotent-replayed: true`.

### 2.6 Rate Limiting (`AppThrottlerGuard`)

- Integrates with `@nestjs/throttler` to enforce request limits per IP/client.
- Returns canonical `429 RATE_LIMITED` response envelopes.

### 2.7 Health & Readiness Probes

- Root endpoints: `/health` (liveness), `/ready` (readiness).
- Versioned endpoints: `/v1/health`, `/v1/ready`.
- Pluggable `HealthIndicator` interface with `ProcessHealthIndicator` monitoring memory limits.

---

## 3. Infrastructure Inversion of Control

To avoid coupling business domain logic directly to specific database drivers or vendor SDKs, Gate 02 introduces abstraction contracts in `src/infrastructure/`:

- `IDatabaseConnection`: Abstraction for SQL querying and transactional unit-of-work.
- `ICacheStore`: Abstraction for key-value caching, TTLs, and invalidation.
- `IObjectStorage`: Abstraction for pre-signed URLs, uploads, downloads, and deletions.
- `IJobQueue`: Abstraction for background job enqueueing and processing.
- `IEventBus`: Abstraction for domain event publishing and subscription.
- `IClock`: Injectable system clock (`SystemClock`) to enable deterministic time testing.
- `IIdGenerator`: Injectable UUIDv7 generator (`UuidV7GeneratorService`).

Concrete database schemas (PostgreSQL / Drizzle ORM), cache implementations (Redis), and queue workers will be implemented in subsequent gates.

---

## 4. Domain Module Boundaries

All product functionality is structured into explicit, decoupled modules under `src/modules/`:

| Module                  | Scope / Future Responsibility                             |
| :---------------------- | :-------------------------------------------------------- |
| `AuthModule`            | Authentication, OTP, OAuth, session management            |
| `UsersModule`           | User account lifecycle and settings                       |
| `ProfilesModule`        | Profile attributes, photos, bio, preferences              |
| `DiscoveryModule`       | Candidate card generation, geospatial discovery           |
| `InteractionsModule`    | Swipes, likes, passes, superlikes                         |
| `MatchesModule`         | Match creation, unmatching, match state machine           |
| `ChatModule`            | Real-time messaging, WebSocket gateways, chat persistence |
| `SafetyModule`          | User reports, blocks, safety screening                    |
| `NotificationsModule`   | Push notifications, FCM/APNs integration                  |
| `PaymentsModule`        | Subscriptions, in-app purchases, entitlement checks       |
| `SocialModule`          | Social feed, posts, discovery feed extensions             |
| `RecommendationsModule` | Recommendation scoring and matching algorithms            |
| `AdminModule`           | Operational and moderation endpoints                      |
