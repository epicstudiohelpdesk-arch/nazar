import { Injectable, Inject } from '@nestjs/common';
import { eq, or, and, desc, lt, count, ne, gt } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/domain';
import type { ConversationStatus } from '@platform/api-contracts';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  conversations,
  conversationReadStates,
  type ConversationRow,
  type ConversationReadStateRow,
} from '../../../infrastructure/database/drizzle/schema/conversations.js';
import { matches } from '../../../infrastructure/database/drizzle/schema/matches.js';
import { messages } from '../../../infrastructure/database/drizzle/schema/messages.js';
import type {
  IConversationsRepository,
  ConversationWithMatchRow,
} from './conversations.repository.interface.js';

@Injectable()
export class ConversationsRepository implements IConversationsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async createConversation(matchId: string, tx?: DrizzleDatabase): Promise<ConversationRow> {
    const client = this.getClient(tx);
    const id = generateUuidV7();
    const [created] = await client
      .insert(conversations)
      .values({
        id,
        matchId,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create conversation');
    }
    return created;
  }

  async findConversationById(
    conversationId: string,
    tx?: DrizzleDatabase
  ): Promise<ConversationRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    return rows[0] || null;
  }

  async findConversationByMatchId(
    matchId: string,
    tx?: DrizzleDatabase
  ): Promise<ConversationRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(conversations)
      .where(eq(conversations.matchId, matchId))
      .limit(1);
    return rows[0] || null;
  }

  async findOrCreateConversationForMatchTx(
    matchId: string,
    tx: DrizzleDatabase
  ): Promise<ConversationRow> {
    const existing = await this.findConversationByMatchId(matchId, tx);
    if (existing) {
      return existing;
    }

    const id = generateUuidV7();
    const [created] = await tx
      .insert(conversations)
      .values({
        id,
        matchId,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [conversations.matchId],
        set: {
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!created) {
      throw new Error('Failed to find or create conversation for match');
    }
    return created;
  }

  async findConversationsForUser(
    userId: string,
    options: {
      limit: number;
      cursor?: { updatedAt: Date; id: string };
    },
    tx?: DrizzleDatabase
  ): Promise<readonly ConversationWithMatchRow[]> {
    const client = this.getClient(tx);

    const conditions = [or(eq(matches.userAId, userId), eq(matches.userBId, userId))];

    if (options.cursor) {
      conditions.push(
        or(
          lt(conversations.updatedAt, options.cursor.updatedAt),
          and(
            eq(conversations.updatedAt, options.cursor.updatedAt),
            lt(conversations.id, options.cursor.id)
          )
        )!
      );
    }

    const rows = await client
      .select({
        conversation: conversations,
        match: matches,
        readState: conversationReadStates,
      })
      .from(conversations)
      .innerJoin(matches, eq(conversations.matchId, matches.id))
      .leftJoin(
        conversationReadStates,
        and(
          eq(conversationReadStates.conversationId, conversations.id),
          eq(conversationReadStates.userId, userId)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt), desc(conversations.id))
      .limit(options.limit);

    return rows.map((r) => {
      const otherUserId = r.match.userAId === userId ? r.match.userBId : r.match.userAId;
      return {
        conversation: r.conversation,
        match: r.match,
        otherUserId,
        lastReadMessageId: r.readState?.lastReadMessageId || null,
        lastReadAt: r.readState?.lastReadAt || null,
      };
    });
  }

  async updateConversationStatus(
    conversationId: string,
    status: ConversationStatus,
    tx?: DrizzleDatabase
  ): Promise<ConversationRow | null> {
    const client = this.getClient(tx);
    const [updated] = await client
      .update(conversations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();
    return updated || null;
  }

  async updateLastMessage(
    conversationId: string,
    messageId: string,
    messageAt: Date,
    tx?: DrizzleDatabase
  ): Promise<void> {
    const client = this.getClient(tx);
    await client
      .update(conversations)
      .set({
        lastMessageId: messageId,
        lastMessageAt: messageAt,
        updatedAt: messageAt,
      })
      .where(eq(conversations.id, conversationId));
  }

  async getReadState(
    conversationId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<ConversationReadStateRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(conversationReadStates)
      .where(
        and(
          eq(conversationReadStates.conversationId, conversationId),
          eq(conversationReadStates.userId, userId)
        )
      )
      .limit(1);
    return rows[0] || null;
  }

  async upsertReadState(
    conversationId: string,
    userId: string,
    lastReadMessageId: string,
    lastReadAt: Date,
    tx?: DrizzleDatabase
  ): Promise<ConversationReadStateRow> {
    const client = this.getClient(tx);
    const [saved] = await client
      .insert(conversationReadStates)
      .values({
        conversationId,
        userId,
        lastReadMessageId,
        lastReadAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [conversationReadStates.conversationId, conversationReadStates.userId],
        set: {
          lastReadMessageId,
          lastReadAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!saved) {
      throw new Error('Failed to upsert conversation read state');
    }
    return saved;
  }

  async upsertDeliveredState(
    conversationId: string,
    userId: string,
    lastDeliveredMessageId: string,
    lastDeliveredAt: Date,
    tx?: DrizzleDatabase
  ): Promise<ConversationReadStateRow> {
    const client = this.getClient(tx);
    const [saved] = await client
      .insert(conversationReadStates)
      .values({
        conversationId,
        userId,
        lastDeliveredMessageId,
        lastDeliveredAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [conversationReadStates.conversationId, conversationReadStates.userId],
        set: {
          lastDeliveredMessageId,
          lastDeliveredAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!saved) {
      throw new Error('Failed to upsert conversation delivered state');
    }
    return saved;
  }

  async getUnreadCount(
    conversationId: string,
    userId: string,
    lastReadAt?: Date | null,
    tx?: DrizzleDatabase
  ): Promise<number> {
    const client = this.getClient(tx);
    const conditions = [
      eq(messages.conversationId, conversationId),
      ne(messages.senderUserId, userId),
    ];

    if (lastReadAt) {
      conditions.push(gt(messages.createdAt, lastReadAt));
    }

    const [result] = await client
      .select({ val: count() })
      .from(messages)
      .where(and(...conditions));

    return Number(result?.val || 0);
  }
}
