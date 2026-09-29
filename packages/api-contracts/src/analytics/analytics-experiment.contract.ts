/**
 * Analytics Experimentation Contracts (Gate 15)
 */

export interface ExperimentVariantMetricsDto {
  readonly variant: string;
  readonly assignments: number;
  readonly exposures: number;
  readonly conversionEvents: number;
  readonly conversionRate: number;
}

export interface ExperimentSummaryDto {
  readonly experimentId: string;
  readonly name: string;
  readonly version: number;
  readonly status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  readonly variants: string[];
  readonly trafficPercentage: number;
  readonly startAt?: string | null;
  readonly endAt?: string | null;
  readonly createdAt: string;
  readonly variantMetrics: ExperimentVariantMetricsDto[];
}

export interface ExperimentAssignmentDto {
  readonly experimentId: string;
  readonly subjectId: string;
  readonly variant: string;
  readonly assignedAt: string;
}

export interface RecordExperimentExposureDto {
  readonly experimentId: string;
  readonly subjectId: string;
  readonly variant: string;
  readonly properties?: Record<string, unknown>;
}
