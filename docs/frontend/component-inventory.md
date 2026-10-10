# Nazar UI Component Inventory

**Version:** 2.0.0 (Frontend Gate F2)  
**Location:** `apps/mobile/src/design/`  
**Purpose:** Canonical inventory of all Nazar core primitives, generic components, and domain patterns, including their variants, states, accessibility roles, and test ID conventions.

---

## 1. Summary Matrix

| Category                  | Count   | Key Components                                                                                                                                                                                                                                         |
| :------------------------ | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primitives**            | 18      | `Box`, `Stack`, `Row`, `Column`, `Spacer`, `Divider`, `Pressable`, `ScrollContainer`, `SafeAreaContainer`, `Text`, `DisplayText`, `HeadingText`, `TitleText`, `BodyText`, `BodySmallText`, `CaptionText`, `NumericText`, `Icon`, `ImageView`, `Avatar` |
| **Buttons & Actions**     | 8       | `Button`, `PrimaryButton`, `SecondaryButton`, `TertiaryButton`, `DestructiveButton`, `TextButton`, `IconButton`, `FloatingActionButton`                                                                                                                |
| **Inputs & Selection**    | 16      | `TextInput`, `PasswordInput`, `OtpInput`, `MultilineInput`, `SearchInput`, `Select`, `SegmentedControl`, `Slider`, `DateSelector`, `ChipSelector`, `Chip`, `SelectableChip`, `RadioRow`, `CheckboxRow`, `Toggle`, `ImagePickerTrigger`                 |
| **Cards & Media**         | 12      | `ProfileCard`, `CompactProfileCard`, `MediaCard`, `MatchCard`, `ConversationCard`, `CommunityCard`, `EventCard`, `SubscriptionCard`, `SurfaceCard`, `MediaThumbnail`, `MediaGridGallery`, `FullScreenMediaViewer`                                      |
| **Navigation**            | 8       | `TopNavHeader`, `TopBar`, `BottomNavBar`, `BottomTabBar`, `BottomNavItem`, `TabItem`, `BackButton`, `CloseButton`                                                                                                                                      |
| **Modals & Dialogs**      | 5       | `BottomSheet`, `Dialog`, `AlertDialog`, `ConfirmationDialog`, `DestructiveDialog`                                                                                                                                                                      |
| **Feedback & System**     | 16      | `Toast`, `ToastProvider`, `Banner`, `ConnectionIndicator`, `SyncIndicator`, `RetryAction`, `Spinner`, `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonProfile`, `PullToRefresh`, `EmptyState`, `ErrorState`, `InlineError`, `OfflineBanner`       |
| **List Patterns**         | 4       | `RefreshableList`, `InfiniteList`, `SectionList`, `ListScreen`                                                                                                                                                                                         |
| **Filter Patterns**       | 5       | `FilterSheet`, `FilterChip`, `FilterSection`, `RangeSelector`, `PreferenceSelector`                                                                                                                                                                    |
| **Form Patterns**         | 4       | `FormSection`, `FormRow`, `FormField`, `FormActions`                                                                                                                                                                                                   |
| **Profile Patterns**      | 5       | `PhotoEditor`, `PromptEditor`, `InterestSelector`, `ProfileField`, `ProfilePreview`                                                                                                                                                                    |
| **Chat Patterns**         | 8       | `ChatMessageBubble`, `ChatTypingIndicator`, `UnreadDivider`, `ConversationRow`, `ChatMessageComposer`, `ChatAttachmentButton`, `MessageStatus`, `MessageTimestamp`                                                                                     |
| **Match Patterns**        | 3       | `MatchAvatarPair`, `MatchCelebration`, `MatchActionRow`                                                                                                                                                                                                |
| **Social Patterns**       | 6       | `AuthorRow`, `ReactionButton`, `CommentRow`, `PostCard`, `SocialPostCard`, `SocialMediaPreview`                                                                                                                                                        |
| **Community Patterns**    | 4       | `CommunityFeedCard`, `MembershipButton`, `CommunityHeader`, `CommunityPostPreview`                                                                                                                                                                     |
| **Event Patterns**        | 6       | `EventFeedCard`, `EventDateBadge`, `EventStatusBadge`, `EventLocation`, `CapacityIndicator`, `RSVPButton`                                                                                                                                              |
| **Subscription Patterns** | 7       | `SubscriptionStatus`, `PlanCard`, `PricingTierCard`, `RestorePurchasesButton`, `PurchaseButton`, `BenefitRow`, `EntitlementBadge`                                                                                                                      |
| **Safety Patterns**       | 5       | `ReportReasonList`, `BlockConfirmation`, `SafetyActionSheet`, `SafetyNotice`, `ModerationState`                                                                                                                                                        |
| **Settings Patterns**     | 5       | `SettingsSection`, `SettingsRow`, `SettingsToggle`, `SettingsToggleRow`, `DangerZone`                                                                                                                                                                  |
| **Permission Patterns**   | 3       | `OpenSystemSettingsAction`, `PermissionExplanation`, `PermissionDeniedState`                                                                                                                                                                           |
| **Total**                 | **148** | Comprehensive production component system for Nazar Mobile                                                                                                                                                                                             |

