import type { AccessibilityRole, AccessibilityState } from 'react-native';

export const MIN_TOUCH_TARGET = 44;

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

export const createHeaderA11y = (title: string): { accessibilityRole: AccessibilityRole; accessibilityLabel: string } => ({
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
