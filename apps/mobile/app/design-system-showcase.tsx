import React, { useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useTheme,
  Text,
  Heading,
  Icon,
  Badge,
  Avatar,
  Button,
  IconButton,
  SurfaceCard,
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
  ProgressBar,
  OfflineBanner,
} from '../src/design/index.js';

export default function DesignSystemShowcaseScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors, spacing, isDark, mode, setMode } = useTheme();

  // Interactive showcase state
  const [textVal, setTextVal] = useState('Ananya Sharma');
  const [passwordVal, setPasswordVal] = useState('secret123');
  const [otpVal, setOtpVal] = useState('5821');
  const [bioVal, setBioVal] = useState('Architect & urban sketcher in Bandra. Passionate about heritage buildings, filter coffee, and contemporary indie films.');
  const [searchVal, setSearchVal] = useState('Bandra');
  const [selectedCity, setSelectedCity] = useState('mumbai');
  const [activeTab, setActiveTab] = useState('feed');
  const [distanceKm, setDistanceKm] = useState(25);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['art', 'coffee']);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const interestOptions = [
    { id: 'art', label: 'Architecture & Art' },
    { id: 'coffee', label: 'Filter Coffee' },
    { id: 'travel', label: 'Himalayan Treks' },
    { id: 'indie', label: 'Indie Cinema' },
    { id: 'food', label: 'Coastal Cuisine' },
  ];

  const cityOptions = [
    { label: 'Mumbai', value: 'mumbai', description: 'Bandra, Colaba, Juhu' },
    { label: 'Bengaluru', value: 'bengaluru', description: 'Indiranagar, Koramangala' },
    { label: 'New Delhi', value: 'delhi', description: 'Hauz Khas, Vasant Vihar' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <TopNavHeader
        title="Nazar Design System"
        subtitle={`Mode: ${mode.toUpperCase()} (F0 Foundation QA)`}
        leftAction="back"
        onLeftAction={() => router.back()}
        rightAction={{
          label: isDark ? 'Light ☀️' : 'Dark 🌙',
          onPress: () => setMode(isDark ? 'light' : 'dark'),
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        style={{ flex: 1 }}
      >
        {/* 1. Brand & Theme Direction */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h2">Nazar Visual Constitution</Heading>
          <Text variant="body" color="secondary" style={{ marginTop: 4 }}>
            Modern · Human · Warm · Confident · Premium · Indian · Social · Editorial
          </Text>
          <View style={styles.themeRow}>
            <Button
              label="Light Mode"
              variant={mode === 'light' ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setMode('light')}
            />
            <Button
              label="Dark Mode"
              variant={mode === 'dark' ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setMode('dark')}
            />
            <Button
              label="System Mode"
              variant={mode === 'system' ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setMode('system')}
            />
          </View>
        </SurfaceCard>

        {/* 2. Color Tokens */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Color System & Semantic Tokens</Heading>
          <View style={styles.paletteGrid}>
            {[
              { label: 'Accent', hex: colors.accent },
              { label: 'Accent Soft', hex: colors.accentSoft },
              { label: 'Background', hex: colors.background },
              { label: 'Surface', hex: colors.surface },
              { label: 'Surface Muted', hex: colors.surfaceMuted },
              { label: 'Text Primary', hex: colors.textPrimary },
              { label: 'Text Secondary', hex: colors.textSecondary },
              { label: 'Border', hex: colors.border },
              { label: 'Success', hex: colors.success },
              { label: 'Warning', hex: colors.warning },
              { label: 'Error', hex: colors.error },
              { label: 'Info', hex: colors.info },
            ].map((c) => (
              <View key={c.label} style={styles.swatchItem}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: c.hex, borderColor: colors.border, borderWidth: 1 },
                  ]}
                />
                <Text variant="caption" weight="medium" style={{ marginTop: 2 }}>
                  {c.label}
                </Text>
              </View>
            ))}
          </View>
        </SurfaceCard>

        {/* 3. Typography Scale */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Typography Hierarchy</Heading>
          <Heading level="display">Display 36pt</Heading>
          <Heading level="h1">Heading 1 30pt</Heading>
          <Heading level="h2">Heading 2 24pt</Heading>
          <Heading level="h3">Heading 3 20pt</Heading>
          <Heading level="title">Title 18pt Semibold</Heading>
          <Text variant="bodyLarge">Body Large 18pt Editorial copy</Text>
          <Text variant="body">Body 16pt Standard discovery copy</Text>
          <Text variant="bodySmall">Body Small 14pt Meta information</Text>
          <Text variant="caption">Caption 12pt Supporting labels</Text>
          <Text variant="label">Label 12pt Uppercase Tracked</Text>
          <Text variant="numeric">Numeric 16pt: ₹799 / month · 94% Compatibility</Text>
        </SurfaceCard>

        {/* 4. Iconography Grid */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Iconography (Stroke 2px Geometry)</Heading>
          <View style={styles.iconsGrid}>
            {(
              [
                'heart',
                'close',
                'message',
                'search',
                'filter',
                'settings',
                'shield',
                'flag',
                'more',
                'back',
                'chevron',
                'location',
                'calendar',
                'camera',
                'edit',
                'check',
                'plus',
                'sparkles',
                'user',
                'bell',
                'lock',
                'refresh',
                'share',
                'warning',
                'info',
              ] as const
            ).map((iconName) => (
              <View key={iconName} style={styles.iconCell}>
                <Icon name={iconName} size="md" color={colors.accent} />
                <Text variant="caption" style={{ fontSize: 10, marginTop: 4 }}>
                  {iconName}
                </Text>
              </View>
            ))}
          </View>
        </SurfaceCard>

        {/* 5. Buttons & Controls */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Buttons (Variants & States)</Heading>
          <View style={styles.buttonCol}>
            <Button label="Primary Button" variant="primary" icon="heart" />
            <Button label="Secondary Button" variant="secondary" icon="search" />
            <Button label="Tertiary Action" variant="tertiary" icon="chevron" />
            <Button label="Destructive Action" variant="destructive" icon="close" />
            <Button label="Loading State" variant="primary" loading={true} />
            <Button label="Success State" variant="primary" success={true} />
            <Button label="Disabled Button" variant="primary" disabled={true} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
              <IconButton icon="heart" variant="primary" accessibilityLabel="Like" />
              <IconButton icon="close" variant="secondary" accessibilityLabel="Pass" />
              <IconButton icon="sparkles" variant="tertiary" accessibilityLabel="Spark" />
              <IconButton icon="flag" variant="destructive" accessibilityLabel="Report" />
              <IconButton icon="heart" loading={true} accessibilityLabel="Loading" />
            </View>
          </View>
        </SurfaceCard>

        {/* 6. Form & Input System */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Input System</Heading>
          <TextInput
            label="Full Name"
            value={textVal}
            onChangeText={setTextVal}
            leftIcon="user"
            hint="Shown on your public dating profile"
          />

          <TextInput
            label="Email Address"
            value="invalid-email"
            error="Enter a valid email address with @ and domain."
            leftIcon="message"
          />

          <PasswordInput
            label="Account Password"
            value={passwordVal}
            onChangeText={setPasswordVal}
          />

          <OtpInput
            length={4}
            value={otpVal}
            onChangeOtp={setOtpVal}
          />

          <MultilineInput
            label="About Me (Bio)"
            value={bioVal}
            onChangeText={setBioVal}
            maxLength={300}
          />

          <SearchInput
            value={searchVal}
            onChangeText={setSearchVal}
          />

          <Select
            label="Location"
            options={cityOptions}
            value={selectedCity}
            onSelect={setSelectedCity}
          />

          <SegmentedControl
            options={[
              { label: 'Feed', value: 'feed' },
              { label: 'Matches', value: 'matches', badge: 3 },
              { label: 'Clubs', value: 'clubs' },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />

          <Slider
            label="Max Distance"
            min={5}
            max={100}
            step={5}
            value={distanceKm}
            onChange={setDistanceKm}
            unit="km"
          />

          <DateSelector
            label="Date of Birth"
            value="1998-04-14"
            onPress={() => {}}
          />

          <ChipSelector
            label="Interests & Passions"
            items={interestOptions}
            selectedIds={selectedInterests}
            onToggle={(id) => {
              setSelectedInterests((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
              );
            }}
            maxSelection={5}
          />

          <ImagePickerTrigger
            uri="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600"
            isPrimary={true}
            status="ready"
            onRemove={() => {}}
          />
        </SurfaceCard>

        {/* 7. Avatars & Presence */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Avatar System</Heading>
          <View style={styles.avatarRow}>
            <Avatar name="Tiny A" size="tiny" />
            <Avatar name="Small B" size="small" isOnline={true} />
            <Avatar name="Medium C" size="medium" isVerified={true} />
            <Avatar name="Large D" size="large" isOnline={true} isVerified={true} />
            <Avatar name="XLarge E" size="xlarge" isLoading={true} />
          </View>
        </SurfaceCard>

        {/* Badges & Indicators */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Badges & Indicators</Heading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <Badge label="Accent" variant="accent" icon="sparkles" />
            <Badge label="Verified" variant="info" icon="check" />
            <Badge label="Gold Member" variant="gold" icon="star" />
            <Badge label="Active" variant="success" />
            <Badge label="Warning" variant="warning" icon="warning" />
            <Badge label="Error" variant="error" />
            <Badge label="Neutral" variant="neutral" />
          </View>
        </SurfaceCard>

        {/* 8. Media System */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Media Presentation & States</Heading>
          <MediaView
            uri="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600"
            aspectRatio="square"
            style={{ marginBottom: 12 }}
          />
          <MediaCard
            uri="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600"
            aspectRatio="4:5"
            photoCount={5}
            caption="Sunset over Marine Drive promenade"
            style={{ marginBottom: 12 }}
          />
          <MediaCard
            uri="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600"
            isRestricted={true}
            style={{ marginBottom: 12 }}
          />
        </SurfaceCard>

        {/* 9. Card Primitives & Profile Card */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Card System & ProfileCard</Heading>
          <ProfileCard
            profile={{
              id: 'demo-1',
              name: 'Ananya Sharma',
              age: 26,
              city: 'Bandra West, Mumbai',
              occupation: 'Senior Urban Architect',
              education: 'CEPT Ahmedabad',
              bio: 'Obsessed with Art Deco balconies, street chai, monsoon train rides, and contemporary Urdu prose.',
              imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
              imageCount: 4,
              isVerified: true,
              contextualInfo: 'Within 4 km · High Compatibility',
              interests: ['Architecture', 'Film Festivals', 'Heritage Walks', 'Podcasts'],
              prompts: [
                {
                  question: 'The key to winning me over is',
                  answer: 'Knowing the best Irani cafe for brun maska and chai on a rainy Sunday morning.',
                },
              ],
            }}
            context="discovery"
            onPass={() => {}}
            onLike={() => {}}
            onSuperLike={() => {}}
            onMessage={() => {}}
          />

          <MatchCard
            id="match-1"
            name="Rohan Verma"
            age={28}
            matchedAt="Yesterday"
            compatibilityScore={94}
            isNew={true}
          />

          <ConversationCard
            id="convo-1"
            name="Pooja Mehta"
            lastMessage="Let us definitely check out the Kala Ghoda gallery opening!"
            timestamp="10:42 AM"
            unreadCount={2}
            isVerified={true}
            isOnline={true}
          />

          <CommunityCard
            id="comm-1"
            name="Bombay Heritage & Architecture Society"
            description="A circle for designers, historians, and flâneurs exploring Mumbai's built heritage."
            memberCount={1420}
            category="Culture & Design"
            isJoined={false}
            onJoinPress={() => {}}
          />

          <EventCard
            id="event-1"
            title="Monsoon Rooftop Acoustic Mixer"
            dateFormatted="SAT, OCT 14 · 7:00 PM"
            location="Khar Social Terrace, Mumbai"
            attendeeCount={48}
            rsvpStatus="attending"
            onRsvp={() => {}}
          />

          <SubscriptionCard
            id="sub-gold"
            tierName="Nazar Gold"
            priceFormatted="₹799"
            interval="per month"
            badge="Recommended"
            isPopular={true}
            features={[
              'See who liked your profile instantly',
              '5 complimentary Super Likes weekly',
              'Unlimited profile rewinds',
              'Priority placement in discovery feed',
              'Read receipts & verified badge priority',
            ]}
            onUpgrade={() => {}}
          />
        </SurfaceCard>

        {/* 10. Modals & Sheets Triggers */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Sheets & Modals</Heading>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Button
              label="Open BottomSheet"
              variant="secondary"
              onPress={() => setSheetOpen(true)}
            />
            <Button
              label="Open Dialog"
              variant="destructive"
              onPress={() => setDialogOpen(true)}
            />
          </View>

          <BottomSheet
            visible={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Discovery Filters"
            subtitle="Fine-tune your spatial wavelength"
          >
            <Slider
              label="Search Radius"
              min={2}
              max={50}
              value={15}
              onChange={() => {}}
              unit="km"
            />
            <Button
              label="Apply Filters"
              variant="primary"
              fullWidth={true}
              onPress={() => setSheetOpen(false)}
              style={{ marginTop: 16 }}
            />
          </BottomSheet>

          <Dialog
            visible={dialogOpen}
            title="Block User"
            message="Are you sure you want to block this profile? They will no longer be able to message you or see your account."
            variant="destructive"
            confirmLabel="Block Profile"
            cancelLabel="Cancel"
            onConfirm={() => setDialogOpen(false)}
            onCancel={() => setDialogOpen(false)}
          />
        </SurfaceCard>

        {/* 11. Feedback & System States */}
        <SurfaceCard p="md" style={styles.sectionCard}>
          <Heading level="h3">Feedback & System States</Heading>

          <Text variant="label" style={{ marginTop: 12, marginBottom: 4 }}>Progress Indicator</Text>
          <ProgressBar progress={75} label="Profile Completeness" showPercentage={true} />

          <Text variant="label" style={{ marginTop: 12, marginBottom: 4 }}>Offline Network States</Text>
          <OfflineBanner status="offline" pendingSyncCount={2} />
          <OfflineBanner status="reconnecting" />
          <OfflineBanner status="failed" onRetrySync={() => {}} />

          <Text variant="label" style={{ marginTop: 12, marginBottom: 4 }}>Empty States</Text>
          <EmptyState type="no_matches" onAction={() => {}} />

          <Text variant="label" style={{ marginTop: 12, marginBottom: 4 }}>Error States</Text>
          <ErrorState type="network_unavailable" onRetry={() => {}} />

          <Text variant="label" style={{ marginTop: 12, marginBottom: 4 }}>Loading Skeleton</Text>
          <SkeletonBox height={24} width="70%" style={{ marginBottom: 8 }} />
          <ProfileCardSkeleton />
        </SurfaceCard>
      </ScrollView>

      {/* Navigation Primitive Demo */}
      <BottomNavBar>
        <BottomNavItem
          icon="sparkles"
          label="Discovery"
          isSelected={true}
          onPress={() => {}}
        />
        <BottomNavItem
          icon="heart"
          label="Matches"
          isSelected={false}
          badgeCount={3}
          onPress={() => {}}
        />
        <BottomNavItem
          icon="message"
          label="Messages"
          isSelected={false}
          badgeCount={1}
          onPress={() => {}}
        />
        <BottomNavItem
          icon="user"
          label="Profile"
          isSelected={false}
          onPress={() => {}}
        />
      </BottomNavBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sectionCard: {
    marginBottom: 16,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  swatchItem: {
    alignItems: 'center',
    width: 72,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
  },
  iconCell: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  buttonCol: {
    gap: 10,
    marginTop: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});
