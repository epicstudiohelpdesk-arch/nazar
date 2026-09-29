import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import {
  ErrorCode,
  type NotificationResponseDto,
  type NotificationListResponseDto,
  type UnreadNotificationCountDto,
  type MarkNotificationReadResponseDto,
  type MarkAllNotificationsReadResponseDto,
  type NotificationType,
  type NotificationPriority,
} from '@platform/api-contracts';
import {
  NOTIFICATIONS_REPOSITORY_TOKEN,
  type INotificationsRepository,
} from '../repositories/notifications.repository.interface.js';
import type { NotificationRow } from '../../../infrastructure/database/drizzle/schema/notifications.js';

function mapNotificationToDto(row: NotificationRow): NotificationResponseDto {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    data: (row.data as Record<string, unknown>) || null,
    priority: row.priority as NotificationPriority,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

interface CursorData {
  readonly createdAt: string;
  readonly id: string;
}

function encodeCursor(createdAt: Date, id: string): string {
  const data: CursorData = { createdAt: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(data), 'utf-8').toString('base64url');
}

function decodeCursor(cursorString?: string): { createdAt: Date; id: string } | undefined {
  if (!cursorString) return undefined;
  try {
    const raw = Buffer.from(cursorString, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw) as CursorData;
    const date = new Date(parsed.createdAt);
    if (isNaN(date.getTime()) || !parsed.id) return undefined;
    return { createdAt: date, id: parsed.id };
  } catch {
    return undefined;
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY_TOKEN)
    private readonly notificationsRepo: INotificationsRepository
  ) {}

  async listNotifications(
    userId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<NotificationListResponseDto> {
    const parsedCursor = decodeCursor(cursor);
    const fetchLimit = Math.min(Math.max(limit, 1), 50);

    // Fetch limit + 1 to determine hasMore
    const rows = await this.notificationsRepo.listNotifications(userId, {
      limit: fetchLimit + 1,
      cursor: parsedCursor,
    });

    const hasMore = rows.length > fetchLimit;
    const items = hasMore ? rows.slice(0, fetchLimit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1]!;
      nextCursor = encodeCursor(lastItem.createdAt, lastItem.id);
    }

    const totalUnreadCount = await this.notificationsRepo.countUnread(userId);

    return {
      items: items.map(mapNotificationToDto),
      nextCursor,
      hasMore,
      totalUnreadCount,
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadNotificationCountDto> {
    const count = await this.notificationsRepo.countUnread(userId);
    return { count };
  }

  async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<MarkNotificationReadResponseDto> {
    const notification = await this.notificationsRepo.findById(notificationId);
    if (!notification) {
      throw new HttpException(
        {
          code: ErrorCode.NOTIFICATION_NOT_FOUND,
          message: 'Notification not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    if (notification.userId !== userId) {
      throw new HttpException(
        {
          code: ErrorCode.NOTIFICATION_ACCESS_DENIED,
          message: 'Access denied to notification',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const updated = await this.notificationsRepo.markAsRead(notificationId, userId);
    const readAt = updated?.readAt ? updated.readAt.toISOString() : new Date().toISOString();

    return {
      id: notificationId,
      readAt,
    };
  }

  async markAllAsRead(userId: string): Promise<MarkAllNotificationsReadResponseDto> {
    const updatedCount = await this.notificationsRepo.markAllAsRead(userId);
    return { updatedCount };
  }
}
