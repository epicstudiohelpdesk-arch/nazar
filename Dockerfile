# ==============================================================================
# NAZAR PLATFORM · PRODUCTION HARDENED MULTI-STAGE DOCKERFILE
# ==============================================================================
# Security Hardening:
# - Minimal base image (Alpine Linux)
# - Non-root unprivileged user (node:node UID 1000)
# - Zero embedded secrets, build tools stripped from runtime image
# - Layer caching optimized for pnpm monorepo
# - Built-in container healthcheck
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Base Environment
# ------------------------------------------------------------------------------
FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# ------------------------------------------------------------------------------
# Stage 2: Dependencies & Monorepo Builder
# ------------------------------------------------------------------------------
FROM base AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY workers/ ./workers/

# Install full dependencies
RUN pnpm install --frozen-lockfile

# Copy full source trees
COPY apps/api/ ./apps/api/
COPY apps/admin/ ./apps/admin/

# Build all monorepo packages and apps
RUN pnpm build

# Prune development dependencies for minimal production footprint
RUN pnpm --filter @platform/api --prod deploy /app/pruned-api

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

RUN apk add --no-cache curl ca-certificates dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Security: Create non-root system group & user if not default
USER node

# Copy pruned production deployment from builder
COPY --chown=node:node --from=builder /app/pruned-api /app

# Container Healthcheck (Evaluates process liveness probe)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

EXPOSE 4000

# Dumb-init ensures proper signal handling (SIGTERM, SIGINT) for graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
