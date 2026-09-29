import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsApiClient } from '../src/notifications/notifications-api.js';
import { notificationManager } from '../src/notifications/notification-manager.js';
import type {
  DeviceResponseDto,
  NotificationListResponseDto,
  NotificationPreferencesDto,
} from '@platform/api-contracts';

describe('Mobile Push Notifications & Background Delivery', () => {
  let client: NotificationsApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockDevice: DeviceResponseDto = {
    id: 'dev-1',
    userId: 'user-a',
    deviceIdentifier: 'uuid-hardware-123',
    platform: 'IOS',
    pushProvider: 'APNS',
    pushTokenRedacted: 'apns...1234',
    appVersion: '1.0.0',
    osVersion: '18.0',
    locale: 'en_IN',
    timezone: 'Asia/Kolkata',
    lastSeenAt: '2026-09-29T10:00:00.000Z',
    createdAt: '2026-09-29T10:00:00.000Z',
    revokedAt: null,
  };

  const mockListResponse: NotificationListResponseDto = {
    items: [
      {
        id: 'notif-1',
        type: 'NEW_MESSAGE',
        title: 'New message from Rahul',
        body: 'Hey there! How is your day going?',
        data: { conversationId: 'conv-123', messageId: 'msg-456' },
        priority: 'NORMAL',
        readAt: null,
        expiresAt: '2026-10-29T10:00:00.000Z',
        createdAt: '2026-09-29T10:00:00.000Z',
      },
      {
        id: 'notif-2',
        type: 'NEW_MATCH',
        title: 'New Match!',
        body: 'You and Priya liked each other',
        data: { matchId: 'match-789' },
        priority: 'NORMAL',
        readAt: '2026-09-29T10:02:00.000Z',
        expiresAt: '2026-10-29T10:00:00.000Z',
        createdAt: '2026-09-29T09:30:00.000Z',
      },
    ],
    nextCursor: 'cur-next',
    hasMore: true,
    totalUnreadCount: 1,
  };

  const mockPreferences: NotificationPreferencesDto = {
    matchNotificationsEnabled: true,
    messageNotificationsEnabled: true,
    likeNotificationsEnabled: false,
    safetyNotificationsEnabled: true,
    systemNotificationsEnabled: true,
    messagePreviewEnabled: true,
    updatedAt: '2026-09-29T10:00:00.000Z',
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    // Inject mockFetch into global fetch
    global.fetch = mockFetch as unknown as typeof fetch;

    client = new NotificationsApiClient({
      baseUrl: 'https://api.dating.internal',
      getAccessToken: async () => 'test_access_token',
    });
  });

  it('registers a device with client-safe hardware info and push token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockDevice,
      }),
    });

    const res = await client.registerDevice({
      deviceIdentifier: 'uuid-hardware-123',
      platform: 'IOS',
      pushToken: 'apns_raw_token_xyz_1234',
      appVersion: '1.0.0',
    });

    expect(res.id).toBe('dev-1');
    expect(res.platform).toBe('IOS');
    expect(res.pushTokenRedacted).toBe('apns...1234');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.dating.internal/v1/devices',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test_access_token',
        }),
      })
    );
  });

  it('lists registered devices and revokes an active device', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [mockDevice],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { revoked: true },
        }),
      });

    const devices = await client.listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0]?.deviceIdentifier).toBe('uuid-hardware-123');

    const revoked = await client.revokeDevice('dev-1');
    expect(revoked).toBe(true);

    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://api.dating.internal/v1/devices/dev-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('fetches paginated notifications and total unread count', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockListResponse,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { count: 1 },
        }),
      });

    const res = await client.listNotifications({ limit: 20, cursor: 'cur-prev' });
    expect(res.items).toHaveLength(2);
    expect(res.totalUnreadCount).toBe(1);
    expect(res.hasMore).toBe(true);

    const unread = await client.getUnreadCount();
    expect(unread).toBe(1);
  });

  it('marks a single notification and all notifications as read', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: 'notif-1', readAt: '2026-09-29T10:05:00.000Z' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { updatedCount: 5 },
        }),
      });

    const readRes = await client.markAsRead('notif-1');
    expect(readRes.id).toBe('notif-1');
    expect(readRes.readAt).toBeDefined();

    const allRes = await client.markAllAsRead();
    expect(allRes).toBe(5);
  });

  it('fetches and updates user notification preferences', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockPreferences,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { ...mockPreferences, likeNotificationsEnabled: true },
        }),
      });

    const prefs = await client.getPreferences();
    expect(prefs.messageNotificationsEnabled).toBe(true);
    expect(prefs.likeNotificationsEnabled).toBe(false);

    const updated = await client.updatePreferences({ likeNotificationsEnabled: true });
    expect(updated.likeNotificationsEnabled).toBe(true);
  });

  it('resolves authoritative deep-link routes correctly across notification types', () => {
    expect(
      notificationManager.resolveDeepLinkRoute({
        type: 'NEW_MESSAGE',
        conversationId: 'conv-xyz',
      })
    ).toBe('/chat/conv-xyz');

    expect(
      notificationManager.resolveDeepLinkRoute({
        type: 'NEW_MATCH',
        matchId: 'match-123',
      })
    ).toBe('/matches/match-123');

    expect(
      notificationManager.resolveDeepLinkRoute({
        type: 'NEW_LIKE',
      })
    ).toBe('/discovery');

    expect(
      notificationManager.resolveDeepLinkRoute({
        type: 'ACCOUNT_RESTRICTION',
      })
    ).toBe('/notifications');
  });
});
