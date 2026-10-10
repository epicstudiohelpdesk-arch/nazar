import type {
  RegisterDeviceRequestDto,
  DeviceResponseDto,
  NotificationListResponseDto,
  UnreadNotificationCountDto,
  MarkNotificationReadResponseDto,
  MarkAllNotificationsReadResponseDto,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
} from '@platform/api-contracts';
import { SocialApiError } from '../social/social-state.js';
import { getDefaultAuthClient } from '../auth/default-client.js';
import type { AuthClient } from '../auth/auth-client.js';
import { isSafeIdentifier } from './notification-payload.js';

export interface NotificationsApiConfig {
  readonly baseUrl: string;
  readonly getAccessToken: () => Promise<string | null>;
  /** Injectable for tests. Defaults to the global `fetch`. */
  readonly fetchFn?: typeof fetch;
}

interface NotificationsEnvelopeShape {
  readonly success?: boolean;
  readonly data?: unknown;
  readonly error?: {
    readonly statusCode?: number;
    readonly code?: string;
    readonly message?: string;
    readonly details?: readonly { field: string; message: string; code?: string }[];
  };
  readonly requestId?: string;
}

/**
 * Maps a response to data or a typed {@link SocialApiError}.
 *
 * The previous version threw `new Error(message)`, which discarded the
 * `code`. Read-state and preference mutations need the code to tell "this
 * notification is gone" (`NOTIFICATION_NOT_FOUND`) apart from "your session
 * expired", and neither should be shown as raw server text.
 */
async function parseNotificationsResponse<T>(
  res: Response
): Promise<{ success: boolean; data: T }> {
  let body: NotificationsEnvelopeShape = {};
  try {
    body = (await res.json()) as NotificationsEnvelopeShape;
  } catch {
    body = {};
  }

  if (res.ok && body.success === true) {
    return { success: true, data: body.data as T };
  }
  if (res.ok && body.data !== undefined) {
    return { success: true, data: body.data as T };
  }

  // `SocialApiError` accepts `ErrorCode | string` so a transport failure that
  // never reached the API can still carry a meaningful code.
  throw new SocialApiError({
    code: body.error?.code ?? `HTTP_${res.status}`,
    statusCode: body.error?.statusCode ?? res.status,
    message: body.error?.message ?? res.statusText ?? 'Request failed',
    details: body.error?.details ?? [],
    requestId: body.requestId,
  });
}

/**
 * Rejects an id that cannot be safely placed in a path.
 *
 * Ids here come from the server, but the guard means a compromised or buggy
 * response cannot inject a path segment, and it turns a would-be 404 into a
 * local, explicit error.
 */
function requireSafeId(id: string, field: string): string {
  if (!isSafeIdentifier(id)) {
    throw new SocialApiError({
      code: 'NOTIFICATION_ACCESS_DENIED',
      statusCode: 400,
      message: `${field} is not a valid identifier`,
    });
  }
  return encodeURIComponent(id);
}

export class NotificationsApiClient {
  private readonly fetch: typeof fetch;

  constructor(private readonly config: NotificationsApiConfig) {
    this.fetch = config.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

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

    const res = await this.fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
    return parseNotificationsResponse<T>(res);
  }

  // ----------------------------------------------------
  // Activity feed & read state
  // ----------------------------------------------------

  /**
   * `limit` is capped at 50 by `listNotificationsQuerySchema`; the page size is
   * clamped here so a caller cannot ask for a limit the API will reject.
   */
  async listNotifications(
    params: { limit?: number; cursor?: string } = {}
  ): Promise<NotificationListResponseDto> {
    const limit = Math.min(Math.max(Math.trunc(params.limit ?? 20), 1), 50);
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    if (params.cursor) {
      query.set('cursor', params.cursor);
    }
    const res = await this.fetchWithAuth<NotificationListResponseDto>(
      `/v1/notifications?${query.toString()}`
    );
    return res.data;
  }

  async getUnreadCount(): Promise<number> {
    const res = await this.fetchWithAuth<UnreadNotificationCountDto>(
      '/v1/notifications/unread-count'
    );
    return res.data.count;
  }

  async markAsRead(notificationId: string): Promise<MarkNotificationReadResponseDto> {
    const id = requireSafeId(notificationId, 'notificationId');
    const res = await this.fetchWithAuth<MarkNotificationReadResponseDto>(
      `/v1/notifications/${id}/read`,
      { method: 'POST' }
    );
    return res.data;
  }

  async markAllAsRead(): Promise<MarkAllNotificationsReadResponseDto> {
    const res = await this.fetchWithAuth<MarkAllNotificationsReadResponseDto>(
      '/v1/notifications/read-all',
      { method: 'POST' }
    );
    return res.data;
  }

  // ----------------------------------------------------
  // Preferences
  // ----------------------------------------------------

  async getPreferences(): Promise<NotificationPreferencesDto> {
    const res = await this.fetchWithAuth<NotificationPreferencesDto>(
      '/v1/notifications/preferences'
    );
    return res.data;
  }

  async updatePreferences(
    dto: UpdateNotificationPreferencesDto
  ): Promise<NotificationPreferencesDto> {
    const res = await this.fetchWithAuth<NotificationPreferencesDto>(
      '/v1/notifications/preferences',
      { method: 'PATCH', body: JSON.stringify(dto) }
    );
    return res.data;
  }

  // ----------------------------------------------------
  // Device registration
  // ----------------------------------------------------

  async registerDevice(payload: RegisterDeviceRequestDto): Promise<DeviceResponseDto> {
    const res = await this.fetchWithAuth<DeviceResponseDto>('/v1/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async listDevices(): Promise<readonly DeviceResponseDto[]> {
    const res = await this.fetchWithAuth<readonly DeviceResponseDto[]>('/v1/devices');
    return res.data;
  }

  async revokeDevice(deviceId: string): Promise<boolean> {
    const id = requireSafeId(deviceId, 'deviceId');
    const res = await this.fetchWithAuth<{ revoked: boolean }>(`/v1/devices/${id}`, {
      method: 'DELETE',
    });
    return res.data.revoked;
  }
}

/**
 * Prefix keys.
 *
 * `unreadCount` is a sibling of `list`, not a child, so invalidating the feed
 * would otherwise leave the badge showing a pre-mutation total. The reverse is
 * also true: a read mutation must clear the badge, not just the rows.
 */
export const NOTIFICATION_QUERY_KEYS = {
  root: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  preferences: ['notifications', 'preferences'] as const,
  devices: ['notifications', 'devices'] as const,
};

export function createNotificationsApi(authClient: AuthClient): NotificationsApiClient {
  return new NotificationsApiClient({
    baseUrl: authClient.getBaseUrl(),
    getAccessToken: async () => authClient.getStorage().getAccessToken(),
  });
}

let defaultNotificationsApi: NotificationsApiClient | null = null;
export function getDefaultNotificationsApi(): NotificationsApiClient {
  if (!defaultNotificationsApi) {
    defaultNotificationsApi = createNotificationsApi(getDefaultAuthClient());
  }
  return defaultNotificationsApi;
}
