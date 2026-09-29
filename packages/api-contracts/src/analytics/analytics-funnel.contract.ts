/**
 * Analytics Funnel & Retention Contracts (Gate 15)
 */

export interface FunnelStepResultDto {
  readonly stepName: string;
  readonly eventName: string;
  readonly count: number;
  readonly conversionRate: number; // percentage of step 0 (or previous step)
  readonly dropOffRate: number; // percentage drop from previous step
}

export interface FunnelResultDto {
  readonly funnelId: string;
  readonly name: string;
  readonly version: number;
  readonly timeWindowSeconds: number;
  readonly steps: FunnelStepResultDto[];
  readonly totalConversionRate: number;
}

export interface FunnelQueryDto {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly platform?: string;
}

export interface RetentionCohortDto {
  readonly cohortDate: string; // 'YYYY-MM-DD'
  readonly cohortSize: number;
  readonly d1Percentage: number;
  readonly d3Percentage: number;
  readonly d7Percentage: number;
  readonly d14Percentage: number;
  readonly d30Percentage: number;
}

export interface RetentionResultDto {
  readonly activationEvent: string;
  readonly returnEvent: string;
  readonly cohorts: RetentionCohortDto[];
}

export interface RetentionQueryDto {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly limit?: number;
}
