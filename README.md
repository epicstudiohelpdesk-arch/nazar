# Nazar - Production Dating & Social Discovery Platform

A production-grade, privacy-centric social discovery and dating platform built with strict architectural invariants and modern engineering practices.

## Architecture

- **Mobile Client**: React Native + Expo + TypeScript + Expo Router
- **State Management**: TanStack Query (Server state) + Zustand (Local state)
- **Backend**: NestJS + Node.js + TypeScript (Modular Monolith)
- **Database & Spatial**: PostgreSQL + PostGIS extension
- **ORM**: Drizzle ORM
- **Cache & Ephemeral State**: Redis 7
- **Object Storage**: Cloudflare R2 / AWS S3 compatible (MinIO for local dev)
- **Real-time**: WebSockets (Socket.io / Native WS)
- **Async Workers**: BullMQ with Transactional Outbox Pattern
- **Contracts & Validation**: Zod + Shared TypeScript contracts (`@nazar/contracts`)

## Repository Structure

```
nazar/
├── apps/
│   ├── api/            # NestJS Backend API & WebSocket Gateway
│   └── mobile/         # React Native Expo Mobile Application
├── packages/
│   └── contracts/      # Shared Zod schemas, DTOs, UUIDv7, error models
├── docker/
│   └── postgres/       # PostgreSQL init scripts (PostGIS, UUID extensions)
├── docs/               # System architecture and engineering gate specifications
├── docker-compose.yml  # Local infrastructure (PostGIS, Redis, MinIO)
└── pnpm-workspace.yaml # Monorepo workspace configuration
```

## Quick Start

### 1. Prerequisites

- Node.js 22+
- pnpm 9+
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
# Build all packages
pnpm build

# Run unit and integration tests
pnpm test

# Typecheck all packages
pnpm typecheck
```

## Core Architectural Invariants

1. **Backend Authoritative**: Mobile client state is untrusted. Entitlements, moderation, verification, matches, and roles are enforced on the backend.
2. **PostgreSQL Source of Truth**: Redis is strictly for cache, pub/sub, and ephemeral state.
3. **Idempotency & UUIDv7**: Time-ordered UUIDv7 identifiers are used for all major entities.
4. **PostGIS**: Spatial geography calculations for proximity discovery.
5. **Decoupled Media**: Object storage for media, presigned upload URLs, never binaries in database.
