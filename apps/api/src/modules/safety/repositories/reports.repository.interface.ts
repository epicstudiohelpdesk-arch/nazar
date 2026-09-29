import type { ReportRow, NewReportRow } from '../../../infrastructure/database/drizzle/schema/reports.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface IReportsRepository {
  createReport(
    data: NewReportRow,
    tx?: DrizzleDatabase
  ): Promise<ReportRow>;

  findReportById(
    reportId: string,
    tx?: DrizzleDatabase
  ): Promise<ReportRow | null>;

  findOpenDuplicate(
    reporterUserId: string,
    targetType: string,
    targetId: string,
    reasonCode: string,
    tx?: DrizzleDatabase
  ): Promise<ReportRow | null>;

  countRecentReportsByReporter(
    reporterUserId: string,
    since: Date,
    tx?: DrizzleDatabase
  ): Promise<number>;

  updateReportStatus(
    reportId: string,
    status: string,
    resolvedAt?: Date,
    tx?: DrizzleDatabase
  ): Promise<ReportRow | null>;
}

export const REPORTS_REPOSITORY_TOKEN = Symbol('IReportsRepository');
