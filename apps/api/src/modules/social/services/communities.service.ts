import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  ErrorCode,
  type CommunityDto,
  type CommunityListResponseDto,
  type CommunityMemberDto,
  type CommunityMemberListResponseDto,
  type CommunityPrivacy,
  type CommunityRole,
  type CommunityMembershipStatus,
} from '@platform/api-contracts';
import {
  COMMUNITIES_REPOSITORY_TOKEN,
  type ICommunitiesRepository,
} from '../repositories/communities.repository.interface.js';
import {
  USER_BLOCKS_REPOSITORY_TOKEN,
  type IUserBlocksRepository,
} from '../../safety/repositories/user-blocks.repository.interface.js';
import {
  USER_RESTRICTIONS_REPOSITORY_TOKEN,
  type IUserRestrictionsRepository,
} from '../../safety/repositories/user-restrictions.repository.interface.js';
import { EntitlementService } from '../../payments/services/entitlement.service.js';
import { SocialProfileEnricherService } from './social-profile-enricher.service.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { outboxEvents } from '../../../infrastructure/database/drizzle/schema/outbox-events.js';
import { generateUuidV7 } from '@platform/domain';
import type {
  CreateCommunityInput,
  UpdateCommunityInput,
  GetCommunitiesQueryInput,
  GetCommunityMembersQueryInput,
} from '@platform/validation';

