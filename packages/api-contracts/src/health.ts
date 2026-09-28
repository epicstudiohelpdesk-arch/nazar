export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResponse {
  readonly status: ServiceHealthStatus;
  readonly service: string;
  readonly version: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}
