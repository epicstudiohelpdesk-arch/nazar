import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  notifications,
  type NotificationRow,
  type NewNotificationRow,
} from '../../../infrastructure/database/drizzle/schema/notifications.js';
import { generateUuidV7 } from '@platform/domain';
import type {
  INotificationsRepository,
  ListNotificationsOptions,
} from './notifications.repository.interface.js';

@Injectable()
export class NotificationsRepository implements INotificationsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async createNotification(
    data: Omit<NewNotificationRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<{ notification: NotificationRow; isDuplicate: boolean }> {
    const client = this.getClient(tx);
    const id = generateUuidV7();
    const now = new Date();

    if (data.sourceEventId) {
      const [created] = await client
        .insert(notifications)
        .values({
          id,
          userId: data.userId,
          sourceEventId: data.sourceEventId,
          type: data.type,
          title: data.title,
          body: data.body,
          data: data.data || null,
          priority: data.priority || 'NORMAL',
          readAt: data.readAt || null,
          expiresAt: data.expiresAt || null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [notifications.sourceEventId, notifications.userId, notifications.type],
        })
        .returning();

      if (created) {
        return { notification: created, isDuplicate: false };
      }

      // Existing duplicate
      const [existing] = await client
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.sourceEventId, data.sourceEventId),
            eq(notifications.userId, data.userId),
            eq(notifications.type, data.type)
          )
        )
        .limit(1);

      return { notification: existing!, isDuplicate: true };
    }

    const [created] = await client
      .insert(notifications)
      .values({
        id,
        userId: data.userId,
        sourceEventId: null,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data || null,
        priority: data.priority || 'NORMAL',
        readAt: data.readAt || null,
        expiresAt: data.expiresAt || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { notification: created!, isDuplicate: false };
  }

  async findById(notificationId: string, tx?: DrizzleDatabase): Promise<NotificationRow | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    return row || null;
  }

  async listNotifications(
    userId: string,
    options: ListNotificationsOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly NotificationRow[]> {
    const client = this.getClient(tx);

    let cursorCondition = sql`TRUE`;
    if (options.cursor) {
      cursorCondition = sql`(${notifications.createdAt} < ${options.cursor.createdAt} OR (${notifications.createdAt} = ${options.cursor.createdAt} AND ${notifications.id} < ${options.cursor.id}))`;
    }

    const now = new Date();
    return client
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          cursorCondition,
          sql`(${notifications.expiresAt} IS NULL OR ${notifications.expiresAt} > ${now})`
        )
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(options.limit);
  }

  async countUnread(userId: string, tx?: DrizzleDatabase): Promise<number> {
    const client = this.getClient(tx);
    const now = new Date();

    const [result] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          sql`${notifications.readAt} IS NULL`,
          sql`(${notifications.expiresAt} IS NULL OR ${notifications.expiresAt} > ${now})`
        )
      );

    return result?.count || 0;
  }

  async markAsRead(
    notificationId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<NotificationRow | null> {
    const client = this.getClient(tx);
    const now = new Date();

    const [updated] = await client
      .update(notifications)
      .set({
        readAt: now,
        updatedAt: now,
      })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    return updated || null;
  }

  async markAllAsRead(userId: string, tx?: DrizzleDatabase): Promise<number> {
    const client = this.getClient(tx);
    const now = new Date();

    const result = await client
      .update(notifications)
      .set({
        readAt: now,
        updatedAt: now,
      })
      .where(and(eq(notifications.userId, userId), sql`${notifications.readAt} IS NULL`))
      .returning({ id: notifications.id });

    return result.length;
  }

  async cleanupExpired(now: Date = new Date(), tx?: DrizzleDatabase): Promise<number> {
    const client = this.getClient(tx);

    const result = await client
      .delete(notifications)
      .where(sql`${notifications.expiresAt} < ${now}`)
      .returning({ id: notifications.id });

    return result.length;
  }
}
