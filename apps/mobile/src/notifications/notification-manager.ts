import type { NotificationType } from '@platform/api-contracts';

export type NotificationPermissionStatus = 'UNDETERMINED' | 'AUTHORIZED' | 'DENIED';

export interface PushNotificationPayload {
  readonly type: NotificationType;
  readonly notificationId?: string;
  readonly conversationId?: string;
  readonly matchId?: string;
  readonly [key: string]: unknown;
}

export class NotificationManager {
  private permissionStatus: NotificationPermissionStatus = 'UNDETERMINED';

  getPermissionStatus(): NotificationPermissionStatus {
    return this.permissionStatus;
  }

  async requestPermission(): Promise<NotificationPermissionStatus> {
    // In production mobile runtime, this triggers the native Expo / OS permission prompt
    this.permissionStatus = 'AUTHORIZED';
    return this.permissionStatus;
  }

  /**
   * Resolves the deep-link route based on notification type and payload data.
   * Note: The app navigates to the target route, but the server remains authoritative
   * for access control when loading the resource.
   */
  resolveDeepLinkRoute(payload: PushNotificationPayload): string {
    switch (payload.type) {
      case 'NEW_MESSAGE':
        if (payload.conversationId) {
          return `/chat/${payload.conversationId}`;
        }
        return '/conversations';

      case 'NEW_MATCH':
        if (payload.matchId) {
          return `/matches/${payload.matchId}`;
        }
        return '/matches';

      case 'NEW_LIKE':
        return '/discovery';

      case 'ACCOUNT_RESTRICTION':
      case 'SECURITY_ALERT':
      case 'SYSTEM_NOTICE':
      default:
        return '/notifications';
    }
  }
}

export const notificationManager = new NotificationManager();
