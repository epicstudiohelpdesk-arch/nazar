import { describe, it, expect } from 'vitest';
import { colors, spacing, typography } from '../src/index.js';

describe('@platform/ui', () => {
  it('should expose consistent color design tokens', () => {
    expect(colors.primary[500]).toBe('#ec4899');
    expect(colors.status.success).toBe('#10b981');
    expect(colors.neutral[900]).toBe('#0f172a');
  });

  it('should expose non-negative spacing tokens in ascending order', () => {
    expect(spacing.none).toBe(0);
    expect(spacing.xs).toBeLessThan(spacing.sm);
    expect(spacing.sm).toBeLessThan(spacing.md);
    expect(spacing.md).toBeLessThan(spacing.lg);
  });

  it('should expose typography scale tokens', () => {
    expect(typography.fontSize.base).toBe(16);
    expect(typography.fontWeight.bold).toBe('700');
  });
});