---

## 2. Primitives Layer

### 2.1 Layout Primitives

- **`Box`**: Foundational container resolving `p`, `px`, `py`, `m`, `mx`, `my`, `bg`, `radius`, `border`, `elevationLevel` from tokens.
- **`Stack`**: Flexbox column or row layout container with constrained `gap` token support.
- **`Row`**: Horizontal layout container with preset `align` and `justify` props.
- **`Column`**: Vertical layout container.
- **`Spacer`**: Explicit dimensional gap (`size="xs" | "sm" | "md" | "lg" | "xl"`).
- **`Divider`**: 1px semantic border separator with optional horizontal/vertical orientation.
- **`Pressable`**: Touchable primitive with built-in opacity/scale feedback and double-tap prevention.
- **`ScrollContainer`**: Keyboard-aware scroll container honoring content padding.
- **`SafeAreaContainer`**: Device safe-area wrapper with automatic top/bottom inset resolution.

### 2.2 Semantic Typography

- **`DisplayText`**: 36pt Bold editorial display typography.
- **`HeadingText`**: Semantic headings (`level="h1" | "h2" | "h3"`).
- **`TitleText`**: 18pt Medium card and section header typography.
- **`BodyText`**: 16pt Regular reading text with 24pt line height.
- **`BodySmallText`**: 14pt Regular secondary text.
- **`CaptionText`**: 12pt Medium metadata and badge text.
- **`LabelText`**: 12pt Semibold uppercase form labels.
- **`NumericText`**: 16pt Tabular numeral typography for prices, distances, and counts.

### 2.3 Media & Identity

- **`ImageView`**: Aspect ratio container (`1:1`, `4:5`, `3:4`, `16:9`) with blur hash placeholder and cache lifecycle states.
- **`Avatar`**: Identity circular image with size tokens (`xs: 24`, `sm: 32`, `md: 48`, `lg: 64`, `xl: 96`), online status dot, and verified tick. Convenience aliases: `AvatarXS`, `AvatarSM`, `AvatarMD`, `AvatarLG`, `AvatarXL`.
- **`Icon`**: Centralized stroke icon primitive with 32+ semantic glyphs (`sparkle`, `compass`, `attachment`, `mic`, `checkCircle`, `alertCircle`, `thumbsUp`, `heart`, `shield`, `flag`, etc.).

---

## 3. Generic Components Layer

### 3.1 Buttons

- **`Button`**: Base interactive button with variants (`primary`, `secondary`, `tertiary`, `destructive`, `text`), sizes (`sm`, `md`, `lg`), loading spinner, icon slot, and double-tap prevention.
- **`PrimaryButton`, `SecondaryButton`, `TertiaryButton`, `DestructiveButton`, `TextButton`**: Zero-boilerplate convenience wrappers.
- **`IconButton`**: Circular or rounded icon-only press target (minimum 44x44pt touch area).
- **`FloatingActionButton`**: Elevated floating action button for instant profile actions.

### 3.2 Inputs & Selection Rows

