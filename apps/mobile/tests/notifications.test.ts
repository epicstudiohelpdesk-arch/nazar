import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsApiClient } from '../src/notifications/notifications-api.js';
import {
  buildNotificationViewModel,
  formatAccessibleTime,
  formatRelativeTime,
  mergeNotificationPages,
  applyConfirmedRead,
  applyConfirmedReadAll,
  upsertNotification,
  getCategoryForType,
} from '../src/notifications/notification-state.js';
import {
  isSafeIdentifier,
  parseNotificationIntent,
  resolveNotificationDestination,
} from '../src/notifications/notification-payload.js';
import { deriveDeviceIdentifier } from '../src/notifications/device-identity.js';
import {
  mapPermissionStatus,
  PERMISSION_STATES,
  shouldPresentForegroundNotification,
  type PushPermissionState,
} from '../src/notifications/push-permissions.js';
import {
  clearPendingNotificationIntent,
  consumePendingNotificationIntent,
  setPendingNotificationIntent,
} from '../src/notifications/notification-intent.js';
import type {
  DeviceResponseDto,
  NotificationListResponseDto,
  NotificationPreferencesDto,
  NotificationResponseDto,
} from '@platform/api-contracts';

const ok = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data }),
});

function notification(
  overrides: Partial<NotificationResponseDto> & { id: string }
): NotificationResponseDto {
  return {
    type: 'NEW_MESSAGE',
    title: 'New message',
    body: 'You have a new message',
    data: { conversationId: 'conv-1' },
    priority: 'NORMAL',
    readAt: null,
    expiresAt: '2026-10-29T10:00:00.000Z',
    createdAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}

describe('Notifications API client', () => {
  let client: NotificationsApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockDevice: DeviceResponseDto = {
    id: 'dev-1',
    userId: 'user-a',
    deviceIdentifier: 'digest-abc',
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
      notification({
        id: 'notif-1',
        title: 'New message from Rahul',
        data: { conversationId: 'conv-123', messageId: 'msg-456' },
      }),
      notification({
        id: 'notif-2',
        type: 'NEW_MATCH',
        title: 'New Match!',
        data: { matchId: 'match-789' },
        readAt: '2026-09-29T10:02:00.000Z',
        createdAt: '2026-09-29T09:30:00.000Z',
      }),
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
    global.fetch = mockFetch as unknown as typeof fetch;
    client = new NotificationsApiClient({
      baseUrl: 'https://api.dating.internal',
      getAccessToken: async () => 'test_access_token',
    });
  });

  it('registers a device and returns the server redacted token', async () => {
    mockFetch.mockResolvedValueOnce(ok(mockDevice));

    const res = await client.registerDevice({
      deviceIdentifier: 'digest-abc',
      platform: 'IOS',
      pushToken: 'apns_raw_token_xyz_1234',
      appVersion: '1.0.0',
    });

    expect(res.id).toBe('dev-1');
    // The raw token is never echoed back; only the redacted form is retained.
    expect(res.pushTokenRedacted).toBe('apns...1234');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.dating.internal/v1/devices',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test_access_token' }),
      })
    );
  });

  it('registers against the real device endpoint, not a notification path', async () => {
    mockFetch.mockResolvedValueOnce(ok(mockDevice));
    await client.registerDevice({ deviceIdentifier: 'd', platform: 'ANDROID', pushToken: 't' });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://api.dating.internal/v1/devices');
    expect(url).not.toContain('/notifications/devices');
  });

  it('lists and revokes devices', async () => {
    mockFetch
      .mockResolvedValueOnce(ok([mockDevice]))
      .mockResolvedValueOnce(ok({ revoked: true }));

    const devices = await client.listDevices();
    expect(devices).toHaveLength(1);

    expect(await client.revokeDevice('dev-1')).toBe(true);
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://api.dating.internal/v1/devices/dev-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('rejects an unsafe device id before it can enter a path', async () => {
    await expect(client.revokeDevice('../../admin')).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('lists notifications and reads the authoritative unread count', async () => {
    mockFetch.mockResolvedValueOnce(ok(mockListResponse)).mockResolvedValueOnce(ok({ count: 1 }));

    const res = await client.listNotifications({ limit: 20, cursor: 'cur-prev' });
    expect(res.items).toHaveLength(2);
    expect(res.totalUnreadCount).toBe(1);
    expect(res.hasMore).toBe(true);
    expect(await client.getUnreadCount()).toBe(1);

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('limit=20');
    expect(url).toContain('cursor=cur-prev');
  });

  it('clamps a requested limit into the range the API accepts', async () => {
    mockFetch.mockResolvedValue(ok(mockListResponse));
    await client.listNotifications({ limit: 500 });
    expect((mockFetch.mock.calls[0] as [string])[0]).toContain('limit=50');

    mockFetch.mockClear();
    await client.listNotifications({ limit: 0 });
    expect((mockFetch.mock.calls[0] as [string])[0]).toContain('limit=1');
  });

  it('marks one notification and all notifications read', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ id: 'notif-1', readAt: '2026-09-29T10:05:00.000Z' }))
      .mockResolvedValueOnce(ok({ updatedCount: 5 }));

    const readRes = await client.markAsRead('notif-1');
    expect(readRes.id).toBe('notif-1');
    expect(readRes.readAt).toBe('2026-09-29T10:05:00.000Z');

    const allRes = await client.markAllAsRead();
    expect(allRes.updatedCount).toBe(5);
  });

  it('fetches and updates preferences', async () => {
    mockFetch
      .mockResolvedValueOnce(ok(mockPreferences))
      .mockResolvedValueOnce(ok({ ...mockPreferences, likeNotificationsEnabled: true }));

    const prefs = await client.getPreferences();
    expect(prefs.likeNotificationsEnabled).toBe(false);

    const updated = await client.updatePreferences({ likeNotificationsEnabled: true });
    expect(updated.likeNotificationsEnabled).toBe(true);
  });

  it('surfaces the server error code rather than discarding it', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        success: false,
        error: { code: 'NOTIFICATION_NOT_FOUND', statusCode: 404, message: 'gone' },
        requestId: 'req-1',
      }),
    });

    await expect(client.markAsRead('missing')).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
      statusCode: 404,
      requestId: 'req-1',
    });
  });

  it('still produces a typed error when the body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('invalid json');
      },
    });

    await expect(client.getUnreadCount()).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe('Notification destination resolution', () => {
  it('routes each entity type from the authoritative type and a validated id', () => {
    expect(
      resolveNotificationDestination({
        id: 'n1',
        type: 'NEW_MESSAGE',
        data: { conversationId: 'conv-1' },
      }).destination
    ).toEqual({ kind: 'conversation', route: '/chat/conv-1', label: 'open conversation' });

    expect(
      resolveNotificationDestination({
        id: 'n1',
        type: 'NEW_MATCH',
        data: { matchId: 'match-1' },
      }).destination?.route
    ).toBe('/matches/match-1');

    expect(
      resolveNotificationDestination({
        id: 'n1',
        type: 'POST_COMMENT',
        data: { postId: 'post-1' },
      }).destination?.route
    ).toBe('/social/post/post-1');

    expect(
      resolveNotificationDestination({
        id: 'n1',
        type: 'COMMUNITY_JOIN',
        data: { communityId: 'c-1' },
      }).destination?.route
    ).toBe('/social/community/c-1');

    expect(
      resolveNotificationDestination({
        id: 'n1',
        type: 'EVENT_RSVP',
        data: { eventId: 'e-1' },
      }).destination?.route
    ).toBe('/social/event/e-1');

    expect(
      resolveNotificationDestination({
        id: 'n1',
        type: 'EVENT_WAITLIST_PROMOTED',
        data: { eventId: 'e-1' },
      }).destination?.route
    ).toBe('/social/event/e-1');
  });

  it('routes billing only when the notice actually carries a billing key', () => {
    expect(
      resolveNotificationDestination({
        id: 'n1',
        type: 'SYSTEM_NOTICE',
        data: { billingEventType: 'SUBSCRIPTION_EXPIRED' },
      }).destination?.route
    ).toBe('/billing');

    expect(
      resolveNotificationDestination({ id: 'n1', type: 'SYSTEM_NOTICE', data: {} })
    ).toMatchObject({ destination: null, reason: 'no_target_for_type' });
  });

  it('routes account notices to account settings', () => {
    for (const type of ['ACCOUNT_RESTRICTION', 'SECURITY_ALERT'] as const) {
      expect(
        resolveNotificationDestination({ id: 'n1', type, data: {} }).destination?.route
      ).toBe('/settings/account');
    }
  });

  it('does not invent a destination for NEW_LIKE, which carries no target', () => {
    // The Gate 10 consumer writes `{ type: 'NEW_LIKE' }` with no actor or profile
    // id. Routing to discovery would be a guess, so there is no destination.
    expect(
      resolveNotificationDestination({ id: 'n1', type: 'NEW_LIKE', data: {} })
    ).toMatchObject({ destination: null, reason: 'no_target_for_type' });
  });

  it('rejects an id that could escape its path segment', () => {
    for (const bad of ['../admin', 'a/b', 'a?b=1', 'a#b', 'a b', '', 'a%2Fb', '<script>']) {
      expect(isSafeIdentifier(bad)).toBe(false);
    }
    for (const good of ['conv-1', '550e8400-e29b-41d4-a716-446655440000', 'abc_123']) {
      expect(isSafeIdentifier(good)).toBe(true);
    }

    expect(
      resolveNotificationDestination({
        id: 'n1',
        type: 'NEW_MESSAGE',
        data: { conversationId: '../../admin' },
      })
    ).toMatchObject({ destination: null, reason: 'malformed_target_id' });
  });

  it('percent-encodes rather than trusting an unusual but valid id', () => {
    const route = resolveNotificationDestination({
      id: 'n1',
      type: 'NEW_MESSAGE',
      data: { conversationId: 'conv.1_2' },
    }).destination?.route;
    expect(route).toBe('/chat/conv.1_2');
  });

  it('treats an unknown type as unroutable', () => {
    expect(
      resolveNotificationDestination({
        id: 'n1',
        type: 'TOTALLY_NEW_TYPE' as never,
        data: { conversationId: 'c' },
      })
    ).toMatchObject({ destination: null, reason: 'unknown_type', type: null });
  });

  it('survives null data', () => {
    expect(
      resolveNotificationDestination({ id: 'n1', type: 'NEW_MESSAGE', data: null })
    ).toMatchObject({ destination: null, reason: 'no_target_for_type' });
  });
});

