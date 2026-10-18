import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
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
  findOrCreate(data: { name: string; category: string }): Promise<InterestRow>;
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

  async findOrCreate(data: { name: string; category: string }): Promise<InterestRow> {
    const cleanName = data.name.trim();
    const cleanCategory = data.category.trim();

    let baseSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!baseSlug) {
      baseSlug = 'passion';
    }
    if (baseSlug.length > 55) {
      baseSlug = baseSlug.slice(0, 55);
    }

    // Check if an existing interest matches this slug or exact name (case-insensitive)
    const existing = await this.databaseService.client
      .select()
      .from(interests)
      .where(sql`lower(${interests.name}) = lower(${cleanName}) OR ${interests.slug} = ${baseSlug}`)
      .limit(1);

    const [found] = existing;
    if (found) {
      return found;
    }

    // Check if slug is taken by another item
    const slugCheck = await this.databaseService.client
      .select({ id: interests.id })
      .from(interests)
      .where(eq(interests.slug, baseSlug))
      .limit(1);

    const finalSlug =
      slugCheck.length > 0 ? `${baseSlug}-${generateUuidV7().slice(0, 6)}` : baseSlug;

    const [created] = await this.databaseService.client
      .insert(interests)
      .values({
        id: generateUuidV7(),
        name: cleanName,
        slug: finalSlug,
        category: cleanCategory,
        status: 'ACTIVE',
        createdAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create interest in database');
    }

    return created;
  }
}
