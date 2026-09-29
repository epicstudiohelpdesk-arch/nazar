/**
 * Admin Platform Operations Contract
 * Platform metrics, communities, events, billing overview, diagnostics, background jobs.
 */

export interface AdminDashboardMetricsDto {
  readonly users: {
    readonly totalCount: number;
    readonly activeTodayCount: number;
    readonly suspendedCount: number;
    readonly newLast24hCount: number;
  };
  readonly safety: {
    readonly openCasesCount: number;
    readonly criticalCasesCount: number;
    readonly pendingReportsCount: number;
    readonly totalReports24h: number;
  };
  readonly billing: {
    readonly activeSubscriptionsCount: number;
    readonly revenueCentsTotal: number;
  };
  readonly social: {
    readonly totalCommunitiesCount: number;
    readonly totalEventsCount: number;
    readonly totalPostsCount: number;
  };
  readonly system: {
    readonly status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    readonly pendingOutboxCount: number;
    readonly failedNotificationJobsCount: number;
  };
}

export interface AdminCommunitySummaryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly privacy: string;
  readonly memberCount: number;
  readonly creatorId: string;
  readonly createdAt: string;
}

export interface AdminEventSummaryDto {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly type: string;
  readonly capacity: number | null;
  readonly attendeeCount: number;
  readonly startAt: string;
  readonly endAt: string;
  readonly communityId: string | null;
  readonly organizerId: string;
  readonly createdAt: string;
}

export interface AdminNotificationJobDto {
  readonly id: string;
  readonly notificationId: string;
  readonly provider: string;
  readonly status: string;
  readonly attemptCount: number;
  readonly lastAttemptAt: string | null;
  readonly lastErrorMessage: string | null;
  readonly createdAt: string;
}

export interface AdminOutboxJobDto {
  readonly id: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly status: string;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly createdAt: string;
}

export interface AdminRecommendationDiagnosticsDto {
  readonly activeModelVersions: readonly {
    readonly id: string;
    readonly version: string;
    readonly mode: string;
    readonly rolloutPercentage: number;
  }[];
  readonly exposuresLast24hCount: number;
  readonly featuresCoverageCount: number;
}
