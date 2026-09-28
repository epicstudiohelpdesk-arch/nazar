import { describe, it, expect } from 'vitest';
import IndexScreen from '../app/index.js';
import RootLayout from '../app/_layout.js';

describe('Mobile App Foundation', () => {
  it('should export IndexScreen as a valid React component', () => {
    expect(typeof IndexScreen).toBe('function');
  });

  it('should export RootLayout as a valid React component', () => {
    expect(typeof RootLayout).toBe('function');
  });
});
