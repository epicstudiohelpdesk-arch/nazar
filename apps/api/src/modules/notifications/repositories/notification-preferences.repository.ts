import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DatabaseService,
  type DrizzleDatabase,
} from '../../../infrastructure/database/database.service.js';
import {
  notificationPreferences,
  type NotificationPreferencesRow,
} from '../../../infrastructure/database/drizzle/schema/notification-preferences.js';
import { generateUuidV7 } from '@platform/domain';
import type { UpdateNotificationPreferencesDto } from '@platform/api-contracts';
import type { INotificationPreferencesRepository } from './notification-preferences.repository.interface.js';

@Injectable()
export class NotificationPreferencesRepository implements INotificationPreferencesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private getClient(tx?: DrizzleDatabase): DrizzleDatabase {
    return tx || this.databaseService.client;
  }

  async getPreferences(userId: string, tx?: DrizzleDatabase): Promise<NotificationPreferencesRow> {
    const client = this.getClient(tx);

    const [existing] = await client
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Auto-initialize safe server-side defaults
    const now = new Date();
    const [created] = await client
      .insert(notificationPreferences)
      .values({
        id: generateUuidV7(),
        userId,
        matchNotificationsEnabled: true,
        messageNotificationsEnabled: true,
        likeNotificationsEnabled: true,
        safetyNotificationsEnabled: true,
        systemNotificationsEnabled: true,
        messagePreviewEnabled: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: [notificationPreferences.userId] })
      .returning();

    if (created) {
      return created;
    }

    // In case of concurrent insert conflict, fetch the existing record
    const [conflictRow] = await client
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return conflictRow!;
  }

  async updatePreferences(
    userId: string,
    update: UpdateNotificationPreferencesDto,
    tx?: DrizzleDatabase
  ): Promise<NotificationPreferencesRow> {
    const client = this.getClient(tx);
    // Ensure row exists first
    await this.getPreferences(userId, tx);

    const now = new Date();
    const [updated] = await client
      .update(notificationPreferences)
      .set({
        ...(update.matchNotificationsEnabled !== undefined
          ? { matchNotificationsEnabled: update.matchNotificationsEnabled }
          : {}),
        ...(update.messageNotificationsEnabled !== undefined
          ? { messageNotificationsEnabled: update.messageNotificationsEnabled }
          : {}),
        ...(update.likeNotificationsEnabled !== undefined
          ? { likeNotificationsEnabled: update.likeNotificationsEnabled }
          : {}),
        ...(update.safetyNotificationsEnabled !== undefined
          ? { safetyNotificationsEnabled: update.safetyNotificationsEnabled }
          : {}),
        ...(update.systemNotificationsEnabled !== undefined
          ? { systemNotificationsEnabled: update.systemNotificationsEnabled }
          : {}),
        ...(update.messagePreviewEnabled !== undefined
          ? { messagePreviewEnabled: update.messagePreviewEnabled }
          : {}),
        updatedAt: now,
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning();

    return updated!;
  }
}
