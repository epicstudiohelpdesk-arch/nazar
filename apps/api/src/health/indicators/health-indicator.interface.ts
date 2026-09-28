import type { ReadinessIndicatorResult } from '@platform/api-contracts';

export interface HealthIndicator {
  readonly name: string;
  check(): Promise<ReadinessIndicatorResult>;
}

export const HEALTH_INDICATOR_TOKEN = Symbol('HealthIndicator');