describe('Push intent parsing', () => {
  it('reads the id and type out of a raw push body', () => {
    const intent = parseNotificationIntent({
      notificationId: 'notif-1',
      type: 'NEW_MESSAGE',
      conversationId: 'conv-1',
    });
    expect(intent).toMatchObject({
      notificationId: 'notif-1',
      type: 'NEW_MESSAGE',
      data: { conversationId: 'conv-1' },
    });
  });

  it('keeps a malformed body as an unroutable intent rather than discarding it', () => {
    const intent = parseNotificationIntent({ type: 'NEW_MESSAGE' });
    expect(intent?.notificationId).toBe('');
    expect(intent?.type).toBe('NEW_MESSAGE');
  });

  it('returns null for a payload that is not a notification at all', () => {
    expect(parseNotificationIntent(undefined)).toBeNull();
    expect(parseNotificationIntent(null)).toBeNull();
    expect(parseNotificationIntent({ hello: 'world' })).toBeNull();
  });

  it('does not treat an unknown type as routable', () => {
    const intent = parseNotificationIntent({ notificationId: 'n', type: 'MYSTERY' });
    expect(intent?.type).toBeNull();
  });
});

describe('Pending notification intent', () => {
  beforeEach(() => clearPendingNotificationIntent());

  it('delivers an intent exactly once', () => {
    setPendingNotificationIntent({
      notificationId: 'n1',
      type: 'NEW_MESSAGE',
      data: { conversationId: 'c1' },
    });

    expect(consumePendingNotificationIntent()?.notificationId).toBe('n1');
    // A second read must not replay the navigation.
    expect(consumePendingNotificationIntent()).toBeNull();
  });

  it('keeps only the most recent intent', () => {
    setPendingNotificationIntent({ notificationId: 'first', type: 'NEW_MATCH', data: {} });
    setPendingNotificationIntent({ notificationId: 'second', type: 'NEW_MATCH', data: {} });
    expect(consumePendingNotificationIntent()?.notificationId).toBe('second');
  });

  it('clears a consumed intent', () => {
    setPendingNotificationIntent({ notificationId: 'n1', type: 'NEW_MATCH', data: {} });
    consumePendingNotificationIntent();
    clearPendingNotificationIntent();
    expect(consumePendingNotificationIntent()).toBeNull();
  });
});

