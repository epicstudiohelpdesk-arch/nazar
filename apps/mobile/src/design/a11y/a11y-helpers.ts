import {
  AccessibilityInfo,
  type AccessibilityRole,
  type AccessibilityState,
  type Insets,
} from 'react-native';

/**
 * Nazar minimum touch target constant adhering to platform defaults (44pt).
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Recommended enhanced touch target constant adhering to WCAG 2.5.5 AAA guidelines (48x48dp).
 */
export const A11Y_RECOMMENDED_TOUCH_TARGET = 48;

/**
 * Calculates a symmetric hitSlop to guarantee an interactive component achieves at least 48x48dp touch target.
 */
export function ensureMinTouchTarget(
  currentWidth: number,
  currentHeight: number = currentWidth,
  targetSize: number = A11Y_RECOMMENDED_TOUCH_TARGET
): Insets {
  const horizontalPadding = Math.max(0, Math.ceil((targetSize - currentWidth) / 2));
  const verticalPadding = Math.max(0, Math.ceil((targetSize - currentHeight) / 2));

  return {
    top: verticalPadding,
    bottom: verticalPadding,
    left: horizontalPadding,
    right: horizontalPadding,
  };
}

/**
 * Safe screen reader announcement with graceful fallback for non-native / test environments.
 */
export function announceAccessibility(message: string): void {
  if (
    typeof AccessibilityInfo !== 'undefined' &&
    typeof AccessibilityInfo.announceForAccessibility === 'function' &&
    message
  ) {
    try {
      AccessibilityInfo.announceForAccessibility(message);
    } catch {
      // Safe no-op in testing/unsupported environments
    }
  }
}

export interface AccessibleInteractiveProps {
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
}

export const createButtonA11y = (
  label: string,
  options?: {
    hint?: string;
    disabled?: boolean;
    busy?: boolean;
    selected?: boolean;
  }
): AccessibleInteractiveProps => ({
  accessibilityRole: 'button',
  accessibilityLabel: label,
  accessibilityHint: options?.hint,
  accessibilityState: {
    disabled: options?.disabled,
    busy: options?.busy,
    selected: options?.selected,
  },
});

export const createHeaderA11y = (
  title: string
): { accessibilityRole: AccessibilityRole; accessibilityLabel: string } => ({
  accessibilityRole: 'header',
  accessibilityLabel: title,
});

export const createTabA11y = (
  label: string,
  isSelected: boolean,
  badgeCount?: number
): AccessibleInteractiveProps => ({
  accessibilityRole: 'tab',
  accessibilityLabel: `${label} tab${badgeCount ? `, ${badgeCount} unread items` : ''}`,
  accessibilityState: {
    selected: isSelected,
  },
});

export const createRadioA11y = (
  label: string,
  isSelected: boolean,
  disabled?: boolean
): AccessibleInteractiveProps => ({
  accessibilityRole: 'radio',
  accessibilityLabel: label,
  accessibilityState: {
    selected: isSelected,
    disabled: Boolean(disabled),
  },
});

export const createCheckboxA11y = (
  label: string,
  isChecked: boolean,
  disabled?: boolean
): AccessibleInteractiveProps => ({
  accessibilityRole: 'checkbox',
  accessibilityLabel: label,
  accessibilityState: {
    checked: isChecked,
    disabled: Boolean(disabled),
  },
});