export interface CursorPayload {
  readonly createdAt: string;
  readonly id: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(raw) as CursorPayload;
  } catch {
    return null;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CommunitiesService {
  constructor(
    @Inject(COMMUNITIES_REPOSITORY_TOKEN)
    private readonly communitiesRepo: ICommunitiesRepository,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService,
    @Inject(USER_BLOCKS_REPOSITORY_TOKEN)
    private readonly userBlocksRepo: IUserBlocksRepository,
    @Inject(USER_RESTRICTIONS_REPOSITORY_TOKEN)
    private readonly userRestrictionsRepo: IUserRestrictionsRepository,
    @Inject(SocialProfileEnricherService)
    private readonly profileEnricher: SocialProfileEnricherService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private async assertCanParticipate(userId: string): Promise<void> {
    const isFullAccountBlocked = await this.userRestrictionsRepo.hasActiveRestriction(
      userId,
      'FULL_ACCOUNT'
    );
    if (isFullAccountBlocked) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.ACCOUNT_BANNED,
        message: 'Your account has been suspended or banned',
      });
    }
  }

  async createCommunity(creatorId: string, input: CreateCommunityInput): Promise<CommunityDto> {
    await this.assertCanParticipate(creatorId);

    // Gate 11 Entitlement Check: Free users can create up to 3 communities
    const createdCount = await this.communitiesRepo.countUserCreatedCommunities(creatorId);
    if (createdCount >= 3) {
      await this.entitlementService.requireEntitlement(creatorId, 'PREMIUM');
    }

    // Name uniqueness check
    const existingName = await this.communitiesRepo.findByName(input.name);
    if (existingName) {
      throw new ConflictException({
        statusCode: 409,
        code: ErrorCode.COMMUNITY_NAME_TAKEN,
        message: 'A community with this name already exists',
      });
    }

    let slug = slugify(input.name);
    const existingSlug = await this.communitiesRepo.findBySlug(slug);
    if (existingSlug) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const communityId = generateUuidV7();
    const membershipId = generateUuidV7();

    return this.databaseService.withTransaction(async (tx) => {
      const community = await this.communitiesRepo.createCommunity(
        {
          id: communityId,
          creatorId,
          name: input.name,
          slug,
          description: input.description,
          privacy: input.privacy || 'PUBLIC',
          memberCount: 1,
          rules: input.rules ? [...input.rules] : null,
          avatarMediaId: input.avatarMediaId || null,
          coverMediaId: input.coverMediaId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tx
      );

      // Creator automatically becomes OWNER
      await this.communitiesRepo.createMembership(
        {
          id: membershipId,
          communityId: community.id,
          userId: creatorId,
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date(),
          updatedAt: new Date(),
        },
        tx
      );

      // Outbox domain event
      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'community.created',
        aggregateType: 'COMMUNITY',
        aggregateId: community.id,
        payload: {
          communityId: community.id,
          creatorId,
          name: community.name,
          slug: community.slug,
          privacy: community.privacy,
          createdAt: community.createdAt.toISOString(),
        },
        status: 'PENDING',
      });

      return {
        id: community.id,
        creatorId: community.creatorId,
        name: community.name,
        slug: community.slug,
        description: community.description,
        avatarUrl: null,
        coverUrl: null,
        privacy: community.privacy as CommunityPrivacy,
        memberCount: 1,
        rules: community.rules || null,
        currentUserRole: 'OWNER',
        currentUserMembershipStatus: 'ACTIVE',
        createdAt: community.createdAt.toISOString(),
        updatedAt: community.updatedAt.toISOString(),
      };
    });
  }

  async getCommunity(id: string, viewerUserId: string): Promise<CommunityDto> {
    const community = await this.communitiesRepo.findById(id);
    if (!community) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_NOT_FOUND,
        message: 'Community not found',
      });
    }

    const membership = await this.communitiesRepo.getMembership(id, viewerUserId);

    if (community.privacy === 'HIDDEN' && (!membership || membership.status !== 'ACTIVE')) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_NOT_FOUND,
        message: 'Community not found',
      });
    }

    return {
      id: community.id,
      creatorId: community.creatorId,
      name: community.name,
      slug: community.slug,
      description: community.description,
      avatarUrl: null,
      coverUrl: null,
      privacy: community.privacy as CommunityPrivacy,
      memberCount: community.memberCount,
      rules: community.rules || null,
      currentUserRole: (membership?.role as CommunityRole) || null,
      currentUserMembershipStatus: (membership?.status as CommunityMembershipStatus) || null,
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    };
  }

  async updateCommunity(
    id: string,
    userId: string,
    input: UpdateCommunityInput
  ): Promise<CommunityDto> {
    const community = await this.communitiesRepo.findById(id);
    if (!community) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_NOT_FOUND,
        message: 'Community not found',
      });
    }

    const membership = await this.communitiesRepo.getMembership(id, userId);
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.COMMUNITY_ACCESS_DENIED,
        message: 'Only community owner or admin can update settings',
      });
    }

    const updated = await this.communitiesRepo.updateCommunity(id, {
      name: input.name !== undefined ? input.name : community.name,
      description: input.description !== undefined ? input.description : community.description,
      privacy: input.privacy !== undefined ? input.privacy : community.privacy,
      rules: input.rules !== undefined ? (input.rules ? [...input.rules] : null) : community.rules,
      avatarMediaId:
        input.avatarMediaId !== undefined ? input.avatarMediaId : community.avatarMediaId,
      coverMediaId: input.coverMediaId !== undefined ? input.coverMediaId : community.coverMediaId,
    });

    return {
      id: updated!.id,
      creatorId: updated!.creatorId,
      name: updated!.name,
      slug: updated!.slug,
      description: updated!.description,
      avatarUrl: null,
      coverUrl: null,
      privacy: updated!.privacy as CommunityPrivacy,
      memberCount: updated!.memberCount,
      rules: updated!.rules || null,
      currentUserRole: membership.role as CommunityRole,
      currentUserMembershipStatus: membership.status as CommunityMembershipStatus,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  async joinCommunity(
    id: string,
    userId: string
  ): Promise<{ status: CommunityMembershipStatus; role: CommunityRole }> {
    await this.assertCanParticipate(userId);

    const community = await this.communitiesRepo.findById(id);
    if (!community) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_NOT_FOUND,
        message: 'Community not found',
      });
    }

    const existing = await this.communitiesRepo.getMembership(id, userId);
    if (existing) {
      if (existing.status === 'BANNED') {
        throw new ForbiddenException({
          statusCode: 403,
          code: ErrorCode.COMMUNITY_MEMBER_BANNED,
          message: 'You have been banned from this community',
        });
      }
      if (existing.status === 'ACTIVE') {
        return { status: 'ACTIVE', role: existing.role as CommunityRole };
      }
      if (existing.status === 'PENDING') {
        return { status: 'PENDING', role: existing.role as CommunityRole };
      }
    }

    const targetStatus: CommunityMembershipStatus =
      community.privacy === 'PRIVATE' ? 'PENDING' : 'ACTIVE';

    return this.databaseService.withTransaction(async (tx) => {
      // Re-verify existing membership inside transaction for consistency under concurrency
      const currentMembership = await this.communitiesRepo.getMembership(id, userId, tx);
      if (currentMembership) {
        if (currentMembership.status === 'BANNED') {
          throw new ForbiddenException({
            statusCode: 403,
            code: ErrorCode.COMMUNITY_MEMBER_BANNED,
            message: 'You have been banned from this community',
          });
        }
        if (currentMembership.status === 'ACTIVE' || currentMembership.status === 'PENDING') {
          return {
            status: currentMembership.status as CommunityMembershipStatus,
            role: currentMembership.role as CommunityRole,
          };
        }

        // Re-joining after leaving
        const updated = await this.communitiesRepo.updateMembership(
          id,
          userId,
          {
            status: targetStatus,
            joinedAt: new Date(),
          },
          tx
        );

        if (targetStatus === 'ACTIVE') {
          await this.communitiesRepo.incrementMemberCount(id, 1, tx);
        }

        // Outbox event
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'community.member_joined',
          aggregateType: 'COMMUNITY',
          aggregateId: id,
          payload: {
            communityId: id,
            userId,
            status: targetStatus,
            joinedAt: new Date().toISOString(),
          },
          status: 'PENDING',
        });

        return {
          status: updated!.status as CommunityMembershipStatus,
          role: updated!.role as CommunityRole,
        };
      }

      // No membership existed prior to transaction - upsert atomically to handle concurrent join races
      const { membership, wasCreated } = await this.communitiesRepo.upsertMembership(
        {
          id: generateUuidV7(),
          communityId: id,
          userId,
          role: 'MEMBER',
          status: targetStatus,
          joinedAt: new Date(),
          updatedAt: new Date(),
        },
        tx
      );

      // Only increment count and fire domain events if this request actually created the active membership
      if (wasCreated && targetStatus === 'ACTIVE') {
        await this.communitiesRepo.incrementMemberCount(id, 1, tx);
      }

      if (wasCreated) {
        // Outbox event
        await tx.insert(outboxEvents).values({
          id: generateUuidV7(),
          eventType: 'community.member_joined',
          aggregateType: 'COMMUNITY',
          aggregateId: id,
          payload: {
            communityId: id,
            userId,
            status: targetStatus,
            joinedAt: new Date().toISOString(),
          },
          status: 'PENDING',
        });
      }

      return {
        status: membership.status as CommunityMembershipStatus,
        role: membership.role as CommunityRole,
      };
    });
  }

  async leaveCommunity(id: string, userId: string): Promise<{ success: boolean }> {
    const community = await this.communitiesRepo.findById(id);
    if (!community) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_NOT_FOUND,
        message: 'Community not found',
      });
    }

    const membership = await this.communitiesRepo.getMembership(id, userId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new BadRequestException({
        statusCode: 400,
        code: ErrorCode.COMMUNITY_MEMBER_NOT_FOUND,
        message: 'You are not an active member of this community',
      });
    }

    if (membership.role === 'OWNER') {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.COMMUNITY_ACCESS_DENIED,
        message: 'Community owner cannot leave without transferring ownership',
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      await this.communitiesRepo.updateMembership(id, userId, { status: 'LEFT' }, tx);
      await this.communitiesRepo.incrementMemberCount(id, -1, tx);

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'community.member_left',
        aggregateType: 'COMMUNITY',
        aggregateId: id,
        payload: {
          communityId: id,
          userId,
          leftAt: new Date().toISOString(),
        },
        status: 'PENDING',
      });
    });

    return { success: true };
  }

  async banMember(
    communityId: string,
    actorUserId: string,
    targetUserId: string
  ): Promise<{ success: boolean }> {
    const community = await this.communitiesRepo.findById(communityId);
    if (!community) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_NOT_FOUND,
        message: 'Community not found',
      });
    }

    const actorMembership = await this.communitiesRepo.getMembership(communityId, actorUserId);
    if (!actorMembership || !['OWNER', 'ADMIN'].includes(actorMembership.role)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.COMMUNITY_ACCESS_DENIED,
        message: 'Only owner or admin can ban members',
      });
    }

    const targetMembership = await this.communitiesRepo.getMembership(communityId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_MEMBER_NOT_FOUND,
        message: 'Target member not found in community',
      });
    }

    if (targetMembership.role === 'OWNER') {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.COMMUNITY_ACCESS_DENIED,
        message: 'Cannot ban the community owner',
      });
    }

    await this.databaseService.withTransaction(async (tx) => {
      const wasActive = targetMembership.status === 'ACTIVE';
      await this.communitiesRepo.updateMembership(
        communityId,
        targetUserId,
        { status: 'BANNED' },
        tx
      );

      if (wasActive) {
        await this.communitiesRepo.incrementMemberCount(communityId, -1, tx);
      }

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'community.member_banned',
        aggregateType: 'COMMUNITY',
        aggregateId: communityId,
        payload: {
          communityId,
          bannedUserId: targetUserId,
          bannedByUserId: actorUserId,
          bannedAt: new Date().toISOString(),
        },
        status: 'PENDING',
      });
    });

    return { success: true };
  }

  async approveMembership(
    communityId: string,
    actorUserId: string,
    targetUserId: string
  ): Promise<{ success: boolean; status: CommunityMembershipStatus }> {
    const community = await this.communitiesRepo.findById(communityId);
    if (!community) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_NOT_FOUND,
        message: 'Community not found',
      });
    }

    const actorMembership = await this.communitiesRepo.getMembership(communityId, actorUserId);
    if (!actorMembership || !['OWNER', 'ADMIN', 'MODERATOR'].includes(actorMembership.role)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.COMMUNITY_ACCESS_DENIED,
        message: 'Only owner, admin, or moderator can approve memberships',
      });
    }

    const targetMembership = await this.communitiesRepo.getMembership(communityId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_MEMBER_NOT_FOUND,
        message: 'Membership request not found',
      });
    }

    if (targetMembership.status === 'ACTIVE') {
      return { success: true, status: 'ACTIVE' };
    }

    return this.databaseService.withTransaction(async (tx) => {
      await this.communitiesRepo.updateMembership(
        communityId,
        targetUserId,
        { status: 'ACTIVE', joinedAt: new Date() },
        tx
      );

      await this.communitiesRepo.incrementMemberCount(communityId, 1, tx);

      await tx.insert(outboxEvents).values({
        id: generateUuidV7(),
        eventType: 'community.membership_approved',
        aggregateType: 'COMMUNITY',
        aggregateId: communityId,
        payload: {
          communityId,
          targetUserId,
          approvedByUserId: actorUserId,
          approvedAt: new Date().toISOString(),
        },
        status: 'PENDING',
      });

      return { success: true, status: 'ACTIVE' };
    });
  }

  async listMembers(
    communityId: string,
    viewerUserId: string,
    query: GetCommunityMembersQueryInput
  ): Promise<CommunityMemberListResponseDto> {
    const community = await this.communitiesRepo.findById(communityId);
    if (!community) {
      throw new NotFoundException({
        statusCode: 404,
        code: ErrorCode.COMMUNITY_NOT_FOUND,
        message: 'Community not found',
      });
    }

    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    let parsedCursor: { joinedAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded && decoded.createdAt && decoded.id) {
        parsedCursor = {
          joinedAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      }
    }

    const blockedUserIds = await this.userBlocksRepo.getAllBlockedUserIdsForUser(viewerUserId);

    const rows = await this.communitiesRepo.listMembers(communityId, {
      limit: limit + 1,
      cursor: parsedCursor,
      excludedUserIds: blockedUserIds,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const userIds = pageRows.map((r) => r.userId);
    const authorMap = await this.profileEnricher.getAuthorMap(userIds);

    const items: CommunityMemberDto[] = pageRows.map((m) => ({
      id: m.id,
      communityId: m.communityId,
      userId: m.userId,
      user: authorMap.get(m.userId),
      role: m.role as CommunityRole,
      status: m.status as CommunityMembershipStatus,
      joinedAt: m.joinedAt.toISOString(),
    }));

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeCursor({
          createdAt: last.joinedAt.toISOString(),
          id: last.id,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async discoverCommunities(query: GetCommunitiesQueryInput): Promise<CommunityListResponseDto> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    let parsedCursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded && decoded.createdAt && decoded.id) {
        parsedCursor = {
          createdAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      }
    }

    const rows = await this.communitiesRepo.findDiscoverable({
      limit: limit + 1,
      cursor: parsedCursor,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items: CommunityDto[] = pageRows.map((c) => ({
      id: c.id,
      creatorId: c.creatorId,
      name: c.name,
      slug: c.slug,
      description: c.description,
      avatarUrl: null,
      coverUrl: null,
      privacy: c.privacy as CommunityPrivacy,
      memberCount: c.memberCount,
      rules: c.rules || null,
      currentUserRole: null,
      currentUserMembershipStatus: null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async getUserCommunities(
    userId: string,
    query: GetCommunitiesQueryInput
  ): Promise<CommunityListResponseDto> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    let parsedCursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded && decoded.createdAt && decoded.id) {
        parsedCursor = {
          createdAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      }
    }

    const rows = await this.communitiesRepo.findUserCommunities(userId, {
      limit: limit + 1,
      cursor: parsedCursor,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items: CommunityDto[] = pageRows.map((c) => ({
      id: c.id,
      creatorId: c.creatorId,
      name: c.name,
      slug: c.slug,
      description: c.description,
      avatarUrl: null,
      coverUrl: null,
      privacy: c.privacy as CommunityPrivacy,
      memberCount: c.memberCount,
      rules: c.rules || null,
      currentUserRole: null,
      currentUserMembershipStatus: 'ACTIVE',
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      if (last) {
        nextCursor = encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        });
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
