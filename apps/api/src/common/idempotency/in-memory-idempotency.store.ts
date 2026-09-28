import { Injectable } from '@nestjs/common';
import type { IdempotencyRecord } from '@platform/api-contracts';
import type { IIdempotencyStore } from './idempotency.interface.js';

/**
 * In-Memory Idempotency Store (Developmental / Test Double)
 */
@Injectable()
export class InMemoryIdempotencyStore implements IIdempotencyStore {
  private readonly store = new Map<string, IdempotencyRecord>();

  private makeKey(key: string, scope = 'global'): string {
    return `${scope}:${key}`;
  }

  async get(key: string, scope = 'global'): Promise<IdempotencyRecord | null> {
    const compositeKey = this.makeKey(key, scope);
    const record = this.store.get(compositeKey);
    if (!record) return null;

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      this.store.delete(compositeKey);
      return null;
    }
    return record;
  }

  async set(record: IdempotencyRecord): Promise<void> {
    const compositeKey = this.makeKey(record.key, record.scope);
    this.store.set(compositeKey, record);
  }

  async update(key: string, updates: Partial<IdempotencyRecord>, scope = 'global'): Promise<void> {
    const compositeKey = this.makeKey(key, scope);
    const existing = this.store.get(compositeKey);
    if (existing) {
      this.store.set(compositeKey, { ...existing, ...updates });
    }
  }

  async delete(key: string, scope = 'global'): Promise<void> {
    this.store.delete(this.makeKey(key, scope));
  }
}
