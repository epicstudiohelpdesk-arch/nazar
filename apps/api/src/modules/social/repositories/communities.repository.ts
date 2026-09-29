import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql, desc, isNull, notInArray } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  communities,
  type CommunityRow,
  type NewCommunityRow,
  communityMemberships,
  type CommunityMembershipRow,
  type NewCommunityMembershipRow,
} from '../../../infrastructure/database/drizzle/schema/communities.js';
import type {
  ICommunitiesRepository,
  ListCommunitiesOptions,
  ListMembersOptions,
} from './communities.repository.interface.js';

@Injectable()
export class CommunitiesRepository implements ICommunitiesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createCommunity(data: NewCommunityRow, tx?: DrizzleDatabase): Promise<CommunityRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(communities).values(data).returning();
    return row!;
  }

  async findById(id: string, tx?: DrizzleDatabase): Promise<CommunityRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(communities)
      .where(and(eq(communities.id, id), isNull(communities.deletedAt)))
      .limit(1);
    return row || null;
  }

  async findBySlug(slug: string, tx?: DrizzleDatabase): Promise<CommunityRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(communities)
      .where(and(eq(communities.slug, slug), isNull(communities.deletedAt)))
      .limit(1);
    return row || null;
  }

  async findByName(name: string, tx?: DrizzleDatabase): Promise<CommunityRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(communities)
      .where(and(eq(communities.name, name), isNull(communities.deletedAt)))
      .limit(1);
    return row || null;
  }

  async updateCommunity(
    id: string,
    data: Partial<NewCommunityRow>,
    tx?: DrizzleDatabase
  ): Promise<CommunityRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(communities)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(communities.id, id), isNull(communities.deletedAt)))
      .returning();
    return row || null;
  }

  async countUserCreatedCommunities(userId: string, tx?: DrizzleDatabase): Promise<number> {
    const client = this.getClient(tx);
    const [result] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(communities)
      .where(and(eq(communities.creatorId, userId), isNull(communities.deletedAt)));
    return result ? result.count : 0;
  }

  async findDiscoverable(
    options: ListCommunitiesOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly CommunityRow[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${communities.createdAt} < ${options.cursor.createdAt} OR (${communities.createdAt} = ${options.cursor.createdAt} AND ${communities.id} < ${options.cursor.id}))`;
    }

    return client
      .select()
      .from(communities)
      .where(and(eq(communities.privacy, 'PUBLIC'), isNull(communities.deletedAt), cursorCondition))
      .orderBy(desc(communities.createdAt), desc(communities.id))
      .limit(options.limit);
  }

  async findUserCommunities(
    userId: string,
    options: ListCommunitiesOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly CommunityRow[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${communities.createdAt} < ${options.cursor.createdAt} OR (${communities.createdAt} = ${options.cursor.createdAt} AND ${communities.id} < ${options.cursor.id}))`;
    }

    const rows = await client
      .select({ community: communities })
      .from(communityMemberships)
      .innerJoin(
        communities,
        and(eq(communities.id, communityMemberships.communityId), isNull(communities.deletedAt))
      )
      .where(
        and(
          eq(communityMemberships.userId, userId),
          eq(communityMemberships.status, 'ACTIVE'),
          cursorCondition
        )
      )
      .orderBy(desc(communities.createdAt), desc(communities.id))
      .limit(options.limit);

    return rows.map((r) => r.community);
  }

  async createMembership(
    data: NewCommunityMembershipRow,
    tx?: DrizzleDatabase
  ): Promise<CommunityMembershipRow> {
    const client = this.getClient(tx);
    const [row] = await client.insert(communityMemberships).values(data).returning();
    return row!;
  }

  async getMembership(
    communityId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<CommunityMembershipRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId)
        )
      )
      .limit(1);
    return row || null;
  }

  async updateMembership(
    communityId: string,
    userId: string,
    data: Partial<NewCommunityMembershipRow>,
    tx?: DrizzleDatabase
  ): Promise<CommunityMembershipRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .update(communityMemberships)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId)
        )
      )
      .returning();
    return row || null;
  }

  async deleteMembership(
    communityId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const result = await client
      .delete(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId)
        )
      )
      .returning();
    return result.length > 0;
  }

  async listMembers(
    communityId: string,
    options: ListMembersOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly CommunityMembershipRow[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${communityMemberships.joinedAt} < ${options.cursor.joinedAt} OR (${communityMemberships.joinedAt} = ${options.cursor.joinedAt} AND ${communityMemberships.id} < ${options.cursor.id}))`;
    }

    const conditions = [
      eq(communityMemberships.communityId, communityId),
      eq(communityMemberships.status, 'ACTIVE'),
      cursorCondition,
    ];

    if (options.excludedUserIds && options.excludedUserIds.length > 0) {
      conditions.push(notInArray(communityMemberships.userId, [...options.excludedUserIds]));
    }

    return client
      .select()
      .from(communityMemberships)
      .where(and(...conditions))
      .orderBy(desc(communityMemberships.joinedAt), desc(communityMemberships.id))
      .limit(options.limit);
  }

  async incrementMemberCount(
    communityId: string,
    delta: number,
    tx?: DrizzleDatabase
  ): Promise<void> {
    const client = this.getClient(tx);
    await client
      .update(communities)
      .set({
        memberCount: sql`GREATEST(0, ${communities.memberCount} + ${delta})`,
        updatedAt: new Date(),
      })
      .where(eq(communities.id, communityId));
  }
}