describe('Activity feed state', () => {
  it('does not duplicate a row that arrives on two pages', () => {
    const first = notification({ id: 'n1' });
    const second = notification({ id: 'n2' });

    const merged = mergeNotificationPages([first], [first, second]);
    expect(merged.map((n) => n.id)).toEqual(['n1', 'n2']);
  });

  it('keeps the already-fetched copy so a stale event cannot overwrite read state', () => {
    const fresh = notification({ id: 'n1', readAt: '2026-09-29T11:00:00.000Z' });
    const stale = notification({ id: 'n1', readAt: null });

    const merged = mergeNotificationPages([fresh], [stale]);
    expect(merged[0]?.readAt).toBe('2026-09-29T11:00:00.000Z');
  });

  it('merges pages in server order without re-sorting', () => {
    const rows = [
      notification({ id: 'n1', createdAt: '2026-09-29T10:00:00.000Z' }),
      notification({ id: 'n2', createdAt: '2026-09-29T09:00:00.000Z' }),
    ];
    expect(mergeNotificationPages([], rows).map((n) => n.id)).toEqual(['n1', 'n2']);
  });

  it('applies a confirmed readAt only to the matching row', () => {
    const rows = [notification({ id: 'n1' }), notification({ id: 'n2' })];
    const updated = applyConfirmedRead(rows, 'n1', '2026-09-29T12:00:00.000Z');

    expect(updated[0]?.readAt).toBe('2026-09-29T12:00:00.000Z');
    // Already-read rows keep their original timestamp rather than being rewritten.
    expect(updated[1]?.readAt).toBeNull();
  });

  it('marks only unread rows on read-all', () => {
    const rows = [
      notification({ id: 'n1' }),
      notification({ id: 'n2', readAt: '2026-09-29T09:00:00.000Z' }),
    ];
    const updated = applyConfirmedReadAll(rows, '2026-09-29T12:00:00.000Z');

    expect(updated[0]?.readAt).toBe('2026-09-29T12:00:00.000Z');
    expect(updated[1]?.readAt).toBe('2026-09-29T09:00:00.000Z');
  });

  it('does not duplicate or reorder when an incoming row already exists', () => {
    const rows = [notification({ id: 'n1' }), notification({ id: 'n2' })];
    const updated = upsertNotification(rows, notification({ id: 'n1', title: 'ignored copy' }));

    expect(updated).toHaveLength(2);
    expect(updated[0]?.title).toBe('New message');
  });

  it('puts a genuinely new row at the front of the feed', () => {
    const rows = [notification({ id: 'n1' })];
    const updated = upsertNotification(rows, notification({ id: 'n0' }));
    expect(updated.map((n) => n.id)).toEqual(['n0', 'n1']);
  });
});

