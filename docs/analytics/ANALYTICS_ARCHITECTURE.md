# Nazar Analytics & Event Infrastructure: Architecture

## 1. System Overview

The Nazar Analytics & Event Infrastructure (Gate 15) establishes the platform's authoritative telemetry, metric computation, and experimentation substrate. It decouples product analytics from transactional domain flows while avoiding premature microservice complexity or treating transactional PostgreSQL as a raw, unbounded data lake.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT TIER                                      │
│  Mobile App (React Native)                       Admin Console (React Web)      │
│  - AnalyticsClient Bounded Queue                 - AdminClient Analytics SDK    │
│  - Offline Persistence & Auto-flush              - RBAC Protected Queries       │
└───────────────────────┬─────────────────────────────────────────┬───────────────┘
                        │ POST /v1/analytics/events               │ GET /v1/admin/analytics/*
                        ▼                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               API GATEWAY / NESTJS                              │
│  AuthGuard (Authoritative Session Binding)        AdminGuard (analytics.read)   │
│                       │                                         │               │
│                       ▼                                         │               │
│         EventGovernanceService                                  │               │
│         - Name & Version Validation                             │               │
│         - Producer Authority Check                              │               │
│         - Secret & PII Scrubbing                                │               │
│         - Timestamp Skew Validation (Max 7d)                    │               │
│                       │                                         │               │
│         ┌─────────────┴─────────────┐                           │               │
│         │ Valid                     │ Malformed / Spoofed       │               │
│         ▼                           ▼                           │               │
│  AnalyticsEventsRepo      AnalyticsQuarantineRepo               │               │
│  (ON CONFLICT DO NOTHING)                                       │               │
└─────────┬───────────────────────────┬───────────────────────────┼───────────────┘
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL STORAGE                                 │
│  - analytics_events (Raw Events, Bounded 90d Hot Retention)                    │
│  - analytics_event_quarantine (Quarantined Payloads, 14d Retention)             │
│  - analytics_daily_metrics (Precomputed Aggregates & KPIs)                      │
│  - analytics_funnel_definitions & analytics_cohort_definitions                  │
│  - analytics_experiment_definitions, assignments, exposures                     │
└───────────────────────────────▲─────────────────────────────────────────────────┘
                                │
                                │ Scheduled Aggregation & Maintenance
                                │
┌───────────────────────────────┴─────────────────────────────────────────────────┐
│                              ANALYTICS WORKER                                   │
│  workers/analytics                                                              │
│  - Scheduled Daily Rollups (computeDailyMetrics)                                │
│  - Bounded Hot Retention Cleanup (> 90 days)                                    │
│  - Quarantine Cleanup (> 14 days)                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Separation

The platform enforces strict boundaries across three data categories:

1. **Transactional Domain Events**:
   - Emitted within transactional boundaries to `outbox_events`.
   - Guarantee reliable cross-aggregate state synchronization (e.g., match creation, billing state transitions, push notification delivery).
   - Never directly queried by operational analytics dashboards.

2. **Product Analytics Events**:
   - Ingested via `/v1/analytics/events` (client interactions) or recorded directly via `AnalyticsIngestionService.recordServerEvent` (server transactions).
   - Ingestion is asynchronous, batched, and resilient.
   - Bound to an immutable canonical envelope (`eventId`, `eventName`, `occurredAt`, `actorUserId`, `properties`, etc.).
   - Inserted idempotently into `analytics_events` using `ON CONFLICT (event_id) DO NOTHING`.

3. **Aggregated Operational & Business Metrics**:
   - Materialized into `analytics_daily_metrics`.
   - Allows fast, sub-millisecond administrative reporting without scanning millions of raw event rows.
   - Supports multi-dimensional slicing by date, metric name, and dimension keys.

---

## 3. Ingestion Pipeline & Security Controls

### Identity Binding & Anti-Spoofing

- When a request carries a valid Bearer token (`request.user`), `AnalyticsIngestionService` authoritatively overwrites any incoming `actorUserId` in the event envelope with `request.user.id`.
- Unauthenticated requests can only emit events with `actorUserId: null` and an optional client-generated `anonymousId`.
- Any client attempting to forge an `actorUserId` different from the authenticated session is scrubbed to the authoritative session identity.

### Producer Authority Control

- Events are classified as **Server-Authoritative** vs **Client-Permitted**.
- Clients are strictly barred from emitting system-authoritative events:
  - `match.created`, `match.unmatched`
  - `subscription.*`, `entitlement.*`
  - `moderation.*`
  - `admin.*`
- Attempting to emit a server-authoritative event from a client producer immediately routes the event to `analytics_event_quarantine` with error code `UNAUTHORIZED_PRODUCER`.

### Timestamp Skew & Ingestion Boundaries

- `occurredAt` must not be more than 15 minutes in the future (rejects forward-skewed clocks).
- `occurredAt` must not be older than 7 days (rejects stale, unbounded replays).
- `receivedAt` is authoritatively assigned by the server upon ingestion.

### Secret Scrubbing & Privacy Filters

- Incoming property payloads are deeply scanned against sensitive pattern blacklists (passwords, auth bearer tokens, credit card PANs, security codes).
- If prohibited content is detected, the event is rejected and quarantined with `PROHIBITED_PAYLOAD_CONTENT`.

---

## 4. Aggregation & Materialization Engine

The aggregation engine (`AnalyticsAggregationService`) performs precomputation across four primary analytical models:

1. **Daily Metric Rollups**:
   - Precomputes DAU, WAU, MAU, signups, interactions, matches, messages, subscriptions, and revenue.
   - Stored in `analytics_daily_metrics`.
   - Powered by idempotent upserts (`ON CONFLICT (metric_date, metric_name, dimension_key) DO UPDATE`).

2. **Step-by-Step Conversion Funnels**:
   - Evaluates sequenced multi-step user journeys over configurable evaluation windows.
   - Computes unique actor conversions, drop-offs, and step-to-step drop-off percentages.

3. **Cohort Retention Matrices**:
   - Tracks user activation cohorts by registration date.
   - Measures return activity across standardized retention intervals (Day 1, 3, 7, 14, 30).

4. **Experimentation Exposure & Allocation**:
   - Deterministic variant allocation via MurmurHash3 hashing over entity IDs.
   - Exposure logging for un-biased variant conversion tracking.

---

## 5. Future Warehouse & Lakehouse Migration

The architecture is explicitly designed for a friction-free transition to a dedicated data warehouse (BigQuery, Snowflake, or ClickHouse) as traffic expands:

1. **Canonical JSON Envelope**: The `analytics_events` schema directly mirrors standard modern data warehouse event formats.
2. **Read-Only CDC / Batch Export**: An export worker or Debezium CDC pipeline can stream rows from `analytics_events` to Parquet/GCS/S3 without modifying API ingestion contracts.
3. **Partition-Ready Key Structure**: Primary keys and temporal indexes (`occurred_at`, `event_name`) allow native migration to PostgreSQL table partitioning (`PARTITION BY RANGE (occurred_at)`) or warehouse clustering.
