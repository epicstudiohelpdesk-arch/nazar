import {
  type RegisterDeviceRequestDto,
  type DeviceResponseDto,
  type NotificationListResponseDto,
  type UnreadNotificationCountDto,
  type MarkNotificationReadResponseDto,
  type MarkAllNotificationsReadResponseDto,
  type NotificationPreferencesDto,
  type UpdateNotificationPreferencesDto,
} from '@platform/api-contracts';

export interface NotificationsApiConfig {
  readonly baseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
}

export class NotificationsApiClient {
  constructor(private readonly config: NotificationsApiConfig) {}

  private async fetchWithAuth<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data: T }> {
    const token = await this.config.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(
        errorBody?.message || errorBody?.code || `HTTP error ${res.status}: ${res.statusText}`
      );
    }

    return res.json();
  }

  // ----------------------------------------------------
  // Devices API
  // ----------------------------------------------------

  async registerDevice(payload: RegisterDeviceRequestDto): Promise<DeviceResponseDto> {
    const res = await this.fetchWithAuth<DeviceResponseDto>('/v1/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async listDevices(): Promise<readonly DeviceResponseDto[]> {
    const res = await this.fetchWithAuth<readonly DeviceResponseDto[]>('/v1/devices', {
      method: 'GET',
    });
    return res.data;
  }

  async revokeDevice(deviceId: string): Promise<boolean> {
    const res = await this.fetchWithAuth<{ revoked: boolean }>(`/v1/devices/${deviceId}`, {
      method: 'DELETE',
    });
    return res.data.revoked;
  }

  // ----------------------------------------------------
  // Notifications History & Read State API
  // ----------------------------------------------------

  async listNotifications(params?: {
    limit?: number;
    cursor?: string;
  }): Promise<NotificationListResponseDto> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.cursor) query.set('cursor', params.cursor);

    const qs = query.toString();
    const endpoint = `/v1/notifications${qs ? `?${qs}` : ''}`;
    const res = await this.fetchWithAuth<NotificationListResponseDto>(endpoint, {
      method: 'GET',
    });
    return res.data;
  }

  async getUnreadCount(): Promise<number> {
    const res = await this.fetchWithAuth<UnreadNotificationCountDto>(
      '/v1/notifications/unread-count',
      { method: 'GET' }
    );
    return res.data.count;
  }

  async markAsRead(notificationId: string): Promise<MarkNotificationReadResponseDto> {
    const res = await this.fetchWithAuth<MarkNotificationReadResponseDto>(
      `/v1/notifications/${notificationId}/read`,
      { method: 'POST' }
    );
    return res.data;
  }

  async markAllAsRead(): Promise<number> {
    const res = await this.fetchWithAuth<MarkAllNotificationsReadResponseDto>(
      '/v1/notifications/read-all',
      { method: 'POST' }
    );
    return res.data.updatedCount;
  }

  // ----------------------------------------------------
  // Notification Preferences API
  // ----------------------------------------------------

  async getPreferences(): Promise<NotificationPreferencesDto> {
    const res = await this.fetchWithAuth<NotificationPreferencesDto>(
      '/v1/notifications/preferences',
      { method: 'GET' }
    );
    return res.data;
  }

  async updatePreferences(
    dto: UpdateNotificationPreferencesDto
  ): Promise<NotificationPreferencesDto> {
    const res = await this.fetchWithAuth<NotificationPreferencesDto>(
      '/v1/notifications/preferences',
      {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }
    );
    return res.data;
  }
}
