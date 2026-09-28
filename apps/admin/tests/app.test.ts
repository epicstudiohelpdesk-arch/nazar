import { describe, it, expect } from 'vitest';
import { App } from '../src/App.js';

describe('Admin App Shell', () => {
  it('should be a valid React functional component', () => {
    expect(typeof App).toBe('function');
  });
});
