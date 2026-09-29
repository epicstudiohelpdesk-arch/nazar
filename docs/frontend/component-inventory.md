# Nazar UI Component Inventory (F0)

**Version:** 1.0.0 (Frontend F0)  
**Location:** `apps/mobile/src/design/components/` & `apps/mobile/src/design/primitives/`  
**Purpose:** Canonical catalog of all foundational UI components, their variants, interaction states, accessibility contracts, and data dependencies.

---

## Summary Matrix

| Category | Component Count | Key Components |
| :--- | :--- | :--- |
| **Primitives** | 7 | `Box`, `Text`, `Heading`, `Icon`, `Avatar`, `Badge`, `SurfaceCard` |
| **Buttons** | 2 | `Button`, `IconButton` |
| **Inputs** | 11 | `TextInput`, `PasswordInput`, `OtpInput`, `MultilineInput`, `SearchInput`, `Select`, `SegmentedControl`, `Slider`, `DateSelector`, `ChipSelector`, `ImagePickerTrigger` |
| **Cards** | 8 | `ProfileCard`, `MediaCard`, `MatchCard`, `ConversationCard`, `CommunityCard`, `EventCard`, `SubscriptionCard`, `SurfaceCard` |
| **Media** | 1 | `MediaView` |
| **Navigation** | 3 | `TopNavHeader`, `BottomNavBar`, `BottomNavItem` |
| **Modals & Overlays**| 2 | `BottomSheet`, `Dialog` |
| **Feedback & States**| 5 | `EmptyState`, `ErrorState`, `LoadingSkeleton`, `ProgressBar`, `OfflineBanner` |
| **Total** | **37** | Full foundational coverage for Nazar Mobile |

---

## 1. Primitives

### 1.1 `Box`
* **Purpose:** Core layout primitive supporting padding, margin, flexbox alignment, and theme-token resolution.
* **Variants:** Standard layout container with flex props (`row`, `align`, `justify`, `gap`, `flex`, `wrap`).
* **States:** Static layout.
* **Accessibility requirements:** Supports `accessible`, `accessibilityRole`, and `accessibilityLabel`.
* **Data dependencies:** None.
* **Screens using it:** Global layout container across all current and future screens.

### 1.2 `Text`
* **Purpose:** Typographic primitive enforcing the 12-level hierarchy.
* **Variants:** `display`, `heading1`, `heading2`, `heading3`, `title`, `bodyLarge`, `body`, `bodySmall`, `caption`, `label`, `button`, `numeric`.
* **States:** Normal, Muted, Colored (Primary, Secondary, Accent, Success, Warning, Error, Inverse).
* **Accessibility requirements:** Dynamic type scaling, contrast WCAG AA compliant.
* **Screens using it:** All screens, cards, modals, and headers.

### 1.3 `Heading`
* **Purpose:** Semantic header primitive rendering `display`, `h1`, `h2`, `h3`, or `title` with consistent letter spacing.
* **Variants:** Level `display` (36pt), `h1` (30pt), `h2` (24pt), `h3` (20pt), `title` (18pt).
* **States:** Default, Centered, Inverted.
* **Accessibility requirements:** `accessibilityRole="header"`.
* **Data dependencies:** None.
* **Screens using it:** Screen headers, onboarding hero sections, profile sheet titles.

### 1.4 `Icon`
* **Purpose:** Geometric stroke-based iconography (24x24 optical grid, 2px uniform stroke).
* **Variants:** 25 semantic glyphs (`heart`, `close`, `message`, `search`, `filter`, `settings`, `shield`, `flag`, `more`, `back`, `chevron`, `location`, `calendar`, `camera`, `edit`, `check`, `plus`, `sparkles`, `user`, `bell`, `share`, `eye`, `eyeOff`, `lock`, `refresh`).
* **States:** Active, Inactive, Muted, Inverted.
* **Accessibility requirements:** Fallback `accessibilityLabel` attached to SVG wrapper.
* **Data dependencies:** None.
* **Screens using it:** Bottom nav, top nav, buttons, cards, filter bars.

