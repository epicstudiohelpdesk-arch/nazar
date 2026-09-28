/**
 * Canonical Interactions API Contracts (Gate 07)
 * Defines directional interaction states, types, responses, and events.
 */

export type InteractionType = 'LIKE' | 'PASS';

export interface InteractionResponseDto {
  readonly targetUserId: string;
  readonly interaction: InteractionType;
  readonly matched: boolean;
  readonly matchId: string | null;
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
  readonly createdAt: string;
}

export interface InteractionHistoryResponseDto {
  readonly items: readonly InteractionHistoryItemDto[];
}