describe('Notification presentation', () => {
  const now = new Date('2026-09-29T12:00:00.000Z');

  it('states unread in words rather than relying on the dot', () => {
    const vm = buildNotificationViewModel(
      notification({ id: 'n1', readAt: null }),
      now
    );
    expect(vm.isUnread).toBe(true);
    expect(vm.accessibilityLabel).toContain('Unread notification');
  });

  it('announces a read row as read', () => {
    const vm = buildNotificationViewModel(
      notification({ id: 'n1', readAt: '2026-09-29T10:00:00.000Z' }),
      now
    );
    expect(vm.isUnread).toBe(false);
    expect(vm.accessibilityLabel).toContain('Read notification');
  });

  it('does not offer a "double tap to open" hint for an unroutable row', () => {
    const vm = buildNotificationViewModel(
      notification({ id: 'n1', type: 'NEW_LIKE', data: {} }),
      now
    );
    expect(vm.accessibilityHint).not.toContain('Double tap');
  });

  it('gives a routable row an open affordance', () => {
    const vm = buildNotificationViewModel(
      notification({ id: 'n1', data: { conversationId: 'c1' } }),
      now
    );
    expect(vm.accessibilityHint).toContain('Double tap to open conversation');
  });

  it('uses generic like copy because the server records no liker', () => {
    expect(getCategoryForType('NEW_LIKE').label).toBe('Like');
  });

  it('renders relative time in words', () => {
    expect(formatRelativeTime('2026-09-29T11:58:00.000Z', now)).toBe('2 minutes ago');
    expect(formatRelativeTime('2026-09-29T11:00:00.000Z', now)).toBe('1 hour ago');
  });

  it('switches to an absolute date for old rows', () => {
    expect(formatRelativeTime('2020-01-01T00:00:00.000Z', now)).toMatch(/2020/);
  });

  it('spells out the time for a screen reader', () => {
    expect(formatAccessibleTime('2026-09-29T11:00:00.000Z', now)).toMatch(/ago/);
  });
});

