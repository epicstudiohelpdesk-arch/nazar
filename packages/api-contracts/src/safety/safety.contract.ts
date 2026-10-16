export type ReportReasonCode =
  | 'HARASSMENT'
  | 'ABUSE'
  | 'THREATS'
  | 'HATE_OR_DISCRIMINATION'
  | 'SEXUAL_CONTENT'
  | 'UNWANTED_SEXUAL_BEHAVIOR'
  | 'SCAM_OR_FRAUD'
  | 'SPAM'
  | 'IMPERSONATION'
  | 'FAKE_PROFILE'
  | 'MINOR_SAFETY_CONCERN'
  | 'SELF_HARM_CONCERN'
  | 'VIOLENCE_OR_DANGER'
  | 'OFF_PLATFORM_PAYMENT_SCAM'
  | 'INAPPROPRIATE_CONTENT'
  | 'OTHER';

export type ReportTargetType =
  | 'USER'
  | 'PROFILE'
  | 'MESSAGE'
  | 'CONVERSATION'
  | 'MEDIA'
  | 'POST'
  | 'COMMENT'
  | 'COMMUNITY'
  | 'EVENT';

export type ReportStatus =
  'OPEN' | 'UNDER_REVIEW' | 'ACTIONED' | 'DISMISSED' | 'DUPLICATE' | 'CLOSED';

export type ReportPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ModerationCaseStatus =
  'OPEN' | 'TRIAGED' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'RESOLVED' | 'DISMISSED';

export type ModerationCasePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ModerationDecisionOutcome =
  | 'NO_ACTION'
  | 'WARNING'
  | 'CONTENT_REMOVED'
  | 'PROFILE_RESTRICTED'
  | 'MESSAGING_RESTRICTED'
  | 'INTERACTION_RESTRICTED'
  | 'TEMPORARY_SUSPENSION'
  | 'PERMANENT_SUSPENSION'
  | 'BAN';

export type UserRestrictionType =
  'PROFILE_VISIBILITY' | 'DISCOVERY' | 'LIKES' | 'MESSAGING' | 'ACCOUNT_LOGIN' | 'FULL_ACCOUNT';

export interface UserRestrictionDto {
  readonly id: string;
  readonly userId: string;
  readonly restrictionType: UserRestrictionType;
  readonly reasonCode: string;
  readonly startsAt: string;
  readonly expiresAt?: string | null;
  readonly createdAt: string;
}

export interface BlockUserRequestDto {
  readonly reason?: string | null;
}

export interface BlockUserResponseDto {
  readonly success: boolean;
  readonly blockedUserId: string;
  readonly createdAt: string;
}

export interface UnblockUserResponseDto {
  readonly success: boolean;
  readonly unblockedUserId: string;
  readonly unblockedAt: string;
}

export interface BlockedUserItemDto {
  readonly blockedUserId: string;
  readonly displayName: string;
  readonly age: number;
  readonly city?: string | null;
  readonly primaryPhotoUrl?: string | null;
  readonly blockedAt: string;
}

export interface BlockedUserListResponseDto {
  readonly items: readonly BlockedUserItemDto[];
  readonly nextCursor?: string | null;
  readonly hasMore: boolean;
}

export interface CreateReportRequestDto {
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reasonCode: ReportReasonCode;
  readonly description?: string | null;
  readonly metadata?: Record<string, unknown> | null;
}

export interface ReportResponseDto {
  readonly id: string;
  readonly reporterUserId: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reasonCode: ReportReasonCode;
  readonly status: ReportStatus;
  readonly createdAt: string;
  readonly resolvedAt?: string | null;
}

export interface BlockedContactItemDto {
  readonly id: string;
  readonly phoneHash: string;
  readonly label?: string | null;
  readonly createdAt: string;
}

export interface BlockContactsRequestDto {
  readonly contacts: readonly {
    readonly phoneHash: string;
    readonly label?: string | null;
  }[];
}

export interface BlockContactsResponseDto {
  readonly success: boolean;
  readonly addedCount: number;
  readonly totalBlockedCount: number;
}

export interface BlockedContactsListResponseDto {
  readonly items: readonly BlockedContactItemDto[];
  readonly totalCount: number;
}

export type VerificationGesture =
  | 'HEAD_TURN_LEFT'
  | 'HEAD_TURN_RIGHT'
  | 'PEACE_SIGN'
  | 'SMILE'
  | 'THUMBS_UP';

export interface VerificationChallengeResponseDto {
  readonly challengeToken: string;
  readonly gesture: VerificationGesture;
  readonly gesturePrompt: string;
  readonly expiresAt: string;
}

export interface SubmitVerificationRequestDto {
  readonly challengeToken: string;
  readonly selfiePhotoUrl: string;
  readonly gesture: VerificationGesture;
}

export interface SubmitVerificationResponseDto {
  readonly success: boolean;
  readonly isVerified: boolean;
  readonly message: string;
  readonly verifiedAt: string;
}

export interface VerificationStatusResponseDto {
  readonly isVerified: boolean;
  readonly verifiedAt?: string | null;
}

