import { Injectable } from '@nestjs/common';
import type { IdempotencyRecord } from '@platform/api-contracts';
import type { IIdempotencyStore } from './idempotency.interface.js';

/**
 * In-Memory Idempotency Store (Developmental / Test Double)
 * NOTE: Production requires durable PostgreSQL / Redis backing store (introduced in future gates).
 */
@Injectable()
export class InMemoryIdempotencyStore implements IIdempotencyStore {
  private readonly store = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this.store.get(key);
    if (!record) return null;

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return record;
  }

  async set(record: IdempotencyRecord): Promise<void> {
    this.store.set(record.key, record);
  }

  async update(key: string, updates: Partial<IdempotencyRecord>): Promise<void> {
    const existing = this.store.get(key);
    if (existing) {
      this.store.set(key, { ...existing, ...updates });
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
