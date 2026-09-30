# Nazar Frontend Component System Architecture

**Document Version:** 1.0.0 (Frontend Gate F2)  
**Location:** `apps/mobile/src/design/`  
**Applicability:** Nazar React Native + Expo Mobile Application (`apps/mobile`)

---

## 1. Architectural Principles

The Nazar UI component system implements a layered, unidirectional composition architecture constructed atop the F0 Visual Constitution and F1 Information Architecture.

```text
Tokens & Theme (`/tokens`, `/theme`)
      │
      ▼
Primitives Layer (`/primitives`)
  (Box, Stack, Row, Column, Text, Icon, ImageView, Avatar)
      │
      ▼
Components Layer (`/components`)
  (Button, Input, Card, Media, Navigation, Modal, Feedback)
      │
      ▼
Patterns Layer (`/patterns`)
  (List, Filter, Form, Profile, Chat, Match, Social, Community, Event, Subscription, Safety, Settings, Permission)
      │
      ▼
Product Screens (`app/`, `src/`)
```

### Core Design Principles
1. **Separation of Concerns:** Primitives know only about design tokens and layout math; components know about interactive states, gestures, and accessibility; patterns compose components around business domain conventions; screens bind patterns to TanStack Query and Zustand stores.
2. **Constrained APIs:** Arbitrary inline styling (`style={{ fontSize: 17.5, color: '#f3a' }}`) is prohibited. All layout spacing, typography sizes, radii, shadows, and color values must resolve through semantic theme tokens.
3. **Double-Tap and Jitter Protection:** All interactive action buttons enforce internal throttling to eliminate accidental double-submissions, double-likes, or duplicate financial transactions.
4. **Deterministic Accessibility:** Every interactive component provides standard `accessibilityRole`, meaningful `accessibilityLabel`, dynamic contrast adaptation, and WCAG AA compliance (minimum 44x44pt touch target).
5. **Stable Test Identifiers:** Automated end-to-end and integration tests target standardized test ID strings following the schema: `[screen/domain].[component].[action]`.

---

## 2. Directory Structure

```text
apps/mobile/src/design/
├── tokens/               # F0 design tokens (colors, typography, spacing, radii, shadows, motion)
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   ├── radii.ts
│   ├── elevation.ts
│   ├── motion.ts
│   └── index.ts
│
├── theme/                # Dynamic theme context and light/dark color mappings
│   ├── ThemeContext.tsx
│   └── index.ts
│
├── primitives/           # Zero-business-logic visual and layout building blocks
│   ├── Box.tsx           # Box, Stack, Row, Column, Spacer, Divider, Pressable, Containers
│   ├── Text.tsx          # Text, DisplayText, HeadingText, TitleText, BodyText, etc.
│   ├── Heading.tsx       # Semantic heading primitive
│   ├── Icon.tsx          # Centralized geometric icon renderer
│   ├── ImageView.tsx     # Aspect-ratio-constrained media container with state caching
│   ├── Avatar.tsx        # Sized identity circles with online and verification indicators
│   ├── Badge.tsx         # Metadata pills and numeric counters
│   ├── SurfaceCard.tsx   # Elevated container with semantic border and shadows
│   └── index.ts
│
├── components/           # Generic interactive components
│   ├── button/           # Button, IconButton, PrimaryButton, DestructiveButton, FAB
│   ├── input/            # TextInput, MultilineInput, Select, SelectionRows (Chip, Radio, Checkbox, Toggle)
│   ├── card/             # ProfileCard, CompactProfileCard, MatchCard, EventCard, etc.
│   ├── media/            # MediaThumbnail, MediaGridGallery, MediaCarousel, FullScreenViewer
│   ├── navigation/       # TopBar, BottomTabBar, TabItem, BackButton, CloseButton
│   ├── modal/            # BottomSheet, Dialog, AlertDialog, ConfirmationDialog, DestructiveDialog
│   ├── feedback/         # Toast, Banner, LoadingSkeleton, EmptyState, ErrorState, OfflineBanner
│   └── index.ts
│
├── patterns/             # Composed domain patterns
│   ├── list/             # RefreshableList, InfiniteList, SectionList, ListScreen
│   ├── filter/           # FilterSheet, FilterSection, RangeSelector, PreferenceSelector
│   ├── form/             # FormSection, FormRow, FormField, FormActions
│   ├── profile/          # PhotoEditor, PromptEditor, InterestSelector, ProfileField
│   ├── chat/             # ChatMessageBubble, ChatTypingIndicator, UnreadDivider, ConversationRow
│   ├── match/            # MatchAvatarPair, MatchCelebration, MatchActionRow
│   ├── social/           # SocialPostCard, AuthorRow, ReactionButton, CommentRow
│   ├── community/        # CommunityFeedCard, CommunityHeader, MembershipButton
│   ├── event/            # EventFeedCard, EventDateBadge, EventStatusBadge, CapacityIndicator
│   ├── subscription/     # SubscriptionStatus, PlanCard, PricingTierCard, RestorePurchasesButton
│   ├── safety/           # ReportReasonList, BlockConfirmation, SafetyActionSheet, SafetyNotice
│   ├── settings/         # SettingsSection, SettingsRow, SettingsToggle, DangerZone
│   ├── permission/       # OpenSystemSettingsAction, PermissionExplanation, PermissionDeniedState
│   └── index.ts
│
├── a11y/                 # Accessibility target helpers, screen-reader utilities
├── localization/         # Cultural formatting, currency formatting (₹), date localization
└── index.ts              # Unified public API export
```

