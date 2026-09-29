import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, desc, and, sql, lt } from 'drizzle-orm';
import crypto from 'node:crypto';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  moderationCases,
  moderationCaseEvents,
  reports,
  users,
  userRestrictions,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import {
  SESSION_REPOSITORY_TOKEN,
  type ISessionRepository,
} from '../../auth/repositories/session.repository.js';
import { AdminAuditService } from './admin-audit.service.js';
import type { AuthenticatedAdminPrincipal } from '../decorators/current-admin.decorator.js';
import type {
  AdminModerationCaseQuery,
  AdminModerationCaseDto,
  AdminReportQuery,
  AdminReportDto,
  AdminAssignModerationCaseRequest,
  AdminDecideModerationCaseRequest,
  AdminResolveReportRequest,
  AdminModerationDecisionResponse,
} from '@platform/api-contracts';

@Injectable()
export class AdminModerationService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepo: ISessionRepository,
    @Inject(AdminAuditService)
    private readonly adminAuditService: AdminAuditService
  ) {}

  async getModerationCases(
    query: AdminModerationCaseQuery
  ): Promise<{ items: AdminModerationCaseDto[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = query.limit || 20;
    const conditions = [];

    if (query.status) {
      conditions.push(eq(moderationCases.status, query.status));
    }
    if (query.priority) {
      conditions.push(eq(moderationCases.priority, query.priority));
    }
    if (query.assignedAdminId) {
      conditions.push(eq(moderationCases.assignedTo, query.assignedAdminId));
    }

    if (query.cursor) {
      try {
        const cursorDate = new Date(query.cursor);
        if (!isNaN(cursorDate.getTime())) {
          conditions.push(lt(moderationCases.openedAt, cursorDate));
        }
      } catch {
        // Ignore invalid cursor
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const db = this.databaseService.client;

    const rows = await db
      .select()
      .from(moderationCases)
      .where(whereClause)
      .orderBy(desc(moderationCases.openedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && data.length > 0 ? data[data.length - 1]!.openedAt.toISOString() : null;

    // Fetch report counts for each case
    const caseIds = data.map((c) => c.id);
    const reportCountMap = new Map<string, number>();

    if (caseIds.length > 0) {
      const counts = await db
        .select({
          caseId: reports.moderationCaseId,
          count: sql<number>`count(*)::int`,
        })
        .from(reports)
        .where(sql`${reports.moderationCaseId} IN ${caseIds}`)
        .groupBy(reports.moderationCaseId);

      for (const c of counts) {
        if (c.caseId) {
          reportCountMap.set(c.caseId, Number(c.count));
        }
      }
    }

    const items: AdminModerationCaseDto[] = data.map((row) => ({
      id: row.id,
      subjectType: row.caseType || 'USER',
      subjectId: row.subjectUserId,
      reportedUserId: row.subjectUserId,
      priority: row.priority,
      status: row.status,
      assignedAdminId: row.assignedTo,
      reportCount: reportCountMap.get(row.id) || 1,
      summary: `Case for user ${row.subjectUserId} (${row.caseType})`,
      createdAt: row.openedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    }));

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async getReports(
    query: AdminReportQuery
  ): Promise<{ items: AdminReportDto[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = query.limit || 20;
    const conditions = [];

    if (query.status) {
      conditions.push(eq(reports.status, query.status));
    }
    if (query.targetType) {
      conditions.push(eq(reports.targetType, query.targetType));
    }
    if (query.reportedUserId) {
      conditions.push(eq(reports.targetUserId, query.reportedUserId));
    }

    if (query.cursor) {
      try {
        const cursorDate = new Date(query.cursor);
        if (!isNaN(cursorDate.getTime())) {
          conditions.push(lt(reports.createdAt, cursorDate));
        }
      } catch {
        // Ignore invalid cursor
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const db = this.databaseService.client;

    const rows = await db
      .select()
      .from(reports)
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && data.length > 0 ? data[data.length - 1]!.createdAt.toISOString() : null;

    const items: AdminReportDto[] = data.map((r) => ({
      id: r.id,
      reporterUserId: r.reporterUserId,
      reportedUserId: r.targetUserId || r.targetId,
      targetType: r.targetType,
      targetId: r.targetId,
      reasonCategory: r.reasonCode,
      freeformDetails: r.description,
      status: r.status,
      resolutionAction: null,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async assignCase(
    caseId: string,
    input: AdminAssignModerationCaseRequest,
    actor: AuthenticatedAdminPrincipal,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<AdminModerationDecisionResponse> {
    const db = this.databaseService.client;
    const caseRows = await db
      .select()
      .from(moderationCases)
      .where(eq(moderationCases.id, caseId))
      .limit(1);
    const modCase = caseRows[0];
    if (!modCase) {
      throw new NotFoundException(`Moderation case ${caseId} not found`);
    }

    await db
      .update(moderationCases)
      .set({
        assignedTo: input.assignedAdminId,
        status: 'UNDER_REVIEW',
        updatedAt: new Date(),
      })
      .where(eq(moderationCases.id, caseId));

    await db.insert(moderationCaseEvents).values({
      id: crypto.randomUUID(),
      caseId,
      eventType: 'CASE_ASSIGNED',
      actorUserId: actor.adminId,
      payload: { assignedTo: input.assignedAdminId, reason: input.reason },
    });

    const audit = await this.adminAuditService.logAction({
      actor,
      action: 'MODERATION_CASE_ASSIGN',
      resourceType: 'MODERATION_CASE',
      resourceId: caseId,
      reason: input.reason,
      previousState: { assignedTo: modCase.assignedTo, status: modCase.status },
      newState: { assignedTo: input.assignedAdminId, status: 'UNDER_REVIEW' },
      ipAddress,
      userAgent,
      requestId,
    });

    return {
      success: true,
      caseId,
      action: 'CASE_ASSIGNED',
      status: 'UNDER_REVIEW',
      auditLogId: audit.id,
    };
  }

  async decideCase(
    caseId: string,
    input: AdminDecideModerationCaseRequest,
    actor: AuthenticatedAdminPrincipal,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<AdminModerationDecisionResponse> {
    const db = this.databaseService.client;
    const caseRows = await db
      .select()
      .from(moderationCases)
      .where(eq(moderationCases.id, caseId))
      .limit(1);
    const modCase = caseRows[0];
    if (!modCase) {
      throw new NotFoundException(`Moderation case ${caseId} not found`);
    }

    // 1. Update case status to RESOLVED
    await db
      .update(moderationCases)
      .set({
        status: 'RESOLVED',
        resolutionDecision: input.action,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(moderationCases.id, caseId));

    // 2. Record event in moderation_case_events
    await db.insert(moderationCaseEvents).values({
      id: crypto.randomUUID(),
      caseId,
      eventType: 'DECISION_APPLIED',
      actorUserId: actor.adminId,
      payload: { action: input.action, reason: input.reason, notes: input.notes },
    });

    // 3. Mark linked reports as ACTIONED or DISMISSED
    const newReportStatus = input.action === 'NO_ACTION' ? 'DISMISSED' : 'ACTIONED';
    await db
      .update(reports)
      .set({
        status: newReportStatus,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reports.moderationCaseId, caseId));

    // 4. Enforce account consequences if SUSPEND or BAN
    if (input.action === 'SUSPEND' || input.action === 'BAN') {
      const userStatus = input.action === 'BAN' ? 'BANNED' : 'SUSPENDED';
      await db
        .update(users)
        .set({ status: userStatus, updatedAt: new Date() })
        .where(eq(users.id, modCase.subjectUserId));

      await db.insert(userRestrictions).values({
        id: crypto.randomUUID(),
        userId: modCase.subjectUserId,
        restrictionType: 'FULL_ACCOUNT',
        sourceCaseId: caseId,
        reasonCode: `MODERATION_${input.action}`,
        startsAt: new Date(),
        expiresAt: input.action === 'BAN' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await this.sessionRepo.revokeAllUserSessions(
        modCase.subjectUserId,
        `MODERATION_${input.action}`
      );
    }

    // 5. Log audit trail
    const audit = await this.adminAuditService.logAction({
      actor,
      action: 'MODERATION_CASE_DECIDE',
      resourceType: 'MODERATION_CASE',
      resourceId: caseId,
      reason: input.reason,
      previousState: { status: modCase.status, decision: modCase.resolutionDecision },
      newState: { status: 'RESOLVED', decision: input.action, notes: input.notes },
      ipAddress,
      userAgent,
      requestId,
    });

    return {
      success: true,
      caseId,
      action: input.action,
      status: 'RESOLVED',
      auditLogId: audit.id,
    };
  }

  async resolveReport(
    reportId: string,
    input: AdminResolveReportRequest,
    actor: AuthenticatedAdminPrincipal,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<AdminModerationDecisionResponse> {
    const db = this.databaseService.client;
    const reportRows = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    const report = reportRows[0];
    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found`);
    }

    await db
      .update(reports)
      .set({
        status: input.status,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reports.id, reportId));

    const audit = await this.adminAuditService.logAction({
      actor,
      action: 'REPORT_RESOLVE',
      resourceType: 'REPORT',
      resourceId: reportId,
      reason: input.reason,
      previousState: { status: report.status },
      newState: { status: input.status, resolutionAction: input.resolutionAction || null },
      ipAddress,
      userAgent,
      requestId,
    });

    return {
      success: true,
      caseId: reportId,
      action: input.status,
      status: input.status,
      auditLogId: audit.id,
    };
  }
}
