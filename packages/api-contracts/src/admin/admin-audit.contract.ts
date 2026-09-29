/**
 * Admin Audit Trail Contract
 * Append-only immutable administrative audit records and platform security events.
 */
import type { CursorPaginationQuery } from '../common/pagination.js';

export interface AdminAuditLogQuery extends CursorPaginationQuery {
  readonly actorAdminId?: string;
  readonly action?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly isBreakGlass?: boolean;
}

export interface AdminAuditLogDto {
  readonly id: string;
  readonly actorAdminId: string | null;
  readonly actorEmail: string;
  readonly actorRole: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly reason: string;
  readonly previousState: Record<string, unknown> | null;
  readonly newState: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown> | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly requestId: string | null;
  readonly isBreakGlass: boolean;
  readonly createdAt: string;
}

export interface AdminSecurityEventQuery extends CursorPaginationQuery {
  readonly userId?: string;
  readonly eventType?: string;
  readonly severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface AdminSecurityEventDto {
  readonly id: string;
  readonly userId: string | null;
  readonly eventType: string;
  readonly severity: string;
  readonly details: Record<string, unknown> | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
}
