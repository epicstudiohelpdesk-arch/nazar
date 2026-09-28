import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, asc, lt, gt, or } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  messages,
  type MessageRow,
  type NewMessageRow,
} from '../../../infrastructure/database/drizzle/schema/messages.js';
import type { IMessagesRepository } from './messages.repository.interface.js';

@Injectable()
export class MessagesRepository implements IMessagesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase) {
    return tx || this.databaseService.client;
  }

  async createMessage(
    row: NewMessageRow,
    tx?: DrizzleDatabase
  ): Promise<{ message: MessageRow; wasCreated: boolean }> {
    const client = this.getClient(tx);

    const inserted = await client
      .insert(messages)
      .values(row)
      .onConflictDoNothing({
        target: [messages.conversationId, messages.senderUserId, messages.clientMessageId],
      })
      .returning();

    if (inserted && inserted.length > 0 && inserted[0]) {
      return { message: inserted[0], wasCreated: true };
    }

    // Already exists via idempotency key
    const existing = await this.findMessageByClientMessageId(
      row.conversationId,
      row.senderUserId,
      row.clientMessageId,
      tx
    );

    if (!existing) {
      throw new Error('Failed to resolve idempotent message conflict');
    }

    return { message: existing, wasCreated: false };
  }

  async findMessageById(messageId: string, tx?: DrizzleDatabase): Promise<MessageRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    return rows[0] || null;
  }

  async findMessageByClientMessageId(
    conversationId: string,
    senderUserId: string,
    clientMessageId: string,
    tx?: DrizzleDatabase
  ): Promise<MessageRow | null> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderUserId, senderUserId),
          eq(messages.clientMessageId, clientMessageId)
        )
      )
      .limit(1);
    return rows[0] || null;
  }

  async findMessagesByConversation(
    conversationId: string,
    options: {
      limit: number;
      cursor?: { createdAt: Date; id: string };
    },
    tx?: DrizzleDatabase
  ): Promise<readonly MessageRow[]> {
    const client = this.getClient(tx);
    const conditions = [eq(messages.conversationId, conversationId)];

    if (options.cursor) {
      conditions.push(
        or(
          lt(messages.createdAt, options.cursor.createdAt),
          and(
            eq(messages.createdAt, options.cursor.createdAt),
            lt(messages.id, options.cursor.id)
          )
        )!
      );
    }

    return client
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(options.limit);
  }

  async findMessagesSince(
    conversationId: string,
    sinceCreatedAt: Date,
    sinceId: string,
    limit: number,
    tx?: DrizzleDatabase
  ): Promise<readonly MessageRow[]> {
    const client = this.getClient(tx);
    const conditions = [
      eq(messages.conversationId, conversationId),
      or(
        gt(messages.createdAt, sinceCreatedAt),
        and(
          eq(messages.createdAt, sinceCreatedAt),
          gt(messages.id, sinceId)
        )
      )!,
    ];

    return client
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(asc(messages.createdAt), asc(messages.id))
      .limit(limit);
  }
}
