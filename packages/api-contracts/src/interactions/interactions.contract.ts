/**
 * Canonical Interactions API Contracts (Gate 07)
 * Defines directional interaction states, types, responses, and events.
 */

import type { MatchStatus } from '../matches/matches.contract.js';

export type InteractionType = 'LIKE' | 'PASS';
export type TargetAttachmentType = 'PROFILE' | 'MEDIA' | 'PROMPT';

export interface LikeInteractionRequestDto {
  readonly targetAttachmentType?: TargetAttachmentType;
  readonly targetAttachmentId?: string;
  readonly comment?: string;
}

export interface InteractionResponseDto {
  readonly targetUserId: string;
  readonly interaction: InteractionType;
  readonly matched: boolean;
  readonly matchId: string | null;
  readonly matchStatus?: MatchStatus;
  readonly expiresAt?: string | null;
  readonly sharedInterests?: readonly string[];
  readonly suggestedIcebreakers?: readonly string[];
  readonly targetAttachmentType?: TargetAttachmentType;
  readonly targetAttachmentId?: string | null;
  readonly comment?: string | null;
}

export interface UndoResponseDto {
  readonly undone: boolean;
  readonly targetUserId: string;
  readonly previousInteraction: InteractionType;
}

export interface InteractionHistoryItemDto {
  readonly id: string;
  readonly targetUserId: string;
  readonly type: InteractionType;
  readonly targetAttachmentType?: TargetAttachmentType;
  readonly targetAttachmentId?: string | null;
  readonly comment?: string | null;
  readonly createdAt: string;
}

export interface InteractionHistoryResponseDto {
  readonly items: readonly InteractionHistoryItemDto[];
}

export interface InboundLikeProfileDto {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly age: number;
  readonly city?: string | null;
  readonly occupation?: string | null;
  readonly photoUrl?: string | null;
  readonly isVerified?: boolean;
}

export interface InboundLikeItemDto {
  readonly id: string;
  readonly actorUserId: string;
  readonly isBlurred: boolean;
  readonly targetAttachmentType?: TargetAttachmentType;
  readonly targetAttachmentId?: string | null;
  readonly comment?: string | null;
  readonly createdAt: string;
  readonly profile?: InboundLikeProfileDto | null;
  readonly blurredPhotoUrl?: string | null;
}

export interface LikesYouResponseDto {
  readonly totalCount: number;
  readonly hasEntitlement: boolean;
  readonly items: readonly InboundLikeItemDto[];
  readonly nextCursor?: string | null;
}
