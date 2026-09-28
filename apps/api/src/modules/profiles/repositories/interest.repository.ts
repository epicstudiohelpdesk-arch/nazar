import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  interests,
  profileInterests,
  type InterestRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';

export interface IInterestRepository {
  findAllActive(): Promise<InterestRow[]>;
  findByIds(ids: string[]): Promise<InterestRow[]>;
  findByProfileId(profileId: string, tx?: DrizzleDatabase): Promise<InterestRow[]>;
  replaceProfileInterests(
    profileId: string,
    interestIds: string[],
    tx?: DrizzleDatabase
  ): Promise<InterestRow[]>;
}

export const INTEREST_REPOSITORY_TOKEN = Symbol('IInterestRepository');

@Injectable()
export class InterestRepository implements IInterestRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async findAllActive(): Promise<InterestRow[]> {
    return this.databaseService.client
      .select()
      .from(interests)
      .where(eq(interests.status, 'ACTIVE'))
      .orderBy(interests.category, interests.name);
  }

  async findByIds(ids: string[]): Promise<InterestRow[]> {
    if (ids.length === 0) return [];
    return this.databaseService.client.select().from(interests).where(inArray(interests.id, ids));
  }

  async findByProfileId(profileId: string, tx?: DrizzleDatabase): Promise<InterestRow[]> {
    const rows = await this.getClient(tx)
      .select({
        id: interests.id,
        name: interests.name,
        slug: interests.slug,
        category: interests.category,
        status: interests.status,
        createdAt: interests.createdAt,
      })
      .from(profileInterests)
      .innerJoin(interests, eq(profileInterests.interestId, interests.id))
      .where(eq(profileInterests.profileId, profileId));

    return rows;
  }

  async replaceProfileInterests(
    profileId: string,
    interestIds: string[],
    tx?: DrizzleDatabase
  ): Promise<InterestRow[]> {
    const client = this.getClient(tx);

    // 1. Delete existing associations
    await client.delete(profileInterests).where(eq(profileInterests.profileId, profileId));

    // 2. Insert new associations
    if (interestIds.length > 0) {
      const newRows = interestIds.map((interestId) => ({
        id: generateUuidV7(),
        profileId,
        interestId,
      }));
      await client.insert(profileInterests).values(newRows);
    }

    // 3. Return updated list
    return this.findByProfileId(profileId, tx);
  }
}
