import { Injectable, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  profiles,
  type ProfileRow,
  type NewProfileRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import type { ProfileVisibility, ProfileCompleteness } from '@platform/api-contracts';

export interface IProfileRepository {
  findByUserId(userId: string, tx?: DrizzleDatabase): Promise<ProfileRow | undefined>;
  findById(id: string, tx?: DrizzleDatabase): Promise<ProfileRow | undefined>;
  create(data: NewProfileRow, tx?: DrizzleDatabase): Promise<ProfileRow>;
  update(id: string, data: Partial<NewProfileRow>, tx?: DrizzleDatabase): Promise<ProfileRow>;
  updateLocation(id: string, lat: number, lng: number, tx?: DrizzleDatabase): Promise<void>;
  updateVisibility(
    id: string,
    visibility: ProfileVisibility,
    tx?: DrizzleDatabase
  ): Promise<ProfileRow>;
  updateCompletionStatus(
    id: string,
    status: ProfileCompleteness,
    tx?: DrizzleDatabase
  ): Promise<void>;
}

export const PROFILE_REPOSITORY_TOKEN = Symbol('IProfileRepository');

@Injectable()
export class ProfileRepository implements IProfileRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async findByUserId(userId: string, tx?: DrizzleDatabase): Promise<ProfileRow | undefined> {
    const rows = await this.getClient(tx)
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    return rows[0];
  }

  async findById(id: string, tx?: DrizzleDatabase): Promise<ProfileRow | undefined> {
    const rows = await this.getClient(tx)
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    return rows[0];
  }

  async create(data: NewProfileRow, tx?: DrizzleDatabase): Promise<ProfileRow> {
    const rows = await this.getClient(tx).insert(profiles).values(data).returning();
    return rows[0]!;
  }

  async update(
    id: string,
    data: Partial<NewProfileRow>,
    tx?: DrizzleDatabase
  ): Promise<ProfileRow> {
    const rows = await this.getClient(tx)
      .update(profiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, id))
      .returning();
    return rows[0]!;
  }

  async updateLocation(id: string, lat: number, lng: number, tx?: DrizzleDatabase): Promise<void> {
    await this.getClient(tx).execute(
      sql`UPDATE profiles
          SET latitude = ${lat},
              longitude = ${lng},
              location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
              updated_at = NOW()
          WHERE id = ${id}`
    );
  }

  async updateVisibility(
    id: string,
    visibility: ProfileVisibility,
    tx?: DrizzleDatabase
  ): Promise<ProfileRow> {
    const rows = await this.getClient(tx)
      .update(profiles)
      .set({
        visibility,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, id))
      .returning();
    return rows[0]!;
  }

  async updateCompletionStatus(
    id: string,
    status: ProfileCompleteness,
    tx?: DrizzleDatabase
  ): Promise<void> {
    await this.getClient(tx)
      .update(profiles)
      .set({
        completionStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, id));
  }
}
