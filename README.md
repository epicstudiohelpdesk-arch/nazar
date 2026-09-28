# Nazar - Production Dating & Social Discovery Platform

A production-grade, privacy-centric social discovery and dating platform built with strict architectural invariants and modern engineering practices.

## Architecture

- **Mobile Client**: React Native + Expo + TypeScript + Expo Router (`apps/mobile`)
- **Backend API**: NestJS + Node.js + TypeScript (`apps/api`)
- **Admin Console**: React + TypeScript + Vite (`apps/admin`)
- **Shared Packages**:
  - `@platform/api-contracts`: Standard API envelopes, cursor pagination, error codes, and health contracts
  - `@platform/domain`: Framework-agnostic domain entities, value objects, UUIDv7, and domain events
  - `@platform/config`: Strongly typed and validated server and client configuration loaders
  - `@platform/ui`: Cross-platform design tokens (colors, spacing, typography)
  - `@platform/validation`: Zod schemas, primitive validators, and environment validation helpers
- **Workers**: Asynchronous processing boundaries for media, notifications, moderation, and analytics (`workers/*`)
- **Database & Spatial**: PostgreSQL with PostGIS extension
- **Cache & Ephemeral State**: Redis 7
- **Object Storage**: Cloudflare R2 / AWS S3 compatible (MinIO for local development)

## Repository Structure

```text
/
├── apps/
│   ├── mobile/             # React Native Expo Mobile Application
│   ├── api/                # NestJS Backend API & WebSocket Gateway
│   └── admin/              # React Vite Operations/Admin Console
├── packages/
│   ├── api-contracts/      # DTOs, Envelopes, Error and Pagination contracts
│   ├── domain/             # Entities, Value Objects, Domain Events, UUIDv7
│   ├── config/             # Type-safe environment loaders
│   ├── ui/                 # Design system tokens and styles
│   └── validation/         # Zod schemas and validation helpers
├── workers/
│   ├── media/              # Media processing worker
│   ├── notifications/      # Push notifications worker
│   ├── moderation/         # Content moderation worker
│   └── analytics/          # Metrics ingestion worker
├── infra/
│   └── docker/             # Docker compose and Postgres init scripts
├── docs/                   # Architecture, Development, and CI/CD documentation
├── scripts/                # Verification and operational scripts
└── .github/
    └── workflows/          # GitHub Actions CI pipeline
```

## Quick Start

### 1. Prerequisites

- Node.js `v22.0.0` or higher (verified on Node `v24`)
- pnpm `v9.0.0` or higher (verified on `11.9.0`)
- Docker & Docker Compose (or local PostgreSQL with PostGIS and Redis)

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start Local Infrastructure

```bash
pnpm docker:up
```

### 4. Build and Test

```bash
# Build all workspaces
pnpm build

# Run unit tests across all workspaces
pnpm test

# Typecheck all workspaces
pnpm typecheck

# Check code formatting
pnpm format:check

# Run full gate verification
pnpm verify
```

## Core Architectural Invariants

1. **Backend Authoritative**: Mobile and admin client states are untrusted presentation layers.
2. **PostgreSQL as Durable Store**: Redis is strictly for cache, pub/sub, and ephemeral state.
3. **Application Isolation**: Applications never import from each other; shared logic resides in dedicated packages.
4. **Idempotency & UUIDv7**: Time-ordered UUIDv7 identifiers are used for all major entities.
5. **Decoupled Media**: Object storage for media binaries with presigned upload URLs.
6. **Outbox Pattern**: Asynchronous side effects are handled via transactional outbox records and independent workers.
