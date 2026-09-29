import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  analyticsDailyMetrics,
  type AnalyticsDailyMetricRow,
} from '../../../infrastructure/database/drizzle/schema/analytics.js';
import { generateUuidV7 } from '@platform/domain';

export interface QueryDailyMetricsParams {
  readonly startDate: string;
  readonly endDate: string;
  readonly metricNames?: string[];
  readonly dimension?: string;
}

@Injectable()
export class AnalyticsMetricsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  /**
   * Upserts a precomputed daily metric row.
   */
  async upsertMetric(
    date: string,
    metricName: string,
    value: number,
    dimension = 'total',
    dimensionValue = 'all'
  ): Promise<void> {
    const id = generateUuidV7();
    await this.db.client
      .insert(analyticsDailyMetrics)
      .values({
        id,
        metricDate: date,
        metricName,
        dimension,
        dimensionValue,
        value,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          analyticsDailyMetrics.metricDate,
          analyticsDailyMetrics.metricName,
          analyticsDailyMetrics.dimension,
          analyticsDailyMetrics.dimensionValue,
        ],
        set: {
          value,
          computedAt: new Date(),
        },
      });
  }

  /**
   * Bulk upserts daily metrics.
   */
  async bulkUpsertMetrics(
    metrics: Array<{
      date: string;
      metricName: string;
      value: number;
      dimension?: string;
      dimensionValue?: string;
    }>
  ): Promise<void> {
    for (const m of metrics) {
      await this.upsertMetric(
        m.date,
        m.metricName,
        m.value,
        m.dimension ?? 'total',
        m.dimensionValue ?? 'all'
      );
    }
  }

  /**
   * Queries metrics across a date range.
   */
  async queryMetrics(params: QueryDailyMetricsParams): Promise<AnalyticsDailyMetricRow[]> {
    const conditions = [
      gte(analyticsDailyMetrics.metricDate, params.startDate),
      lte(analyticsDailyMetrics.metricDate, params.endDate),
    ];

    if (params.metricNames && params.metricNames.length > 0) {
      conditions.push(inArray(analyticsDailyMetrics.metricName, params.metricNames));
    }
    if (params.dimension) {
      conditions.push(eq(analyticsDailyMetrics.dimension, params.dimension));
    }

    return this.db.client
      .select()
      .from(analyticsDailyMetrics)
      .where(and(...conditions))
      .orderBy(analyticsDailyMetrics.metricDate, analyticsDailyMetrics.metricName);
  }

  /**
   * Fetches latest aggregated date.
   */
  async getLatestAggregatedDate(): Promise<string | null> {
    const row = await this.db.client
      .select({ maxDate: sql<string>`MAX(${analyticsDailyMetrics.metricDate})` })
      .from(analyticsDailyMetrics);

    return row[0]?.maxDate ?? null;
  }
}
