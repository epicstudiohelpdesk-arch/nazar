import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  adminUsers,
  adminUserRoles,
  adminRolePermissions,
  type AdminUserRow,
  type NewAdminUserRow,
} from '../../../infrastructure/database/drizzle/schema/admin.js';
import type { AdminRoleName, AdminPermissionName } from '@platform/api-contracts';
import crypto from 'node:crypto';

@Injectable()
export class AdminUsersRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async findById(id: string): Promise<AdminUserRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);

    return rows[0] || null;
  }

  async findByEmail(email: string): Promise<AdminUserRow | null> {
    const rows = await this.databaseService.client
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase().trim()))
      .limit(1);

    return rows[0] || null;
  }

  async createAdminUser(data: NewAdminUserRow): Promise<AdminUserRow> {
    const [row] = await this.databaseService.client
      .insert(adminUsers)
      .values({
        ...data,
        email: data.email.toLowerCase().trim(),
      })
      .returning();

    return row!;
  }

  async updateLastLogin(id: string, timestamp: Date): Promise<void> {
    await this.databaseService.client
      .update(adminUsers)
      .set({
        lastLoginAt: timestamp,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, id));
  }

  async deleteAdminUser(id: string): Promise<void> {
    await this.databaseService.client.delete(adminUsers).where(eq(adminUsers.id, id));
  }

  async getUserRoles(adminUserId: string): Promise<AdminRoleName[]> {
    const rows = await this.databaseService.client
      .select({
        roleId: adminUserRoles.roleId,
      })
      .from(adminUserRoles)
      .where(eq(adminUserRoles.adminUserId, adminUserId));

    return rows.map((r) => r.roleId as AdminRoleName);
  }

  async getUserPermissions(adminUserId: string): Promise<AdminPermissionName[]> {
    const roles = await this.getUserRoles(adminUserId);
    if (roles.length === 0) {
      return [];
    }

    const rows = await this.databaseService.client
      .select({
        permissionId: adminRolePermissions.permissionId,
      })
      .from(adminRolePermissions)
      .where(inArray(adminRolePermissions.roleId, roles));

    const permissionSet = new Set<AdminPermissionName>();
    for (const r of rows) {
      permissionSet.add(r.permissionId as AdminPermissionName);
    }

    return Array.from(permissionSet);
  }

  async assignRole(adminUserId: string, roleId: string, assignedBy?: string): Promise<void> {
    await this.databaseService.client
      .insert(adminUserRoles)
      .values({
        id: crypto.randomUUID(),
        adminUserId,
        roleId,
        assignedBy: assignedBy || null,
      })
      .onConflictDoNothing();
  }
}
