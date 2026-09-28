import type { IdempotencyRecord } from '@platform/api-contracts';

export interface IIdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>;
  set(record: IdempotencyRecord): Promise<void>;
  update(key: string, updates: Partial<IdempotencyRecord>): Promise<void>;
  delete(key: string): Promise<void>;
}

export const IDEMPOTENCY_STORE_TOKEN = Symbol('IIdempotencyStore');
