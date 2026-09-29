import { describe, it, expect } from 'vitest';
import { NotificationsWorker } from '../src/index.js';

describe('@platform/worker-notifications', () => {
  it('should instantiate the notifications worker shell', () => {
    const worker = new NotificationsWorker();
    expect(worker.name).toBe('worker-notifications');
    expect(worker.isRunning).toBe(false);
  });

  it('should handle start and stop lifecycle cleanly', async () => {
    let tickCount = 0;
    const worker = new NotificationsWorker({
      pollIntervalMs: 50,
      onTick: async () => {
        tickCount++;
      },
    });

    await worker.start();
    expect(worker.isRunning).toBe(true);

    // Wait a brief moment for at least 1 tick
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(tickCount).toBeGreaterThanOrEqual(1);

    await worker.stop();
    expect(worker.isRunning).toBe(false);

    const countAfterStop = tickCount;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(tickCount).toBe(countAfterStop);
  });
});
