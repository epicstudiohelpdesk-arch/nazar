export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResponse {
  readonly status: ServiceHealthStatus;
  readonly service: string;
  readonly version: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}

export interface ReadinessIndicatorResult {
  readonly status: ServiceHealthStatus;
  readonly message?: string;
}

export interface ReadinessCheckResponse {
  readonly status: ServiceHealthStatus;
  readonly service: string;
  readonly version: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
  readonly checks: Readonly<Record<string, ReadinessIndicatorResult>>;
}
