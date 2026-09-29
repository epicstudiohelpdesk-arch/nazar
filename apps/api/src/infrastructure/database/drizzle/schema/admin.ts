import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Admin Users Table
 * Dedicated administrative identities for platform operators and staff.
 * Security Invariant: Admin users are completely segregated from consumer user identities.
 */
export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    mfaSecret: text('mfa_secret'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_admin_users_email').on(table.email),
    index('idx_admin_users_active').on(table.isActive),
  ]
);

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type NewAdminUserRow = typeof adminUsers.$inferInsert;

/**
 * Admin Roles Table
 * Canonical RBAC roles supported by the Nazar Admin & Operations Console.
 */
export const adminRoles = pgTable('admin_roles', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type AdminRoleRow = typeof adminRoles.$inferSelect;
export type NewAdminRoleRow = typeof adminRoles.$inferInsert;

/**
 * Admin Permissions Table
 * Granular permissions governing operational platform capabilities.
 */
export const adminPermissions = pgTable('admin_permissions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  category: varchar('category', { length: 64 }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type AdminPermissionRow = typeof adminPermissions.$inferSelect;
export type NewAdminPermissionRow = typeof adminPermissions.$inferInsert;

/**
 * Admin Role Permissions Junction Table
 */
export const adminRolePermissions = pgTable(
  'admin_role_permissions',
  {
    id: uuid('id').primaryKey(),
    roleId: varchar('role_id', { length: 64 })
      .notNull()
      .references(() => adminRoles.id, { onDelete: 'cascade' }),
    permissionId: varchar('permission_id', { length: 64 })
      .notNull()
      .references(() => adminPermissions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_admin_role_permissions_unique').on(table.roleId, table.permissionId),
    index('idx_admin_role_permissions_role_id').on(table.roleId),
    index('idx_admin_role_permissions_permission_id').on(table.permissionId),
  ]
);

export type AdminRolePermissionRow = typeof adminRolePermissions.$inferSelect;
export type NewAdminRolePermissionRow = typeof adminRolePermissions.$inferInsert;

/**
 * Admin User Roles Junction Table
 */
export const adminUserRoles = pgTable(
  'admin_user_roles',
  {
    id: uuid('id').primaryKey(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    roleId: varchar('role_id', { length: 64 })
      .notNull()
      .references(() => adminRoles.id, { onDelete: 'cascade' }),
    assignedBy: uuid('assigned_by'),
    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_admin_user_roles_unique').on(table.adminUserId, table.roleId),
    index('idx_admin_user_roles_user_id').on(table.adminUserId),
    index('idx_admin_user_roles_role_id').on(table.roleId),
  ]
);

export type AdminUserRoleRow = typeof adminUserRoles.$inferSelect;
export type NewAdminUserRoleRow = typeof adminUserRoles.$inferInsert;

/**
 * Admin Sessions Table
 * Durable session registry supporting admin token validation and revoking.
 */
export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: uuid('id').primaryKey(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    revocationReason: varchar('revocation_reason', { length: 64 }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_admin_sessions_user_id').on(table.adminUserId),
    uniqueIndex('idx_admin_sessions_token_hash').on(table.tokenHash),
  ]
);

export type AdminSessionRow = typeof adminSessions.$inferSelect;
export type NewAdminSessionRow = typeof adminSessions.$inferInsert;

/**
 * Admin Audit Logs Table
 * Append-only immutable administrative audit trail recording every staff operation.
 * Security Invariant: Reason is strictly mandatory on all administrative state mutations.
 */
export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').primaryKey(),
    actorAdminId: uuid('actor_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    actorEmail: varchar('actor_email', { length: 255 }).notNull(),
    actorRole: varchar('actor_role', { length: 64 }),
    action: varchar('action', { length: 128 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }).notNull(),
    resourceId: varchar('resource_id', { length: 128 }),
    reason: text('reason').notNull(),
    previousState: jsonb('previous_state'),
    newState: jsonb('new_state'),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    requestId: varchar('request_id', { length: 64 }),
    isBreakGlass: boolean('is_break_glass').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_admin_audit_created').on(table.createdAt),
    index('idx_admin_audit_actor').on(table.actorAdminId, table.createdAt),
    index('idx_admin_audit_resource').on(table.resourceType, table.resourceId),
    index('idx_admin_audit_action').on(table.action),
  ]
);

export type AdminAuditLogRow = typeof adminAuditLogs.$inferSelect;
export type NewAdminAuditLogRow = typeof adminAuditLogs.$inferInsert;
