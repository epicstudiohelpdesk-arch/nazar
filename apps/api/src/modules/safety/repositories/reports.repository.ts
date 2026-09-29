import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, sql, gt } from 'drizzle-orm';
import { DatabaseService, type DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import { reports, type ReportRow, type NewReportRow } from '../../../infrastructure/database/drizzle/schema/reports.js';
import type { IReportsRepository } from './reports.repository.interface.js';

@Injectable()
export class ReportsRepository implements IReportsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createReport(
    data: NewReportRow,
    tx?: DrizzleDatabase
  ): Promise<ReportRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(reports).values(data).returning();
    return row!;
  }

  async findReportById(
    reportId: string,
    tx?: DrizzleDatabase
  ): Promise<ReportRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    return row || null;
  }

  async findOpenDuplicate(
    reporterUserId: string,
    targetType: string,
    targetId: string,
    reasonCode: string,
    tx?: DrizzleDatabase
  ): Promise<ReportRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.reporterUserId, reporterUserId),
          eq(reports.targetType, targetType),
          eq(reports.targetId, targetId),
          eq(reports.reasonCode, reasonCode),
          or(eq(reports.status, 'OPEN'), eq(reports.status, 'UNDER_REVIEW'))
        )
      )
      .limit(1);

    return row || null;
  }

  async countRecentReportsByReporter(
    reporterUserId: string,
    since: Date,
    tx?: DrizzleDatabase
  ): Promise<number> {
    const client = this.getClient(tx);
    const [result] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(
        and(
          eq(reports.reporterUserId, reporterUserId),
          gt(reports.createdAt, since)
        )
      );

    return result?.count || 0;
  }

  async updateReportStatus(
    reportId: string,
    status: string,
    resolvedAt?: Date,
    tx?: DrizzleDatabase
  ): Promise<ReportRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(reports)
      .set({
        status,
        updatedAt: new Date(),
        resolvedAt: resolvedAt || null,
      })
      .where(eq(reports.id, reportId))
      .returning();

    return row || null;
  }
}
