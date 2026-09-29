/**
 * Admin Health & Diagnostics Contract
 */

export interface AdminSystemHealthDto {
  readonly status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  readonly timestamp: string;
  readonly uptimeSeconds: number;
  readonly memory: {
    readonly rssMb: number;
    readonly heapTotalMb: number;
    readonly heapUsedMb: number;
  };
  readonly services: {
    readonly database: {
      readonly status: 'UP' | 'DOWN';
      readonly latencyMs: number;
    };
    readonly redis: {
      readonly status: 'UP' | 'DOWN';
      readonly latencyMs: number;
    };
    readonly storage: {
      readonly status: 'UP' | 'DOWN';
    };
    readonly workers: {
      readonly status: 'UP' | 'DOWN';
      readonly pendingJobsCount: number;
    };
  };
}
