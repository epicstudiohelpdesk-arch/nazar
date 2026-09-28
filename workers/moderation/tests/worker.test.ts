import { describe, it, expect } from 'vitest';
import { ModerationWorker } from '../src/index.js';

describe('@platform/worker-moderation', () => {
  it('should instantiate the moderation worker shell', () => {
    const worker = new ModerationWorker();
    expect(worker.name).toBe('worker-moderation');
  });
});