describe('Push permission mapping', () => {
  it('maps platform status strings to app states', () => {
    expect(mapPermissionStatus('granted')).toBe('granted');
    expect(mapPermissionStatus('provisional')).toBe('provisional');
    expect(mapPermissionStatus('ephemeral')).toBe('provisional');
    expect(mapPermissionStatus('denied')).toBe('denied');
    expect(mapPermissionStatus('undetermined')).toBe('not_requested');
    expect(mapPermissionStatus(undefined)).toBe('not_requested');
  });

  it('treats an unknown future status as not asked rather than granted', () => {
    expect(mapPermissionStatus('something_new')).toBe('not_requested');
  });

  it('never reports a permission the platform did not give', () => {
    // The old manager returned AUTHORIZED unconditionally; the mapping is the
    // only source of truth now, so no input may produce a grant that was not asked for.
    for (const status of ['undetermined', 'denied', 'blocked', 'unknown', undefined, null]) {
      expect(mapPermissionStatus(status)).not.toBe('granted');
    }
  });

  it('has a blocked state distinct from denied', () => {
    expect(PERMISSION_STATES).toContain('blocked');
    expect(mapPermissionStatus('blocked')).toBe<PushPermissionState>('blocked');
  });
});

describe('Foreground notification policy', () => {
  it('suppresses the banner and sound while the user is looking at the app', () => {
    expect(
      shouldPresentForegroundNotification({ appState: 'active', permission: 'granted' })
    ).toEqual({ showBanner: false, playSound: false, shouldReconcile: true });
  });

  it('still reconciles the feed while suppressing the banner', () => {
    // A foreground delivery is not visible, so the cache and badge are the only
    // way the user learns about it; that reconciliation must survive suppression.
    const decision = shouldPresentForegroundNotification({
      appState: 'active',
      permission: 'granted',
    });
    expect(decision.shouldReconcile).toBe(true);
  });

  it('presents normally when the app is backgrounded', () => {
    expect(
      shouldPresentForegroundNotification({ appState: 'background', permission: 'granted' })
        .showBanner
    ).toBe(true);
  });

  it('presents normally when the app is inactive (notification shade pulled)', () => {
    expect(
      shouldPresentForegroundNotification({ appState: 'inactive', permission: 'granted' })
        .showBanner
    ).toBe(true);
  });
});

describe('Device identity', () => {
  it('derives a stable digest for the same token', () => {
    const a = deriveDeviceIdentifier({ pushToken: 'ExponentPushToken[abc]' });
    const b = deriveDeviceIdentifier({ pushToken: 'ExponentPushToken[abc]' });
    expect(a).toBe(b);
  });

  it('derives different digests for different tokens', () => {
    expect(deriveDeviceIdentifier({ pushToken: 'token-a' })).not.toBe(
      deriveDeviceIdentifier({ pushToken: 'token-b' })
    );
  });

  it('never contains the raw token', () => {
    const digest = deriveDeviceIdentifier({ pushToken: 'super-secret-token' });
    expect(digest).not.toContain('super-secret-token');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('falls back to a random identifier when there is no token', () => {
    const first = deriveDeviceIdentifier({ pushToken: '' });
    const second = deriveDeviceIdentifier({ pushToken: '' });
    expect(first).not.toBe(second);
  });
});
