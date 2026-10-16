import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type { UserInteractionRow } from '../../../infrastructure/database/drizzle/schema/interactions.js';

export interface InteractionAttachmentOptions {
  readonly targetAttachmentType?: 'PROFILE' | 'MEDIA' | 'PROMPT';
  readonly targetAttachmentId?: string;
  readonly comment?: string;
}

export interface IInteractionsRepository {
  upsertInteraction(
    actorUserId: string,
    targetUserId: string,
    type: 'LIKE' | 'PASS',
    attachmentOptions?: InteractionAttachmentOptions,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow>;

  findInteraction(
    actorUserId: string,
    targetUserId: string,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow | null>;

  findRecentInteraction(
    actorUserId: string,
    tx?: DrizzleDatabase
  ): Promise<UserInteractionRow | null>;

  deleteInteraction(id: string, tx?: DrizzleDatabase): Promise<boolean>;

  findInteractionsByActor(
    actorUserId: string,
    limit: number,
    tx?: DrizzleDatabase
  ): Promise<readonly UserInteractionRow[]>;

  findInboundLikes(
    targetUserId: string,
    limit: number,
    tx?: DrizzleDatabase
  ): Promise<{ items: readonly InboundLikeRecord[]; totalCount: number }>;
}

export interface InboundLikeRecord {
  readonly id: string;
  readonly actorUserId: string;
  readonly targetAttachmentType: string;
  readonly targetAttachmentId: string | null;
  readonly comment: string | null;
  readonly createdAt: Date;
  readonly profileId: string | null;
  readonly displayName: string | null;
  readonly dateOfBirth: string | null;
  readonly city: string | null;
  readonly occupation: string | null;
  readonly isVerified: boolean | null;
  readonly primaryPhotoKey: string | null;
}

export const INTERACTIONS_REPOSITORY_TOKEN = Symbol('IInteractionsRepository');
