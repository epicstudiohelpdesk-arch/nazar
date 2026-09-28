import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@platform/api-contracts';

export interface NormalizedUserPair {
  readonly userAId: string;
  readonly userBId: string;
}

/**
 * Normalizes two user IDs into a deterministic pair where userAId < userBId.
 * Enforces that a user cannot be paired with themselves.
 */
export function normalizeUserPair(userId1: string, userId2: string): NormalizedUserPair {
  if (!userId1 || !userId2) {
    throw new HttpException(
      { code: ErrorCode.VALIDATION_ERROR, message: 'Both user IDs must be provided' },
      HttpStatus.BAD_REQUEST
    );
  }

  if (userId1 === userId2) {
    throw new HttpException(
      { code: ErrorCode.INTERACTION_SELF_TARGET, message: 'A user cannot interact or match with themselves' },
      HttpStatus.BAD_REQUEST
    );
  }

  return userId1 < userId2
    ? { userAId: userId1, userBId: userId2 }
    : { userAId: userId2, userBId: userId1 };
}
