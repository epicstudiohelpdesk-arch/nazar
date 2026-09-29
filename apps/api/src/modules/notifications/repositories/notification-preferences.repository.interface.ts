import type { NotificationPreferencesRow } from '../../../infrastructure/database/drizzle/schema/notification-preferences.js';
import type { DrizzleDatabase } from '../../../infrastructure/database/database.service.js';
import type { UpdateNotificationPreferencesDto } from '@platform/api-contracts';

export interface INotificationPreferencesRepository {
  getPreferences(userId: string, tx?: DrizzleDatabase): Promise<NotificationPreferencesRow>;

  updatePreferences(
    userId: string,
    update: UpdateNotificationPreferencesDto,
    tx?: DrizzleDatabase
  ): Promise<NotificationPreferencesRow>;
}

export const NOTIFICATION_PREFERENCES_REPOSITORY_TOKEN = Symbol(
  'INotificationPreferencesRepository'
);
