# Nazar Platform Architecture

## 1. Architectural Philosophy & Invariants

Nazar is built as a high-integrity, production-ready dating and social discovery platform.
The architecture enforces strict invariants across data durability, client trust, security, and scalability.

### Core Tenets

1. **Backend Authoritative, Client Untrusted**:
   - The mobile client is an untrusted presentation layer.
   - Entitlements, verification status, moderation status, match generation, and subscription tiers are evaluated and authorized strictly server-side.
2. **PostgreSQL as Durable Source of Truth**:
   - All state transitions (accounts, profiles, swipes, matches, messages, outbox events) are transactionally written to PostgreSQL.
   - Redis is strictly for cache, pub/sub, transient session tracking, and rate limiting; it is never the sole durable store.
3. **Spatial Discovery with PostGIS**:
   - Geolocation is represented using PostGIS spatial geography points (`geography(Point, 4326)`).
   - Candidate discovery queries use spatial indexing (`GIST`) and spherical distance calculations (`ST_DWithin`, `ST_Distance`).
4. **Media Decoupling (Object Storage)**:
   - PostgreSQL never stores media binaries.
   - Cloudflare R2 or S3-compatible storage handles media via presigned upload URLs.
   - Media references are validated, sanitized, and stored as metadata.
5. **Idempotent Mutations & UUIDv7**:
   - All critical write operations (swipes, message sends, profile updates) require client-provided or server-generated UUIDv7 idempotency keys.
   - RFC 9562 UUIDv7 provides time-ordered indexing, eliminating B-Tree index fragmentation while retaining distributed uniqueness.
6. **Outbox Pattern & Asynchronous Side Effects**:
   - Side effects (push notifications, real-time message fanout, analytics, media moderation) are decoupled through an Outbox table and background workers.
7. **Modular Monolith**:
   - Cohesive domain modules (Auth, User/Profile, Discovery, Matching, Chat, Notifications) deployed together to eliminate premature network hops and distributed transaction complexity.

---

## 2. System Topology

```text
+-------------------------------------------------------------+
|                 Mobile Client (Expo / React Native)         |
|  - React Native + Expo Router + TanStack Query + Zustand    |
|  - Shared Contracts & Zod Validation                        |
+------------------------------+------------------------------+
                               |
                   HTTPS REST  |  WSS WebSocket
                               v
+-------------------------------------------------------------+
|           API Layer / Gateway (NestJS Modular Monolith)      |
|  - Auth & Guard Pipelines (JWT Access + Rotating Refresh)   |
|  - Rate Limiter (Redis token bucket)                        |
|  - OpenAPI Contract Documentation                           |
|  - WebSocket Gateway (Presence, Chat, Typing)               |
+------------------------------+------------------------------+
                               |
       +-----------------------+-----------------------+
       |                       |                       |
       v                       v                       v
+---------------+      +---------------+      +---------------+
|  PostgreSQL   |      |     Redis     |      | Cloudflare R2 |
|   + PostGIS   |      |  Cache, Rate  |      |   / S3 Media  |
| Durable Store |      | Limit, Pub/Sub|      | Storage       |
+---------------+      +---------------+      +---------------+
```

---

## 3. Workspace Boundaries & Dependency Flow

```text
+------------------+     +------------------+     +------------------+
|   apps/mobile    |     |     apps/api     |     |    apps/admin    |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         |         +--------------+-------------+          |
         |         |              |             |          |
         v         v              v             v          v
+--------------------+   +----------------+   +--------------------+
|  @platform/ui      |   | @platform/     |   | @platform/         |
|  (Tokens & Styles) |   |  api-contracts |   |  validation        |
+--------------------+   +----------------+   +---------+----------+
                                  |                     |
                                  v                     v
                         +----------------+   +--------------------+
                         | @platform/     |   | @platform/config   |
                         |  domain        |   | (Environment/Safe) |
                         +----------------+   +--------------------+
```

### Invariants:

1. **Zero Cross-Application Imports**: Applications (`apps/*`) never import directly from other applications.
2. **Framework Isolation in Domain**: `@platform/domain` has zero dependencies on NestJS, React, Express, or database drivers.
3. **Secret Hygiene**: Client applications (`apps/mobile`, `apps/admin`) only consume client-safe schemas (`ClientEnv`), never server credentials or secrets.

---

## 4. Architectural Layering & Subsystem Reference

For detailed specifications of the backend application foundation and API contracts established in Gate 02, see:

- [Backend Architecture & Module Structure](file:///Users/subhamdas/Documents/PROJECTS/nazar/docs/BACKEND_ARCHITECTURE.md)
- [Database Engine, Drizzle ORM & PostGIS](file:///Users/subhamdas/Documents/PROJECTS/nazar/docs/DATABASE.md)
- [API Conventions, Response Envelopes & Idempotency](file:///Users/subhamdas/Documents/PROJECTS/nazar/docs/API_CONVENTIONS.md)
- [Engineering Gates Roadmap](file:///Users/subhamdas/Documents/PROJECTS/nazar/docs/GATES.md)
