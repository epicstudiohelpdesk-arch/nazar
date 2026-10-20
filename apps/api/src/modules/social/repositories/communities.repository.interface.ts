import type {
  CommunityRow,
  NewCommunityRow,
  CommunityMembershipRow,
  NewCommunityMembershipRow,
} from '../../../infrastructure/database/drizzle/schema/communities.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface CommunityCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export interface ListCommunitiesOptions {
  readonly limit: number;
  readonly cursor?: CommunityCursor;
}

export interface MemberCursor {
  readonly joinedAt: Date;
  readonly id: string;
}

export interface ListMembersOptions {
  readonly limit: number;
  readonly cursor?: MemberCursor;
  readonly excludedUserIds?: readonly string[];
}

export interface ICommunitiesRepository {
  createCommunity(data: NewCommunityRow, tx?: DrizzleDatabase): Promise<CommunityRow>;
  findById(id: string, tx?: DrizzleDatabase): Promise<CommunityRow | null>;
  findBySlug(slug: string, tx?: DrizzleDatabase): Promise<CommunityRow | null>;
  findByName(name: string, tx?: DrizzleDatabase): Promise<CommunityRow | null>;
  updateCommunity(
    id: string,
    data: Partial<NewCommunityRow>,
    tx?: DrizzleDatabase
  ): Promise<CommunityRow | null>;
  countUserCreatedCommunities(userId: string, tx?: DrizzleDatabase): Promise<number>;
  findDiscoverable(
    options: ListCommunitiesOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly CommunityRow[]>;
  findUserCommunities(
    userId: string,
    options: ListCommunitiesOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly CommunityRow[]>;

  // Memberships
  createMembership(
    data: NewCommunityMembershipRow,
    tx?: DrizzleDatabase
  ): Promise<CommunityMembershipRow>;
  upsertMembership(
    data: NewCommunityMembershipRow,
    tx?: DrizzleDatabase
  ): Promise<{ membership: CommunityMembershipRow; wasCreated: boolean }>;
  getMembership(
    communityId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<CommunityMembershipRow | null>;
  updateMembership(
    communityId: string,
    userId: string,
    data: Partial<NewCommunityMembershipRow>,
    tx?: DrizzleDatabase
  ): Promise<CommunityMembershipRow | null>;
  deleteMembership(communityId: string, userId: string, tx?: DrizzleDatabase): Promise<boolean>;
  listMembers(
    communityId: string,
    options: ListMembersOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly CommunityMembershipRow[]>;
  incrementMemberCount(communityId: string, delta: number, tx?: DrizzleDatabase): Promise<void>;
}

export const COMMUNITIES_REPOSITORY_TOKEN = Symbol('ICommunitiesRepository');
