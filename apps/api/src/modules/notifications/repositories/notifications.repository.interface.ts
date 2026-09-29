import type {
  NotificationRow,
  NewNotificationRow,
} from '../../../infrastructure/database/drizzle/schema/notifications.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';

export interface ListNotificationsOptions {
  readonly limit: number;
  readonly cursor?: {
    readonly createdAt: Date;
    readonly id: string;
  };
}

export interface INotificationsRepository {
  createNotification(
    data: Omit<NewNotificationRow, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: DrizzleDatabase
  ): Promise<{ notification: NotificationRow; isDuplicate: boolean }>;

  findById(notificationId: string, tx?: DrizzleDatabase): Promise<NotificationRow | null>;

  listNotifications(
    userId: string,
    options: ListNotificationsOptions,
    tx?: DrizzleDatabase
  ): Promise<readonly NotificationRow[]>;

  countUnread(userId: string, tx?: DrizzleDatabase): Promise<number>;

  markAsRead(
    notificationId: string,
    userId: string,
    tx?: DrizzleDatabase
  ): Promise<NotificationRow | null>;

  markAllAsRead(userId: string, tx?: DrizzleDatabase): Promise<number>;

  cleanupExpired(now?: Date, tx?: DrizzleDatabase): Promise<number>;
}

export const NOTIFICATIONS_REPOSITORY_TOKEN = Symbol('INotificationsRepository');
