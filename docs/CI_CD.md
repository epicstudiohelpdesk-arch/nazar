# CI/CD Architecture & Pipeline Specification

## Continuous Integration Pipeline

Continuous Integration runs on all pull requests and pushes targeting the `main` branch via GitHub Actions (`.github/workflows/ci.yml`).

### Pipeline Stages

The pipeline executes five deterministic gates in sequence:

1. **Dependency Installation**:
   - Uses `pnpm install --frozen-lockfile` to guarantee exact dependency parity.
   - Restores pnpm store and Turborepo cache for rapid build times.
2. **Linting**:
   - Runs `pnpm lint` across all applications and shared packages using flat ESLint.
   - Enforces unused import removal, strict type import assertions, and architectural boundaries.
3. **Type Checking**:
   - Runs `pnpm typecheck` executing `tsc --noEmit` across all apps, packages, and workers.
   - Strict TypeScript flags enabled (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `useUnknownInCatchVariables`).
4. **Automated Testing**:
   - Runs `pnpm test` invoking Vitest across all workspaces.
   - Must achieve 100% test passing rate.
5. **Build Verification**:
   - Runs `pnpm build` across all packages, applications, and workers.
   - Ensures production bundle compilation succeeds without errors.

## Production Deployment Principles (Future Gates)

- API and Workers will deploy as hardened, non-root Docker containers.
- Mobile client builds are compiled through EAS (Expo Application Services) with pinned dependency profiles.
- Admin console compiles as a static single-page application deployed to Cloudflare Pages.
