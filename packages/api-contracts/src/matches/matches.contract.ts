/**
 * Canonical Matches API Contracts (Gate 07)
 * Defines mutual match entities, summary profiles, detail responses, and unmatch lifecycle.
 */

import type {
  PublicMediaItem,
  InterestItem,
  PublicPromptItem,
} from '../profile/profile.contract.js';

export type MatchStatus = 'ACTIVE' | 'UNMATCHED';

export interface MatchPagination {
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly limit: number;
}

export interface MatchedUserSummaryDto {
  readonly userId: string;
  readonly profileId: string;
  readonly displayName: string;
  readonly age: number;
  readonly city: string | null;
  readonly countryCode: string | null;
  readonly primaryPhotoUrl: string | null;
}

export interface MatchItemDto {
  readonly id: string;
  readonly matchedAt: string;
  readonly status: MatchStatus;
  readonly otherUser: MatchedUserSummaryDto;
}

export interface MatchListResponseDto {
  readonly items: readonly MatchItemDto[];
  readonly pagination: MatchPagination;
}

export interface MatchDetailDto {
  readonly id: string;
  readonly matchedAt: string;
  readonly status: MatchStatus;
  readonly otherUser: {
    readonly userId: string;
    readonly profileId: string;
    readonly displayName: string;
    readonly age: number;
    readonly bio: string | null;
    readonly occupation: string | null;
    readonly education: string | null;
    readonly city: string | null;
    readonly countryCode: string | null;
    readonly media: readonly PublicMediaItem[];
    readonly interests: readonly InterestItem[];
    readonly prompts: readonly PublicPromptItem[];
  };
}

export interface UnmatchRequestDto {
  readonly reason?: string;
}

export interface UnmatchResponseDto {
  readonly success: boolean;
  readonly matchId: string;
  readonly status: MatchStatus;
}
