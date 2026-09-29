/**
 * Admin Moderation & Reports Contract
 */
import type { CursorPaginationQuery } from '../common/pagination.js';

export interface AdminModerationCaseQuery extends CursorPaginationQuery {
  readonly status?: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'DISMISSED';
  readonly priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly assignedAdminId?: string;
  readonly subjectType?:
    'USER' | 'PROFILE' | 'POST' | 'COMMENT' | 'COMMUNITY' | 'EVENT' | 'MESSAGE';
}

export interface AdminModerationCaseDto {
  readonly id: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly reportedUserId: string | null;
  readonly priority: string;
  readonly status: string;
  readonly assignedAdminId: string | null;
  readonly reportCount: number;
  readonly summary: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
}

export interface AdminReportQuery extends CursorPaginationQuery {
  readonly status?: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  readonly targetType?: 'USER' | 'PROFILE' | 'POST' | 'COMMENT' | 'COMMUNITY' | 'EVENT' | 'MESSAGE';
  readonly reportedUserId?: string;
}

export interface AdminReportDto {
  readonly id: string;
  readonly reporterUserId: string;
  readonly reportedUserId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly reasonCategory: string;
  readonly freeformDetails: string | null;
  readonly status: string;
  readonly resolutionAction: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
}

export interface AdminAssignModerationCaseRequest {
  readonly assignedAdminId: string;
  readonly reason: string;
}

export interface AdminDecideModerationCaseRequest {
  readonly action: 'NO_ACTION' | 'WARNING' | 'SUSPEND' | 'BAN' | 'CONTENT_REMOVAL';
  readonly reason: string;
  readonly notes?: string;
}

export interface AdminResolveReportRequest {
  readonly status: 'RESOLVED' | 'DISMISSED';
  readonly resolutionAction?: string;
  readonly reason: string;
}

export interface AdminModerationDecisionResponse {
  readonly success: boolean;
  readonly caseId: string;
  readonly action: string;
  readonly status: string;
  readonly auditLogId: string;
}
