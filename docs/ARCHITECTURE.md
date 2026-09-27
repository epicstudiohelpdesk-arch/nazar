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

```
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

## 3. Data Flow & Transaction Integrity

### Mutual Matching Flow (Two-Phase Verification)

1. User A likes User B:
   - Request received with `idempotencyKey` and `targetUserId`.
   - Written to `user_interactions` table with unique constraint on `(actor_user_id, target_user_id)`.
   - Query checks if reciprocal like exists (`actor_user_id = B, target_user_id = A`).
   - If reciprocal like exists:
     - Transaction opens:
       - Match record created in `matches` table (`user1_id < user2_id` deterministic canonical ordering).
       - Outbox event `MATCH_CREATED` enqueued within the same database transaction.
     - Outbox worker consumes event, emits real-time WebSocket notification to both parties, and triggers push notification.

### Chat & Messaging Flow

1. User sends message:
   - Message validated against schema and match authorization.
   - Message persisted in `messages` table with UUIDv7 identifier.
   - Match `last_message_at` updated.
   - Outbox event `MESSAGE_SENT` enqueued for push notification and offline sync.
   - WebSocket broadcasts event to connected room participants.
