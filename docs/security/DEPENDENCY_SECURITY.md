# Nazar Dependency & Supply-Chain Security Audit

## 1. Audit Summary

A full dependency audit was executed across the monorepo using `pnpm audit`.

- **Total Dependencies Scanned**: 12 workspace packages and all transitive production and development dependencies.
- **Critical Severity Vulnerabilities**: **0**
- **High Severity Vulnerabilities**: **0**
- **Moderate Severity Vulnerabilities**: 5 (all confined to dev/tooling dependencies).
- **Low Severity Vulnerabilities**: **0**

---

## 2. Detailed Findings Disposition

### Finding DEP-01: `decode-uri-component` (Moderate)

- **Component**: Transitive dev dependency in Expo / Metro runtime bundling tools (`apps/mobile`).
- **Description**: Potential DoS via malformed URI strings during local bundling.
- **Runtime Impact**: None in production backend or released mobile binaries; only active during local metro bundling.
- **Disposition**: Accepted dev risk; scheduled for upstream patch bump with next major Expo SDK upgrade.

### Finding DEP-02: `vitest` / `@vitest/mocker` (Moderate)

- **Component**: Development test runner framework (`vitest`).
- **Description**: Path traversal vulnerability via redirect mock functionality in test suites.
- **Runtime Impact**: None in production; test runner code is strictly excluded from built artifacts (`dist/`). Nazar test suites do not utilize redirect mock fixtures.
- **Disposition**: Accepted dev risk; will bump to Vitest v4 once supported across monorepo plugins.

---

## 3. Supply-Chain Hardening Policies

1. **Lockfile Integrity**: All dependency installations in CI use `pnpm install --frozen-lockfile` to prevent unexpected transitive resolution changes.
2. **Provenance & Verification**: All internal packages use `@platform/*` scoped namespaces.
3. **No Dynamic Post-Install Scripts**: Arbitrary external install scripts are restricted by pnpm config.
4. **Minimal Base Images**: Production Docker images use official `node:22-alpine` minimal images with non-root runtime users.
