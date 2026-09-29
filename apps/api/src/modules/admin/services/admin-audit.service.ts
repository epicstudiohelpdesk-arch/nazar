import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import crypto from 'node:crypto';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { AdminAuditLogsRepository } from '../repositories/admin-audit-logs.repository.js';
import { securityEvents } from '../../../infrastructure/database/drizzle/schema/security-events.js';
import type {
  AdminAuditLogQuery,
  AdminAuditLogDto,
  AdminSecurityEventQuery,
  AdminSecurityEventDto,
} from '@platform/api-contracts';
import { desc, eq, and, lt } from 'drizzle-orm';
import type { AuthenticatedAdminPrincipal } from '../decorators/current-admin.decorator.js';

export interface LogAdminActionParams {
  readonly actor: AuthenticatedAdminPrincipal;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string | null;
  readonly reason: string;
  readonly previousState?: Record<string, unknown> | null;
  readonly newState?: Record<string, unknown> | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly requestId?: string | null;
  readonly isBreakGlass?: boolean;
}

@Injectable()
export class AdminAuditService {
  constructor(
    @Inject(AdminAuditLogsRepository)
    private readonly auditRepo: AdminAuditLogsRepository,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async logAction(params: LogAdminActionParams): Promise<AdminAuditLogDto> {
    const trimmedReason = params.reason?.trim();
    if (!trimmedReason || trimmedReason.length < 3) {
      throw new BadRequestException(
        'A clear, mandatory reason of at least 3 characters is required for all administrative mutations.'
      );
    }

    const logId = crypto.randomUUID();
    const primaryRole = params.actor.roles[0] || 'ADMIN';

    const row = await this.auditRepo.createLog({
      id: logId,
      actorAdminId: params.actor.adminId,
      actorEmail: params.actor.email,
      actorRole: primaryRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId || null,
      reason: trimmedReason,
      previousState: params.previousState || null,
      newState: params.newState || null,
      metadata: params.metadata || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      requestId: params.requestId || null,
      isBreakGlass: params.isBreakGlass || false,
    });

    return {
      id: row.id,
      actorAdminId: row.actorAdminId,
      actorEmail: row.actorEmail,
      actorRole: row.actorRole,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      reason: row.reason,
      previousState: (row.previousState as Record<string, unknown>) || null,
      newState: (row.newState as Record<string, unknown>) || null,
      metadata: (row.metadata as Record<string, unknown>) || null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      requestId: row.requestId,
      isBreakGlass: row.isBreakGlass,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getAuditLogs(
    query: AdminAuditLogQuery
  ): Promise<{ items: AdminAuditLogDto[]; nextCursor: string | null; hasMore: boolean }> {
    const result = await this.auditRepo.findLogs(query);

    const items: AdminAuditLogDto[] = result.logs.map((row) => ({
      id: row.id,
      actorAdminId: row.actorAdminId,
      actorEmail: row.actorEmail,
      actorRole: row.actorRole,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      reason: row.reason,
      previousState: (row.previousState as Record<string, unknown>) || null,
      newState: (row.newState as Record<string, unknown>) || null,
      metadata: (row.metadata as Record<string, unknown>) || null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      requestId: row.requestId,
      isBreakGlass: row.isBreakGlass,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getSecurityEvents(
    query: AdminSecurityEventQuery
  ): Promise<{ items: AdminSecurityEventDto[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = query.limit || 20;
    const conditions = [];

    if (query.userId) {
      conditions.push(eq(securityEvents.userId, query.userId));
    }
    if (query.eventType) {
      conditions.push(eq(securityEvents.eventType, query.eventType));
    }
    if (query.severity) {
      conditions.push(eq(securityEvents.severity, query.severity));
    }

    if (query.cursor) {
      try {
        const cursorDate = new Date(query.cursor);
        if (!isNaN(cursorDate.getTime())) {
          conditions.push(lt(securityEvents.createdAt, cursorDate));
        }
      } catch {
        // Ignore invalid cursor
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.databaseService.client
      .select()
      .from(securityEvents)
      .where(whereClause)
      .orderBy(desc(securityEvents.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && data.length > 0 ? data[data.length - 1]!.createdAt.toISOString() : null;

    const items: AdminSecurityEventDto[] = data.map((r) => ({
      id: r.id,
      userId: r.userId,
      eventType: r.eventType,
      severity: r.severity,
      details: (r.metadata as Record<string, unknown>) || null,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