### 1.5 `Avatar`
* **Purpose:** Identity representation for users, matches, and community authors.
* **Variants:** Sizes: `tiny` (24pt), `small` (32pt), `medium` (48pt), `large` (64pt), `xlarge` (96pt).
* **States:** Normal, Online (presence dot), Verified (shield icon overlay), Loading (skeleton placeholder), Unavailable (fallback initials).
* **Accessibility requirements:** `accessibilityRole="image"`, `accessibilityLabel="{name}'s avatar"`.
* **Data dependencies:** Image URI, user display name, verification status, presence status.
* **Screens using it:** Profile headers, match rows, conversation lists, comment feeds.

### 1.6 `Badge`
* **Purpose:** Compact visual tag for metadata, counts, status, and premium tiers.
* **Variants:** `accent`, `surface`, `success`, `warning`, `error`, `info`, `gold`.
* **States:** Normal, Pill, Dot-only, Counter.
* **Accessibility requirements:** Screen reader announcement of badge value.
* **Data dependencies:** Label string or count number.
* **Screens using it:** Match expiration counters, unread badges, verification chips.

### 1.7 `SurfaceCard`
* **Purpose:** Foundational elevated card container providing boundary contrast and subtle shadow.
* **Variants:** Flat, Outlined, Elevated (`shadowSM`, `shadowMD`, `shadowLG`).
* **States:** Normal, Interactive (pressed state opacity).
* **Accessibility requirements:** Touch target compliance when clickable.
* **Data dependencies:** Children React nodes.
* **Screens using it:** Profile previews, settings cards, prompt cards.

---

## 2. Buttons

### 2.1 `Button`
* **Purpose:** Primary touch action component across the entire application.
* **Variants:** `primary` (Terracotta filled), `secondary` (Surface with border), `tertiary` (Ghost text), `destructive` (Crimson filled). Sizes: `sm` (36pt), `md` (48pt), `lg` (56pt).
* **States:** `default`, `pressed` (active opacity), `disabled` (0.4 opacity, pointer events none), `loading` (shows native spinner), `success`, `error`.
* **Accessibility requirements:** Minimum 44pt touch target; `accessibilityRole="button"`, `accessibilityState={{ disabled, busy }}`.
* **Data dependencies:** None.
* **Screens using it:** Onboarding, discovery action bar, edit profile, checkout, settings.

### 2.2 `IconButton`
* **Purpose:** Compact icon-only touch trigger for toolbars, photo navigation, and card overlays.
* **Variants:** `primary`, `secondary`, `tertiary`, `destructive`. Sizes: `sm` (36pt), `md` (44pt), `lg` (52pt).
* **States:** `default`, `pressed`, `disabled`, `loading`.
* **Accessibility requirements:** Strict `accessibilityLabel` enforcement; satisfies 44pt minimum touch boundary.
* **Data dependencies:** Icon name.
* **Screens using it:** Header back buttons, card pass/like triggers, photo carousel pagers.

---

## 3. Inputs

### 3.1 `TextInput`
* **Purpose:** Single-line alphanumeric input for names, emails, addresses, and short text.
* **Variants:** Standard, With Left Icon, With Right Action.
* **States:** `default`, `focused` (strong accent border), `filled`, `error` (crimson border + message), `disabled`.
* **Accessibility requirements:** `accessibilityLabel`, error announcement with `accessibilityLiveRegion="polite"`.
* **Data dependencies:** Value and onChangeText.
* **Screens using it:** Auth, profile editing, search filters.

### 3.2 `PasswordInput`
* **Purpose:** Secure text entry with built-in show/hide password toggle.
* **Variants:** Standard password, confirm password.
* **States:** `default`, `focused`, `obscured`, `revealed`, `error`, `disabled`.
* **Accessibility requirements:** Accessible toggle button with label "Show password" / "Hide password".
* **Data dependencies:** Value and onChangeText.
* **Screens using it:** Sign in, sign up, password change dialog.

### 3.3 `OtpInput`
* **Purpose:** Digit-by-digit phone and email verification input.
* **Variants:** 4-digit and 6-digit layouts with auto-focus advancing.
* **States:** `default`, `focusedCell`, `filledCell`, `error`, `disabled`.
* **Accessibility requirements:** Single text field or grouped cell with keyboardType="number-pad".
* **Data dependencies:** OTP code string.
* **Screens using it:** Phone verification, 2FA prompt.

