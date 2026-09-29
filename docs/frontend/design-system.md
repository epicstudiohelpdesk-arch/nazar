# Nazar UI/UX Design System & Constitution (F0)

**Version:** 1.0.0 (Frontend F0)  
**Status:** Canonical Design Foundation  
**Audience:** Mobile Engineers, Product Designers, QA Engineers  
**Target Platform:** React Native / Expo (iOS & Android)

---

## 1. Brand Principles & Product Philosophy

Nazar is a contemporary, premium Indian dating application designed around authentic connection, personal dignity, and cultural resonance. The interface is built to elevate human beings rather than overpower them with decorative excess.

### Core Character
* **Modern & Editorial:** Large typography, confident whitespace, intentional photographic framing.
* **Warm & Human:** Grounded in earthy Indian tones (terracotta vermilion, warm off-white, deep charcoal) without falling into stereotypical decorative cliches.
* **Intimate & Respectful:** Generous breathing room for dating profiles, high-contrast readability, and low cognitive noise.
* **Trusted & Safe:** Explicit verification states, transparent reporting controls, empathetic error handling, and robust offline-first indicators.

### What Nazar Is NOT
* Not a neon-soaked, hyper-gamified hookup app with flashing animations.
* Not an ornamental catalog with mandala graphics or ethnic borders.
* Not a sterile corporate SaaS dashboard with tiny tables and cold gray palettes.

---

## 2. Color System

Nazar relies on **semantic color tokens** rather than hardcoded hex codes. All colors are organized into light and dark palettes exposed through `@platform/ui` and dynamic `useTheme()` in `@/design`.

### Light Mode (Primary Target)

| Semantic Token | Hex Value | Role & Usage |
| :--- | :--- | :--- |
| `background` | `#FAF8F5` | Warm off-white canvas. Eliminates sterile starkness while preserving high contrast. |
| `surface` | `#FFFFFF` | Primary card and container fill. Clean contrast against background. |
| `surfaceElevated` | `#FFFFFF` | Modals, sheets, floating controls (combined with `shadowMD`). |
| `surfaceMuted` | `#F5F2EB` | Subtle input fills, inactive segmented items, and disabled backgrounds. |
| `textPrimary` | `#1C1917` | Deep warm charcoal (WCAG AAA contrast on surface). Profile names and headings. |
| `textSecondary` | `#78716C` | Muted stone. Subheadings, metadata, captions, timestamps. |
| `textTertiary` | `#A8A29E` | Secondary placeholders, disabled text, subtle divider labels. |
| `textInverse` | `#FFFFFF` | Text on top of accent or dark button surfaces. |
| `border` | `#E7E5E4` | Hairline separators and card outlines (subtle definition). |
| `borderStrong` | `#D6D3D1` | Active input borders, focused boundaries. |
| `accent` | `#D84315` | Terracotta Vermilion. Nazar brand anchor for primary CTAs and active states. |
| `accentSoft` | `#FBE9E7` | Light terracotta wash for tag selections, badges, and notification tints. |
| `accentStrong` | `#BF360C` | Deep terracotta for button press states and high-contrast links. |
| `success` | `#2E7D32` | Forest green. Verified profiles, successful form submits, matches. |
| `warning` | `#F57F17` | Warm amber. Expiring matches, safety reminders, pending verification. |
| `error` | `#C62828` | Deep crimson. Destructive actions, validation errors, report dialogs. |
| `info` | `#0288D1` | Deep sky blue. System informational notices. |
| `overlay` | `rgba(0,0,0,0.5)` | Modal backdrops and bottom-sheet scrims. |
| `scrim` | `rgba(0,0,0,0.7)` | Photo gradients behind white text overlays on profile cards. |

### Dark Mode (Independent Semantic Mapping)

