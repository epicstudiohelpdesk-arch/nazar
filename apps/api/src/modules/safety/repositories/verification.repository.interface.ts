import type { VerificationGesture } from '@platform/api-contracts';
import type { PhotoVerificationRow } from '../../../infrastructure/database/drizzle/schema/photo-verifications.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface CreateVerificationParams {
  readonly id: string;
  readonly userId: string;
  readonly gesture: VerificationGesture;
  readonly selfiePhotoUrl: string;
  readonly challengeToken: string;
  readonly status?: string;
}

export interface IVerificationRepository {
  createVerification(
    params: CreateVerificationParams,
    tx?: DrizzleDatabase
  ): Promise<PhotoVerificationRow>;

  getLatestVerification(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<PhotoVerificationRow | null>;

  markProfileVerified(
    userId: string,
    verifiedAt: Date,
    tx?: DrizzleDatabase
  ): Promise<boolean>;

  getProfileVerificationStatus(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<{ isVerified: boolean; verifiedAt: Date | null }>;
}
