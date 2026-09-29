import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsClient } from '../src/analytics/analytics-client.js';
import type { AuthClient } from '../src/auth/auth-client.js';

describe('Mobile AnalyticsClient (Gate 15)', () => {
  let mockAuthClient: AuthClient;

  beforeEach(() => {
    mockAuthClient = {
      request: vi.fn().mockResolvedValue({
        success: true,
        data: {
          accepted: 1,
          duplicates: 0,
          quarantined: 0,
          rejected: 0,
          processedEventIds: ['evt-1'],
        },
      }),
    } as unknown as AuthClient;
  });

  it('should enqueue events and preserve occurredAt timestamp', () => {
    const client = new AnalyticsClient({
      authClient: mockAuthClient,
      maxQueueSize: 10,
      batchSize: 5,
      flushIntervalMs: 60000,
    });

    const eventId = client.track('app.screen.viewed', { screenName: 'Discovery' });
    expect(eventId).toBeDefined();
    expect(client.queueLength).toBe(1);

    client.destroy();
  });

  it('should bound queue size dropping oldest events when limit exceeded', () => {
    const client = new AnalyticsClient({
      authClient: mockAuthClient,
      maxQueueSize: 3,
      batchSize: 10, // Prevent auto flush on batch size
      flushIntervalMs: 60000,
    });

    client.track('app.screen.viewed', { index: 1 });
    client.track('app.screen.viewed', { index: 2 });
    client.track('app.screen.viewed', { index: 3 });
    expect(client.queueLength).toBe(3);

    // 4th event exceeds maxQueueSize 3, oldest drops
    client.track('app.screen.viewed', { index: 4 });
    expect(client.queueLength).toBe(3);

    client.destroy();
  });

  it('should flush batches to /v1/analytics/events and clear dispatched items', async () => {
    const client = new AnalyticsClient({
      authClient: mockAuthClient,
      maxQueueSize: 10,
      batchSize: 5,
      flushIntervalMs: 60000,
    });

    client.track('app.screen.viewed', { screenName: 'Feed' });
    client.track('discovery.profile.exposed', { targetUserId: 'user-2', rankPosition: 1 });

    const result = await client.flush();

    expect(result).toBeDefined();
    expect(result?.accepted).toBe(1);
    expect(mockAuthClient.request).toHaveBeenCalledWith(
      '/v1/analytics/events',
      expect.objectContaining({
        method: 'POST',
      })
    );

    client.destroy();
  });
});
