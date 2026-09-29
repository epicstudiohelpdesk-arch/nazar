import { describe, it, expect, vi } from 'vitest';
import { AnalyticsWorker } from '../src/index.js';

describe('@platform/worker-analytics', () => {
  it('should instantiate the analytics worker shell with default options', () => {
    const worker = new AnalyticsWorker();
    expect(worker.name).toBe('worker-analytics');
    expect(worker.isRunning).toBe(false);
  });

  it('should start and stop runner loop cleanly', async () => {
    const worker = new AnalyticsWorker({ pollIntervalMs: 100 });
    await worker.start();
    expect(worker.isRunning).toBe(true);
    await worker.stop();
    expect(worker.isRunning).toBe(false);
  });

  it('should execute processTick invoking aggregation and cleanup handlers', async () => {
    const onAggregate = vi.fn().mockResolvedValue(13);
    const onRetention = vi.fn().mockResolvedValue(42);
    const onQuarantine = vi.fn().mockResolvedValue(5);

    const worker = new AnalyticsWorker({
      onAggregateDailyMetrics: onAggregate,
      onRetentionCleanup: onRetention,
      onQuarantineCleanup: onQuarantine,
    });

    const result = await worker.processTick();

    expect(onAggregate).toHaveBeenCalledTimes(1);
    expect(onRetention).toHaveBeenCalledWith(90);
    expect(onQuarantine).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      aggregated: 13,
      cleaned: 42,
      quarantinedCleaned: 5,
    });
  });
});
