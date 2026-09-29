/**
 * Admin User Investigation & Operations Contract
 */
import type { CursorPaginationQuery } from '../common/pagination.js';

export interface AdminUserSearchQuery extends CursorPaginationQuery {
  readonly query?: string;
  readonly status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DEACTIVATED';
  readonly sort?: 'createdAt' | 'lastActiveAt' | 'reportsCount';
}

export interface AdminUserSummaryDto {
  readonly id: string;
  readonly phoneNumber: string | null;
  readonly email: string | null;
  readonly status: string;
  readonly displayName: string | null;
  readonly gender: string | null;
  readonly birthDate: string | null;
  readonly age: number | null;
  readonly isVerified: boolean;
  readonly reportsCount: number;
  readonly createdAt: string;
  readonly lastActiveAt: string | null;
}

export interface AdminUserDetailDto {
  readonly id: string;
  readonly phoneNumber: string | null;
  readonly email: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly profile: {
    readonly displayName: string | null;
    readonly bio: string | null;
    readonly birthDate: string | null;
    readonly gender: string | null;
    readonly isVisible: boolean;
    readonly isComplete: boolean;
    readonly media: readonly {
      readonly id: string;
      readonly url: string;
      readonly type: string;
      readonly isPrimary: boolean;
    }[];
    readonly prompts: readonly {
      readonly id: string;
      readonly prompt: string;
      readonly answer: string;
    }[];
    readonly interests: readonly string[];
  } | null;
  readonly restrictions: readonly {
    readonly id: string;
    readonly restrictionType: string;
    readonly reason: string;
    readonly expiresAt: string | null;
    readonly isActive: boolean;
    readonly createdAt: string;
  }[];
  readonly recentSessions: readonly {
    readonly id: string;
    readonly ipAddress: string | null;
    readonly userAgent: string | null;
    readonly lastActiveAt: string | null;
    readonly createdAt: string;
    readonly revokedAt: string | null;
  }[];
  readonly safetyStats: {
    readonly blocksReceivedCount: number;
    readonly blocksInitiatedCount: number;
    readonly reportsReceivedCount: number;
    readonly reportsInitiatedCount: number;
    readonly activeModerationCasesCount: number;
  };
  readonly billingSummary: {
    readonly activeSubscriptionsCount: number;
    readonly entitlements: readonly string[];
  };
}

export interface AdminSuspendUserRequest {
  readonly reason: string;
  readonly durationDays?: number; // undefined or 0 for permanent
}

export interface AdminRestoreUserRequest {
  readonly reason: string;
}

export interface AdminRevokeSessionsRequest {
  readonly reason: string;
}

export interface AdminActionResponse {
  readonly success: boolean;
  readonly message: string;
  readonly userId: string;
  readonly action: string;
  readonly auditLogId: string;
}
