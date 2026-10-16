import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  profilePreferences,
  type ProfilePreferencesRow,
  type NewProfilePreferencesRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';

export interface IPreferencesRepository {
  findByUserId(userId: string, tx?: DrizzleDatabase): Promise<ProfilePreferencesRow | undefined>;
  upsert(
    userId: string,
    data: Partial<NewProfilePreferencesRow>,
    tx?: DrizzleDatabase
  ): Promise<ProfilePreferencesRow>;
}

export const PREFERENCES_REPOSITORY_TOKEN = Symbol('IPreferencesRepository');

@Injectable()
export class PreferencesRepository implements IPreferencesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async findByUserId(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<ProfilePreferencesRow | undefined> {
    const rows = await this.getClient(tx)
      .select()
      .from(profilePreferences)
      .where(eq(profilePreferences.userId, userId))
      .limit(1);
    return rows[0];
  }

  async upsert(
    userId: string,
    data: Partial<NewProfilePreferencesRow>,
    tx?: DrizzleDatabase
  ): Promise<ProfilePreferencesRow> {
    const existing = await this.findByUserId(userId, tx);

    if (existing) {
      const rows = await this.getClient(tx)
        .update(profilePreferences)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(profilePreferences.userId, userId))
        .returning();
      return rows[0]!;
    }

    const newRow: NewProfilePreferencesRow = {
      id: generateUuidV7(),
      userId,
      minAge: data.minAge ?? 18,
      maxAge: data.maxAge ?? 99,
      ageIsDealbreaker: data.ageIsDealbreaker ?? false,
      genderPreferences: data.genderPreferences ?? ['WOMAN', 'MAN', 'NON_BINARY', 'OTHER'],
      maxDistanceKm: data.maxDistanceKm ?? 50,
      distanceIsDealbreaker: data.distanceIsDealbreaker ?? false,
      relationshipIntent: data.relationshipIntent ?? 'LONG_TERM',
      intentIsDealbreaker: data.intentIsDealbreaker ?? false,
      familyPlans: data.familyPlans ?? null,
      familyPlansIsDealbreaker: data.familyPlansIsDealbreaker ?? false,
    };

    const rows = await this.getClient(tx).insert(profilePreferences).values(newRow).returning();
    return rows[0]!;
  }
}