| Semantic Token | Hex Value | Role & Usage |
| :--- | :--- | :--- |
| `background` | `#121212` | Deep charcoal background (never pure #000000) for OLED comfort. |
| `surface` | `#1E1E1E` | Primary cards and navigation surfaces. |
| `surfaceElevated` | `#2D2D2D` | Floating sheets, modals, elevated action headers. |
| `surfaceMuted` | `#252525` | Inactive chip selectors, disabled input fields. |
| `textPrimary` | `#F5F5F5` | Off-white text providing crisp contrast without harsh glare. |
| `textSecondary` | `#A0A0A0` | Readable secondary metadata. |
| `textTertiary` | `#666666` | Placeholders and muted hints. |
| `textInverse` | `#121212` | Inverted text on bright accents. |
| `border` | `#333333` | Subtle perimeter containment. |
| `borderStrong` | `#4F4F4F` | Focused card and input outlines. |
| `accent` | `#FF7043` | Slightly lighter terracotta tint optimized for dark mode luminance. |
| `accentSoft` | `#3D2018` | Dark terracotta surface tint for selected badges and chips. |
| `accentStrong` | `#FF8A65` | High-visibility accent for pressed and active dark elements. |

---

## 3. Typography Hierarchy

Nazar uses a 12-level typographic scale. Values are carefully calibrated for native mobile screens with proportional line heights to prevent truncation or overlap across dynamic type sizes.

| Level | Size | Line Height | Weight | Letter Spacing | Use Cases |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display` | 36px | 44px | Bold (700) | -0.75px | Onboarding splash heroes, primary match celebration headlines. |
| `heading1` | 30px | 38px | Bold (700) | -0.5px | Screen titles, Profile card primary names. |
| `heading2` | 24px | 32px | Bold (700) | -0.25px | Section headers, sheet titles, dialog titles. |
| `heading3` | 20px | 28px | SemiBold (600) | 0px | Subsection headers, prompt card titles, card group labels. |
| `title` | 18px | 24px | SemiBold (600) | 0px | Conversation row names, settings section titles. |
| `bodyLarge`| 17px | 24px | Regular (400) | 0px | Profile bios, prompt response answers, editorial blurbs. |
| `body` | 15px | 22px | Regular (400) | 0px | Primary messaging text, form input values, body copy. |
| `bodySmall`| 13px | 18px | Regular (400) | 0px | Secondary captions, helper hints, timestamp indicators. |
| `caption` | 11px | 15px | Medium (500) | +0.2px | Legal microcopy, unread count badges, image indicators. |
| `label` | 13px | 18px | SemiBold (600) | +0.1px | Form input field labels, chip selector items, filter tags. |
| `button` | 16px | 22px | SemiBold (600) | +0.2px | Action buttons, CTA controls. |
| `numeric` | 18px | 24px | Bold (700) | 0px | Age indicators, distance badges, verification statistics. |

---

## 4. Spacing Scale

The spacing scale is strictly geometric, based on a 4pt/8pt grid system. Components must only consume numeric or semantic spacing keys.

```typescript
export const spacing = {
  0: 0,
  1: 4,      // Micro gaps, chip internal padding
  2: 8,      // Standard icon-to-label gaps, tight item stacks
  3: 12,     // Compact card paddings, form group gaps
  4: 16,     // Default container horizontal padding, input padding
  5: 20,     // Form block separation, relaxed card spacing
  6: 24,     // Screen margin offsets, section margins
  8: 32,     // Major section dividers, modal headers
  10: 40,    // Hero offsets, empty state vertical breathing room
  12: 48,    // Top screen clearances
  16: 64,    // Onboarding spacer blocks
  20: 80,    // Extended bottom inset cushions for tab bars
} as const;
```

---

## 5. Corner Radii

Corner radii communicate hierarchy, interaction affordance, and visual softness:

* `radiusXS (4px)`: Micro tags, badge pills, checkbox borders.
* `radiusSM (8px)`: Small controls, text inputs, search fields, inline chips.
* `radiusMD (12px)`: Standard surface cards, segmented controls, list containers.
* `radiusLG (16px)`: Prominent feature cards, match preview cards, dialog containers.
* `radiusXL (24px)`: Full-screen discovery cards, bottom sheets, hero image containers.
* `radiusFull (9999px)`: Circular avatars, icon buttons, pill filter tags.

---

## 6. Elevation & Shadows

Nazar avoids heavy, muddy drop shadows in favor of subtle boundary contrast combined with light elevation.

```typescript
export const shadows = {
  none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  sm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
};
```

---

## 7. Motion & Physics

All micro-interactions use consistent timing and spring parameters to feel intentional and physical:

* `duration.instant (100ms)`: Immediate button press states, checkmarks.
* `duration.fast (200ms)`: Chip selection toggles, toast notifications, input focus transitions.
* `duration.normal (300ms)`: Sheet presentation, screen card transitions, accordion expansion.
* `duration.slow (500ms)`: Match celebration overlays, photo gallery transitions.
* `spring.snappy`: Damping 20, Stiff 300 (Likes, heart taps, icon bounces).
* `spring.gentle`: Damping 26, Stiff 170 (Bottom sheet snaps, card flips).

---

## 8. Foundational Component Guidelines

### Buttons (`Button`, `IconButton`)
* **Variants:** Primary (Terracotta filled), Secondary (Muted surface with border), Tertiary (Ghost text button), Destructive (Crimson filled/outline).
* **States:** Default, Pressed, Disabled, Loading (with `ActivityIndicator`), Success, Error.
* **Touch Target:** Guaranteed minimum `44pt × 44pt` across all button and icon button interactions.

### Inputs (`TextInput`, `PasswordInput`, `OtpInput`, `MultilineInput`, `SearchInput`, `Select`, `SegmentedControl`, `Slider`, `DateSelector`, `ChipSelector`, `ImagePickerTrigger`)
* **States:** Default, Focused, Filled, Error, Disabled, Loading.
* **Error Treatment:** Clear, empathetic error messages rendered below the input with `accessibilityLiveRegion="polite"`. Never show vague messages like "Invalid input".

### Cards (`SurfaceCard`, `ProfileCard`, `MediaCard`, `MatchCard`, `ConversationCard`, `CommunityCard`, `EventCard`, `SubscriptionCard`)
* **ProfileCard:** The signature component supporting 7 canonical contexts:
  1. `discovery`: Full-bleed portrait media, floating like/pass buttons, photo index indicator.
  2. `likes`: Compact grid card with blurred teaser or full preview, blur overlay badge.
  3. `matches`: Circle/rounded avatar with quick messaging CTA and mutual prompt context.
  4. `search`: Filter-friendly card with compatibility chips and distance metrics.
  5. `community`: Member badge, shared group tag, bio snippet.
  6. `event`: Attendee state, RSVPs, event badge.
  7. `profilePreview`: Read-only self-view with full prompts, bio, and edit shortcuts.

### Navigation Primitives (`TopNavHeader`, `BottomNavBar`, `BottomNavItem`)
* Header respects safe-area top insets and supports left actions (`back` or `close`) and right actions.
* Bottom navigation respects safe-area bottom insets, supports unread numeric badges, and maps to standard accessible tab semantics (`accessibilityRole="tab"`).

### Feedback & System States
* **EmptyState:** Provides 8 explicit domain states (`noMatches`, `noLikes`, `noConversations`, `noNotifications`, `noSearchResults`, `offline`, `communityEmpty`, `generic`). Always answers: (1) What happened, (2) Why it's empty, (3) What actionable next step to take.
* **ErrorState:** Provides 9 humanized error templates (`network`, `server`, `unauthorized`, `rateLimit`, `notFound`, `validation`, `payment`, `safetyAlert`, `generic`) with retry CTAs.
* **LoadingSkeleton:** Smooth, shimmering placeholders (`SkeletonBox`, `ProfileCardSkeleton`, `ConversationListSkeleton`) preventing layout shifts.
* **OfflineBanner:** Non-intrusive notification displaying connection status (`offline`, `reconnecting`, `syncing`, `synced`, `failed`).

---

## 9. Accessibility Standard (WCAG AA)

1. **Touch Targets:** Every interactive element satisfies the strict 44pt rule (`MIN_TOUCH_TARGET = 44`).
2. **Accessible Names:** Every icon-only button and media trigger includes an explicit `accessibilityLabel`.
3. **Contrast:** All text tokens meet or exceed WCAG AA ratio (4.5:1 for normal text, 3:1 for large text). TextPrimary on Light Surface is `14.2:1` (AAA).
4. **Dynamic Sizing:** Text elements inherit platform accessibility scaling without container clipping.
5. **Screen Readers:** All tab bars, segmented controls, and dialogs implement ARIA-equivalent roles (`tablist`, `tab`, `dialog`, `alertdialog`).

---

## 10. Usage Rules: Do's and Don'ts

### Colors & Styling
* **DO:** Use `theme.colors.accent` or `theme.colors.surfaceElevated`.
* **DON'T:** Scatter raw hex codes like `color: '#D84315'` or `backgroundColor: '#FFF'` in components.
* **DO:** Use semantic spacing keys `margin: theme.spacing[4]`.
* **DON'T:** Use arbitrary values like `margin: 17` or `gap: 13`.

### Photography & Layout
* **DO:** Let user photography dominate profile cards with warm, clean typography overlays.
* **DON'T:** Overlay bright neon badges or patterned graphics on top of faces.
* **DO:** Use `ProfileCard` across all discovery and matches flows to maintain visual coherence.
* **DON'T:** Re-implement ad-hoc profile cards in feature screens.

### State & Feedback
* **DO:** Use `LoadingSkeleton` during initial data fetches.
* **DON'T:** Show a blank white screen or a tiny centered spinner with no context.
* **DO:** Explain errors empathetically: *"Unable to connect to Nazar servers. Check your internet connection."*
* **DON'T:** Display raw backend codes: *"Error 500: Internal Server Error"*.
