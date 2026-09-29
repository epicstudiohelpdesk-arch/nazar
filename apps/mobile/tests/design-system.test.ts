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
  lightTheme,
  darkTheme,
  Text,
  Heading,
  Icon,
  Avatar,
  Badge,
  SurfaceCard,
  Button,
  IconButton,
  TextInput,
  PasswordInput,
  OtpInput,
  MultilineInput,
  SearchInput,
  Select,
  SegmentedControl,
  Slider,
  DateSelector,
  ChipSelector,
  ImagePickerTrigger,
  ProfileCard,
  MediaCard,
  MatchCard,
  ConversationCard,
  CommunityCard,
  EventCard,
  SubscriptionCard,
  MediaView,
  TopNavHeader,
  BottomNavBar,
  BottomNavItem,
  BottomSheet,
  Dialog,
  EmptyState,
  ErrorState,
  SkeletonBox,
  ProfileCardSkeleton,
  ConversationListSkeleton,
  ProgressBar,
  OfflineBanner,
  defaultStrings,
  MIN_TOUCH_TARGET,
  createButtonA11y,
  createHeaderA11y,
  createTabA11y,
} from '../src/design/index.js';
import DesignSystemShowcaseScreen from '../app/design-system-showcase.js';

describe('Nazar Design System (F0 UI/UX Constitution)', () => {
  describe('1. Design Tokens', () => {
    it('exposes semantic light and dark color palettes', () => {
      expect(semanticLightColors.background).toBe('#FAF8F5');
      expect(semanticLightColors.surface).toBe('#FFFFFF');
      expect(semanticLightColors.accent).toBe('#D84315');
      expect(semanticLightColors.textPrimary).toBe('#1C1917');
      expect(semanticLightColors.border).toBe('#E7E2DA');

      expect(semanticDarkColors.background).toBe('#12100E');
      expect(semanticDarkColors.surface).toBe('#1C1917');
      expect(semanticDarkColors.accent).toBe('#F06548');
      expect(semanticDarkColors.textPrimary).toBe('#F5F5F4');
      expect(darkColors.darkBackground).toBe('#12100E');
    });

    it('exposes complete 12-level typography hierarchy', () => {
      expect(typographyScale.display.fontSize).toBe(36);
      expect(typographyScale.heading1.fontSize).toBe(30);
      expect(typographyScale.heading2.fontSize).toBe(24);
      expect(typographyScale.heading3.fontSize).toBe(20);
      expect(typographyScale.title.fontSize).toBe(18);
      expect(typographyScale.bodyLarge.fontSize).toBe(18);
      expect(typographyScale.body.fontSize).toBe(16);
      expect(typographyScale.bodySmall.fontSize).toBe(14);
      expect(typographyScale.caption.fontSize).toBe(12);
      expect(typographyScale.label.fontSize).toBe(12);
      expect(typographyScale.button.fontSize).toBe(15);
      expect(typographyScale.numeric.fontSize).toBe(16);
    });

    it('exposes semantic spacing tokens scale', () => {
      expect(spacing.none).toBe(0);
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(16);
      expect(spacing.lg).toBe(24);
      expect(spacing.xl).toBe(32);
      expect(spacing.xxl).toBe(40);
      expect(spacing.xxxl).toBe(48);
      expect(spacing.huge).toBe(64);
      expect(spacing.massive).toBe(80);
      expect(spacing[4]).toBe(4);
      expect(spacing[80]).toBe(80);
    });

    it('exposes semantic radii tokens', () => {
      expect(radii.radiusXS).toBe(4);
      expect(radii.radiusSM).toBe(8);
      expect(radii.radiusMD).toBe(12);
      expect(radii.radiusLG).toBe(16);
      expect(radii.radiusXL).toBe(24);
      expect(radii.radiusFull).toBe(9999);
    });

    it('exposes elevation and shadow tokens', () => {
      expect(shadows.shadowNone.elevation).toBe(0);
      expect(shadows.shadowSM.elevation).toBe(1);
      expect(shadows.shadowMD.elevation).toBe(3);
      expect(shadows.shadowLG.elevation).toBe(6);
      expect(elevation.none).toBe(0);
      expect(elevation.lg).toBe(6);
    });

    it('exposes motion tokens with instant, fast, normal, slow, spring', () => {
      expect(motion.duration.instant).toBe(0);
      expect(motion.duration.fast).toBe(150);
      expect(motion.duration.normal).toBe(250);
      expect(motion.duration.slow).toBe(400);
      expect(motion.spring.damping).toBe(20);
      expect(motion.spring.stiffness).toBe(180);
    });
  });

  describe('2. Themes & Architecture', () => {
    it('defines consistent lightTheme and darkTheme structures', () => {
      expect(lightTheme.mode).toBe('light');
      expect(lightTheme.colors.background).toBe('#FAF8F5');
      expect(darkTheme.mode).toBe('dark');
      expect(darkTheme.colors.background).toBe('#12100E');
    });
  });

  describe('3. Component Primitives Export Verification', () => {
    it('exports all foundational primitive components', () => {
      expect(typeof Text).toBe('function');
      expect(typeof Heading).toBe('function');
      expect(typeof Icon).toBe('function');
      expect(typeof Avatar).toBe('function');
      expect(typeof Badge).toBe('function');
      expect(typeof SurfaceCard).toBe('function');
    });

    it('exports all button components', () => {
      expect(typeof Button).toBe('function');
      expect(typeof IconButton).toBe('function');
    });

    it('exports all input components', () => {
      expect(typeof TextInput).toBe('function');
      expect(typeof PasswordInput).toBe('function');
      expect(typeof OtpInput).toBe('function');
      expect(typeof MultilineInput).toBe('function');
      expect(typeof SearchInput).toBe('function');
      expect(typeof Select).toBe('function');
      expect(typeof SegmentedControl).toBe('function');
      expect(typeof Slider).toBe('function');
      expect(typeof DateSelector).toBe('function');
      expect(typeof ChipSelector).toBe('function');
      expect(typeof ImagePickerTrigger).toBe('function');
    });

    it('exports all semantic card primitives including ProfileCard', () => {
      expect(typeof ProfileCard).toBe('function');
      expect(typeof MediaCard).toBe('function');
      expect(typeof MatchCard).toBe('function');
      expect(typeof ConversationCard).toBe('function');
      expect(typeof CommunityCard).toBe('function');
      expect(typeof EventCard).toBe('function');
      expect(typeof SubscriptionCard).toBe('function');
    });

    it('exports media, navigation, modal, and feedback components', () => {
      expect(typeof MediaView).toBe('function');
      expect(typeof TopNavHeader).toBe('function');
      expect(typeof BottomNavBar).toBe('function');
      expect(typeof BottomNavItem).toBe('function');
      expect(typeof BottomSheet).toBe('function');
      expect(typeof Dialog).toBe('function');
      expect(typeof EmptyState).toBe('function');
      expect(typeof ErrorState).toBe('function');
      expect(typeof SkeletonBox).toBe('function');
      expect(typeof ProfileCardSkeleton).toBe('function');
      expect(typeof ConversationListSkeleton).toBe('function');
      expect(typeof ProgressBar).toBe('function');
      expect(typeof OfflineBanner).toBe('function');
    });
  });

  describe('4. Localization & Accessibility Foundations', () => {
    it('defines complete domain strings dictionary', () => {
      expect(defaultStrings.common.appName).toBe('Nazar');
      expect(defaultStrings.discovery.pass).toBe('Pass');
      expect(defaultStrings.discovery.like).toBe('Like');
      expect(defaultStrings.matches.title).toBe('Matches');
      expect(defaultStrings.billing.gold).toBe('Nazar Gold');
    });

    it('provides accessibility helpers with 44pt touch target standard', () => {
      expect(MIN_TOUCH_TARGET).toBe(44);

      const btnA11y = createButtonA11y('Like Ananya', { hint: 'Sends mutual like' });
      expect(btnA11y.accessibilityRole).toBe('button');
      expect(btnA11y.accessibilityLabel).toBe('Like Ananya');
      expect(btnA11y.accessibilityHint).toBe('Sends mutual like');

      const headerA11y = createHeaderA11y('Discovery Feed');
      expect(headerA11y.accessibilityRole).toBe('header');
      expect(headerA11y.accessibilityLabel).toBe('Discovery Feed');

      const tabA11y = createTabA11y('Matches', true, 3);
      expect(tabA11y.accessibilityRole).toBe('tab');
      expect(tabA11y.accessibilityLabel).toBe('Matches tab, 3 unread items');
      expect(tabA11y.accessibilityState?.selected).toBe(true);
    });
  });

  describe('5. Visual QA Development Screen', () => {
    it('exports DesignSystemShowcaseScreen as a valid React component', () => {
      expect(typeof DesignSystemShowcaseScreen).toBe('function');
    });
  });
});