### 3.4 `MultilineInput`
* **Purpose:** Rich bio and prompt answer editor with auto-growing height and character counter.
* **Variants:** Standard multiline, bordered prompt card input.
* **States:** `default`, `focused`, `filled`, `characterLimitApproaching`, `error`, `disabled`.
* **Accessibility requirements:** Character count announced to assistive tech.
* **Data dependencies:** Current text, maxLength.
* **Screens using it:** Profile bio editor, icebreaker prompt answers.

### 3.5 `SearchInput`
* **Purpose:** Search query bar with clear button and real-time query feedback.
* **Variants:** Pill search bar, rectangular header search.
* **States:** `default`, `activeQuery`, `loading`, `clearable`.
* **Accessibility requirements:** `accessibilityRole="search"`.
* **Data dependencies:** Query string.
* **Screens using it:** Discovery search, conversation list search, community lookup.

### 3.6 `Select`
* **Purpose:** Dropdown / picker trigger opening bottom-sheet option selection.
* **Variants:** Single select, categorized select.
* **States:** `unselected`, `selected`, `focused`, `disabled`, `error`.
* **Accessibility requirements:** `accessibilityRole="combobox"`.
* **Data dependencies:** Options array `{ label, value }`.
* **Screens using it:** City selector, relationship goal, zodiac, languages.

### 3.7 `SegmentedControl`
* **Purpose:** Discrete tabbed switch for switching views or filter dimensions.
* **Variants:** 2-segment, 3-segment, 4-segment pill container.
* **States:** `active`, `inactive`, `disabled`.
* **Accessibility requirements:** `accessibilityRole="tablist"`, items `accessibilityRole="tab"`.
* **Data dependencies:** Options array, activeIndex.
* **Screens using it:** Likes tab (Received / Sent), Matches tab (All / Unread).

### 3.8 `Slider`
* **Purpose:** Range and continuous value selection for discovery preferences.
* **Variants:** Single slider (distance), Dual slider (age range min/max).
* **States:** `default`, `sliding`, `disabled`.
* **Accessibility requirements:** `accessibilityRole="adjustable"`, value announcement.
* **Data dependencies:** Min, max, step, current value.
* **Screens using it:** Discovery filters (distance in km, age range).

### 3.9 `DateSelector`
* **Purpose:** Date of birth and calendar event selector complying with Indian formats (DD/MM/YYYY).
* **Variants:** Date of birth picker, event date picker.
* **States:** `default`, `focused`, `valid`, `invalidAgeLimit`.
* **Accessibility requirements:** Modal calendar or spinner with standard a11y labels.
* **Data dependencies:** Selected Date object.
* **Screens using it:** Registration (Age 18+ verification), Event scheduling.

### 3.10 `ChipSelector`
* **Purpose:** Multi-select interest and lifestyle tag selector with max selection caps.
* **Variants:** Outlined chip, filled accent chip, icon chip.
* **States:** `selected`, `unselected`, `disabledMaxReached`.
* **Accessibility requirements:** `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`.
* **Data dependencies:** Options list, selectedValues array, maxSelectable limit.
* **Screens using it:** Profile setup (Interests, Languages, Dietary habits, Music).

### 3.11 `ImagePickerTrigger`
* **Purpose:** Photo upload slot with upload trigger, preview, delete button, and reorder affordance.
* **Variants:** Hero primary slot (large), Secondary photo slot (grid).
* **States:** `empty`, `uploading` (spinner), `filled`, `rejected` (guideline failure).
* **Accessibility requirements:** Accessible button to "Add photo slot {N}" or "Remove photo {N}".
* **Data dependencies:** Photo URL or null.
* **Screens using it:** Profile photo manager, verification selfie upload.

---

## 4. Cards

### 4.1 `ProfileCard`
* **Purpose:** Canonical dating profile presentation across the entire product.
* **Variants (Contexts):**
  * `discovery`: Full portrait media, photo count pills, name, age, city, bio snippet, like/pass action overlay.
  * `likes`: Blurred or unblurred grid tile with heart badge and mutual teaser.
  * `matches`: Circle avatar card with mutual prompt quote and start-chat action.
  * `search`: Compact discovery card with distance, compatibility score, and interests.
  * `community`: Member card with group tags and mutual connections.
  * `event`: Event attendee card with RSVP badge.
  * `profilePreview`: Full-bleed self-preview with edit shortcuts.
