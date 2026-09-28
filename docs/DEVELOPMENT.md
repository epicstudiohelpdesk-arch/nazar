# Development Workflow Guide

## Prerequisites

- **Node.js**: `v22.0.0` or higher (verified on Node `v24`)
- **Package Manager**: `pnpm` `v9.0.0` or higher (verified on `11.9.0`)
- **Containers**: Docker and Docker Compose (or local PostgreSQL 16+ with PostGIS and Redis 7+)

## Setup

1. **Clone repository and install dependencies**:

   ```bash
   pnpm install
   ```

2. **Environment configuration**:

   ```bash
   cp .env.example .env
   ```

3. **Start local infrastructure**:
   ```bash
   pnpm docker:up
   ```

## Development Commands

| Command             | Purpose                                                             |
| :------------------ | :------------------------------------------------------------------ |
| `pnpm dev:api`      | Starts the NestJS API application in watch mode                     |
| `pnpm dev:admin`    | Starts the Vite React Admin application on port 3001                |
| `pnpm dev:mobile`   | Starts the Expo React Native Metro bundler                          |
| `pnpm build`        | Compiles all packages and applications via Turborepo                |
| `pnpm typecheck`    | Typechecks all packages and applications with strict compiler rules |
| `pnpm test`         | Runs unit and integration test suites across all packages           |
| `pnpm lint`         | Runs repository-wide ESLint checks                                  |
| `pnpm format`       | Formats all code files with Prettier                                |
| `pnpm format:check` | Verifies formatting compliance without writing changes              |
| `pnpm verify`       | Executes the complete deterministic pre-commit gate verification    |

## Dependency Management Rules

- Add dependencies to specific packages or apps:
  ```bash
  pnpm --filter @platform/api add <pkg>
  pnpm --filter @platform/mobile add <pkg>
  ```
- Add shared devDependencies to the root:
  ```bash
  pnpm add -w -D <pkg>
  ```
- Never bypass package boundaries or create circular imports between workspaces.
