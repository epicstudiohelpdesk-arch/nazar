export type IdempotencyStatus = 'STARTED' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord<T = unknown> {
  readonly key: string;
  readonly scope?: string;
  readonly requestFingerprint?: string;
  readonly status: IdempotencyStatus;
  readonly statusCode?: number;
  readonly response?: T;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly completedAt?: string;
}
