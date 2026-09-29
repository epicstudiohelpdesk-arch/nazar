import { Injectable, Inject } from '@nestjs/common';
import { desc, eq, and, lt } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  adminAuditLogs,
  type AdminAuditLogRow,
  type NewAdminAuditLogRow,
} from '../../../infrastructure/database/drizzle/schema/admin.js';
import type { AdminAuditLogQuery } from '@platform/api-contracts';

@Injectable()
export class AdminAuditLogsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async createLog(data: NewAdminAuditLogRow): Promise<AdminAuditLogRow> {
    const [row] = await this.databaseService.client.insert(adminAuditLogs).values(data).returning();
    return row!;
  }

  async findLogs(
    query: AdminAuditLogQuery
  ): Promise<{ logs: AdminAuditLogRow[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = query.limit || 20;
    const conditions = [];

    if (query.actorAdminId) {
      conditions.push(eq(adminAuditLogs.actorAdminId, query.actorAdminId));
    }
    if (query.action) {
      conditions.push(eq(adminAuditLogs.action, query.action));
    }
    if (query.resourceType) {
      conditions.push(eq(adminAuditLogs.resourceType, query.resourceType));
    }
    if (query.resourceId) {
      conditions.push(eq(adminAuditLogs.resourceId, query.resourceId));
    }
    if (query.isBreakGlass !== undefined) {
      conditions.push(eq(adminAuditLogs.isBreakGlass, query.isBreakGlass));
    }

    if (query.cursor) {
      // Decode cursor timestamp
      try {
        const cursorDate = new Date(query.cursor);
        if (!isNaN(cursorDate.getTime())) {
          conditions.push(lt(adminAuditLogs.createdAt, cursorDate));
        }
      } catch {
        // Ignore invalid cursor
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.databaseService.client
      .select()
      .from(adminAuditLogs)
      .where(whereClause)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const logs = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && logs.length > 0 ? logs[logs.length - 1]!.createdAt.toISOString() : null;

    return {
      logs,
      nextCursor,
      hasMore,
    };
  }
}
