import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/drizzle/client.js';
import {
  userIdentities,
  type UserIdentityRow,
  type NewUserIdentityRow,
  type IdentityProviderType,
} from '../../../infrastructure/database/drizzle/schema/index.js';

export interface IUserIdentityRepository {
  findByProvider(
    provider: IdentityProviderType,
    providerSubject: string,
    db?: DrizzleDatabase
  ): Promise<UserIdentityRow | null>;
  findById(id: string, db?: DrizzleDatabase): Promise<UserIdentityRow | null>;
  create(data: NewUserIdentityRow, db?: DrizzleDatabase): Promise<UserIdentityRow>;
  updateLastUsed(id: string, db?: DrizzleDatabase): Promise<void>;
  listByUserId(userId: string, db?: DrizzleDatabase): Promise<UserIdentityRow[]>;
}

export const USER_IDENTITY_REPOSITORY_TOKEN = Symbol('IUserIdentityRepository');

@Injectable()
export class UserIdentityRepository implements IUserIdentityRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async findByProvider(
    provider: IdentityProviderType,
    providerSubject: string,
    db?: DrizzleDatabase
  ): Promise<UserIdentityRow | null> {
    const runner = db ?? this.databaseService.client;
    const rows = await runner
      .select()
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, provider),
          eq(userIdentities.providerSubject, providerSubject)
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findById(id: string, db?: DrizzleDatabase): Promise<UserIdentityRow | null> {
    const runner = db ?? this.databaseService.client;
    const rows = await runner
      .select()
      .from(userIdentities)
      .where(eq(userIdentities.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async create(data: NewUserIdentityRow, db?: DrizzleDatabase): Promise<UserIdentityRow> {
    const runner = db ?? this.databaseService.client;
    const [row] = await runner.insert(userIdentities).values(data).returning();

    if (!row) {
      throw new Error('Failed to create user identity record');
    }

    return row;
  }

  async updateLastUsed(id: string, db?: DrizzleDatabase): Promise<void> {
    const runner = db ?? this.databaseService.client;
    await runner
      .update(userIdentities)
      .set({
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userIdentities.id, id));
  }

  async listByUserId(userId: string, db?: DrizzleDatabase): Promise<UserIdentityRow[]> {
    const runner = db ?? this.databaseService.client;
    return runner.select().from(userIdentities).where(eq(userIdentities.userId, userId));
  }
}
