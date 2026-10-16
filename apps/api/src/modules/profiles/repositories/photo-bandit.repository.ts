import { Injectable, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  photoBanditStats,
  type PhotoBanditStatRow,
} from '../../../infrastructure/database/drizzle/schema/photo-bandit-stats.js';
import { generateUuidV7 } from '@platform/domain';

@Injectable()
export class PhotoBanditRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async recordImpression(
    userId: string,
    mediaId: string,
    tx?: DrizzleDatabase
  ): Promise<PhotoBanditStatRow> {
    const client = this.getClient(tx);
    const id = generateUuidV7();

    const [row] = await client
      .insert(photoBanditStats)
      .values({
        id,
        userId,
        mediaId,
        impressions: 1,
        likes: 0,
        score: 0.0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [photoBanditStats.userId, photoBanditStats.mediaId],
        set: {
          impressions: sql`${photoBanditStats.impressions} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) {
      throw new Error('Failed to record photo impression');
    }

    return row;
  }

  async recordLike(
    userId: string,
    mediaId: string,
    tx?: DrizzleDatabase
  ): Promise<PhotoBanditStatRow> {
    const client = this.getClient(tx);
    const id = generateUuidV7();

    const [row] = await client
      .insert(photoBanditStats)
      .values({
        id,
        userId,
        mediaId,
        impressions: 1,
        likes: 1,
        score: 1.0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [photoBanditStats.userId, photoBanditStats.mediaId],
        set: {
          likes: sql`${photoBanditStats.likes} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) {
      throw new Error('Failed to record photo like');
    }

    return row;
  }

  async updateScore(mediaId: string, score: number, tx?: DrizzleDatabase): Promise<void> {
    const client = this.getClient(tx);
    await client
      .update(photoBanditStats)
      .set({ score, updatedAt: new Date() })
      .where(eq(photoBanditStats.mediaId, mediaId));
  }

  async findStatsByUserId(userId: string, tx?: DrizzleDatabase): Promise<PhotoBanditStatRow[]> {
    const client = this.getClient(tx);
    return client.select().from(photoBanditStats).where(eq(photoBanditStats.userId, userId));
  }
}
