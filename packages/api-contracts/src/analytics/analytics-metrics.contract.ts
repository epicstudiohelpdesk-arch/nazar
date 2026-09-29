/**
 * Analytics Metrics & Aggregation Contracts (Gate 15)
 */

export interface DailyMetricDto {
  readonly date: string; // 'YYYY-MM-DD'
  readonly metricName: string;
  readonly dimension: string;
  readonly dimensionValue: string;
  readonly value: number;
  readonly computedAt: string;
}

export interface DailyMetricsQueryDto {
  readonly metricNames?: string[];
  readonly startDate: string; // 'YYYY-MM-DD'
  readonly endDate: string; // 'YYYY-MM-DD'
  readonly dimension?: string;
}

export interface AnalyticsOverviewDto {
  readonly dateRange: {
    readonly startDate: string;
    readonly endDate: string;
  };
  readonly activeUsers: {
    readonly dau: number;
    readonly wau: number;
    readonly mau: number;
  };
  readonly acquisition: {
    readonly newSignups: number;
    readonly profileCompletions: number;
    readonly completionRate: number;
  };
  readonly engagement: {
    readonly likesSent: number;
    readonly passesSent: number;
    readonly matchesCreated: number;
    readonly matchRate: number;
    readonly messagesSent: number;
  };
  readonly monetization: {
    readonly subscriptionsStarted: number;
    readonly subscriptionsRenewed: number;
    readonly paywallViews: number;
    readonly conversionRate: number;
  };
  readonly platformHealth: {
    readonly totalEventsIngested: number;
    readonly totalQuarantined: number;
    readonly totalDuplicates: number;
    readonly lastAggregatedDate: string;
  };
}

export interface AnalyticsPipelineHealthDto {
  readonly status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  readonly totalEventsIngested: number;
  readonly totalQuarantined: number;
  readonly totalDuplicates: number;
  readonly ingestionRatePerMin: number;
  readonly workerLagSeconds: number;
  readonly lastAggregationAt: string | null;
}
