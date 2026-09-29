/**
 * Admin RBAC Contract
 * Canonical Staff Roles and Granular Operational Permissions
 */

export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'TRUST_SAFETY_ADMIN',
  'SUPPORT_AGENT',
  'COMMUNITY_ADMIN',
  'FINANCE_ADMIN',
  'ANALYTICS_ADMIN',
  'READ_ONLY_OPERATOR',
] as const;

export type AdminRoleName = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  // Users
  'users.read',
  'users.suspend',
  'users.restore',
  'users.sessions.revoke',
  'users.delete',

  // Moderation & Safety
  'moderation.read',
  'moderation.assign',
  'moderation.decide',
  'reports.read',
  'reports.resolve',
  'safety.investigate',
  'safety.blocks.read',
  'safety.restrictions.manage',

  // Communities & Events & Social
  'communities.read',
  'communities.manage',
  'events.read',
  'events.manage',
  'posts.moderate',

  // Billing & Entitlements
  'billing.read',
  'subscriptions.read',
  'entitlements.read',
  'entitlements.manage',

  // Diagnostics & System
  'notifications.diagnostics.read',
  'recommendations.diagnostics.read',
  'health.read',
  'jobs.read',
  'analytics.read',
  'analytics.manage',

  // Audit & Security
  'audit.read',
  'security.events.read',

  // Staff & Administration
  'staff.read',
  'staff.manage',
  'roles.manage',

  // Emergency
  'system.break_glass',
] as const;

export type AdminPermissionName = (typeof ADMIN_PERMISSIONS)[number];

export interface AdminRoleDto {
  readonly id: AdminRoleName;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly AdminPermissionName[];
}

export interface AdminPermissionDto {
  readonly id: AdminPermissionName;
  readonly category: string;
  readonly description: string;
}

/**
 * Standard Role-to-Permissions Mapping Matrix
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRoleName, readonly AdminPermissionName[]> = {
  SUPER_ADMIN: [...ADMIN_PERMISSIONS],
  PLATFORM_ADMIN: [
    'users.read',
    'users.sessions.revoke',
    'moderation.read',
    'reports.read',
    'safety.investigate',
    'safety.blocks.read',
    'communities.read',
    'communities.manage',
    'events.read',
    'events.manage',
    'posts.moderate',
    'billing.read',
    'subscriptions.read',
    'entitlements.read',
    'notifications.diagnostics.read',
    'recommendations.diagnostics.read',
    'health.read',
    'jobs.read',
    'analytics.read',
    'audit.read',
    'security.events.read',
    'staff.read',
  ],
  TRUST_SAFETY_ADMIN: [
    'users.read',
    'users.suspend',
    'users.restore',
    'users.sessions.revoke',
    'moderation.read',
    'moderation.assign',
    'moderation.decide',
    'reports.read',
    'reports.resolve',
    'safety.investigate',
    'safety.blocks.read',
    'safety.restrictions.manage',
    'posts.moderate',
    'audit.read',
    'security.events.read',
  ],
  SUPPORT_AGENT: [
    'users.read',
    'users.sessions.revoke',
    'moderation.read',
    'reports.read',
    'safety.investigate',
    'safety.blocks.read',
    'billing.read',
    'subscriptions.read',
    'entitlements.read',
    'audit.read',
  ],
  COMMUNITY_ADMIN: [
    'communities.read',
    'communities.manage',
    'events.read',
    'events.manage',
    'posts.moderate',
    'moderation.read',
    'reports.read',
  ],
  FINANCE_ADMIN: [
    'users.read',
    'billing.read',
    'subscriptions.read',
    'entitlements.read',
    'entitlements.manage',
    'audit.read',
  ],
  ANALYTICS_ADMIN: [
    'health.read',
    'recommendations.diagnostics.read',
    'notifications.diagnostics.read',
    'jobs.read',
    'analytics.read',
    'analytics.manage',
    'audit.read',
  ],
  READ_ONLY_OPERATOR: [
    'users.read',
    'moderation.read',
    'reports.read',
    'communities.read',
    'events.read',
    'billing.read',
    'subscriptions.read',
    'entitlements.read',
    'health.read',
    'jobs.read',
    'analytics.read',
    'audit.read',
    'security.events.read',
  ],
};
