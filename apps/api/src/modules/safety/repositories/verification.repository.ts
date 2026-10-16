import { Injectable, Inject } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  photoVerifications,
  type PhotoVerificationRow,
} from '../../../infrastructure/database/drizzle/schema/photo-verifications.js';
import { profiles } from '../../../infrastructure/database/drizzle/schema/profiles.js';
import type {
  IVerificationRepository,
  CreateVerificationParams,
} from './verification.repository.interface.js';

@Injectable()
export class VerificationRepository implements IVerificationRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async createVerification(
    params: CreateVerificationParams,
    tx?: DrizzleDatabase
  ): Promise<PhotoVerificationRow> {
    const client = this.getClient(tx);
    const [inserted] = await client
      .insert(photoVerifications)
      .values({
        id: params.id,
        userId: params.userId,
        gesture: params.gesture,
        selfiePhotoUrl: params.selfiePhotoUrl,
        challengeToken: params.challengeToken,
        status: params.status || 'APPROVED',
      })
      .returning();

    if (!inserted) {
      throw new Error('Failed to insert photo verification record');
    }
    return inserted;
  }

  async getLatestVerification(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<PhotoVerificationRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(photoVerifications)
      .where(eq(photoVerifications.userId, userId))
      .orderBy(desc(photoVerifications.createdAt))
      .limit(1);

    return rows[0] || null;
  }

  async markProfileVerified(
    userId: string,
    verifiedAt: Date,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const updated = await client
      .update(profiles)
      .set({
        isVerified: true,
        verifiedAt,
      })
      .where(eq(profiles.userId, userId))
      .returning({ id: profiles.id });

    return updated.length > 0;
  }

  async getProfileVerificationStatus(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<{ isVerified: boolean; verifiedAt: Date | null }> {
    const client = this.getClient(tx);
    const rows = await client
      .select({
        isVerified: profiles.isVerified,
        verifiedAt: profiles.verifiedAt,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!rows[0]) {
      return { isVerified: false, verifiedAt: null };
    }

    return {
      isVerified: rows[0].isVerified,
      verifiedAt: rows[0].verifiedAt,
    };
  }
}
