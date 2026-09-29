import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, type UserRestrictionType } from '@platform/api-contracts';
import {
  USER_BLOCKS_REPOSITORY_TOKEN,
  type IUserBlocksRepository,
} from '../repositories/user-blocks.repository.interface.js';
import {
  USER_RESTRICTIONS_REPOSITORY_TOKEN,
  type IUserRestrictionsRepository,
} from '../repositories/user-restrictions.repository.interface.js';
import type { UserRestrictionRow } from '../../../infrastructure/database/drizzle/schema/user-restrictions.js';

@Injectable()
export class SafetyEnforcementService {
  constructor(
    @Inject(USER_BLOCKS_REPOSITORY_TOKEN)
    private readonly userBlocksRepo: IUserBlocksRepository,
    @Inject(USER_RESTRICTIONS_REPOSITORY_TOKEN)
    private readonly userRestrictionsRepo: IUserRestrictionsRepository
  ) {}

  /**
   * Evaluates restriction precedence:
   * FULL_ACCOUNT > ACCOUNT_LOGIN > MESSAGING > LIKES > DISCOVERY > PROFILE_VISIBILITY
   */
  async assertCanLogin(userId: string): Promise<void> {
    const isFullAccountBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      userId,
      'FULL_ACCOUNT'
    );
    if (isFullAccountBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_BANNED,
          message: 'Your account has been permanently suspended or banned',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const isLoginBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      userId,
      'ACCOUNT_LOGIN'
    );
    if (isLoginBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_SUSPENDED,
          message: 'Account login is temporarily suspended',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  async assertCanDiscover(userId: string): Promise<void> {
    const isFullAccountBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      userId,
      'FULL_ACCOUNT'
    );
    if (isFullAccountBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_BANNED,
          message: 'Your account has been suspended',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const isDiscoveryBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      userId,
      'DISCOVERY'
    );
    if (isDiscoveryBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.DISCOVERY_UNAVAILABLE,
          message: 'Discovery is restricted on your account',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  async assertCanInteract(actorUserId: string, targetUserId: string): Promise<void> {
    const isFullAccountBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      actorUserId,
      'FULL_ACCOUNT'
    );
    if (isFullAccountBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_BANNED,
          message: 'Your account has been suspended',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const isInteractionBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      actorUserId,
      'LIKES'
    );
    if (isInteractionBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.INTERACTION_RESTRICTED,
          message: 'Interactions are restricted on your account',
        },
        HttpStatus.FORBIDDEN
      );
    }

    // Bidirectional block check: neither user can interact if either blocked the other
    const isBlocked = await this.userBlocksRepo.isBlockedBidirectional(actorUserId, targetUserId);
    if (isBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.USER_BLOCKED,
          message: 'Interaction cannot be completed due to safety settings',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  async assertCanMessage(senderUserId: string, targetUserId: string): Promise<void> {
    const isFullAccountBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      senderUserId,
      'FULL_ACCOUNT'
    );
    if (isFullAccountBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.ACCOUNT_BANNED,
          message: 'Your account has been suspended',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const isMessagingBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      senderUserId,
      'MESSAGING'
    );
    if (isMessagingBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.MESSAGING_RESTRICTED,
          message: 'Messaging is restricted on your account',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const isBlocked = await this.userBlocksRepo.isBlockedBidirectional(senderUserId, targetUserId);
    if (isBlocked) {
      throw new HttpException(
        {
          code: ErrorCode.USER_BLOCKED,
          message: 'Messaging is unavailable due to safety settings',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  async isUserBlockedBidirectional(userAId: string, userBId: string): Promise<boolean> {
    return this.userBlocksRepo.isBlockedBidirectional(userAId, userBId);
  }

  async hasBlocked(blockerUserId: string, blockedUserId: string): Promise<boolean> {
    return this.userBlocksRepo.hasBlocked(blockerUserId, blockedUserId);
  }

  async getActiveRestrictions(userId: string): Promise<readonly UserRestrictionRow[]> {
    return this.userRestrictionsRepo.findActiveRestrictions(userId);
  }

  async hasActiveRestriction(
    userId: string,
    restrictionType: UserRestrictionType
  ): Promise<boolean> {
    return this.userRestrictionsRepo.hasActiveRestriction(userId, restrictionType);
  }
}
