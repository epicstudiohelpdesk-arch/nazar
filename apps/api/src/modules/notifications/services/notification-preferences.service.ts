import { Injectable, Inject } from '@nestjs/common';
import type {
  NotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
} from '@platform/api-contracts';
import {
  NOTIFICATION_PREFERENCES_REPOSITORY_TOKEN,
  type INotificationPreferencesRepository,
} from '../repositories/notification-preferences.repository.interface.js';
import type { NotificationPreferencesRow } from '../../../infrastructure/database/drizzle/schema/notification-preferences.js';

function mapPreferencesToDto(row: NotificationPreferencesRow): NotificationPreferencesDto {
  return {
    matchNotificationsEnabled: row.matchNotificationsEnabled,
    messageNotificationsEnabled: row.messageNotificationsEnabled,
    likeNotificationsEnabled: row.likeNotificationsEnabled,
    safetyNotificationsEnabled: row.safetyNotificationsEnabled,
    systemNotificationsEnabled: row.systemNotificationsEnabled,
    messagePreviewEnabled: row.messagePreviewEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @Inject(NOTIFICATION_PREFERENCES_REPOSITORY_TOKEN)
    private readonly prefsRepo: INotificationPreferencesRepository
  ) {}

  async getPreferences(userId: string): Promise<NotificationPreferencesDto> {
    const row = await this.prefsRepo.getPreferences(userId);
    return mapPreferencesToDto(row);
  }

  async updatePreferences(
    userId: string,
    update: UpdateNotificationPreferencesDto
  ): Promise<NotificationPreferencesDto> {
    const updated = await this.prefsRepo.updatePreferences(userId, update);
    return mapPreferencesToDto(updated);
  }
}
