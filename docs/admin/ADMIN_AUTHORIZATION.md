# Admin Authorization Architecture (Gate 14)

## 1. Dual Guard Architecture & Credential Segregation

Nazar enforces strict, zero-trust credential segregation between regular platform users and administrative operators. Administrative credentials and regular user credentials cannot be used interchangeably.

```text
                     Incoming Request
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
        /v1/admin/* Routes         All Other Routes
               │                         │
               ▼                         ▼
        AdminAuthGuard               AuthGuard
        (apps/api/src/common/       (apps/api/src/common/
        guards/admin-auth.guard)    guards/auth.guard)
               │                         │
     Requires scope: "admin"    Skips /v1/admin/* routes
     Checks admin_sessions       Requires consumer session
```

### Key Security Invariants

1. **Consumer Tokens Rejected on Admin Endpoints**: Consumer JWTs lack `scope: 'admin'`. When passed to `/v1/admin/*`, `AdminAuthGuard` immediately rejects the request with HTTP 401 Unauthorized.
2. **Admin Tokens Rejected on Consumer Endpoints**: Admin tokens have `scope: 'admin'`. When passed to consumer API endpoints, consumer `AuthGuard` queries the consumer `sessions` table (where the admin session token hash does not exist) and rejects the request with HTTP 401 Unauthorized.
3. **No Cross-Contamination**: Consumer identities reside in `users` and `user_identities`; admin operators reside strictly in `admin_users`.

---

## 2. Guard Pipeline

Protected admin endpoints pass through a two-stage guard pipeline:

```text
Request ──► AdminAuthGuard ──► AdminPermissionsGuard ──► Route Handler
```

### Stage 1: `AdminAuthGuard`

1. Extracts Bearer token from the `Authorization` header.
2. Verifies the JWT signature using the server's configured secret.
3. Asserts `payload.scope === 'admin'`.
4. Computes the SHA-256 hash of the token: `crypto.createHash('sha256').update(token).digest('hex')`.
5. Queries `admin_sessions` using the token hash.
6. Validates that:
   - The session exists.
   - `session.revokedAt` is `null`.
   - `session.expiresAt` is in the future.
7. Fetches the operator's record from `admin_users` and verifies `isActive === true`.
8. Fetches all assigned roles from `admin_user_roles` and queries `admin_role_permissions` to aggregate the full set of granted permissions.
9. Attaches the `AuthenticatedAdminPrincipal` to `request.admin`:
   ```typescript
   export interface AuthenticatedAdminPrincipal {
     adminUserId: string;
     email: string;
     displayName: string;
     roles: string[];
     permissions: string[];
     sessionId: string;
   }
   ```

### Stage 2: `AdminPermissionsGuard`

1. Inspects the route handler for metadata attached via `@RequirePermissions(...)`.
2. If no permissions are specified, access is granted to any authenticated admin.
3. If permissions are specified, verifies that the admin principal's `permissions` array contains **all** required permissions (or `*`).
4. If missing any required permission, throws `ForbiddenException` (HTTP 403 Forbidden) with a structured error response:
   ```json
   {
     "error": "Forbidden",
     "message": "Missing required administrative permission(s): users.suspend",
     "statusCode": 403
   }
   ```

---

## 3. Decorator Usage

### `@RequirePermissions(...permissions: string[])`

Declares permission requirements on controllers or individual route handlers.

```typescript
@Controller('v1/admin/users')
@UseGuards(AdminAuthGuard, AdminPermissionsGuard)
export class AdminUsersController {

  @Get(':id')
  @RequirePermissions('users.read')
  async inspectUser(@Param('id') userId: string) { ... }

  @Post(':id/suspend')
  @RequirePermissions('users.suspend')
  async suspendUser(
    @Param('id') userId: string,
    @Body() dto: SuspendUserDto,
    @CurrentAdmin() admin: AuthenticatedAdminPrincipal,
  ) { ... }
}
```

### `@CurrentAdmin()`

Extracts the validated `AuthenticatedAdminPrincipal` directly from the request object for audit logging and contextual processing.

---

## 4. Session Invalidation & Revocation

- **Explicit Logout**: `POST /v1/admin/auth/logout` sets `revokedAt = NOW()` on the active session in `admin_sessions`.
- **Operator Deactivation**: Setting `isActive = false` on `admin_users` immediately invalidates all active sessions for that operator, as `AdminAuthGuard` validates `isActive` on every request.
- **TTL Expiry**: Admin JWTs and session records default to a strict 1-hour lifespan (`expiresAt = NOW() + 1 hour`).
