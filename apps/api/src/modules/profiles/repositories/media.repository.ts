import { Injectable, Inject } from '@nestjs/common';
import { eq, and, ne, asc } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  profileMedia,
  type ProfileMediaRow,
  type NewProfileMediaRow,
} from '../../../infrastructure/database/drizzle/schema/index.js';
import type { MediaStatus } from '@platform/api-contracts';

export interface IMediaRepository {
  findById(id: string, tx?: DrizzleDatabase): Promise<ProfileMediaRow | undefined>;
  findByProfileId(profileId: string, tx?: DrizzleDatabase): Promise<ProfileMediaRow[]>;
  findByUserId(userId: string, tx?: DrizzleDatabase): Promise<ProfileMediaRow[]>;
  countActiveByProfileId(profileId: string, tx?: DrizzleDatabase): Promise<number>;
  create(data: NewProfileMediaRow, tx?: DrizzleDatabase): Promise<ProfileMediaRow>;
  updateStatus(id: string, status: MediaStatus, tx?: DrizzleDatabase): Promise<ProfileMediaRow>;
  setPrimary(profileId: string, mediaId: string, tx?: DrizzleDatabase): Promise<void>;
  reorder(profileId: string, mediaIds: readonly string[], tx?: DrizzleDatabase): Promise<void>;
  delete(id: string, tx?: DrizzleDatabase): Promise<void>;
  normalizePositions(profileId: string, tx?: DrizzleDatabase): Promise<void>;
}

export const MEDIA_REPOSITORY_TOKEN = Symbol('IMediaRepository');

@Injectable()
export class MediaRepository implements IMediaRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async findById(id: string, tx?: DrizzleDatabase): Promise<ProfileMediaRow | undefined> {
    const rows = await this.getClient(tx)
      .select()
      .from(profileMedia)
      .where(eq(profileMedia.id, id))
      .limit(1);
    return rows[0];
  }

  async findByProfileId(profileId: string, tx?: DrizzleDatabase): Promise<ProfileMediaRow[]> {
    return this.getClient(tx)
      .select()
      .from(profileMedia)
      .where(and(eq(profileMedia.profileId, profileId), ne(profileMedia.status, 'DELETED')))
      .orderBy(asc(profileMedia.position));
  }

  async findByUserId(userId: string, tx?: DrizzleDatabase): Promise<ProfileMediaRow[]> {
    return this.getClient(tx)
      .select()
      .from(profileMedia)
      .where(and(eq(profileMedia.userId, userId), ne(profileMedia.status, 'DELETED')))
      .orderBy(asc(profileMedia.position));
  }

  async countActiveByProfileId(profileId: string, tx?: DrizzleDatabase): Promise<number> {
    const rows = await this.getClient(tx)
      .select()
      .from(profileMedia)
      .where(and(eq(profileMedia.profileId, profileId), ne(profileMedia.status, 'DELETED')));
    return rows.length;
  }

  async create(data: NewProfileMediaRow, tx?: DrizzleDatabase): Promise<ProfileMediaRow> {
    const rows = await this.getClient(tx).insert(profileMedia).values(data).returning();
    return rows[0]!;
  }

  async updateStatus(
    id: string,
    status: MediaStatus,
    tx?: DrizzleDatabase
  ): Promise<ProfileMediaRow> {
    const rows = await this.getClient(tx)
      .update(profileMedia)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(profileMedia.id, id))
      .returning();
    return rows[0]!;
  }

  async setPrimary(profileId: string, mediaId: string, tx?: DrizzleDatabase): Promise<void> {
    const client = this.getClient(tx);

    // 1. Unset all isPrimary for this profile
    await client
      .update(profileMedia)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(profileMedia.profileId, profileId));

    // 2. Set targeted media as primary
    await client
      .update(profileMedia)
      .set({ isPrimary: true, position: 0, updatedAt: new Date() })
      .where(and(eq(profileMedia.profileId, profileId), eq(profileMedia.id, mediaId)));

    // 3. Normalize remaining positions
    await this.normalizePositions(profileId, tx);
  }

  async reorder(
    profileId: string,
    mediaIds: readonly string[],
    tx?: DrizzleDatabase
  ): Promise<void> {
    const client = this.getClient(tx);

    for (let i = 0; i < mediaIds.length; i++) {
      const mediaId = mediaIds[i];
      if (!mediaId) continue;
      await client
        .update(profileMedia)
        .set({ position: i, updatedAt: new Date() })
        .where(and(eq(profileMedia.profileId, profileId), eq(profileMedia.id, mediaId)));
    }
  }

  async delete(id: string, tx?: DrizzleDatabase): Promise<void> {
    await this.getClient(tx)
      .update(profileMedia)
      .set({
        status: 'DELETED',
        updatedAt: new Date(),
      })
      .where(eq(profileMedia.id, id));
  }

  async normalizePositions(profileId: string, tx?: DrizzleDatabase): Promise<void> {
    const client = this.getClient(tx);
    const active = await client
      .select()
      .from(profileMedia)
      .where(and(eq(profileMedia.profileId, profileId), ne(profileMedia.status, 'DELETED')))
      .orderBy(asc(profileMedia.position));

    // Place primary first if exists
    const primary = active.find((m: ProfileMediaRow) => m.isPrimary);
    const rest = active.filter((m: ProfileMediaRow) => !m.isPrimary);
    const sorted = primary ? [primary, ...rest] : rest;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      if (item && item.position !== i) {
        await client
          .update(profileMedia)
          .set({ position: i, updatedAt: new Date() })
          .where(eq(profileMedia.id, item.id));
      }
    }
  }
}