* **States:** Normal, Expanded (full bio sheet), Blurred (pre-match blur mode).
* **Accessibility requirements:** Comprehensive accessible summary containing name, age, location, and verification status.
* **Data dependencies:** Profile data object (id, name, age, images, bio, location, verified).
* **Screens using it:** Main Discovery deck, Likes Received grid, Matches list, Search results, Public Profile.

### 4.2 `MediaCard`
* **Purpose:** General photography card supporting diverse aspect ratios and content protection.
* **Variants:** Square, Portrait (4:5 or 9:16), Landscape.
* **States:** `normal`, `blurred` (restricted or pending mutual match), `loading`, `error`.
* **Accessibility requirements:** Alt text description.
* **Data dependencies:** Media URI, restriction flags.
* **Screens using it:** Photo galleries, profile prompts, community posts.

### 4.3 `MatchCard`
* **Purpose:** Card representing an active match waiting for conversation.
* **Variants:** New Match (with glowing ring / expiration badge), Active Match.
* **States:** `normal`, `expiringSoon` (amber warning), `unread`.
* **Accessibility requirements:** Match expiration alert announcement.
* **Data dependencies:** Match entity (id, user, matchedAt, expiresAt).
* **Screens using it:** Matches screen top horizontal carousel.

### 4.4 `ConversationCard`
* **Purpose:** Interactive messaging row in conversation list.
* **Variants:** Standard direct message, Prompt response preview.
* **States:** `read`, `unread` (bold name, unread count badge), `typing`, `offlineSent`.
* **Accessibility requirements:** Announces sender, last message preview, unread status, and timestamp.
* **Data dependencies:** Conversation summary (participant, lastMessage, unreadCount, updatedAt).
* **Screens using it:** Messages / Inbox screen.

### 4.5 `CommunityCard`
* **Purpose:** Community group or interest circle preview card.
* **Variants:** Featured community, Joined community row.
* **States:** `joined`, `openToJoin`, `privateRequestPending`.
* **Accessibility requirements:** Announces group name, member count, and join state.
* **Data dependencies:** Community entity (id, title, description, memberCount, iconUri).
* **Screens using it:** Community tab, explore groups.

### 4.6 `EventCard`
* **Purpose:** Singles mixers, cultural gatherings, and speed-dating events.
* **Variants:** Upcoming event card, Past event summary.
* **States:** `rsvpd`, `open`, `soldOut`, `liveNow`.
* **Accessibility requirements:** Full event date, location, and ticket status announced.
* **Data dependencies:** Event entity (id, title, date, location, attendeeCount, coverUri).
* **Screens using it:** Events tab, city single mixers.

### 4.7 `SubscriptionCard`
* **Purpose:** Nazar Gold / Nazar Platinum membership tier upsell card.
* **Variants:** Gold tier, Platinum tier, Spotlight boost package.
* **States:** `default`, `bestValueBadge`, `currentPlan`, `loadingCheckout`.
* **Accessibility requirements:** Clear pricing breakdown and billing terms.
* **Data dependencies:** Plan details (id, title, price, period, perks).
* **Screens using it:** Paywall sheet, Settings subscription management.

---

## 5. Media Primitives

### 5.1 `MediaView`
* **Purpose:** Photography rendering primitive wrapping React Native Image with skeleton placeholders, caching, error fallbacks, and blur overlays.
* **Variants:** `square`, `portrait`, `landscape`, `fullBleed`, `thumbnail`.
* **States:** `loading` (shows SkeletonBox shimmer), `loaded`, `error` (shows retry icon), `blurred` (security/privacy blur filter).
* **Accessibility requirements:** `accessibilityRole="image"`, `accessibilityLabel`.
* **Data dependencies:** URI string, blurHash or fallback placeholder.
* **Screens using it:** Profile cards, gallery viewers, media grids.

---

## 6. Navigation Primitives

### 6.1 `TopNavHeader`
* **Purpose:** Canonical top bar respecting safe-area top insets.
* **Variants:** Title-only, With Back Button, With Close Button, With Right Actions (e.g. Filter, Settings, Report).
* **States:** Transparent (for full-bleed profile headers), Solid background (with border).
* **Accessibility requirements:** Navigation actions have 44pt touch areas and accessible roles.
* **Data dependencies:** Title string, optional action handlers.
* **Screens using it:** All stack screens, settings, edit profile, filters modal.