- **`TextInput`, `TextField`**: Single-line text input with label, clear button, error indicator, and helper text.
- **`PasswordInput`, `PasswordField`**: Secure text input with eye toggle.
- **`OtpInput`, `OTPField`**: 4 or 6-digit split cell verification code input.
- **`MultilineInput`, `TextArea`**: Auto-growing multiline input with live character counter.
- **`Select`, `SelectField`**: Bottom-sheet backed selection picker with option descriptions.
- **`Slider`**: Step-based continuous value selector with numeric feedback.
- **`Chip`, `SelectableChip`**: Compact filter and interest pills with active/inactive contrast.
- **`RadioRow`**: List selection row with radio button, label, and description.
- **`CheckboxRow`**: Multi-select row with square checkbox and checked checkmark.
- **`Toggle`**: Native iOS/Android switch wrapper with accessible status announcement.

### 3.3 Cards & Media

- **`ProfileCard`**: Editorial discovery hero card with photo pagination, cultural bio, prompts, and action buttons.
- **`CompactProfileCard`**: Grid card for likes, matches, and recommendations with age and location overlays.
- **`MediaThumbnail`**: Aspect-constrained media tile with tap-to-view callback.
- **`MediaGridGallery`**: Staggered or 2-column image gallery with full-screen viewer trigger.
- **`FullScreenMediaViewer`**: Pinch-to-zoom modal with dismiss gesture and image counter.

### 3.4 Feedback & Overlays

- **`Toast` & `useToast`**: Non-blocking toast notifications with automatic dismiss timeout and action button.
- **`Banner`**: Inline status banners (`info`, `account_warning`, `system_announcement`, `offline`).
- **`ConnectionIndicator`, `SyncIndicator`**: Real-time WebSocket and offline mutation indicators.
- **`LoadingSkeleton`**: Shimmering placeholders (`SkeletonCard`, `SkeletonProfile`, `SkeletonText`).
- **`EmptyState`**: Empty container illustrations with primary and secondary call-to-actions.
- **`ErrorState`**: Network and API error banners with retry trigger.

---

## 4. Domain Patterns Layer

### 4.1 Chat Patterns (`/patterns/chat`)

- **`ChatMessageBubble` (`ChatBubble`)**: Asymmetric conversation bubble with timestamp and delivery ticks (`sending`, `sent`, `delivered`, `read`).
- **`ChatTypingIndicator`**: Compact animated indicator for active typing.
- **`UnreadDivider`**: Editorial separator indicating new incoming messages.
- **`ConversationRow`**: Inbox conversation list item with avatar, unread count badge, and snippet preview.
- **`ChatMessageComposer`**: Multiline message input with photo attachment button and send action.

### 4.2 Match Patterns (`/patterns/match`)

- **`MatchAvatarPair`**: Overlapping dual-avatar composition with central heart emblem.
- **`MatchCelebration`**: Modal dialogue for new match celebrations with chat and browse actions.
- **`MatchActionRow`**: Pinned action buttons for match interaction.

### 4.3 Social & Community Patterns (`/patterns/social`, `/patterns/community`, `/patterns/event`)

- **`SocialPostCard` (`PostCard`)**: Community post card with author row, timestamp, image attachment, like counter, and comment count.
- **`CommunityFeedCard`**: Discovery card for interest groups with membership toggle.
- **`EventFeedCard`**: Date badge, venue location, capacity indicator, and RSVP trigger.

### 4.4 Trust, Safety & Settings Patterns (`/patterns/safety`, `/patterns/settings`, `/patterns/permission`)

- **`ReportReasonList`**: Curated list of moderation report categories.
- **`BlockConfirmation`**: Destructive confirmation modal to sever connections safely.
- **`SafetyActionSheet`**: Bottom sheet offering report, block, and dating safety guidelines.
- **`SettingsSection`, `SettingsRow`, `SettingsToggleRow`**: Standardized settings management groups.
- **`PermissionExplanation`**: Transparent system permission explanation with OS settings fallback.

---

## 5. Accessibility & Test ID Specifications

- **Minimum Hit Targets:** All interactive controls enforce a minimum hit area of 44x44 points.
- **A11y Roles:** Interactive rows provide `accessibilityRole="button" | "checkbox" | "radio" | "switch"`.
- **Test ID Convention:**
  - `discover.card.like`
  - `discover.card.pass`
  - `chat.composer.input`
  - `chat.composer.send`
  - `settings.toggle.incognito`
  - `safety.button.report`
