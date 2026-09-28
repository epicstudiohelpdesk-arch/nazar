# Repository Structure

Nazar is organized as a high-integrity `pnpm` monorepo enforcing modular application and package boundaries.

## Top-Level Layout

```text
/
├── apps/
│   ├── mobile/             # React Native + Expo + TypeScript (User discovery app)
│   ├── api/                # NestJS + Node.js + TypeScript (Backend API & WebSockets)
│   └── admin/              # React + Vite + TypeScript (Operations & Moderation console)
│
├── packages/
│   ├── api-contracts/      # HTTP/WS DTOs, Envelopes, Pagination & Error schemas
│   ├── domain/             # Framework-agnostic Domain Entities, Value Objects, Events
│   ├── config/             # Type-safe environment loaders & centralized configurations
│   ├── ui/                 # Shared cross-platform design tokens (colors, spacing, type)
│   └── validation/         # Zod schemas, primitive validation & parsing helpers
│
├── workers/
│   ├── media/              # Media processing & thumbnail generation worker
│   ├── notifications/      # Push notifications (FCM/APNs) & email worker
│   ├── moderation/         # AI vision/text moderation worker
│   └── analytics/          # Metric ingestion & feed analytics worker
│
├── infra/
│   └── docker/             # Docker Compose (PostGIS, Redis, MinIO) & DB init scripts
│
├── docs/                   # System architecture, developer guides, CI/CD specs
│
├── scripts/                # Verification and operational helper scripts
│
├── .github/
│   └── workflows/          # GitHub Actions CI/CD automation pipelines
│
├── package.json            # Monorepo root workspace scripts
├── pnpm-workspace.yaml     # pnpm workspace definition
├── tsconfig.base.json      # Strict TypeScript compiler baseline
├── eslint.config.mjs       # Repository-wide flat ESLint configuration
├── prettier.config.mjs     # Repository-wide code formatting rules
├── .editorconfig           # Editor whitespace and encoding standards
└── README.md               # Primary project documentation and quickstart
```

## Architectural Isolation Invariants

1. **Applications are Isolated**:
   - `apps/mobile` never imports from `apps/api` or `apps/admin`.
   - `apps/api` never imports from `apps/mobile` or `apps/admin`.
   - Cross-boundary communication occurs exclusively via HTTP REST, WebSockets, or shared packages (`@platform/api-contracts`, `@platform/validation`).
2. **Shared Packages are Purpose-Built**:
   - `@platform/domain` is strictly pure TypeScript with zero framework or database dependencies.
   - `@platform/config` cleanly separates server-side secrets from public client-exposed environment variables.
3. **Workers are Decoupled**:
   - Workers consume events asynchronously from durable queues or outbox records, isolated from direct client request/response cycles.
