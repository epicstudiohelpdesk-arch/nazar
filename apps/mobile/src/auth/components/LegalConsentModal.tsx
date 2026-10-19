import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Dimensions,
  Keyboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ArrowRight } from 'lucide-react-native';
import { useFonts } from 'expo-font';
import { useTheme } from '../../design/theme/ThemeContext.js';
import { Text } from '../../design/primitives/Text.js';
import { haptics } from '../../design/haptics/index.js';

export interface LegalConsentModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onAgree: () => void;
  readonly identifier?: string;
  readonly identifierType?: 'PHONE' | 'EMAIL';
  readonly testID?: string;
}

export const LegalConsentModal: React.FC<LegalConsentModalProps> = ({
  visible,
  onClose,
  onAgree,
  identifier,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  const windowHeight = Dimensions.get('window').height;
  // Sized generously like full bottom-sheet modals (~88% height)
  const sheetHeight = Math.min(Math.round(windowHeight * 0.88), 840);
  // Precisely measured travel distance needed to fully clear top edge + dynamic island/notch
  const exitOffset = sheetHeight + Math.max(insets.top, Platform.OS === 'ios' ? 44 : 28) + 30;

  const [isRendered, setIsRendered] = useState(visible);
  const [isAgreed, setIsAgreed] = useState(false);

  const backdropAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  // Starts directly above the screen (-exitOffset) and glides down smoothly to 0
  const sheetTranslateY = useRef(new Animated.Value(visible ? 0 : -exitOffset)).current;

  // Load Folkra brand font for headers and actions
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  const isDismissingRef = useRef(false);

  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    if (visible) {
      isDismissingRef.current = false;
      Keyboard.dismiss();
      setIsRendered(true);
      sheetTranslateY.setValue(-exitOffset);
      backdropAnim.setValue(0);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 380,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isRendered && !isDismissingRef.current) {
      isDismissingRef.current = true;
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: -exitOffset,
          duration: 300,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsRendered(false);
        setIsAgreed(false);
        isDismissingRef.current = false;
      });

      fallbackTimer = setTimeout(() => {
        setIsRendered(false);
        setIsAgreed(false);
        isDismissingRef.current = false;
      }, 400);
    }

    return () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [visible, isRendered, exitOffset, backdropAnim, sheetTranslateY]);

  if (!isRendered) {
    return null;
  }

  const handleDecline = () => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    Keyboard.dismiss();
    haptics.light();

    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: -exitOffset,
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsRendered(false);
      setIsAgreed(false);
      isDismissingRef.current = false;
      onClose();
    });
  };

  const handleAccept = () => {
    if (!isAgreed || isDismissingRef.current) return;
    isDismissingRef.current = true;
    Keyboard.dismiss();
    haptics.success();

    // Closes swiftly and smoothly to the top, then immediately navigates to OTP
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: -exitOffset,
        duration: 260,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsRendered(false);
      setIsAgreed(false);
      isDismissingRef.current = false;
      onAgree();
    });
  };

  return (
    <Modal
      visible={isRendered}
      transparent={true}
      animationType="none"
      onRequestClose={handleDecline}
      statusBarTranslucent={true}
      testID={testID}
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Soft Stationary Dark & Frosted-Glass Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 2 : 1}
            tint={isDark ? 'dark' : 'default'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.40)' : 'rgba(0, 0, 0, 0.20)',
              },
            ]}
          />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleDecline}
            accessibilityRole="button"
            accessibilityLabel="Dismiss legal document modal"
          />
        </Animated.View>

        {/* Top Sheet Container: anchored at top, coming down generously to the bottom portion */}
        <View style={styles.sheetWrapper} pointerEvents="box-none">
          <Animated.View
            renderToHardwareTextureAndroid={true}
            style={[
              styles.sheetSurface,
              {
                height: sheetHeight,
                backgroundColor: isDark ? '#121215' : '#FCFCFD',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
                paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 28) + 20,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            {/* Modal Header: Clean, Elegant, Minimalist with spacious top padding */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: theme.colors.textPrimary, fontFamily: folkraFont },
                  ]}
                >
                  Terms & Conditions
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                  Privacy Notice & Data Rights Agreement · Version 1.0
                </Text>
              </View>
            </View>

            {/* Clear Divider matching the bottom action divider */}
            <View
              style={[
                styles.headerDivider,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
            />

            {/* Native Full-Width ScrollView for Smooth, Lag-Free Native Inertia Scrolling */}
            <ScrollView
              style={styles.documentScrollView}
              contentContainerStyle={styles.documentScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              bounces={true}
              nestedScrollEnabled={true}
              overScrollMode="never"
              decelerationRate="normal"
            >
              {/* Section 1 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  1. INTRODUCTION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Welcome to Nazar.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar is a digital dating and social discovery platform designed to help eligible
                  adults discover other people, express their interests, establish connections,
                  communicate, and explore potential romantic relationships.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  These Terms and Conditions ("Terms") govern your access to and use of the Nazar
                  mobile application, website, associated services, features, communication systems,
                  subscriptions, and related digital products.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  This document also explains how Nazar collects, uses, stores, protects, shares,
                  retains, and deletes personal data.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  By creating an account, accessing the Platform, or continuing to use our services
                  after being presented with these Terms, you acknowledge that you have read and
                  understood the applicable provisions and agree to be bound by them.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Where consent is required for processing personal data, such consent will be
                  obtained through an appropriate and separate consent mechanism. Acceptance of
                  these Terms does not, by itself, constitute consent to every form of personal data
                  processing.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  If you do not agree with these Terms, you must discontinue using Nazar.
                </Text>
              </View>

              {/* Section 2 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  2. ELIGIBILITY AND AGE RESTRICTION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar is exclusively intended for individuals who are at least eighteen (18) years
                  of age.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  By registering, you represent and warrant that:
                </Text>
                <View style={styles.listContainer}>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>1. </Text>You are at least eighteen years old.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>2. </Text>The information you provide is accurate
                    and not intentionally misleading.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>3. </Text>You are legally capable of entering into
                    an agreement under applicable Indian law.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>4. </Text>You will use Nazar for lawful purposes.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>5. </Text>You will not create an account by
                    impersonating another person or using another person's identity without
                    authorization.
                  </Text>
                </View>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar does not knowingly permit individuals below eighteen years of age to create
                  or maintain dating accounts.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  If Nazar discovers that an account belongs to a person below the permitted age, it
                  may suspend the account, restrict access, and take appropriate steps to remove the
                  account and associated personal data, subject to applicable legal requirements.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Users may be required to complete reasonable age or identity verification measures
                  where necessary for safety, fraud prevention, legal compliance, or enforcement of
                  these Terms. Submitting false age information may result in account suspension or
                  permanent termination.
                </Text>
              </View>

              {/* Section 3 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  3. ACCOUNT REGISTRATION AND AUTHENTICATION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may allow users to register or sign in through supported authentication
                  methods, including:
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Mobile number verification using a one-time password (OTP).
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Email address verification using an OTP or another supported verification
                  method.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Other authentication methods expressly provided within the application.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  You are responsible for providing access to the mobile number, email address, or
                  other authentication method associated with your account. You must not share
                  verification codes or knowingly allow unauthorized persons to access your account.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may use third-party authentication and communication providers to deliver
                  OTPs, verify contact details, prevent fraud, and protect account security.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Verification of a mobile number or email address confirms control of that contact
                  method at the time of verification. It does not automatically establish the user's
                  legal identity, age, intentions, relationship status, or trustworthiness.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  You must promptly report suspected unauthorized access to [Insert Security Support
                  Email]. Nazar may temporarily restrict an account when reasonably necessary to
                  investigate suspected fraud, compromised credentials, abuse, or other security
                  threats.
                </Text>
              </View>

              {/* Section 4 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  4. USER PROFILES AND INFORMATION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Users may be permitted to create profiles containing information such as:
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Name, display name, and age.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Profile photographs and other permitted media.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Gender and dating preferences.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Personal interests, hobbies, and profile descriptions.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • General location or distance-related information.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Contact verification status.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Other optional profile information made available through Nazar.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  You are responsible for the accuracy and lawfulness of the information and media
                  you submit. You must not upload content that unlawfully discloses another person's
                  personal information, infringes intellectual property rights, or violates another
                  person's privacy.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  You should avoid publishing your home address, financial details, government
                  identification numbers, private contact details, or other information that could
                  expose you to fraud or personal harm.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may remove misleading, unlawful, abusive, fraudulent, or otherwise
                  prohibited profile content. A user profile is not an independent verification of
                  the user's identity, background, relationship status, or intentions.
                </Text>
              </View>

              {/* Section 5 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  5. MATCHING, DISCOVERY AND LOCATION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may use profile information, preferences, interactions, approximate
                  location, and activity within the Platform to provide discovery, recommendations,
                  matching, and related functionality.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Where location-related features are offered, Nazar will request the relevant
                  device permissions where required. You may refuse optional location permissions,
                  although some location-dependent features may not function fully.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may use approximate location information to display relevant people or
                  calculate distances. Exact GPS coordinates or precise location histories should
                  not be collected unless genuinely necessary for a disclosed feature and
                  appropriately authorized.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar will not intentionally display a user's precise home or device location to
                  other users unless the user has expressly chosen to disclose that information
                  through a clearly explained feature.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Location information will be handled according to the Privacy Notice and the
                  permissions you provide. You acknowledge that matching and recommendation systems
                  may produce inaccurate, incomplete, or unsuitable suggestions. Nazar does not
                  guarantee that a match will lead to a conversation, relationship, meeting, or any
                  particular outcome.
                </Text>
              </View>

              {/* Section 6 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  6. MESSAGING AND COMMUNICATION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may offer direct messaging, match-based communication, media sharing,
                  notifications, and other communication features. You agree not to use these
                  features to:
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Threaten, harass, intimidate, or repeatedly contact someone who does not wish to
                  communicate.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Send unsolicited sexually explicit content or unwanted sexual messages.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Distribute intimate images without the person's consent.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Share private conversations or personal information unlawfully.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Commit fraud, blackmail, extortion, stalking, or other unlawful acts.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Distribute malicious software, spam, phishing links, or deceptive solicitations.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Users should not assume that every message is end-to-end encrypted or inaccessible
                  to the Platform. Nazar will accurately disclose the actual security properties of
                  its messaging system in its Privacy Notice.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Where messages are processed or stored by Nazar, authorized personnel may access
                  relevant information when reasonably necessary for user-requested support, safety
                  investigations, abuse prevention, legal compliance, or other disclosed lawful
                  purposes. Nazar will apply appropriate access controls and will not authorize
                  indiscriminate access to private communications.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Messages already delivered to another user may remain visible to that recipient
                  after you log out or delete your account, unless the relevant messaging feature
                  supports deletion for all participants or removal is otherwise required.
                </Text>
              </View>

              {/* Section 7 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  7. USER CONDUCT AND PROHIBITED ACTIVITIES
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  You agree to use Nazar responsibly and lawfully. The following activities are
                  strictly prohibited:
                </Text>
                <View style={styles.listContainer}>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>1. </Text>Impersonation, catfishing, fake
                    profiles, and deliberate identity deception.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>2. </Text>Fraudulent requests for money, financial
                    credentials, OTPs, or sensitive information.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>3. </Text>Harassment, hate speech, threats,
                    blackmail, or discriminatory abuse.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>4. </Text>Sexual exploitation, coercion,
                    non-consensual intimate imagery, or any unlawful sexual conduct.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>5. </Text>Stalking, doxxing, or unauthorized
                    surveillance.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>6. </Text>Uploading illegal, infringing, or
                    harmful content.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>7. </Text>Scraping profiles, collecting user
                    information without authorization, or selling personal data obtained through
                    Nazar.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>8. </Text>Using bots, automated accounts, or
                    manipulation techniques without authorization.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>9. </Text>Attempting to bypass authentication,
                    security controls, subscription restrictions, or account enforcement.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>10. </Text>Using Nazar to facilitate illegal
                    activities.
                  </Text>
                </View>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may investigate reported violations and take proportionate action, including
                  content removal, warnings, temporary restrictions, suspension, permanent account
                  termination, or referral to appropriate authorities where legally warranted.
                </Text>
              </View>

              {/* Section 8 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  8. REPORTING, BLOCKING AND USER SAFETY
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may provide mechanisms to report profiles, messages, photographs, suspected
                  fraud, harassment, impersonation, and other safety concerns. Where available,
                  users may block other accounts to restrict unwanted interaction.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Reports will be reviewed according to the seriousness of the allegation, available
                  information, applicable legal obligations, and the Platform's safety procedures.
                  Nazar may preserve relevant evidence when reasonably necessary to investigate
                  serious abuse, protect users, prevent fraud, enforce its policies, or comply with
                  lawful requests.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Users are encouraged to exercise caution when communicating with people they have
                  not met in person. For in-person meetings, consider meeting in a public place,
                  informing a trusted person, arranging independent transportation, and avoiding
                  financial transfers to people you have not independently verified.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  If you face an immediate threat, contact the appropriate local emergency services
                  or law-enforcement authorities. Nazar's reporting system is not an
                  emergency-response service.
                </Text>
              </View>

              {/* Section 9 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  9. PERSONAL DATA WE MAY COLLECT
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Depending on the features you use, Nazar may process the following categories of
                  personal data:
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  9.1 Account and contact data
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  This may include your mobile number, email address, account identifier, display
                  name, date of birth or age information, and account verification status.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  9.2 Profile data
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  This may include photographs, biography, gender, dating preferences, interests,
                  and other information you choose to add to your profile.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  9.3 Matching and activity data
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  This may include likes, dislikes, matches, blocks, reports, profile views where
                  recorded, preferences, and interactions necessary to operate and improve matching
                  features.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  9.4 Communication data
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  This may include messages, attachments, delivery information, and related metadata
                  where those features are provided and the information is processed or stored by
                  Nazar.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  9.5 Technical and security data
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  This may include device and application information, IP address, authentication
                  events, session identifiers, error logs, security events, and information used to
                  detect spam, unauthorized access, and fraud.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  9.6 Location data
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  This may include approximate location, distance-related information, or precise
                  location information where a relevant feature requires it and the appropriate
                  permissions have been obtained.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  9.7 Payment and subscription data
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Where paid features are offered, Nazar or its authorized payment providers may
                  process subscription status, transaction references, billing records, and
                  payment-related information. Full payment card credentials will not be stored by
                  Nazar unless the actual payment architecture requires it and appropriate
                  safeguards and legal obligations are met.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  9.8 Support and safety records
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  This may include support requests, complaints, reports, investigation records, and
                  communications with our support team. Nazar will seek to collect only the personal
                  data reasonably necessary for the disclosed purposes.
                </Text>
              </View>

              {/* Section 10 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  10. PURPOSES FOR USING PERSONAL DATA
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may process personal data for the following purposes, subject to applicable
                  law and the relevant consent or other lawful basis:
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Account creation and authentication:</Text> To
                  register users, verify contact methods, maintain accounts, and provide secure
                  access.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Dating and matching:</Text> To display profiles,
                  apply preferences, recommend potential connections, and facilitate user
                  interactions.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Communication:</Text> To deliver messages,
                  notifications, and other communication features requested by users.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Safety and fraud prevention:</Text> To detect
                  suspicious activity, investigate reports, prevent impersonation, protect users,
                  and enforce Platform rules.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Technical operation:</Text> To diagnose errors,
                  maintain service availability, troubleshoot issues, and improve reliability.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Customer support:</Text> To respond to complaints,
                  answer questions, and resolve account-related issues.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Payments and subscriptions:</Text> To manage paid
                  features, confirm transactions, address billing disputes, and maintain required
                  financial records.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Legal compliance:</Text> To meet applicable legal
                  obligations and respond to valid legal demands.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Product improvement:</Text> To evaluate service
                  performance and improve features using appropriately limited information.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Marketing and advertising:</Text> To deliver
                  relevant promotional communications or advertisements where permitted by law and
                  with appropriate consent.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar will not treat consent for one purpose as automatic permission for unrelated
                  purposes. Nazar will not sell personal data to third parties as a business model.
                </Text>
              </View>

              {/* Section 11 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  11. DATA STORAGE AND SECURITY
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar will store personal data using its actual production storage infrastructure
                  and authorized service providers. Depending on the deployed architecture, this may
                  include managed databases, secure object storage for photographs and media,
                  authentication services, application servers, and encrypted backups.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Personal data will be protected through reasonable technical and organizational
                  safeguards:
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Encryption in transit using appropriate secure communication protocols.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Encryption at rest where supported and appropriately configured.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Access restrictions based on job responsibilities and operational necessity.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Secure authentication and authorization controls.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Protection of application secrets, API credentials, and database access.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Security logging, monitoring, and incident investigation.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Backup management and controlled recovery procedures.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Only authorized personnel and service providers with a legitimate operational need
                  should be permitted to access relevant personal data. Where third-party providers
                  process personal data on Nazar's behalf, contractual safeguards and oversight are
                  enforced.
                </Text>
              </View>

              {/* Section 12 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  12. THIRD-PARTY SERVICE PROVIDERS AND DATA SHARING
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may share limited personal data with authorized third parties where
                  necessary for the operation of the Platform or another disclosed lawful purpose:
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Authentication and OTP providers:</Text> To
                  deliver verification codes and support account authentication.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Cloud hosting and database providers:</Text> To
                  store and process account information and operate the Platform.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Media storage & content delivery providers:</Text>{' '}
                  To store and deliver profile photographs and permitted media.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Payment providers and app stores:</Text> To
                  process subscriptions, payments, refunds, and purchase-related records.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Security and technical providers:</Text> To detect
                  abuse, troubleshoot failures, and maintain service reliability.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Legal and regulatory authorities:</Text> Where
                  disclosure is required by applicable law or a valid legal process.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar will not disclose private user information to unrelated third parties for
                  their independent marketing purposes without an appropriate lawful basis and any
                  consent required by law.
                </Text>
              </View>

              {/* Section 13 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  13. USER CONSENT AND PRIVACY RIGHTS
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar will provide privacy information in a clear and accessible form and obtain
                  consent where required by applicable law. Subject to the applicable legal
                  framework, users may have rights to:
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Request information about their personal data and its processing.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Request correction or completion of inaccurate or incomplete information.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Request erasure of personal data where applicable.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Withdraw consent where processing is based on consent.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Raise grievances regarding the processing of personal data.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Nominate another person to exercise applicable rights in circumstances permitted
                  by law.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • Seek redress through the appropriate statutory mechanisms.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Requests may be submitted to [Insert Privacy Contact Email]. If consent is
                  withdrawn, Nazar will cease the relevant consent-based processing and take the
                  required steps regarding associated personal data.
                </Text>
              </View>

              {/* Section 14 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  14. LOGGING OUT AND SESSION MANAGEMENT
                </Text>
                <Text
                  style={[
                    styles.paragraphText,
                    { color: theme.colors.textPrimary, fontWeight: '600' },
                  ]}
                >
                  Logging out is different from deleting an account.
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  When you log out of Nazar:
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  1. Your active session will be terminated or invalidated through the applicable
                  authentication mechanism.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  2. Your account will remain registered unless you separately request account
                  deletion.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  3. Your profile and matching information may remain available according to your
                  existing visibility settings.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  4. Your messages, matches, preferences, photographs, and other account information
                  will not automatically be erased merely because you log out.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  5. Information retained for security, legal, financial, or operational purposes
                  will remain subject to the applicable retention policy.
                </Text>
              </View>

              {/* Section 15 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  15. PERMANENT ACCOUNT DELETION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar provides an accessible self-service method for permanent account deletion
                  under:{' '}
                  <Text style={[styles.boldText, { color: theme.colors.textPrimary }]}>
                    Settings → Account → Delete Account
                  </Text>
                  .
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Once a valid deletion request is confirmed, Nazar will:
                </Text>
                <View style={styles.listContainer}>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>1. </Text>Record and acknowledge the deletion
                    request.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>2. </Text>Remove or disable the account's public
                    profile from new discovery and matching immediately.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>3. </Text>Stop optional processing that is no
                    longer necessary.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>4. </Text>Delete or irreversibly anonymize
                    personal data that no longer needs to be retained.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>5. </Text>Instruct relevant processors to delete
                    or appropriately handle the associated data.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>6. </Text>Retain only the limited information that
                    Nazar is legally permitted or required to preserve.
                  </Text>
                  <Text style={[styles.listRow, { color: theme.colors.textSecondary }]}>
                    <Text style={styles.boldText}>7. </Text>Complete the deletion process and
                    communicate the outcome where appropriate.
                  </Text>
                </View>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  15.1 Proposed deletion timeline
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar's operational target is to complete deletion of personal data eligible for
                  erasure within <Text style={styles.boldText}>30 days</Text> after a valid request
                  is confirmed.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  15.2 Information that may be retained
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Permanent account deletion does not necessarily mean that every record can
                  immediately be erased. Limited transaction, safety investigation, or legal
                  suppression records may be retained for the minimum legally justified period.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  15.3 Backups and residual copies
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Eligible deleted personal data will expire from protected disaster-recovery
                  backups within <Text style={styles.boldText}>90 days</Text>, unless a specific
                  lawful preservation obligation applies.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  15.4 Messages and information shared with other users
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Deleting your account will remove your profile from discovery. However,
                  information previously delivered to another user, including messages or
                  screenshots saved outside Nazar, may remain on that recipient's device.
                </Text>

                <Text style={[styles.subHeading, { color: theme.colors.textPrimary }]}>
                  15.5 Consequences of permanent deletion
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Permanent deletion results in the loss of matches, messages, profile photos, and
                  account history. App-store subscriptions must be cancelled separately through the
                  applicable app store channel.
                </Text>
              </View>

              {/* Section 16 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  16. DATA RETENTION POLICY
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar will retain personal data only for as long as necessary for the purpose for
                  which it was collected:
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Active account data:</Text> Retained while the
                  account remains active.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Profile photos & prompts:</Text> Retained while
                  active, then deleted following valid account deletion.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Authentication and security logs:</Text> Retained
                  for a defined security period based on risk and legal requirements.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Payment & accounting records:</Text> Retained for
                  the mandatory statutory recordkeeping period.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Backups:</Text> Subject to the 90-day deletion
                  target described in Section 15.
                </Text>
              </View>

              {/* Section 17 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  17. COOKIES, ANALYTICS AND ADVERTISING
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  If Nazar uses cookies, device identifiers, analytics tools, or advertising SDKs,
                  these technologies collect technical information to maintain reliability, diagnose
                  errors, and prevent abuse. Nazar will disclose material tracking technologies in
                  its Privacy Notice and provide choices or consent mechanisms where required.
                </Text>
              </View>

              {/* Section 18 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  18. SUBSCRIPTIONS, PAYMENTS AND REFUNDS
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Paid subscriptions, premium features, and in-app purchases are clearly disclosed
                  with billing periods and renewal terms prior to purchase. Payments processed
                  through Apple App Store or Google Play are subject to the applicable platform
                  store conditions.
                </Text>
              </View>

              {/* Section 19 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  19. INTELLECTUAL PROPERTY
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar and its licensors retain all rights in the Platform's software, branding,
                  trademarks, and interface elements. You retain ownership of content you create and
                  upload, granting Nazar a limited license strictly necessary to operate the
                  service.
                </Text>
              </View>

              {/* Section 20 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  20. SUSPENSION AND TERMINATION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may suspend, restrict, or terminate accounts for material violations,
                  suspected fraud, harassment, or safety risks. Where legally permissible, notice
                  and review opportunities will be provided.
                </Text>
              </View>

              {/* Section 21 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  21. THIRD-PARTY SERVICES AND EXTERNAL LINKS
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may integrate with third-party providers (such as SMS/OTP or payment
                  gateways). Users should review their respective independent terms and policies.
                </Text>
              </View>

              {/* Section 22 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  22. DISCLAIMER AND LIMITATION OF LIABILITY
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar facilitates digital discovery and communication. It does not guarantee the
                  identity, honesty, intentions, or conduct of any user. Users must exercise
                  appropriate personal judgment when interacting.
                </Text>
              </View>

              {/* Section 23 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  23. INDEMNITY
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  To the extent permitted by law, users are responsible for claims directly
                  resulting from unlawful conduct or material breach of these Terms.
                </Text>
              </View>

              {/* Section 24 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  24. GOVERNING LAW AND DISPUTE RESOLUTION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  These Terms are governed by the laws of India. Competent courts and statutory
                  consumer forums in India hold jurisdiction.
                </Text>
              </View>

              {/* Section 25 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  25. GRIEVANCE REDRESSAL (IT RULES 2021)
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Users may submit grievances regarding privacy, account access, impersonation, or
                  unauthorized processing to our designated statutory officer:
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Grievance Officer: </Text>[Insert Full Name]
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Designation: </Text>[Insert Designation]
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Email: </Text>[Insert Grievance Email]
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Postal Address: </Text>[Insert Complete Address]
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Complaints will be acknowledged and resolved within the mandatory statutory
                  timelines prescribed under Indian law.
                </Text>
              </View>

              {/* Section 26 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  26. CHANGES TO THESE TERMS
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  Nazar may update these Terms to reflect operational, security, or legal changes.
                  Material updates will be notified in-app with effective dates displayed.
                </Text>
              </View>

              {/* Section 27 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  27. SEVERABILITY
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  If any provision is held invalid by a competent court, the remaining provisions
                  remain in full legal force and effect.
                </Text>
              </View>

              {/* Section 28 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  28. ENTIRE AGREEMENT
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  These Terms and Privacy Notice constitute the complete understanding between you
                  and Nazar regarding access to the Platform.
                </Text>
              </View>

              {/* Section 29 */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textPrimary }]}>
                  29. CONTACT INFORMATION
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  For general support, account inquiries, privacy questions, or deletion requests:
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Platform: </Text>Nazar
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Legal Operator: </Text>[Full Legal Name]
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Email: </Text>[Insert Official Support Email]
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Privacy Email: </Text>[Insert Privacy Contact
                  Email]
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Grievance Email: </Text>[Insert Grievance Email]
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Address: </Text>[Insert Complete Business Address]
                </Text>
                <Text style={[styles.entityLine, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Website: </Text>[Insert Official Website URL]
                </Text>
              </View>

              {/* Privacy Notice: Important User Summary */}
              <View style={styles.sectionBlock}>
                <Text
                  style={[
                    styles.sectionHeading,
                    { color: theme.colors.textPrimary, fontFamily: folkraFont },
                  ]}
                >
                  PRIVACY NOTICE: IMPORTANT USER SUMMARY
                </Text>
                <Text style={[styles.paragraphText, { color: theme.colors.textSecondary }]}>
                  This summary outlines Nazar's principal privacy practices for{' '}
                  {identifier || 'your account'}:
                </Text>

                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>What we collect:</Text> Contact details, profile
                  information, photographs, matching activity, messages, and security logs.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Why we use it:</Text> To authenticate accounts,
                  display profiles, provide matching, prevent fraud, and comply with law.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>Where we store it:</Text> On secure production
                  infrastructure with encryption at rest and in transit.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>When you log out:</Text> Your session ends, but
                  your account and stored data are not deleted.
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>When you delete your account:</Text> Your profile
                  is excluded from discovery and eligible personal data is purged within 30 days
                  (and 90 days from backups).
                </Text>
                <Text style={[styles.bulletRow, { color: theme.colors.textSecondary }]}>
                  • <Text style={styles.boldText}>How to delete your account:</Text> Open Settings →
                  Account → Delete Account.
                </Text>
              </View>

              {/* End of Document Clean Stamp */}
              <View style={styles.endStampRow}>
                <Text
                  style={[
                    styles.endStampText,
                    { color: theme.colors.textTertiary, fontFamily: folkraFont },
                  ]}
                >
                  — END OF OFFICIAL DOCUMENTATION —
                </Text>
                <Text style={[styles.endSubText, { color: theme.colors.textTertiary }]}>
                  Nazar Social Discovery · Legal Affairs & Regulatory Compliance
                </Text>
              </View>
            </ScrollView>

            {/* Bottom Agreement & Action Controls */}
            <View
              style={[
                styles.bottomActionContainer,
                {
                  borderTopColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
                  backgroundColor: isDark ? '#121215' : '#FCFCFD',
                },
              ]}
            >
              {/* Checkbox agreement row */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  haptics.selection();
                  setIsAgreed((prev) => !prev);
                }}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isAgreed }}
                accessibilityLabel="I have read and agree to Nazar Terms of Service and Privacy Notice"
              >
                <View
                  style={[
                    styles.checkboxBox,
                    {
                      borderColor: isAgreed
                        ? '#FFFFFF'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.35)'
                          : 'rgba(0, 0, 0, 0.30)',
                      backgroundColor: isAgreed ? '#FFFFFF' : 'transparent',
                    },
                  ]}
                >
                  {isAgreed && <Check size={13} color="#000000" strokeWidth={3} />}
                </View>
                <Text
                  level="caption"
                  style={[styles.checkboxLabel, { color: theme.colors.textPrimary }]}
                >
                  I have read and agree to Nazar's{' '}
                  <Text
                    level="caption"
                    style={[styles.linkHighlight, { color: theme.colors.accent }]}
                  >
                    Terms of Service
                  </Text>
                  ,{' '}
                  <Text
                    level="caption"
                    style={[styles.linkHighlight, { color: theme.colors.accent }]}
                  >
                    Privacy Notice
                  </Text>
                  , and Data Deletion Rights.
                </Text>
              </TouchableOpacity>

              {/* Action Buttons Row */}
              <View style={styles.buttonActionRow}>
                <TouchableOpacity
                  onPress={handleDecline}
                  style={styles.declineButton}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Decline and return to signup"
                >
                  <Text style={[styles.declineButtonText, { color: theme.colors.textSecondary }]}>
                    Decline
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAccept}
                  disabled={!isAgreed}
                  style={[
                    styles.agreeButton,
                    {
                      backgroundColor: isAgreed
                        ? '#FFFFFF'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(0, 0, 0, 0.08)',
                      opacity: isAgreed ? 1 : 0.6,
                    },
                  ]}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Agree and proceed to verification"
                >
                  <Text
                    style={[
                      styles.agreeButtonText,
                      {
                        fontFamily: folkraFont,
                        color: isAgreed ? '#000000' : theme.colors.textTertiary,
                      },
                    ]}
                  >
                    Agree & Proceed
                  </Text>
                  <ArrowRight
                    size={15}
                    color={isAgreed ? '#000000' : theme.colors.textTertiary}
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>
              </View>

              {/* Bottom Handle Pill (The contrary mirror to the bottom sheet handle) */}
              <View
                style={[
                  styles.bottomHandlePill,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.14)',
                  },
                ]}
              />
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-start', // Anchored at the top
  },
  sheetSurface: {
    width: '100%',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    marginTop: 8,
    marginBottom: 16,
  },
  modalTitleContainer: {
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12.5,
    marginTop: 4,
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  headerDivider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
  },
  documentScrollView: {
    flex: 1,
  },
  documentScrollContent: {
    paddingBottom: 28,
    paddingTop: 4,
  },
  boldText: {
    fontWeight: '700',
  },
  entityLine: {
    fontSize: 12.5,
    lineHeight: 19,
    marginBottom: 4,
  },
  sectionBlock: {
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.10)',
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 8,
    lineHeight: 20,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
    lineHeight: 18,
  },
  paragraphText: {
    fontSize: 13,
    lineHeight: 19.5,
    marginBottom: 8,
  },
  bulletRow: {
    fontSize: 12.5,
    lineHeight: 19,
    marginBottom: 5,
    paddingLeft: 4,
  },
  listContainer: {
    gap: 5,
    marginBottom: 8,
  },
  listRow: {
    fontSize: 12.5,
    lineHeight: 19,
    paddingLeft: 2,
  },
  endStampRow: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  endStampText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  endSubText: {
    fontSize: 10.5,
  },
  bottomActionContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16.5,
  },
  linkHighlight: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  buttonActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 4,
  },
  declineButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  declineButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  agreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 11,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  agreeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bottomHandlePill: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
});
