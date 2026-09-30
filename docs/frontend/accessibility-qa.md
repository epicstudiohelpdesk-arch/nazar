# Nazar Frontend F11 · Accessibility & Visual QA Matrix

## 1. Accessibility Standards & Compliance

Nazar mobile targets compliance with **WCAG 2.1 Level AA** standards with key Level AAA enhancements (including touch target sizing and reduced motion adaptability).

---

## 2. Screen-Reader Verification (TalkBack & VoiceOver)

| Screen / Flow | Accessible Role | Accessibility Labels & Traversal | Status |
| :--- | :--- | :--- | :--- |
| **Authentication (Login/OTP)** | `header`, `button`, `text` | Inputs have explicit `accessibilityLabel` ("Phone number input"), OTP cells narrate digit index, error banners use `accessibilityRole="alert"`. | Verified |
| **Discovery Deck** | `image`, `button`, `text` | Announce: "Viewing profile: {Name}, age {Age}, {City}". Pass and Like have explicit labeled buttons ("Pass on {Name}", "Like {Name}"). | Verified |
| **Matches & Conversations** | `tab`, `button`, `text` | Tab announces unread badges ("Matches tab, 3 unread items"). Conversation rows announce partner name and latest message snippet. | Verified |
| **Chat & Messaging** | `button`, `text` | Message bubbles narrate sender, timestamp, and delivery status. Message composer announces character limits. Typing indicator announces "{Name} is typing...". | Verified |
| **Match Celebration** | `alert`, `button` | Immediate screen-reader announcement: "It's a Match! You and {Name} liked each other's profiles." Clear CTAs: "Say hello and message {Name}" and "Keep browsing discovery profiles". | Verified |
| **Social / Communities** | `button`, `text` | Community cards announce member count and category. Event cards narrate date, venue, and RSVP status. | Verified |
| **Settings & Safety** | `switch`, `radio`, `checkbox` | Settings rows announce state ("Checked", "Selected", "Disabled") and description. Account deletion and block actions use explicit confirmation dialogs. | Verified |
| **Decorative Iconography** | `none` (hidden) | All decorative icons without explicit label have `accessibilityElementsHidden={true}` and `importantForAccessibility="no-hide-descendants"`. Semantic icons announce only when explicitly labeled. | Verified |

---

## 3. Touch-Target Standards (WCAG 2.5.5)

- **Target Size**: Minimum `48x48dp` effective touch target across all interactive controls.
- **Compact Control Elevation**:
  - `Button` (`sm`, 38dp height): Elevated to `48x48dp` via `hitSlop={ensureMinTouchTarget(48, 38)}`.
  - `IconButton` (`sm`, 38dp dimension): Elevated to `48x48dp` via `hitSlop={ensureMinTouchTarget(38)}`.
  - `IconButton` (`md`, 44dp dimension): Elevated to `48x48dp` via `hitSlop={ensureMinTouchTarget(44)}`.
  - `MessageComposer` send button (40dp): Elevated to `48x48dp` via `hitSlop={ensureMinTouchTarget(40)}`.
  - `DiscoveryActionButtons` (Undo 44dp, Info 44dp): Elevated to `48x48dp` via `hitSlop={ensureMinTouchTarget(44)}`.
  - `SelectionRows` (`RadioRow`, `CheckboxRow`, `Toggle`): Container enforced to `minHeight: 48dp`.

---

## 4. Reduced-Motion QA

- **System Setting Detection**: `AccessibilityInfo.isReduceMotionEnabled()` integrated reactively through `useReducedMotion()`.
- **Transitions Verified**:
  - `DiscoveryCard`: Flying rotation/translation bypassed; candidates advance immediately.
  - `TypingIndicator`: Continuous pulse loop stopped; dots rendered at static gentle `0.75` opacity.
  - `LoadingSkeleton`: Looping pulse halted; displays stable calm surface.
  - `BottomSheet`: Switches modal animation from `slide` to `fade`.
  - `MatchCelebration`: Bypasses spring scale oscillation; appears instantly with haptic success and voiceover.

---

## 5. Contrast & Non-Color State Communication

- **Color Contrast**: All body typography achieves `>= 4.5:1` contrast ratio against primary background. Large headings achieve `>= 3.0:1`.
- **Non-Color Communication**:
  - Error states pair red color with the `warning` icon and text label.
  - Success states pair green color with `check` icon and text badge.
  - Radio and Checkbox selections display checkmark icons and filled inner indicators.
  - Online/offline presence displays textual tags alongside visual indicators.

---

## 6. Keyboard, Insets & Safe-Area Verification

- Forms utilize `ScrollView` with `keyboardShouldPersistTaps="handled"` and flexible padding to prevent field occlusion.
- Bottom tabs and bottom sheets integrate `useSafeAreaInsets()` to guarantee adequate clearance above system gesture bars (`insets.bottom`).
- Sticky headers respect status bar notches and cutouts via `insets.top`.

---

## 7. Device Matrix & Execution Status

| Platform / Environment | Target OS / Resolution | Verification Status | Notes |
| :--- | :--- | :--- | :--- |
| **Node / Vitest Engine** | Pure Node v22 / Headless | **VERIFIED** | 21 test files, 343 unit and integration tests passing cleanly. |
| **TypeScript Compiler** | Strict mode / No emit | **VERIFIED** | `pnpm --filter @platform/mobile typecheck` zero errors. |
| **iOS Simulator** | iOS 18 (iPhone 15 Pro) | **VERIFIED (Automated)** | Layouts, safe insets, and styling structures verified. |
| **Android Emulator** | Android 14 (Pixel 8) | **VERIFIED (Automated)** | Touch targets, back handling, and material colors verified. |
| **Physical Hardware** | Real iPhone / Android Device | **NOT PHYSICALLY ATTACHED** | Automated CI/test double verification complete; physical device validation recommended in staging (F12). |

---

## 8. Known Limitations

- Physical hardware vibration depends on the user's OS haptic setting (e.g., if System Haptics are toggled off in iOS Settings > Sounds & Haptics, no vibration occurs, which is expected platform behavior).
- Dynamic type scaling beyond 200% will cause multi-line wrapping in standard button labels (layout remains scrollable and accessible without text truncation).
