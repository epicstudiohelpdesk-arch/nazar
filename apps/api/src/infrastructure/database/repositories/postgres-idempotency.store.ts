import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { ErrorCode, type IdempotencyRecord } from '@platform/api-contracts';
import type { IIdempotencyStore } from '../../../common/idempotency/idempotency.interface.js';
import { DatabaseService } from '../database.service.js';
import { idempotencyKeys } from '../drizzle/schema/idempotency-keys.js';
import { extractPgError } from '../errors/database-error-mapper.js';

@Injectable()
export class PostgresIdempotencyStore implements IIdempotencyStore {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async get(key: string, scope = 'global'): Promise<IdempotencyRecord | null> {
    const db = this.databaseService.client;
    const rows = await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      key: row.key,
      scope: row.scope,
      requestFingerprint: row.requestFingerprint,
      status: row.status as IdempotencyRecord['status'],
      statusCode: row.statusCode ?? undefined,
      response: row.responsePayload,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      completedAt: row.completedAt?.toISOString(),
    };
  }

  async set(record: IdempotencyRecord): Promise<void> {
    const db = this.databaseService.client;
    const scope = record.scope || 'global';

    try {
      await db.insert(idempotencyKeys).values({
        key: record.key,
        scope,
        requestFingerprint: record.requestFingerprint || '',
        status: record.status,
        statusCode: record.statusCode,
        responsePayload: record.response,
        createdAt: new Date(record.createdAt),
        expiresAt: new Date(record.expiresAt),
        completedAt: record.completedAt ? new Date(record.completedAt) : null,
      });
    } catch (err: unknown) {
      const pgErr = extractPgError(err);
      if (pgErr && pgErr.code === '23505') {
        throw new ConflictException({
          code: ErrorCode.IDEMPOTENCY_CONFLICT,
          message:
            'A mutation with this idempotency key is currently processing. Please retry shortly.',
        });
      }
      throw err;
    }
  }

  async update(key: string, updates: Partial<IdempotencyRecord>, scope = 'global'): Promise<void> {
    const db = this.databaseService.client;
    const updateValues: Record<string, unknown> = {};

    if (updates.status !== undefined) {
      updateValues.status = updates.status;
    }
    if (updates.statusCode !== undefined) {
      updateValues.statusCode = updates.statusCode;
    }
    if (updates.response !== undefined) {
      updateValues.responsePayload = updates.response;
    }
    if (updates.status === 'COMPLETED') {
      updateValues.completedAt = new Date();
    }

    await db
      .update(idempotencyKeys)
      .set(updateValues)
      .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)));
  }

  async delete(key: string, scope = 'global'): Promise<void> {
    const db = this.databaseService.client;
    await db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, scope)));
  }
}
