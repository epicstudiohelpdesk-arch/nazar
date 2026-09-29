import type {
  UserRestrictionRow,
  NewUserRestrictionRow,
} from '../../../infrastructure/database/drizzle/schema/user-restrictions.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type { UserRestrictionType } from '@platform/api-contracts';

export interface IUserRestrictionsRepository {
  createRestriction(
    data: NewUserRestrictionRow,
    tx?: DrizzleDatabase
  ): Promise<UserRestrictionRow>;

  findActiveRestrictions(
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<readonly UserRestrictionRow[]>;

  hasActiveRestriction(
    userId: string,
    restrictionType: UserRestrictionType,
    tx?: DrizzleDatabase
  ): Promise<boolean>;

  revokeRestriction(
    restrictionId: string,
    revokedByUserId?: string,
    tx?: DrizzleDatabase
  ): Promise<UserRestrictionRow | null>;

  revokeAllActiveRestrictions(
    userId: string,
    revokedByUserId?: string,
    tx?: DrizzleDatabase
  ): Promise<number>;
}

export const USER_RESTRICTIONS_REPOSITORY_TOKEN = Symbol('IUserRestrictionsRepository');
