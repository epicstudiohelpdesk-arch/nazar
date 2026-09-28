import { describe, it, expect } from 'vitest';
import { MediaWorker } from '../src/index.js';

describe('@platform/worker-media', () => {
  it('should instantiate the media worker shell', () => {
    const worker = new MediaWorker();
    expect(worker.name).toBe('worker-media');
  });
});
