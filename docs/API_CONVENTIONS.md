# API Conventions & Contracts Specification

This document defines the canonical HTTP REST and API contracts for the Nazar platform. All frontend clients (React Native mobile, Vite admin web), worker processes, and internal microservices strictly adhere to these conventions.

---

## 1. Protocol & Baseline Conventions

- **Transport**: HTTPS / JSON (HTTP/2 enabled in production)
- **API Versioning**: Prefix path versioning (canonical `/v1/` prefix)
- **Root Operational Probes**: Unversioned `/health` and `/ready` are exposed at root for container orchestrators (Kubernetes / ECS).
- **Documentation**: OpenAPI 3.0 / Swagger UI exposed at `/docs/`.

---

## 2. Response Envelopes

Every JSON response returned by the backend conforms to standard response envelopes. Clients never receive raw, unstructured JSON payloads.

### 2.1 Standard Success Envelope (`ApiSuccessEnvelope<T>`)

```json
{
  "success": true,
  "data": {
    "id": "01a0e628-ef6a-7000-9e2e-cf568bf14d37",
    "name": "Alex"
  },
  "requestId": "01a0e628-ef6a-7000-9e2e-cf568bf14d37"
}
```

### 2.2 Cursor-Based Paginated Envelope (`ApiPaginatedEnvelope<T>`)

High-volume collections (profiles, discovery feeds, messages, interaction logs) use forward/backward cursor pagination rather than offset/limit:

```json
{
  "success": true,
  "data": [
    { "id": "01a0e628-ef6a-7000-9e2e-cf568bf14d37" },
    { "id": "01a0e628-ef70-7000-8431-fe39105ca912" }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "eyJsYXN0SWQiOiIwMWEwZTYyOC1lZjcwLTcwMDAtODQzMS1mZTM5MTA1Y2E5MTIifQ==",
    "prevCursor": null
  },
  "requestId": "01a0e628-ef6a-7000-9e2e-cf568bf14d37"
}
```

### 2.3 Failure Envelope (`ApiFailureEnvelope`)

All errors—whether raised from business rules, validation failures, database errors, or uncaught exceptions—are captured by `GlobalExceptionFilter` and translated to the failure envelope:

```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "code": "VALIDATION_ERROR",
    "message": "Request payload failed schema validation",
    "details": [
      {
        "field": "age",
        "message": "Number must be greater than or equal to 18",
        "code": "too_small"
      }
    ],
    "path": "/v1/users/profile",
    "timestamp": "2026-09-28T03:57:17.556Z"
  },
  "requestId": "01a0e628-ef6a-7000-9e2e-cf568bf14d37"
}
```

> **Security Note**: In production (`NODE_ENV === 'production'`), internal error messages are sanitized to `Internal server error`, and `stack` properties are completely suppressed from the client envelope.

---

## 3. Standard Error Codes

The canonical error codes declared in `@platform/api-contracts`:

| Error Code              | HTTP Status | Meaning                                                          |
| :---------------------- | :---------- | :--------------------------------------------------------------- |
| `BAD_REQUEST`           | 400         | Malformed request or illegal payload (e.g. prototype pollution)  |
| `VALIDATION_ERROR`      | 400         | Request payload schema validation failed (details populated)     |
| `UNAUTHORIZED`          | 401         | Missing, expired, or invalid authentication credentials          |
| `FORBIDDEN`             | 403         | Authenticated user lacks permission or ownership                 |
| `NOT_FOUND`             | 404         | Requested route or entity not found                              |
| `CONFLICT`              | 409         | Resource state conflict (e.g. unique constraint violated)        |
| `IDEMPOTENCY_CONFLICT`  | 409         | Mutation with same idempotency key is already actively executing |
| `PRECONDITION_FAILED`   | 412         | Precondition or optimistic lock condition violated               |
| `RATE_LIMITED`          | 429         | Rate limit exceeded                                              |
| `INTERNAL_SERVER_ERROR` | 500         | Unhandled internal backend server failure                        |
| `SERVICE_UNAVAILABLE`   | 503         | Subsystem or dependency failure rendering service unavailable    |

---

## 4. Request Tracing & Correlation

- **Header**: `x-request-id`
- **Format**: UUIDv7 (timestamp-ordered UUID)
- **Lifecycle**:
  1. `RequestIdMiddleware` inspects the incoming `x-request-id` header.
  2. If a valid alphanumeric ID is present, it is preserved.
  3. If missing or invalid, a new UUIDv7 is generated via `@platform/domain`.
  4. The request ID is bound to Node.js `AsyncLocalStorage` via `RequestContextService`.
  5. The request ID is attached to the outgoing response header and injected into the response envelope.
  6. All structured log entries automatically print the active `requestId`.

---

## 5. Idempotency Semantics

Critical state mutations (payment charges, swipes/interactions, matches, message dispatch) must be idempotent to protect against network retries and duplicate mobile triggers.

- **Header**: `Idempotency-Key` (e.g., UUID or unique client mutation token)
- **Decorator**: `@Idempotent({ ttlSeconds?: number })`
- **Replay Indicator Header**: `x-idempotent-replayed: true`
- **Mechanism**:
  - `IdempotencyInterceptor` verifies the `Idempotency-Key` header is present.
  - Queries `IIdempotencyStore`.
  - If state is `STARTED`, returns `409 IDEMPOTENCY_CONFLICT`.
  - If state is `COMPLETED`, immediately replays the cached status code and response body with `x-idempotent-replayed: true`.
  - If new, records `STARTED`, executes controller handler, and updates record to `COMPLETED` on response or `FAILED` on exception.

---

## 6. Security Headers & CORS

Configured globally in `main.ts` and `test-app.helper.ts`:

- **Helmet**: Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-DNS-Prefetch-Control: off`, `Strict-Transport-Security`.
- **CORS**:
  - `Access-Control-Allow-Origin`: Explicit configured origin (wildcard prohibited in production).
  - `Access-Control-Allow-Credentials`: `true`.
  - `Access-Control-Expose-Headers`: `x-request-id`, `x-idempotent-replayed`.
