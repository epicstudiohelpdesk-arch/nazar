import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  adminRoles,
  adminPermissions,
  adminRolePermissions,
  type AdminRoleRow,
  type AdminPermissionRow,
} from '../../../infrastructure/database/drizzle/schema/admin.js';
import {
  ADMIN_ROLES,
  ADMIN_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type AdminRoleName,
  type AdminPermissionName,
} from '@platform/api-contracts';
import crypto from 'node:crypto';

@Injectable()
export class AdminRolesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async getAllRoles(): Promise<AdminRoleRow[]> {
    return this.databaseService.client.select().from(adminRoles);
  }

  async getAllPermissions(): Promise<AdminPermissionRow[]> {
    return this.databaseService.client.select().from(adminPermissions);
  }

  async getRolePermissions(roleId: string): Promise<AdminPermissionName[]> {
    const rows = await this.databaseService.client
      .select({
        permissionId: adminRolePermissions.permissionId,
      })
      .from(adminRolePermissions)
      .where(eq(adminRolePermissions.roleId, roleId));

    return rows.map((r) => r.permissionId as AdminPermissionName);
  }

  /**
   * Initializes canonical roles and permissions in the database if not present.
   */
  async ensureDefaultRolesAndPermissions(): Promise<void> {
    const db = this.databaseService.client;

    // 1. Ensure permissions
    const existingPermissions = await db.select().from(adminPermissions);
    const existingPermIds = new Set(existingPermissions.map((p) => p.id));

    for (const perm of ADMIN_PERMISSIONS) {
      if (!existingPermIds.has(perm)) {
        const category = perm.split('.')[0] || 'system';
        await db.insert(adminPermissions).values({
          id: perm,
          category,
          description: `Permission allowing ${perm} operation`,
        });
      }
    }

    // 2. Ensure roles
    const existingRoles = await db.select().from(adminRoles);
    const existingRoleIds = new Set(existingRoles.map((r) => r.id));

    const roleDescriptions: Record<AdminRoleName, string> = {
      SUPER_ADMIN: 'Full administrative access and emergency break-glass authority',
      PLATFORM_ADMIN: 'General platform operations and infrastructure management',
      TRUST_SAFETY_ADMIN: 'Safety investigation, moderation cases, and account restrictions',
      SUPPORT_AGENT: 'Customer support, read-only investigation, and session assistance',
      COMMUNITY_ADMIN: 'Community space moderation and event operations',
      FINANCE_ADMIN: 'Subscription management and financial operations',
      ANALYTICS_ADMIN: 'Platform telemetry and recommendation diagnostics',
      READ_ONLY_OPERATOR: 'Platform observation and audit inspection without mutation rights',
    };

    for (const role of ADMIN_ROLES) {
      if (!existingRoleIds.has(role)) {
        await db.insert(adminRoles).values({
          id: role,
          name: role.replace(/_/g, ' '),
          description: roleDescriptions[role] || 'Administrative role',
        });
      }
    }

    // 3. Ensure role-permission mappings
    const existingMappings = await db.select().from(adminRolePermissions);
    const mappingSet = new Set(existingMappings.map((m) => `${m.roleId}:${m.permissionId}`));

    for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const perm of permissions) {
        const key = `${roleName}:${perm}`;
        if (!mappingSet.has(key)) {
          await db.insert(adminRolePermissions).values({
            id: crypto.randomUUID(),
            roleId: roleName,
            permissionId: perm,
          });
          mappingSet.add(key);
        }
      }
    }
  }
}