---

## 3. Layer Specifications

### 3.1 Design Tokens Layer
- **Colors:** Light (`#FAF8F5` cream background, `#D84315` warm terracotta accent) and Dark (`#12100E` deep obsidian background, `#F06548` radiant terracotta accent) palettes.
- **Typography:** 12 defined semantic scales with strict line-heights and font-weights (`display`, `heading1`–`heading3`, `title`, `bodyLarge`, `body`, `bodySmall`, `caption`, `label`, `button`, `numeric`).
- **Spacing:** Fibonacci-derived scale (`none: 0`, `xxs: 2`, `xs: 4`, `sm: 8`, `md: 16`, `lg: 24`, `xl: 32`, `xxl: 48`).
- **Radii:** Geometric curvature tokens (`radiusXS: 4`, `radiusSM: 8`, `radiusMD: 12`, `radiusLG: 16`, `radiusXL: 24`, `radiusFull: 9999`).
- **Elevation:** Multi-platform iOS shadow and Android elevation levels (`shadowSM`, `shadowMD`, `shadowLG`).

### 3.2 Primitives Layer
- Layout is constructed through `<Box>`, `<Stack>`, `<Row>`, `<Column>`, `<Spacer>`, and `<Divider>` rather than raw `View` style objects with arbitrary margins.
- Semantic typography components (`<DisplayText>`, `<HeadingText>`, `<BodyText>`, `<BodySmallText>`, `<CaptionText>`, `<NumericText>`) ensure zero typography drifting across screens.
- Media primitives (`<ImageView>`, `<Avatar>`) handle loading skeletons, blur hashes, fallback placeholders, and network failure states natively.

### 3.3 Components Layer
- All buttons implement active press feedback and double-tap prevention windows (default 400ms).
- Form inputs support validation error states, helper texts, clear triggers, secure text toggle, and OTP cell synchronization.
- Feedback components provide non-blocking toasts via React Context (`useToast`), non-dismissible or dismissible banners (`Banner`), connection quality indicators (`ConnectionIndicator`), and animated skeletons.

### 3.4 Patterns Layer
- Higher-order patterns encapsulate repetitive domain screens:
  - **Lists:** `<RefreshableList>` and `<InfiniteList>` wire pull-to-refresh, skeleton placeholders, and empty states automatically.
  - **Chat:** `<ChatMessageBubble>` renders Indian colloquialisms and timestamps with delivery status ticks (`sending`, `sent`, `delivered`, `read`).
  - **Matches:** `<MatchAvatarPair>` and `<MatchCelebration>` provide cinematic match celebration transitions.
  - **Trust & Safety:** `<SafetyActionSheet>`, `<ReportReasonList>`, and `<BlockConfirmation>` guarantee consistent moderation journeys.

---

## 4. Accessibility & Platform Conventions

- **Touch Targets:** Minimum 44x44pt hit areas on mobile via `hitSlop` or explicit dimension constraints (`MIN_TOUCH_TARGET = 44`).
- **Screen Readers:** All icons default to `accessible={false}` or provide an explicit `accessibilityLabel`. Interactive rows specify `accessibilityRole="button" | "radio" | "checkbox" | "switch"`.
- **Keyboard Navigation:** Forms support keyboard avoidance, next-field focusing, and automated bottom submission bars pinned to the safe area.
- **Dynamic Type:** Text primitives honor system accessibility scaling while maintaining layout bounds through `numberOfLines` and truncation ellipses where necessary.

---

## 5. Testing & Verification Standard

Components are verified through:
1. **Static Typing:** Strict TypeScript compilation with `noEmit: true`, no implicit `any`, and zero unused identifiers (`tsc --noEmit`).
2. **Unit Tests:** Vitest unit test coverage validating component instantiation, prop contracts, state transitions, and accessibility attributes.
3. **Showcase Integration:** All primitives, components, and patterns are rendered in `app/design-system-showcase.tsx`, enabling real-device QA across light and dark modes.
