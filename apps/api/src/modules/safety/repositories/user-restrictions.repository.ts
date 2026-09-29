import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, isNull, gt, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  userRestrictions,
  type UserRestrictionRow,
  type NewUserRestrictionRow,
} from '../../../infrastructure/database/drizzle/schema/user-restrictions.js';
import type { IUserRestrictionsRepository } from './user-restrictions.repository.interface.js';
import type { UserRestrictionType } from '@platform/api-contracts';

@Injectable()
export class UserRestrictionsRepository implements IUserRestrictionsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createRestriction(
    data: NewUserRestrictionRow,
    tx?: DrizzleDatabase
  ): Promise<UserRestrictionRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(userRestrictions).values(data).returning();
    return row!;
  }

  async findActiveRestrictions(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly UserRestrictionRow[]> {
    const client = this.getClient(tx);
    const now = new Date();

    return client
      .select()
      .from(userRestrictions)
      .where(
        and(
          eq(userRestrictions.userId, userId),
          isNull(userRestrictions.revokedAt),
          or(isNull(userRestrictions.expiresAt), gt(userRestrictions.expiresAt, now))
        )
      );
  }

  async hasActiveRestriction(
    userId: string,
    restrictionType: UserRestrictionType,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const now = new Date();

    // FULL_ACCOUNT precedes and covers all sub-restrictions
    const restrictionTypes =
      restrictionType === 'FULL_ACCOUNT' ? ['FULL_ACCOUNT'] : ['FULL_ACCOUNT', restrictionType];

    const [row] = await client
      .select({ id: userRestrictions.id })
      .from(userRestrictions)
      .where(
        and(
          eq(userRestrictions.userId, userId),
          sql`${userRestrictions.restrictionType} IN (${sql.join(
            restrictionTypes.map((t) => sql`${t}`),
            sql`, `
          )})`,
          isNull(userRestrictions.revokedAt),
          or(isNull(userRestrictions.expiresAt), gt(userRestrictions.expiresAt, now))
        )
      )
      .limit(1);

    return Boolean(row);
  }

  async revokeRestriction(
    restrictionId: string,
    revokedByUserId?: string,
    tx?: DrizzleDatabase
  ): Promise<UserRestrictionRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(userRestrictions)
      .set({
        revokedAt: new Date(),
        revokedByUserId: revokedByUserId || null,
      })
      .where(eq(userRestrictions.id, restrictionId))
      .returning();

    return row || null;
  }

  async revokeAllActiveRestrictions(
    userId: string,
    revokedByUserId?: string,
    tx?: DrizzleDatabase
  ): Promise<number> {
    const client = this.getClient(tx);
    const result = await client
      .update(userRestrictions)
      .set({
        revokedAt: new Date(),
        revokedByUserId: revokedByUserId || null,
      })
      .where(and(eq(userRestrictions.userId, userId), isNull(userRestrictions.revokedAt)))
      .returning();

    return result.length;
  }
}
