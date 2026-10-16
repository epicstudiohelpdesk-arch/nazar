import { describe, it, expect } from 'vitest';
import {
  colors,
  semanticLightColors,
  semanticDarkColors,
  darkColors,
  spacing,
  typography,
  typographyScale,
  radii,
  shadows,
  elevation,
  motion,
} from '../src/index.js';

describe('@platform/ui', () => {
  it('should expose consistent legacy color design tokens', () => {
    expect(colors.primary[500]).toBe('#ec4899');
    expect(colors.status.success).toBe('#10b981');
    expect(colors.neutral[900]).toBe('#0f172a');
  });

  it('should expose semantic light and dark color palettes', () => {
    expect(semanticLightColors.background).toBe('#FAF8F5');
    expect(semanticLightColors.surface).toBe('#FFFFFF');
    expect(semanticLightColors.accent).toBe('#DC0C24');
    expect(semanticLightColors.textPrimary).toBe('#1C1917');

    expect(semanticDarkColors.background).toBe('#12100E');
    expect(semanticDarkColors.surface).toBe('#1C1917');
    expect(semanticDarkColors.accent).toBe('#DC0C24');
    expect(semanticDarkColors.textPrimary).toBe('#F5F5F4');

    expect(darkColors.darkBackground).toBe('#12100E');
    expect(colors.accent).toBe('#DC0C24');
    expect(colors.darkAccent).toBe('#DC0C24');
  });

  it('should expose non-negative spacing tokens in ascending order', () => {
    expect(spacing.none).toBe(0);
    expect(spacing.xs).toBeLessThan(spacing.sm);
    expect(spacing.sm).toBeLessThan(spacing.md);
    expect(spacing.md).toBeLessThan(spacing.lg);
    expect(spacing[4]).toBe(4);
    expect(spacing[80]).toBe(80);
  });

  it('should expose typography scale tokens', () => {
    expect(typography.fontSize.base).toBe(16);
    expect(typography.fontWeight.bold).toBe('700');
    expect(typographyScale.display.fontSize).toBe(36);
    expect(typographyScale.heading1.fontSize).toBe(30);
    expect(typographyScale.button.fontWeight).toBe('600');
  });

  it('should expose corner radius tokens', () => {
    expect(radii.radiusXS).toBe(4);
    expect(radii.radiusSM).toBe(8);
    expect(radii.radiusMD).toBe(12);
    expect(radii.radiusLG).toBe(16);
    expect(radii.radiusXL).toBe(24);
    expect(radii.radiusFull).toBe(9999);
  });

  it('should expose elevation and shadow tokens', () => {
    expect(elevation.none).toBe(0);
    expect(elevation.lg).toBe(6);
    expect(shadows.shadowSM.elevation).toBe(1);
    expect(shadows.shadowMD.elevation).toBe(3);
    expect(shadows.shadowLG.elevation).toBe(6);
  });

  it('should expose motion tokens', () => {
    expect(motion.duration.instant).toBe(0);
    expect(motion.duration.fast).toBe(150);
    expect(motion.duration.normal).toBe(250);
    expect(motion.duration.slow).toBe(400);
    expect(motion.spring.damping).toBe(20);
  });
});
