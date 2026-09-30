# Nazar Frontend F11 · Motion, Micro-interactions, and Polish Architecture

## 1. Overview & Baseline

Frontend Phase F11 establishes the centralized interaction, motion, accessibility, and visual-polish foundation across Nazar. The architecture balances responsive fluidity with strict platform accessibility guidelines (WCAG 2.1 AA / AAA standards, reduced-motion preferences, and deterministic haptics).

---

## 2. Motion System

The motion system is centralized in `@platform/ui` (`packages/ui/src/tokens/motion.ts`) and `@platform/mobile` (`apps/mobile/src/design/motion/`).

### 2.1 Motion Tokens

```typescript
export const motion = {
  duration: {
    instant: 0,
    micro: 100,      // Subtle state toggles, icons
    fast: 150,       // Button taps, chip selects
    standard: 250,   // Dialog appearance, cards
    normal: 250,     // Backwards-compatible standard
    emphasis: 350,   // Sheet entrance, match celebration
    slow: 400,       // Modal backdrops, complex transitions
  },
  spring: {
    damping: 20,
    mass: 1,
    stiffness: 180,
    gentle: { damping: 25, mass: 1, stiffness: 140 },
    bouncy: { damping: 15, mass: 1, stiffness: 200 },
    stiff: { damping: 28, mass: 0.8, stiffness: 240 },
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
    emphasized: 'cubic-bezier(0.2, 0.0, 0.0, 1)',
  },
};
```

### 2.2 Animation Principles
- **Hierarchy & Continuity**: Elements transition into place without jarring layout jumps.
- **Cause & Effect**: User interactions trigger immediate visual and tactile feedback.
- **Performant Transforms**: All animations leverage `useNativeDriver: true` (opacity, scale, translateY, translateX) to run on the native thread without dropping frames.
- **Non-blocking**: Transitions do not prevent user cancellation or rapid navigation.

---

## 3. Reduced-Motion Strategy

Nazar respects the system accessibility preference (`AccessibilityInfo.isReduceMotionEnabled()`):
- **Centralized Hook**: `useReducedMotion()` provides reactive updates when system preferences change.
- **Safe Duration Helper**: `getSafeDuration(duration)` collapses motion to `0ms` when reduced motion is enabled.
- **Safe Animation Builders**: `createSafeTiming` and `createSafeSpring` automatically substitute animations with instantaneous 0-duration timing when reduced motion is active.
- **Component Behaviors**:
  - `TypingIndicator`: Disables continuous pulsing loop; keeps dots at a stable, readable `0.75` opacity.
  - `LoadingSkeleton`: Halts continuous loop; renders calm static surface placeholder.
  - `BottomSheet`: Switches from vertical slide to instantaneous fade.
  - `DiscoveryCard`: Bypasses 200ms offscreen fly-off animation on release, transitioning candidates immediately.
  - `MatchCelebration`: Bypasses spring scaling; displays celebratory surface immediately with full screen-reader announcements.

---

## 4. Semantic Haptic Taxonomy

Haptics are centralized in [`apps/mobile/src/design/haptics/haptic-feedback.ts`](file:///Users/subhamdas/Documents/PROJECTS/nazar/apps/mobile/src/design/haptics/haptic-feedback.ts).

| Category | Sensation / Pattern | Use Cases |
| :--- | :--- | :--- |
| **Selection / Light** | 10ms–15ms pulse | Button taps, chip selection, switch toggle, tab switch, message send |
| **Medium** | 30ms pulse | Discovery Like action, RSVP confirmation, filter submission |
| **Success** | `[0, 35, 60, 45]` multi-pulse | Match celebration, subscription purchase success |
| **Warning** | `[0, 40, 50, 40]` alert pulse | Form validation warning, boundary warning, destructive dialog opening |
| **Error** | `[0, 50, 60, 50, 60, 50]` triple pulse | Account deletion confirmation, block execution, network mutation failure |

### Safeguards:
- **Debouncing**: `100ms` window prevents sensory overload or double-firing when screen and component handlers overlap.
- **Global Toggle**: `haptics.setEnabled(false)` silences all haptics for low-power or user-disabled settings.
- **Environment Agnostic**: Gracefully falls back to no-op in Node / unit test environments.

---

## 5. Interaction States & Touch Target Standards

- **Touch Target Standard**:
  - Default: `44pt` platform baseline.
  - Recommended Target: `48x48dp` (WCAG 2.5.5 AAA standard).
  - Helper `ensureMinTouchTarget(width, height, targetSize)` calculates symmetric `hitSlop` so visual compactness is preserved without sacrificing accessible ergonomics.
- **Interactive Component Audits**:
  - `Button`: Debounces rapid taps (`<400ms`), adds haptics, provides `hitSlop` on `sm` (38dp) variants.
  - `IconButton`: Expands `sm` (38dp) and `md` (44dp) to at least 48dp via `hitSlop`, triggers tactile feedback.
  - `RadioRow`, `CheckboxRow`, `Toggle`: Container enforced to `minHeight: 48dp`, triggers light selection haptic.
  - `DiscoveryActionButtons`: Like (64dp) and Pass (58dp) are well above 48dp; Undo (44dp) and Info (44dp) elevated with symmetric hitSlop.
  - `MessageComposer`: Send button (40dp) elevated to 48dp target via hitSlop.

---

## 6. Feedback, Empty & Error States

- **Loading State**: Shimmer pulse across `SkeletonBox`, `SkeletonCard`, and `ProfileCardSkeleton` (calmed during reduced motion).
- **Empty States**: Centralized in `EmptyState.tsx` across `no_matches`, `no_conversations`, `no_notifications`, `no_communities`, `no_events`, and `no_likes` with clear recovery CTAs.
- **Error States**: `ErrorState.tsx` surfaces actionable alerts for `network_unavailable`, `server_error`, `auth_expired`, `permission_denied`, and `rate_limited`.
- **Offline States**: `OfflineBanner.tsx` displays local sync queue status and discrete reconnect prompts.

---

## 7. Performance & Memory Guarantees

- Zero layout-triggering animated styles (width/height/margin/padding animations strictly avoided).
- Composited animations run on the native UI thread using `useNativeDriver: true`.
- Listeners (reduced motion, timer intervals) are cleanly detached in React `useEffect` cleanups to prevent memory leaks.
