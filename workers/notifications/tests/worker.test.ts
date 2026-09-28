import { describe, it, expect } from 'vitest';
import { NotificationsWorker } from '../src/index.js';

describe('@platform/worker-notifications', () => {
  it('should instantiate the notifications worker shell', () => {
    const worker = new NotificationsWorker();
    expect(worker.name).toBe('worker-notifications');
  });
});