### 6.2 `BottomNavBar` & `BottomNavItem`
* **Purpose:** Primary application tab navigation bar respecting safe-area bottom insets.
* **Variants:** 4-tab or 5-tab configuration (`Discovery`, `Likes`, `Matches`, `Community`, `Profile`).
* **States:** `activeTab` (accent color, bold label), `inactiveTab` (stone color), `withUnreadBadge` (numeric count).
* **Accessibility requirements:** `accessibilityRole="tablist"`, items `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.
* **Data dependencies:** Active route, badge counts from stores.
* **Screens using it:** Root application layout (`app/(tabs)/`).

---

## 7. Modals & Overlays

### 7.1 `BottomSheet`
* **Purpose:** Modal bottom sheet for filters, profile options, report flows, and action pickers.
* **Variants:** Fixed height, Content-driven height, Draggable grabber handle.
* **States:** `hidden`, `presenting`, `visible`, `dismissing`.
* **Accessibility requirements:** Traps focus when visible; `accessibilityRole="dialog"`.
* **Data dependencies:** Visible boolean, onClose handler.
* **Screens using it:** Discovery filters, reporting profile, match options, photo picker.

### 7.2 `Dialog`
* **Purpose:** Critical confirmation and alert modal dialogs.
* **Variants:** `confirm` (neutral), `destructive` (red CTA for unmatch/block/delete), `warning` (safety notice).
* **States:** `visible`, `dismissing`.
* **Accessibility requirements:** `accessibilityRole="alertdialog"`, accessible title and description.
* **Data dependencies:** Title, message, confirmText, cancelText, onConfirm, onCancel.
* **Screens using it:** Unmatch confirmation, block user, delete account, logout.

---

## 8. Feedback & System States

### 8.1 `EmptyState`
* **Purpose:** Contextual empty view answering: (1) what happened, (2) why it's empty, and (3) what actionable next step to take.
* **Variants:** `noMatches`, `noLikes`, `noConversations`, `noNotifications`, `noSearchResults`, `offline`, `communityEmpty`, `generic`.
* **States:** Static display with primary action button.
* **Accessibility requirements:** Screen reader announcement of empty status and action.
* **Data dependencies:** Type enum or custom title/description/action.
* **Screens using it:** Discovery deck exhausted, Likes empty, Chat list empty, Search zero results.

### 8.2 `ErrorState`
* **Purpose:** Humanized error messaging replacing raw HTTP codes with empathetic explanations and recovery actions.
* **Variants:** `network`, `server`, `unauthorized`, `rateLimit`, `notFound`, `validation`, `payment`, `safetyAlert`, `generic`.
* **States:** Full screen error, Inline card error.
* **Accessibility requirements:** `accessibilityLiveRegion="assertive"`.
* **Data dependencies:** Error category or custom message, onRetry handler.
* **Screens using it:** Failed feed load, network disconnect, payment failure.

### 8.3 `LoadingSkeleton`
* **Purpose:** Shimmering placeholder components that preserve visual layout during async operations.
* **Variants:** `SkeletonBox` (custom width/height), `ProfileCardSkeleton`, `ConversationListSkeleton`.
* **States:** Pulsing opacity animation.
* **Accessibility requirements:** `accessibilityElementsHidden={true}`, `accessibilityLabel="Loading..."`.
* **Data dependencies:** None.
* **Screens using it:** Initial load of discovery deck, match lists, conversations.

### 8.4 `ProgressBar`
* **Purpose:** Visual progress indicator for multi-step onboarding and profile completion.
* **Variants:** Continuous bar, Segmented step bar.
* **States:** 0% to 100% progress.
* **Accessibility requirements:** `accessibilityRole="progressbar"`, `accessibilityValue={{ min: 0, max: 100, now: progress }}`.
* **Data dependencies:** Progress number (0 to 1).
* **Screens using it:** Registration flow, profile completion meter.

### 8.5 `OfflineBanner`
* **Purpose:** Non-intrusive status strip informing user of network connectivity states.
* **Variants:** Top banner, floating capsule.
* **States:** `offline` (charcoal warning), `reconnecting` (amber), `syncing` (blue), `synced` (temporary green), `failed` (red).
* **Accessibility requirements:** Polite live region update.
* **Data dependencies:** Network state from connectivity store.
* **Screens using it:** App-wide global header overlay.
