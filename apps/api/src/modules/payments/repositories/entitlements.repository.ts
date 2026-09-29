import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, isNull, gt, lte, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  entitlements,
  type EntitlementRow,
  type NewEntitlementRow,
} from '../../../infrastructure/database/drizzle/schema/entitlements.js';
import type { IEntitlementsRepository } from './entitlements.repository.interface.js';
import type { EntitlementCode } from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class EntitlementsRepository implements IEntitlementsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async findActiveEntitlements(
    userId: string,
    asOf: Date = new Date(),
    tx?: DrizzleDatabase
  ): Promise<readonly EntitlementRow[]> {
    const client = this.getClient(tx);

    return client
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          lte(entitlements.startsAt, asOf),
          or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, asOf)),
          isNull(entitlements.revokedAt),
          eq(entitlements.status, 'ACTIVE')
        )
      );
  }

  async hasActiveEntitlement(
    userId: string,
    code: EntitlementCode,
    asOf: Date = new Date(),
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);

    const [row] = await client
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          eq(entitlements.entitlementCode, code),
          lte(entitlements.startsAt, asOf),
          or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, asOf)),
          isNull(entitlements.revokedAt),
          eq(entitlements.status, 'ACTIVE')
        )
      )
      .limit(1);

    return Boolean(row);
  }

  async grantOrExtendEntitlement(
    data: Omit<NewEntitlementRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<EntitlementRow> {
    const client = this.getClient(tx);
    const now = new Date();

    // Check if user has an active entitlement with same code and source
    const [existing] = await client
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, data.userId),
          eq(entitlements.entitlementCode, data.entitlementCode),
          eq(entitlements.sourceType, data.sourceType),
          data.sourceId ? eq(entitlements.sourceId, data.sourceId) : sql`TRUE`
        )
      )
      .limit(1);

    if (existing) {
      // Determine max expiration
      let newExpiresAt = data.expiresAt;
      if (existing.expiresAt && data.expiresAt && existing.expiresAt > data.expiresAt) {
        newExpiresAt = existing.expiresAt;
      }

      const [updated] = await client
        .update(entitlements)
        .set({
          status: 'ACTIVE',
          expiresAt: newExpiresAt,
          revokedAt: null,
          updatedAt: now,
        })
        .where(eq(entitlements.id, existing.id))
        .returning();

      return updated!;
    }

    const id = generateUuidV7();
    const [created] = await client
      .insert(entitlements)
      .values({
        id,
        userId: data.userId,
        entitlementCode: data.entitlementCode,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        status: data.status || 'ACTIVE',
        startsAt: data.startsAt || now,
        expiresAt: data.expiresAt,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created!;
  }

  async revokeEntitlement(
    id: string,
    revokedAt: Date = new Date(),
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .update(entitlements)
      .set({
        status: 'REVOKED',
        revokedAt,
        updatedAt: new Date(),
      })
      .where(eq(entitlements.id, id))
      .returning({ id: entitlements.id });

    return result.length > 0;
  }

  async expireEntitlement(
    id: string,
    _asOf: Date = new Date(),
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .update(entitlements)
      .set({
        status: 'EXPIRED',
        updatedAt: new Date(),
      })
      .where(eq(entitlements.id, id))
      .returning({ id: entitlements.id });

    return result.length > 0;
  }

  async revokeBySource(
    sourceType: string,
    sourceId: string,
    revokedAt: Date = new Date(),
    tx?: DrizzleDatabase
  ): Promise<number> {
    const client = this.getClient(tx);
    const result = await client
      .update(entitlements)
      .set({
        status: 'REVOKED',
        revokedAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(entitlements.sourceType, sourceType),
          eq(entitlements.sourceId, sourceId),
          isNull(entitlements.revokedAt)
        )
      )
      .returning({ id: entitlements.id });

    return result.length;
  }

  async findExpiredActiveEntitlements(
    asOf: Date = new Date(),
    tx?: DrizzleDatabase
  ): Promise<readonly EntitlementRow[]> {
    const client = this.getClient(tx);

    return client
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.status, 'ACTIVE'),
          isNull(entitlements.revokedAt),
          lte(entitlements.expiresAt, asOf)
        )
      )
      .limit(100);
  }
}
