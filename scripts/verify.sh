#!/bin/bash
set -euo pipefail

echo "==========================================="
echo "  NAZAR GATE 01 - SYSTEM VERIFICATION"
echo "==========================================="

echo ">> 1. Checking formatting with Prettier..."
pnpm format:check

echo ">> 2. Running TypeScript typechecks across all workspaces..."
pnpm typecheck

echo ">> 3. Executing automated test suites across all packages and apps..."
pnpm test

echo ">> 4. Building all packages, workers, and applications..."
pnpm build

echo ">> 5. Linting workspaces..."
pnpm lint

echo "==========================================="
echo "  GATE 01 VERIFICATION SUCCESSFUL"
echo "==========================================="
