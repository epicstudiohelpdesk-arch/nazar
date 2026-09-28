import { describe, it, expect } from 'vitest';
import { AnalyticsWorker } from '../src/index.js';

describe('@platform/worker-analytics', () => {
  it('should instantiate the analytics worker shell', () => {
    const worker = new AnalyticsWorker();
    expect(worker.name).toBe('worker-analytics');
  });
});
