import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput as RNTextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  MapPin,
  User,
  Users,
  Briefcase,
  GraduationCap,
  Heart,
  Sparkles,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  ShieldCheck,
  Lock,
  Coffee,
  BookOpen,
  Plane,
  Music,
  Search,
  Crosshair,
  Plus,
  Minus,
  Moon,
  Map as MapIcon,
  Satellite,
  Layers,
  Compass,
} from 'lucide-react-native';
import type { Gender, RelationshipIntent } from '@platform/api-contracts';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';
import { SmoothBottomSheetModal } from '../../src/design/components/modal/SmoothBottomSheetModal.js';

// ============================================================================
// Modern Inclusive Gender Spectrum Definitions
// ============================================================================

export interface ModernGenderOption {
  id: string;
  label: string;
  coreGender: Gender;
  desc: string;
}

export const MODERN_GENDER_OPTIONS: ModernGenderOption[] = [
  {
    id: 'woman',
    label: 'Woman',
    coreGender: 'WOMAN',
    desc: 'Identifies as a woman',
  },
  {
    id: 'man',
    label: 'Man',
    coreGender: 'MAN',
    desc: 'Identifies as a man',
  },
  {
    id: 'non_binary',
    label: 'Non-binary',
    coreGender: 'NON_BINARY',
    desc: 'Identity that expands beyond binary male or female',
  },
  {
    id: 'cisgender_woman',
    label: 'Cisgender Woman',
    coreGender: 'WOMAN',
    desc: 'Assigned female at birth, identifies as woman',
  },
  {
    id: 'cisgender_man',
    label: 'Cisgender Man',
    coreGender: 'MAN',
    desc: 'Assigned male at birth, identifies as man',
  },
  {
    id: 'transgender_woman',
    label: 'Transgender Woman',
    coreGender: 'WOMAN',
    desc: 'Woman with transgender journey and lived experience',
  },
  {
    id: 'transgender_man',
    label: 'Transgender Man',
    coreGender: 'MAN',
    desc: 'Man with transgender journey and lived experience',
  },
  {
    id: 'genderfluid',
    label: 'Genderfluid',
    coreGender: 'NON_BINARY',
    desc: 'Gender identity shifts or fluctuates dynamically',
  },
  {
    id: 'genderqueer',
    label: 'Genderqueer',
    coreGender: 'NON_BINARY',
    desc: 'Queer expression defying normative social roles',
  },
  {
    id: 'agender',
    label: 'Agender',
    coreGender: 'NON_BINARY',
    desc: 'Experiences absence of gender or neutral identity',
  },
  {
    id: 'bigender',
    label: 'Bigender',
    coreGender: 'NON_BINARY',
    desc: 'Identifies with two distinct genders concurrently or alternately',
  },
  {
    id: 'demigirl',
    label: 'Demigirl',
    coreGender: 'NON_BINARY',
    desc: 'Partially identifies with womanhood or feminine traits',
  },
  {
    id: 'demiboy',
    label: 'Demiboy',
    coreGender: 'NON_BINARY',
    desc: 'Partially identifies with manhood or masculine traits',
  },
  {
    id: 'two_spirit',
    label: 'Two-Spirit',
    coreGender: 'NON_BINARY',
    desc: 'Sacred Indigenous cultural and spiritual gender identity',
  },
  {
    id: 'pangender',
    label: 'Pangender',
    coreGender: 'NON_BINARY',
    desc: 'Experiences all or multiple genders holistically',
  },
  {
    id: 'androgynous',
    label: 'Androgynous',
    coreGender: 'NON_BINARY',
    desc: 'Blends masculine and feminine expressions harmoniously',
  },
  {
    id: 'intersex',
    label: 'Intersex',
    coreGender: 'OTHER',
    desc: 'Inborn reproductive or chromosomal variations outside the binary',
  },
  {
    id: 'questioning',
    label: 'Questioning',
    coreGender: 'OTHER',
    desc: 'Currently exploring and discovering gender expression',
  },
  {
    id: 'other',
    label: 'Prefer to self-describe',
    coreGender: 'OTHER',
    desc: 'Enter your self-described personal identity',
  },
];

// ============================================================================
// Modern Inclusive Interested In (Looking For) Definitions
// ============================================================================

export interface InterestedInOption {
  id: string;
  label: string;
  desc: string;
  coreGender: Gender;
}

export const INTERESTED_IN_OPTIONS: InterestedInOption[] = [
  {
    id: 'everyone',
    label: 'Everyone (Open to All)',
    coreGender: 'OTHER',
    desc: 'Open to people of all genders and identities',
  },
  {
    id: 'woman',
    label: 'Women',
    coreGender: 'WOMAN',
    desc: 'Show me women (cis & trans)',
  },
  {
    id: 'man',
    label: 'Men',
    coreGender: 'MAN',
    desc: 'Show me men (cis & trans)',
  },
  {
    id: 'non_binary',
    label: 'Non-binary',
    coreGender: 'NON_BINARY',
    desc: 'Identity that expands beyond binary male or female',
  },
  {
    id: 'cisgender_woman',
    label: 'Cisgender Women',
    coreGender: 'WOMAN',
    desc: 'Assigned female at birth, identifies as woman',
  },
  {
    id: 'cisgender_man',
    label: 'Cisgender Men',
    coreGender: 'MAN',
    desc: 'Assigned male at birth, identifies as man',
  },
  {
    id: 'transgender_woman',
    label: 'Transgender Women',
    coreGender: 'WOMAN',
    desc: 'Women with transgender journey and lived experience',
  },
  {
    id: 'transgender_man',
    label: 'Transgender Men',
    coreGender: 'MAN',
    desc: 'Men with transgender journey and lived experience',
  },
  {
    id: 'genderfluid',
    label: 'Genderfluid People',
    coreGender: 'NON_BINARY',
    desc: 'Gender identity shifts or fluctuates dynamically',
  },
  {
    id: 'genderqueer',
    label: 'Genderqueer People',
    coreGender: 'NON_BINARY',
    desc: 'Queer expression defying normative social roles',
  },
  {
    id: 'agender',
    label: 'Agender People',
    coreGender: 'NON_BINARY',
    desc: 'Experiences absence of gender or neutral identity',
  },
  {
    id: 'bigender',
    label: 'Bigender People',
    coreGender: 'NON_BINARY',
    desc: 'Identifies with two distinct genders concurrently or alternately',
  },
  {
    id: 'demigirl',
    label: 'Demigirls',
    coreGender: 'NON_BINARY',
    desc: 'Partially identifies with womanhood or feminine traits',
  },
  {
    id: 'demiboy',
    label: 'Demiboys',
    coreGender: 'NON_BINARY',
    desc: 'Partially identifies with manhood or masculine traits',
  },
  {
    id: 'two_spirit',
    label: 'Two-Spirit Individuals',
    coreGender: 'NON_BINARY',
    desc: 'Sacred Indigenous cultural and spiritual gender identity',
  },
  {
    id: 'pangender',
    label: 'Pangender People',
    coreGender: 'NON_BINARY',
    desc: 'Experiences all or multiple genders holistically',
  },
  {
    id: 'androgynous',
    label: 'Androgynous People',
    coreGender: 'NON_BINARY',
    desc: 'Blends masculine and feminine expressions harmoniously',
  },
  {
    id: 'intersex',
    label: 'Intersex Individuals',
    coreGender: 'OTHER',
    desc: 'Inborn reproductive or chromosomal variations outside the binary',
  },
  {
    id: 'questioning',
    label: 'Questioning Individuals',
    coreGender: 'OTHER',
    desc: 'Currently exploring and discovering gender expression',
  },
];

// ============================================================================
// Relationship Intent Definitions (Monochromatic)
// ============================================================================

export interface IntentOption {
  label: string;
  value: RelationshipIntent;
  desc: string;
}

export const INTENT_OPTIONS: IntentOption[] = [
  {
    label: 'Long-term relationship / Marriage',
    value: 'LONG_TERM',
    desc: 'Looking for a committed partner to build a shared future with.',
  },
  {
    label: 'Dating with intention',
    value: 'SHORT_TERM',
    desc: 'Open to love, taking time to get to know someone genuinely.',
  },
  {
    label: 'Casual dating & exploring',
    value: 'CASUAL',
    desc: 'Spontaneous dates, engaging conversations, and chemistry.',
  },
  {
    label: 'New friends & community',
    value: 'FRIENDSHIP',
    desc: 'Expanding my authentic social circle with inspiring souls.',
  },
  {
    label: 'Still figuring it out',
    value: 'NOT_SURE',
    desc: 'Keeping an open mind and letting real connection lead the way.',
  },
];

// ============================================================================
// Date Picker Helpers
// ============================================================================

const MONTHS = [
  { name: 'January', short: 'Jan', value: 0 },
  { name: 'February', short: 'Feb', value: 1 },
  { name: 'March', short: 'Mar', value: 2 },
  { name: 'April', short: 'Apr', value: 3 },
  { name: 'May', short: 'May', value: 4 },
  { name: 'June', short: 'Jun', value: 5 },
  { name: 'July', short: 'Jul', value: 6 },
  { name: 'August', short: 'Aug', value: 7 },
  { name: 'September', short: 'Sep', value: 8 },
  { name: 'October', short: 'Oct', value: 9 },
  { name: 'November', short: 'Nov', value: 10 },
  { name: 'December', short: 'Dec', value: 11 },
];

export interface LocationSuggestion {
  displayName: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface EducationSuggestion {
  name: string;
  location?: string;
  country?: string;
}

const EDUCATION_ABBREVIATIONS: Record<string, string> = {
  mit: 'Massachusetts Institute of Technology',
  iit: 'Indian Institute of Technology',
  iitb: 'IIT Bombay',
  iitd: 'IIT Delhi',
  iitm: 'IIT Madras',
  iitk: 'IIT Kanpur',
  iitkgp: 'IIT Kharagpur',
  bits: 'Birla Institute of Technology and Science',
  iim: 'Indian Institute of Management',
  nid: 'National Institute of Design',
  nift: 'National Institute of Fashion Technology',
  du: 'Delhi University',
  ucla: 'University of California, Los Angeles',
  nyu: 'New York University',
  cmu: 'Carnegie Mellon University',
  nus: 'National University of Singapore',
  ntu: 'Nanyang Technological University',
  ucb: 'UC Berkeley',
  lse: 'London School of Economics',
  oxford: 'University of Oxford',
  cambridge: 'University of Cambridge',
  harvard: 'Harvard University',
  stanford: 'Stanford University',
};

const MAP_LAYERS = [
  { id: 'default' as const, label: 'Default', Icon: Moon },
  { id: 'street' as const, label: 'Street', Icon: MapIcon },
  { id: 'satellite' as const, label: 'Satellite', Icon: Satellite },
  { id: 'hybrid' as const, label: 'Hybrid', Icon: Layers },
];

export default function OnboardingProfileSetupScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();
  const profileApi = getDefaultProfileApi();

  // Animated scroll listener for glossy top vignette & position tracking
  const scrollY = useRef(new Animated.Value(0)).current;
  const currentScrollY = useRef(0);
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e: any) => {
      const y = e?.nativeEvent?.contentOffset?.y;
      if (typeof y === 'number') {
        currentScrollY.current = y;
      }
    },
  });
  const headerGlossOpacity = scrollY.interpolate({
    inputRange: [0, 20, 60],
    outputRange: [0, 0.45, 1],
    extrapolate: 'clamp',
  });

  // Load Folkra brand font
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  const { draftProfile, draftPreferences, updateDraftProfile, updateDraftPreferences } =
    useOnboardingStore();

  // Core Form State
  const [displayName, setDisplayName] = useState(draftProfile.displayName || '');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(
    draftProfile.dateOfBirth ? new Date(draftProfile.dateOfBirth) : null
  );

  // Modern Gender State
  const initialGenderId = useMemo(() => {
    if (draftProfile.genderIdentity) {
      const match = MODERN_GENDER_OPTIONS.find(
        (g) => g.label.toLowerCase() === draftProfile.genderIdentity?.toLowerCase()
      );
      if (match) return match.id;
    }
    if (draftProfile.gender === 'MAN') return 'man';
    if (draftProfile.gender === 'NON_BINARY') return 'non_binary';
    if (draftProfile.gender === 'OTHER') return 'other';
    return 'woman';
  }, [draftProfile.gender, draftProfile.genderIdentity]);

  const [selectedGenderId, setSelectedGenderId] = useState<string>(initialGenderId);
  const [customGenderText, setCustomGenderText] = useState<string>(
    draftProfile.genderIdentity &&
      !MODERN_GENDER_OPTIONS.some((g) => g.label === draftProfile.genderIdentity)
      ? draftProfile.genderIdentity
      : ''
  );
  const [showGenderOnProfile, setShowGenderOnProfile] = useState<boolean>(true);

  // Interested In (Looking For) State
  const [selectedInterestedInIds, setSelectedInterestedInIds] = useState<string[]>(() => {
    if (draftProfile.interestedInIdentities && draftProfile.interestedInIdentities.length > 0) {
      return draftProfile.interestedInIdentities;
    }
    if (draftPreferences.genderPreferences && draftPreferences.genderPreferences.length > 0) {
      if (draftPreferences.genderPreferences.includes('OTHER')) return ['everyone'];
      const ids: string[] = [];
      if (draftPreferences.genderPreferences.includes('WOMAN')) ids.push('woman');
      if (draftPreferences.genderPreferences.includes('MAN')) ids.push('man');
      if (draftPreferences.genderPreferences.includes('NON_BINARY')) ids.push('non_binary');
      return ids.length > 0 ? ids : ['everyone'];
    }
    return ['everyone'];
  });

  // Relationship Intent State
  const [intent, setIntent] = useState<RelationshipIntent>(draftProfile.intent || 'LONG_TERM');

  // Location / City State
  const [city, setCity] = useState(draftProfile.city || '');
  const [selectedCoords, setSelectedCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(draftProfile.coordinates || null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);

  // Map Picker Modal State
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [selectedMapType, setSelectedMapType] = useState<
    'default' | 'satellite' | 'street' | 'hybrid'
  >('default');
  const [mapCenterCoords, setMapCenterCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: draftProfile.coordinates?.latitude || 22.5726,
    longitude: draftProfile.coordinates?.longitude || 88.3639,
  });
  const [mapReverseGeocodedName, setMapReverseGeocodedName] = useState<string>(
    draftProfile.city || 'Kolkata, West Bengal'
  );
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [mapSearchText, setMapSearchText] = useState('');
  const [mapSuggestions, setMapSuggestions] = useState<LocationSuggestion[]>([]);
  const [isMapSearching, setIsMapSearching] = useState(false);
  const mapSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapWebViewRef = useRef<any>(null);

  // Bio, Career, Education
  const [bio, setBio] = useState(draftProfile.bio || '');
  const [occupation, setOccupation] = useState(draftProfile.occupation || '');
  const [education, setEducation] = useState(draftProfile.education || '');
  const [educationSuggestions, setEducationSuggestions] = useState<EducationSuggestion[]>([]);
  const [isSearchingEducation, setIsSearchingEducation] = useState(false);
  const [showEducationDropdown, setShowEducationDropdown] = useState(false);
  const educationSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const educationInputRef = useRef<RNTextInput>(null);

  // Modals & Focus States
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isGenderModalVisible, setIsGenderModalVisible] = useState(false);
  const [genderSearchText, setGenderSearchText] = useState('');
  const [isInterestedInModalVisible, setIsInterestedInModalVisible] = useState(false);
  const [interestedInSearchText, setInterestedInSearchText] = useState('');
  const interestedInSearchInputRef = useRef<RNTextInput>(null);
  const [isIntentModalVisible, setIsIntentModalVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Date picker scratch state
  const initialDate = dateOfBirth || new Date(2000, 0, 15);
  const [tempMonth, setTempMonth] = useState<number>(initialDate.getMonth());
  const [tempDay, setTempDay] = useState<number>(initialDate.getDate());
  const [tempYear, setTempYear] = useState<number>(initialDate.getFullYear());

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const scrollViewRef = useRef<ScrollView>(null);
  const nameInputRef = useRef<RNTextInput>(null);
  const cityInputRef = useRef<RNTextInput>(null);
  const genderSearchInputRef = useRef<RNTextInput>(null);

  // Field shake animations & smooth scroll tracking
  const nameShakeAnim = useRef(new Animated.Value(0)).current;
  const dobShakeAnim = useRef(new Animated.Value(0)).current;
  const cityShakeAnim = useRef(new Animated.Value(0)).current;
  const [highlightedField, setHighlightedField] = useState<'displayName' | 'dob' | 'city' | null>(
    null
  );
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fallback and dynamic Y coordinates for smooth scroll targets
  const section1Y = useRef(200);
  const nameCardRelY = useRef(40);
  const dobCardRelY = useRef(180);
  const section3Y = useRef(560);
  const cityCardRelY = useRef(40);
  const section4Y = useRef(750);
  const bioCardRelY = useRef(40);
  const section5Y = useRef(950);
  const occupationCardRelY = useRef(40);
  const educationCardRelY = useRef(120);
  const lastScrollRedirectTime = useRef(0);

  const ensureFieldInView = useCallback((targetY: number) => {
    const clampedTarget = Math.max(0, targetY);
    const diff = Math.abs(currentScrollY.current - clampedTarget);
    const now = Date.now();
    if (diff > 45 && now - lastScrollRedirectTime.current > 350) {
      lastScrollRedirectTime.current = now;
      scrollViewRef.current?.scrollTo({
        y: clampedTarget,
        animated: true,
      });
    }
  }, []);

  // ============================================================================
  // Age Calculations
  // ============================================================================

  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const tempAge = useMemo(() => {
    const d = new Date(tempYear, tempMonth, tempDay);
    return calculateAge(d);
  }, [tempYear, tempMonth, tempDay]);

  const currentAge = useMemo(() => {
    return dateOfBirth ? calculateAge(dateOfBirth) : null;
  }, [dateOfBirth]);

  const isFormValid = useMemo(() => {
    const hasName = Boolean(displayName.trim() && displayName.trim().length <= 30);
    const hasDob = Boolean(
      dateOfBirth && currentAge !== null && currentAge >= 18 && currentAge <= 100
    );
    const hasCity = Boolean(city.trim());
    const hasInterestedIn = selectedInterestedInIds.length > 0;
    return hasName && hasDob && hasCity && hasInterestedIn;
  }, [displayName, dateOfBirth, currentAge, city, selectedInterestedInIds]);

  const selectedCoreGenders = useMemo<Gender[]>(() => {
    if (selectedInterestedInIds.includes('everyone')) {
      return ['OTHER'];
    }
    const coreSet = new Set<Gender>();
    selectedInterestedInIds.forEach((id) => {
      const found = INTERESTED_IN_OPTIONS.find((opt) => opt.id === id);
      if (found) {
        coreSet.add(found.coreGender);
      }
    });
    return coreSet.size > 0 ? Array.from(coreSet) : ['OTHER'];
  }, [selectedInterestedInIds]);

  const filteredInterestedInOptions = useMemo(() => {
    const q = interestedInSearchText.trim().toLowerCase();
    if (!q) return INTERESTED_IN_OPTIONS;
    return INTERESTED_IN_OPTIONS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    );
  }, [interestedInSearchText]);

  const toggleInterestedInId = (id: string) => {
    haptics.selection();
    if (id === 'everyone') {
      setSelectedInterestedInIds(['everyone']);
      return;
    }

    let updated: string[];
    if (selectedInterestedInIds.includes('everyone')) {
      updated = [id];
    } else if (selectedInterestedInIds.includes(id)) {
      if (selectedInterestedInIds.length <= 1) return; // Keep at least one selected
      updated = selectedInterestedInIds.filter((item) => item !== id);
    } else {
      updated = [...selectedInterestedInIds, id];
    }
    setSelectedInterestedInIds(updated);
  };

  const activeInterestedInLabel = useMemo(() => {
    if (selectedInterestedInIds.includes('everyone')) {
      return 'Everyone (Open to All)';
    }
    if (selectedInterestedInIds.length === 1) {
      const match = INTERESTED_IN_OPTIONS.find((o) => o.id === selectedInterestedInIds[0]);
      return match ? match.label : 'Everyone (Open to All)';
    }
    if (selectedInterestedInIds.length === 2) {
      const m1 = INTERESTED_IN_OPTIONS.find((o) => o.id === selectedInterestedInIds[0]);
      const m2 = INTERESTED_IN_OPTIONS.find((o) => o.id === selectedInterestedInIds[1]);
      if (m1 && m2) return `${m1.label} & ${m2.label}`;
    }
    const m1 = INTERESTED_IN_OPTIONS.find((o) => o.id === selectedInterestedInIds[0]);
    if (m1) {
      return `${m1.label} +${selectedInterestedInIds.length - 1} more`;
    }
    return 'Everyone (Open to All)';
  }, [selectedInterestedInIds]);

  const activeInterestedInDesc = useMemo(() => {
    if (selectedInterestedInIds.includes('everyone')) {
      return 'Open to people of all genders and identities';
    }
    if (selectedInterestedInIds.length === 1) {
      const match = INTERESTED_IN_OPTIONS.find((o) => o.id === selectedInterestedInIds[0]);
      return match ? match.desc : 'Open to people of all genders and identities';
    }
    return `${selectedInterestedInIds.length} categories selected for discovery`;
  }, [selectedInterestedInIds]);

  const maxDaysInTempMonth = useMemo(() => {
    return new Date(tempYear, tempMonth + 1, 0).getDate();
  }, [tempYear, tempMonth]);

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear - 18;
    const minYear = 1940;
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  }, []);

  const daysList = useMemo(() => {
    const list: number[] = [];
    for (let d = 1; d <= maxDaysInTempMonth; d++) {
      list.push(d);
    }
    return list;
  }, [maxDaysInTempMonth]);

  // Selected gender object
  const activeGenderOption = useMemo(() => {
    return (
      MODERN_GENDER_OPTIONS.find((g) => g.id === selectedGenderId) || MODERN_GENDER_OPTIONS[0]!
    );
  }, [selectedGenderId]);

  const activeGenderLabel = useMemo(() => {
    if (selectedGenderId === 'other' && customGenderText.trim()) {
      return customGenderText.trim();
    }
    return activeGenderOption.label;
  }, [selectedGenderId, customGenderText, activeGenderOption]);

  const activeIntentOption = useMemo(() => {
    return INTENT_OPTIONS.find((i) => i.value === intent) || INTENT_OPTIONS[0]!;
  }, [intent]);

  // Filtered genders for search modal
  const filteredGenders = useMemo(() => {
    const q = genderSearchText.trim().toLowerCase();
    if (!q) return MODERN_GENDER_OPTIONS;
    return MODERN_GENDER_OPTIONS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    );
  }, [genderSearchText]);

  // ============================================================================
  // Internet Location Autocomplete Search (Photon API by Komoot / OpenStreetMap)
  // ============================================================================

  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLocationSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setLocationSuggestions([]);
      setShowSuggestionsDropdown(false);
      setIsSearchingLocation(false);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=5`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Location query failed');
      const data = await response.json();

      if (data && Array.isArray(data.features)) {
        const parsed: LocationSuggestion[] = data.features.map((f: any) => {
          const props = f.properties || {};
          const coords = f.geometry?.coordinates || [0, 0];
          const primaryName = props.name || props.city || props.county || trimmed;
          const secondary = [props.city, props.state, props.country]
            .filter(Boolean)
            .filter((v, idx, arr) => arr.indexOf(v) === idx && v !== primaryName)
            .join(', ');

          const fullLabel = secondary ? `${primaryName}, ${secondary}` : primaryName;

          return {
            displayName: fullLabel,
            city: props.city || primaryName,
            region: secondary,
            country: props.country || '',
            latitude: coords[1],
            longitude: coords[0],
          };
        });

        setLocationSuggestions(parsed);
        setShowSuggestionsDropdown(parsed.length > 0);
      } else {
        setLocationSuggestions([]);
        setShowSuggestionsDropdown(false);
      }
    } catch {
      setLocationSuggestions([]);
      setShowSuggestionsDropdown(false);
    } finally {
      setIsSearchingLocation(false);
    }
  }, []);

  const handleCityTextChange = (text: string) => {
    setCity(text);
    if (errorMessage) setErrorMessage(undefined);
    ensureFieldInView(section3Y.current + cityCardRelY.current - 95);

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    if (text.trim().length >= 2) {
      searchDebounceTimerRef.current = setTimeout(() => {
        fetchLocationSuggestions(text);
      }, 350);
    } else {
      setLocationSuggestions([]);
      setShowSuggestionsDropdown(false);
    }
  };

  const handleSelectSuggestion = (item: LocationSuggestion) => {
    haptics.selection();
    setCity(item.displayName);
    setSelectedCoords({ latitude: item.latitude, longitude: item.longitude });
    setShowSuggestionsDropdown(false);
    setLocationSuggestions([]);
    Keyboard.dismiss();
  };

  // ============================================================================
  // Internet Education / University Autocomplete Search (Photon OpenStreetMap API)
  // ============================================================================

  const fetchEducationSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setEducationSuggestions([]);
      setShowEducationDropdown(false);
      setIsSearchingEducation(false);
      return;
    }

    setIsSearchingEducation(true);
    try {
      const lower = trimmed.toLowerCase();
      const expandedQuery = EDUCATION_ABBREVIATIONS[lower] || trimmed;
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(expandedQuery)}&limit=6&osm_tag=amenity:university&osm_tag=amenity:college`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Education query failed');
      const data = await response.json();

      let features = Array.isArray(data?.features) ? data.features : [];

      if (features.length === 0) {
        const fallbackUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed + ' university')}&limit=4`;
        const fbRes = await fetch(fallbackUrl);
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          if (Array.isArray(fbData?.features)) {
            features = fbData.features;
          }
        }
      }

      if (features.length > 0) {
        const parsed: EducationSuggestion[] = [];
        const seenNames = new Set<string>();

        if (EDUCATION_ABBREVIATIONS[lower]) {
          const abbrevTitle = EDUCATION_ABBREVIATIONS[lower];
          parsed.push({
            name: abbrevTitle,
            location: 'Higher Education Institution',
          });
          seenNames.add(abbrevTitle.toLowerCase());
        }

        for (const f of features) {
          const props = f.properties || {};
          const name = props.name;
          if (!name) continue;
          const nameKey = name.toLowerCase().trim();
          if (seenNames.has(nameKey)) continue;
          seenNames.add(nameKey);

          const secondary = [props.city, props.state, props.country]
            .filter(Boolean)
            .filter((v, idx, arr) => arr.indexOf(v) === idx && v !== name)
            .join(', ');

          parsed.push({
            name,
            location: secondary || props.country || undefined,
            country: props.country || '',
          });

          if (parsed.length >= 5) break;
        }

        setEducationSuggestions(parsed);
        setShowEducationDropdown(parsed.length > 0);
      } else {
        setEducationSuggestions([]);
        setShowEducationDropdown(false);
      }
    } catch {
      setEducationSuggestions([]);
      setShowEducationDropdown(false);
    } finally {
      setIsSearchingEducation(false);
    }
  }, []);

  const handleEducationTextChange = (text: string) => {
    setEducation(text);
    ensureFieldInView(section5Y.current + educationCardRelY.current - 95);

    if (educationSearchDebounceRef.current) {
      clearTimeout(educationSearchDebounceRef.current);
    }

    if (text.trim().length >= 2) {
      educationSearchDebounceRef.current = setTimeout(() => {
        fetchEducationSuggestions(text);
      }, 350);
    } else {
      setEducationSuggestions([]);
      setShowEducationDropdown(false);
    }
  };

  const handleSelectEducationSuggestion = (item: EducationSuggestion) => {
    haptics.selection();
    setEducation(item.name);
    setShowEducationDropdown(false);
    setEducationSuggestions([]);
    Keyboard.dismiss();
  };

  // Reverse Geocoding for Map Center
  const reverseGeocodeMapCenter = useCallback(async (lat: number, lon: number) => {
    setIsReverseGeocoding(true);
    try {
      const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.features?.[0]?.properties) {
          const props = data.features[0].properties;
          const place =
            props.name || props.locality || props.district || props.city || 'Selected Location';
          const locality = [props.city, props.state, props.country]
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i && v !== place)
            .join(', ');
          const formatted = locality ? `${place}, ${locality}` : place;
          setMapReverseGeocodedName(formatted);
          return;
        }
      }
      setMapReverseGeocodedName(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } catch {
      setMapReverseGeocodedName(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } finally {
      setIsReverseGeocoding(false);
    }
  }, []);

  const mapDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'location_changed') {
        const lat = Number(payload.lat);
        const lng = Number(payload.lng);
        setMapCenterCoords({ latitude: lat, longitude: lng });

        if (mapDebounceTimerRef.current) {
          clearTimeout(mapDebounceTimerRef.current);
        }
        mapDebounceTimerRef.current = setTimeout(() => {
          reverseGeocodeMapCenter(lat, lng);
        }, 300);
      }
    } catch {
      // non-json message, ignore safely
    }
  };

  const handleConfirmMapLocation = () => {
    haptics.notificationSuccess();
    setCity(mapReverseGeocodedName);
    setSelectedCoords(mapCenterCoords);
    setIsMapModalVisible(false);
    setMapSearchText('');
    setMapSuggestions([]);
    if (errorMessage) setErrorMessage(undefined);
  };

  const handleMapTypeChange = (type: 'default' | 'satellite' | 'street' | 'hybrid') => {
    if (type === selectedMapType) return;
    haptics.selection();
    setSelectedMapType(type);
    mapWebViewRef.current?.injectJavaScript(`
      if (window.setMapLayer) {
        window.setMapLayer('${type}');
      }
      true;
    `);
  };

  // In-Map Search Autocomplete
  const fetchMapSearchSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMapSuggestions([]);
      setIsMapSearching(false);
      return;
    }

    setIsMapSearching(true);
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=5`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Location query failed');
      const data = await response.json();

      if (data && Array.isArray(data.features)) {
        const parsed: LocationSuggestion[] = data.features.map((f: any) => {
          const props = f.properties || {};
          const coords = f.geometry?.coordinates || [0, 0];
          const primaryName = props.name || props.city || props.county || trimmed;
          const secondary = [props.city, props.state, props.country]
            .filter(Boolean)
            .filter((v, idx, arr) => arr.indexOf(v) === idx && v !== primaryName)
            .join(', ');

          const fullLabel = secondary ? `${primaryName}, ${secondary}` : primaryName;

          return {
            displayName: fullLabel,
            city: props.city || primaryName,
            region: secondary,
            country: props.country || '',
            latitude: coords[1],
            longitude: coords[0],
          };
        });

        setMapSuggestions(parsed);
      } else {
        setMapSuggestions([]);
      }
    } catch {
      setMapSuggestions([]);
    } finally {
      setIsMapSearching(false);
    }
  }, []);

  const handleMapSearchTextChange = (text: string) => {
    setMapSearchText(text);
    if (mapSearchDebounceRef.current) {
      clearTimeout(mapSearchDebounceRef.current);
    }
    if (text.trim().length >= 2) {
      mapSearchDebounceRef.current = setTimeout(() => {
        fetchMapSearchSuggestions(text);
      }, 300);
    } else {
      setMapSuggestions([]);
    }
  };

  const handleSelectMapSearchResult = (item: LocationSuggestion) => {
    haptics.selection();
    setMapSearchText('');
    setMapSuggestions([]);
    Keyboard.dismiss();
    setMapCenterCoords({ latitude: item.latitude, longitude: item.longitude });
    setMapReverseGeocodedName(item.displayName);
    mapWebViewRef.current?.injectJavaScript(`
      if (window.map) {
        window.map.setView([${item.latitude}, ${item.longitude}], 14, { animate: true });
      }
      true;
    `);
  };

  // ============================================================================
  // Back & Submit Handlers
  // ============================================================================

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleOpenDatePicker = () => {
    haptics.selection();
    const baseDate = dateOfBirth || new Date(2000, 0, 15);
    setTempMonth(baseDate.getMonth());
    setTempDay(baseDate.getDate());
    setTempYear(baseDate.getFullYear());
    setIsDatePickerVisible(true);
  };

  const handleConfirmDate = () => {
    const validDay = Math.min(tempDay, maxDaysInTempMonth);
    const selected = new Date(tempYear, tempMonth, validDay);
    const age = calculateAge(selected);

    if (age < 18) {
      haptics.notificationError();
      setErrorMessage('You must be at least 18 years old to join Nazar.');
      return;
    }

    haptics.notificationSuccess();
    setDateOfBirth(selected);
    setIsDatePickerVisible(false);
    if (errorMessage) setErrorMessage(undefined);
  };

  const triggerFieldShake = (
    anim: Animated.Value,
    field: 'displayName' | 'dob' | 'city',
    targetScrollY: number
  ) => {
    setErrorMessage(undefined);
    haptics.notificationError();
    setHighlightedField(field);

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedField(null);
    }, 1800);

    scrollViewRef.current?.scrollTo({
      y: Math.max(0, targetScrollY - 95),
      animated: true,
    });

    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -3, duration: 35, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 3, duration: 35, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 30, useNativeDriver: true }),
    ]).start();
  };

  const handleNext = async () => {
    if (!displayName.trim() || displayName.trim().length > 30) {
      triggerFieldShake(nameShakeAnim, 'displayName', section1Y.current + nameCardRelY.current);
      nameInputRef.current?.focus();
      return;
    }

    if (!dateOfBirth) {
      triggerFieldShake(dobShakeAnim, 'dob', section1Y.current + dobCardRelY.current);
      handleOpenDatePicker();
      return;
    }

    const age = calculateAge(dateOfBirth);
    if (age < 18 || age > 100) {
      triggerFieldShake(dobShakeAnim, 'dob', section1Y.current + dobCardRelY.current);
      handleOpenDatePicker();
      return;
    }

    if (!city.trim()) {
      triggerFieldShake(cityShakeAnim, 'city', section3Y.current + cityCardRelY.current);
      cityInputRef.current?.focus();
      return;
    }

    haptics.impactMedium();
    const formattedDob = dateOfBirth.toISOString().split('T')[0];
    const coreGender = activeGenderOption.coreGender;
    const finalGenderIdentity = activeGenderLabel;

    updateDraftProfile({
      displayName: displayName.trim(),
      dateOfBirth: formattedDob,
      gender: coreGender,
      genderIdentity: finalGenderIdentity,
      interestedIn: selectedCoreGenders,
      interestedInIdentities: selectedInterestedInIds,
      intent,
      city: city.trim(),
      coordinates: selectedCoords || undefined,
      bio: bio.trim(),
      occupation: occupation.trim(),
      education: education.trim(),
    });

    updateDraftPreferences({
      genderPreferences: selectedCoreGenders,
    });

    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      await profileApi.updateMyProfile({
        displayName: displayName.trim(),
        dateOfBirth: formattedDob,
        gender: coreGender,
        city: city.trim(),
        location: selectedCoords || undefined,
        bio: bio.trim() || undefined,
        occupation: occupation.trim() || undefined,
        education: education.trim() || undefined,
      });

      try {
        await profileApi.updatePreferences({
          genderPreferences: selectedCoreGenders,
        });
      } catch {
        // Will be reaffirmed on preferences step
      }

      trackOnboardingEvent('profile_details_completed', {
        age,
        gender: coreGender,
        intent,
      });

      router.push('/(onboarding)/photos');
    } catch (err: unknown) {
      if (__DEV__) {
        trackOnboardingEvent('profile_details_completed', {
          age,
          gender: coreGender,
          intent,
        });
        router.push('/(onboarding)/photos');
        return;
      }
      haptics.notificationError();
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Failed to save profile. Tap Continue to retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const formattedDateString = useMemo(() => {
    if (!dateOfBirth) return 'Select date of birth';
    const day = dateOfBirth.getDate();
    const month = MONTHS[dateOfBirth.getMonth()]?.name || '';
    const year = dateOfBirth.getFullYear();
    return `${day} ${month} ${year}`;
  }, [dateOfBirth]);

  // Leaflet Map HTML (Professional multi-layer map: Street, Satellite, Hybrid, Dark)
  const mapHtml = useMemo(() => {
    const initialLat = mapCenterCoords.latitude;
    const initialLng = mapCenterCoords.longitude;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #0b0b0e; overflow: hidden; }
    .original-map-tile {
      filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
    }
    .center-pin {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -100%);
      z-index: 1000;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .pin-shadow {
      width: 14px;
      height: 6px;
      background: rgba(0, 0, 0, 0.45);
      border-radius: 50%;
      margin-top: -3px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="center-pin">
    <svg width="34" height="42" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#000000" stroke-width="1.8">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.8" fill="#000000"/>
    </svg>
    <div class="pin-shadow"></div>
  </div>
  <script>
    window.map = L.map('map', { 
      zoomControl: false, 
      attributionControl: false,
      touchZoom: true,
      dragging: true 
    }).setView([${initialLat}, ${initialLng}], 13);

    var layers = {
      default: [
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          className: 'original-map-tile'
        })
      ],
      street: [
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c']
        })
      ],
      satellite: [
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19
        })
      ],
      hybrid: [
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19
        })
      ]
    };

    var currentActiveLayers = [];

    function setMapLayer(type) {
      for (var i = 0; i < currentActiveLayers.length; i++) {
        window.map.removeLayer(currentActiveLayers[i]);
      }
      var target = layers[type] || layers.default;
      for (var j = 0; j < target.length; j++) {
        target[j].addTo(window.map);
      }
      currentActiveLayers = target;
    }

    setMapLayer('default');
    window.setMapLayer = setMapLayer;

    function notifyPosition() {
      var center = window.map.getCenter();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'location_changed',
          lat: center.lat,
          lng: center.lng
        }));
      }
    }

    window.map.on('moveend', notifyPosition);

    window.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'set_view') {
          window.map.setView([data.lat, data.lng], data.zoom || 14, { animate: true });
        } else if (data.type === 'set_layer') {
          setMapLayer(data.layer);
        }
      } catch (err) {}
    });
  </script>
</body>
</html>`;
  }, []);

  return (
    <View style={[styles.safeArea, { backgroundColor: isDark ? '#0B0B0E' : '#FAFAFA' }]}>
      {/* Glossy, Faded, Frosted-Glass Top Vignette (Reveals dynamically on scroll) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glossyTopOverlay,
          {
            height: Math.max(insets.top + 54, 70),
            opacity: headerGlossOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(11, 11, 14, 0.98)',
                  'rgba(11, 11, 14, 0.92)',
                  'rgba(11, 11, 14, 0.70)',
                  'rgba(11, 11, 14, 0.28)',
                  'rgba(11, 11, 14, 0.0)',
                ]
              : [
                  'rgba(250, 250, 250, 0.98)',
                  'rgba(250, 250, 250, 0.92)',
                  'rgba(250, 250, 250, 0.70)',
                  'rgba(250, 250, 250, 0.28)',
                  'rgba(250, 250, 250, 0.0)',
                ]
          }
          locations={[0, 0.4, 0.68, 0.88, 1.0]}
          style={StyleSheet.absoluteFill}
        />
        {/* Specular Gloss Sheen Layer */}
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(255, 255, 255, 0.08)',
                  'rgba(255, 255, 255, 0.03)',
                  'rgba(255, 255, 255, 0.0)',
                ]
              : [
                  'rgba(255, 255, 255, 0.70)',
                  'rgba(255, 255, 255, 0.25)',
                  'rgba(255, 255, 255, 0.0)',
                ]
          }
          locations={[0, 0.45, 1.0]}
          style={styles.glossySheenLayer}
        />
      </Animated.View>

      {/* Encircled floating circular back button on top left corner (identical to login/otp) */}
      <TouchableOpacity
        onPress={handleBack}
        style={[
          styles.encircledBackButton,
          {
            top: Math.max(insets.top + 8, 16),
            left: Math.max(insets.left + 16, 16),
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)',
          },
        ]}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="onboarding-back-button"
      >
        <ArrowLeft size={20} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.ScrollView
            ref={scrollViewRef as any}
            contentContainerStyle={[
              styles.scrollContent,
              {
                maxWidth: maxContentWidth,
                width: '100%',
                alignSelf: 'center',
                paddingTop: Math.max(insets.top + 64, 76),
                paddingBottom: isKeyboardVisible ? 16 : Math.max(insets.bottom + 115, 135),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={{ flex: 1 }}>
                {/* Redesigned Monochromatic Hero Section with Inline 01/06 */}
                <View style={styles.heroSection}>
                  <View style={styles.heroTitleRow}>
                    <Heading
                      level="h1"
                      style={[
                        styles.heroTitle,
                        { fontFamily: folkraFont, color: theme.colors.textPrimary },
                      ]}
                    >
                      The Basics
                    </Heading>

                    {/* Refined Pure Typographic 01/06 Indicator beside Heading */}
                    <View style={styles.stepBadgeInline}>
                      <Text
                        style={[
                          styles.stepCurrentText,
                          { color: theme.colors.textPrimary, fontFamily: folkraFont },
                        ]}
                      >
                        01
                      </Text>
                      <Text
                        style={[
                          styles.stepDividerText,
                          { color: theme.colors.textTertiary, fontFamily: folkraFont },
                        ]}
                      >
                        /
                      </Text>
                      <Text
                        style={[
                          styles.stepTotalText,
                          { color: theme.colors.textTertiary, fontFamily: folkraFont },
                        ]}
                      >
                        06
                      </Text>
                    </View>
                  </View>

                  <Text level="body" color="secondary" style={styles.heroSubtitle}>
                    Begin your authentic narrative. Your name, age, identity, and location form the
                    foundation of who you meet on Nazar.
                  </Text>
                </View>

                {/* Error Banner */}
                {errorMessage && (
                  <View
                    style={[
                      styles.errorBanner,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                        borderColor: '#EF4444',
                      },
                    ]}
                  >
                    <AlertCircle
                      size={16}
                      color="#EF4444"
                      style={{ marginRight: 8, marginTop: 1 }}
                    />
                    <Text
                      level="bodySmall"
                      style={{ color: '#EF4444', fontWeight: '600', flex: 1, lineHeight: 18 }}
                    >
                      {errorMessage}
                    </Text>
                  </View>
                )}

                {/* ======================================================== */}
                {/* Section 1: Who You Are */}
                {/* ======================================================== */}
                <View
                  style={styles.sectionGroup}
                  onLayout={(e) => {
                    section1Y.current = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeaderRow}>
                    <Text
                      style={[
                        styles.sectionHeaderTitle,
                        { color: theme.colors.textSecondary, fontFamily: folkraFont },
                      ]}
                    >
                      WHO YOU ARE
                    </Text>
                  </View>

                  {/* Full Name Card */}
                  <Animated.View
                    onLayout={(e) => {
                      nameCardRelY.current = e.nativeEvent.layout.y;
                    }}
                    style={[
                      styles.cardBox,
                      {
                        backgroundColor: isDark ? '#121216' : '#FFFFFF',
                        borderColor:
                          focusedField === 'displayName' || highlightedField === 'displayName'
                            ? theme.colors.textPrimary
                            : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : '#E4E4E7',
                        marginBottom: 14,
                        transform: [{ translateX: nameShakeAnim }],
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleCluster}>
                        <View
                          style={[
                            styles.monochromeIconBadge,
                            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                          ]}
                        >
                          <User size={15} color={theme.colors.textPrimary} />
                        </View>
                        <Text level="bodySmall" style={styles.cardTitleText}>
                          Full Name
                        </Text>
                      </View>
                      <Text level="caption" color="tertiary">
                        {displayName.length}/30
                      </Text>
                    </View>

                    <RNTextInput
                      ref={nameInputRef}
                      style={[
                        styles.textInput,
                        {
                          color: theme.colors.textPrimary,
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E4E4E7',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F8FA',
                        },
                      ]}
                      placeholder="What should we call you?"
                      placeholderTextColor={theme.colors.textTertiary}
                      value={displayName}
                      onFocus={() => setFocusedField('displayName')}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(t) => {
                        setDisplayName(t);
                        if (errorMessage) setErrorMessage(undefined);
                        ensureFieldInView(section1Y.current + nameCardRelY.current - 95);
                      }}
                      maxLength={30}
                      autoCapitalize="words"
                      returnKeyType="next"
                      testID="name-input"
                    />
                    <Text level="caption" color="tertiary" style={styles.microNotice}>
                      This will be displayed on your profile and cannot be changed later.
                    </Text>
                  </Animated.View>

                  {/* Date of Birth Trigger Card */}
                  <Animated.View
                    onLayout={(e) => {
                      dobCardRelY.current = e.nativeEvent.layout.y;
                    }}
                    style={[
                      styles.cardBox,
                      {
                        backgroundColor: isDark ? '#121216' : '#FFFFFF',
                        borderColor:
                          highlightedField === 'dob'
                            ? theme.colors.textPrimary
                            : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : '#E4E4E7',
                        marginBottom: 14,
                        transform: [{ translateX: dobShakeAnim }],
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleCluster}>
                        <View
                          style={[
                            styles.monochromeIconBadge,
                            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                          ]}
                        >
                          <Calendar size={15} color={theme.colors.textPrimary} />
                        </View>
                        <Text level="bodySmall" style={styles.cardTitleText}>
                          Date of Birth
                        </Text>
                      </View>

                      {currentAge !== null && (
                        <View
                          style={[
                            styles.monochromeAgePill,
                            {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F1F4',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#E4E4E7',
                            },
                          ]}
                        >
                          <ShieldCheck
                            size={12}
                            color={theme.colors.textPrimary}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={{
                              color: theme.colors.textPrimary,
                              fontWeight: '700',
                              fontSize: 12,
                            }}
                          >
                            {currentAge} yrs · 18+
                          </Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.dropdownBox,
                        {
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E4E4E7',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F8FA',
                          height: 52,
                        },
                      ]}
                      onPress={handleOpenDatePicker}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Choose date of birth"
                    >
                      <Text
                        style={{
                          color: dateOfBirth ? theme.colors.textPrimary : theme.colors.textTertiary,
                          fontWeight: dateOfBirth ? '600' : '400',
                          fontSize: 15,
                          flex: 1,
                        }}
                      >
                        {formattedDateString}
                      </Text>
                      <View
                        style={[
                          styles.intentChevronBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.04)',
                          },
                        ]}
                      >
                        <ChevronDown size={15} color={theme.colors.textSecondary} />
                      </View>
                    </TouchableOpacity>

                    <View style={styles.securityFootnote}>
                      <Lock
                        size={12}
                        color={theme.colors.textTertiary}
                        style={{ marginRight: 5 }}
                      />
                      <Text level="caption" color="tertiary" style={{ flex: 1, lineHeight: 16 }}>
                        Your age will be public on Nazar, but your exact birthday is always kept
                        private.
                      </Text>
                    </View>
                  </Animated.View>

                  {/* Modern Gender Identity Trigger Card */}
                  <View
                    style={[
                      styles.cardBox,
                      {
                        backgroundColor: isDark ? '#121216' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                        marginBottom: 14,
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleCluster}>
                        <View
                          style={[
                            styles.monochromeIconBadge,
                            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                          ]}
                        >
                          <Users size={15} color={theme.colors.textPrimary} />
                        </View>
                        <Text level="bodySmall" style={styles.cardTitleText}>
                          Gender Identity
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.intentDropdownBox,
                        {
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E4E4E7',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F8FA',
                        },
                      ]}
                      onPress={() => {
                        haptics.selection();
                        setGenderSearchText('');
                        setIsGenderModalVisible(true);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Select gender identity"
                    >
                      <View style={styles.intentContentContainer}>
                        <Text
                          style={[styles.intentLabelText, { color: theme.colors.textPrimary }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {activeGenderLabel}
                        </Text>
                        <Text
                          style={[styles.intentDescText, { color: theme.colors.textTertiary }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {activeGenderOption.desc}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.intentChevronBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.04)',
                          },
                        ]}
                      >
                        <ChevronDown size={15} color={theme.colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Interested In (Looking For) Trigger Card */}
                  <View
                    style={[
                      styles.cardBox,
                      {
                        backgroundColor: isDark ? '#121216' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleCluster}>
                        <View
                          style={[
                            styles.monochromeIconBadge,
                            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                          ]}
                        >
                          <Compass size={15} color={theme.colors.textPrimary} />
                        </View>
                        <Text level="bodySmall" style={styles.cardTitleText}>
                          Interested In
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.intentDropdownBox,
                        {
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E4E4E7',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F8FA',
                        },
                      ]}
                      onPress={() => {
                        haptics.selection();
                        setIsInterestedInModalVisible(true);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Select who you are interested in"
                    >
                      <View style={styles.intentContentContainer}>
                        <Text
                          style={[styles.intentLabelText, { color: theme.colors.textPrimary }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {activeInterestedInLabel}
                        </Text>
                        <Text
                          style={[styles.intentDescText, { color: theme.colors.textTertiary }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {activeInterestedInDesc}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.intentChevronBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.04)',
                          },
                        ]}
                      >
                        <ChevronDown size={15} color={theme.colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ======================================================== */}
                {/* Section 2: Intentions */}
                {/* ======================================================== */}
                <View style={styles.sectionGroup}>
                  <View style={styles.sectionHeaderRow}>
                    <Text
                      style={[
                        styles.sectionHeaderTitle,
                        { color: theme.colors.textSecondary, fontFamily: folkraFont },
                      ]}
                    >
                      YOUR INTENTIONS
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.cardBox,
                      {
                        backgroundColor: isDark ? '#121216' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleCluster}>
                        <View
                          style={[
                            styles.monochromeIconBadge,
                            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                          ]}
                        >
                          <Heart size={15} color={theme.colors.textPrimary} />
                        </View>
                        <Text level="bodySmall" style={styles.cardTitleText}>
                          Relationship Intent
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.intentDropdownBox,
                        {
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E4E4E7',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F8FA',
                        },
                      ]}
                      onPress={() => {
                        haptics.selection();
                        setIsIntentModalVisible(true);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Select relationship intent"
                    >
                      <View style={styles.intentContentContainer}>
                        <Text
                          style={[styles.intentLabelText, { color: theme.colors.textPrimary }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {activeIntentOption.label}
                        </Text>
                        <Text
                          style={[styles.intentDescText, { color: theme.colors.textTertiary }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {activeIntentOption.desc}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.intentChevronBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : 'rgba(0, 0, 0, 0.04)',
                          },
                        ]}
                      >
                        <ChevronDown size={15} color={theme.colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ======================================================== */}
                {/* Section 3: Where You Live (Internet Search + Map Picker) */}
                {/* ======================================================== */}
                <View
                  style={styles.sectionGroup}
                  onLayout={(e) => {
                    section3Y.current = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeaderRow}>
                    <Text
                      style={[
                        styles.sectionHeaderTitle,
                        { color: theme.colors.textSecondary, fontFamily: folkraFont },
                      ]}
                    >
                      WHERE YOU LIVE
                    </Text>
                  </View>

                  <Animated.View
                    onLayout={(e) => {
                      cityCardRelY.current = e.nativeEvent.layout.y;
                    }}
                    style={[
                      styles.cardBox,
                      {
                        backgroundColor: isDark ? '#121216' : '#FFFFFF',
                        borderColor:
                          focusedField === 'city' || highlightedField === 'city'
                            ? theme.colors.textPrimary
                            : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : '#E4E4E7',
                        transform: [{ translateX: cityShakeAnim }],
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleCluster}>
                        <View
                          style={[
                            styles.monochromeIconBadge,
                            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                          ]}
                        >
                          <MapPin size={15} color={theme.colors.textPrimary} />
                        </View>
                        <Text level="bodySmall" style={styles.cardTitleText} numberOfLines={1}>
                          City / Neighborhood
                        </Text>
                      </View>
                    </View>

                    {/* City Input with Real-time Search and Inline Map Button */}
                    <View style={styles.cityInputContainer}>
                      <RNTextInput
                        ref={cityInputRef}
                        style={[
                          styles.textInput,
                          {
                            color: theme.colors.textPrimary,
                            borderColor:
                              focusedField === 'city'
                                ? theme.colors.textPrimary
                                : isDark
                                  ? 'rgba(255, 255, 255, 0.1)'
                                  : '#E4E4E7',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F8FA',
                            height: 50,
                            paddingLeft: 14,
                            paddingRight: isSearchingLocation ? 154 : city.length > 0 ? 154 : 124,
                            fontSize: 14.5,
                          },
                        ]}
                        placeholder="Type a city or locality..."
                        placeholderTextColor={theme.colors.textTertiary}
                        value={city}
                        onFocus={() => {
                          setFocusedField('city');
                          if (locationSuggestions.length > 0) setShowSuggestionsDropdown(true);
                        }}
                        onBlur={() => {
                          setFocusedField(null);
                          // allow tap on suggestions before hiding
                          setTimeout(() => setShowSuggestionsDropdown(false), 250);
                        }}
                        onChangeText={handleCityTextChange}
                        autoCapitalize="words"
                        returnKeyType="done"
                        testID="city-input"
                      />

                      {/* Right-aligned actions inside text field: Activity indicator or Clear X + Choose on Map button */}
                      <View style={styles.cityInputInlineActions}>
                        {isSearchingLocation ? (
                          <ActivityIndicator
                            size="small"
                            color={theme.colors.textSecondary}
                            style={{ marginRight: 6 }}
                          />
                        ) : city.length > 0 ? (
                          <TouchableOpacity
                            onPress={() => {
                              haptics.selection();
                              setCity('');
                              setLocationSuggestions([]);
                              setShowSuggestionsDropdown(false);
                              setSelectedCoords(null);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ marginRight: 6, padding: 3 }}
                            accessibilityRole="button"
                            accessibilityLabel="Clear city input"
                          >
                            <X size={14} color={theme.colors.textTertiary} />
                          </TouchableOpacity>
                        ) : null}

                        {/* Compact Button-Style Choose on Map */}
                        <TouchableOpacity
                          onPress={() => {
                            haptics.selection();
                            Keyboard.dismiss();
                            setShowSuggestionsDropdown(false);
                            const targetCoords = selectedCoords || {
                              latitude: 22.5726,
                              longitude: 88.3639,
                            };
                            setMapCenterCoords(targetCoords);
                            setMapReverseGeocodedName(city.trim() || 'Kolkata, West Bengal');
                            setIsMapModalVisible(true);
                            setTimeout(() => {
                              mapWebViewRef.current?.injectJavaScript(`
                                if (window.map) {
                                  window.map.setView([${targetCoords.latitude}, ${targetCoords.longitude}], 13);
                                }
                                true;
                              `);
                            }, 300);
                          }}
                          style={[
                            styles.inlineMapButton,
                            {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#EBEBEF',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#DCDCE0',
                            },
                          ]}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel="Choose location from map"
                        >
                          <Crosshair
                            size={11.5}
                            color={theme.colors.textPrimary}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={{
                              color: theme.colors.textPrimary,
                              fontWeight: '700',
                              fontSize: 11,
                              letterSpacing: -0.1,
                            }}
                            numberOfLines={1}
                          >
                            Choose on Map
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Real-time Internet Autocomplete Dropdown */}
                    {showSuggestionsDropdown && locationSuggestions.length > 0 && (
                      <View
                        style={[
                          styles.suggestionsDropdownCard,
                          {
                            backgroundColor: isDark ? '#18181E' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E4E4E7',
                          },
                        ]}
                      >
                        {locationSuggestions.map((item, idx) => (
                          <TouchableOpacity
                            key={`${item.displayName}-${idx}`}
                            style={[
                              styles.suggestionRow,
                              idx > 0 && {
                                borderTopWidth: 1,
                                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4',
                              },
                            ]}
                            onPress={() => handleSelectSuggestion(item)}
                            activeOpacity={0.7}
                          >
                            <MapPin
                              size={15}
                              color={theme.colors.textSecondary}
                              style={{ marginRight: 10, marginTop: 2 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: theme.colors.textPrimary,
                                  fontWeight: '600',
                                  fontSize: 13.5,
                                }}
                              >
                                {item.city || item.displayName}
                              </Text>
                              {item.region ? (
                                <Text
                                  level="caption"
                                  color="tertiary"
                                  numberOfLines={1}
                                  style={{ marginTop: 1 }}
                                >
                                  {item.region}
                                </Text>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <Text level="caption" color="tertiary" style={styles.microNotice}>
                      Nearby matches will see your general city area. Your exact GPS coordinates
                      remain strictly private.
                    </Text>
                  </Animated.View>
                </View>

                {/* ======================================================== */}
                {/* Section 4: About You (Bio) */}
                {/* ======================================================== */}
                <View
                  style={styles.sectionGroup}
                  onLayout={(e) => {
                    section4Y.current = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeaderRow}>
                    <Text
                      style={[
                        styles.sectionHeaderTitle,
                        { color: theme.colors.textSecondary, fontFamily: folkraFont },
                      ]}
                    >
                      ABOUT YOU
                    </Text>
                  </View>

                  <View
                    onLayout={(e) => {
                      bioCardRelY.current = e.nativeEvent.layout.y;
                    }}
                    style={[
                      styles.cardBox,
                      {
                        backgroundColor: isDark ? '#121216' : '#FFFFFF',
                        borderColor:
                          focusedField === 'bio'
                            ? theme.colors.textPrimary
                            : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : '#E4E4E7',
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleCluster}>
                        <View
                          style={[
                            styles.monochromeIconBadge,
                            { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                          ]}
                        >
                          <Sparkles size={15} color={theme.colors.textPrimary} />
                        </View>
                        <Text level="bodySmall" style={styles.cardTitleText}>
                          Bio / Headline
                        </Text>
                      </View>
                      <Text level="caption" color="tertiary">
                        {bio.length}/300
                      </Text>
                    </View>

                    <RNTextInput
                      style={[
                        styles.multilineInput,
                        {
                          color: theme.colors.textPrimary,
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E4E4E7',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F8FA',
                        },
                      ]}
                      placeholder="A little about your rhythm, weekend rituals, and what brings you genuine joy..."
                      placeholderTextColor={theme.colors.textTertiary}
                      value={bio}
                      onFocus={() => setFocusedField('bio')}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(t) => {
                        setBio(t.slice(0, 300));
                        ensureFieldInView(section4Y.current + bioCardRelY.current - 95);
                      }}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      maxLength={300}
                    />

                    {/* Monochromatic Inspiration Chips */}
                    <View style={styles.chipsSection}>
                      <Text level="caption" color="tertiary" style={styles.chipsHeading}>
                        SPARK AN IDEA
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={[
                              styles.inspirationCard,
                              {
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F4F4F6',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                              },
                            ]}
                            onPress={() => {
                              haptics.selection();
                              const prompt = 'Sunday morning coffee ritual: ';
                              setBio((prev) => (prev ? `${prev.trim()}\n${prompt}` : prompt));
                            }}
                          >
                            <Coffee
                              size={13}
                              color={theme.colors.textPrimary}
                              style={{ marginRight: 6 }}
                            />
                            <Text level="caption" color="secondary" style={{ fontSize: 12 }}>
                              Sunday morning ritual
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.inspirationCard,
                              {
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F4F4F6',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                              },
                            ]}
                            onPress={() => {
                              haptics.selection();
                              const prompt = 'Currently reading / obsessed with: ';
                              setBio((prev) => (prev ? `${prev.trim()}\n${prompt}` : prompt));
                            }}
                          >
                            <BookOpen
                              size={13}
                              color={theme.colors.textPrimary}
                              style={{ marginRight: 6 }}
                            />
                            <Text level="caption" color="secondary" style={{ fontSize: 12 }}>
                              Currently obsessed with
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.inspirationCard,
                              {
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F4F4F6',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                              },
                            ]}
                            onPress={() => {
                              haptics.selection();
                              const prompt = 'Next destination on my bucket list: ';
                              setBio((prev) => (prev ? `${prev.trim()}\n${prompt}` : prompt));
                            }}
                          >
                            <Plane
                              size={13}
                              color={theme.colors.textPrimary}
                              style={{ marginRight: 6 }}
                            />
                            <Text level="caption" color="secondary" style={{ fontSize: 12 }}>
                              Next dream destination
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.inspirationCard,
                              {
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F4F4F6',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                              },
                            ]}
                            onPress={() => {
                              haptics.selection();
                              const prompt = 'The song I play on repeat: ';
                              setBio((prev) => (prev ? `${prev.trim()}\n${prompt}` : prompt));
                            }}
                          >
                            <Music
                              size={13}
                              color={theme.colors.textPrimary}
                              style={{ marginRight: 6 }}
                            />
                            <Text level="caption" color="secondary" style={{ fontSize: 12 }}>
                              Songs on repeat
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </ScrollView>
                    </View>
                  </View>
                </View>

                {/* ======================================================== */}
                {/* Section 5: Career & Education (Optional) */}
                {/* ======================================================== */}
                <View
                  style={[styles.sectionGroup, isKeyboardVisible && { marginBottom: 8 }]}
                  onLayout={(e) => {
                    section5Y.current = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeaderRow}>
                    <Text
                      style={[
                        styles.sectionHeaderTitle,
                        { color: theme.colors.textSecondary, fontFamily: folkraFont },
                      ]}
                    >
                      CAREER & EDUCATION (OPTIONAL)
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.cardBox,
                      {
                        backgroundColor: isDark ? '#121216' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
                      },
                    ]}
                  >
                    {/* Occupation */}
                    <View
                      style={styles.fieldInnerRow}
                      onLayout={(e) => {
                        occupationCardRelY.current = e.nativeEvent.layout.y;
                      }}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTitleCluster}>
                          <View
                            style={[
                              styles.monochromeIconBadge,
                              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                            ]}
                          >
                            <Briefcase size={15} color={theme.colors.textPrimary} />
                          </View>
                          <Text level="bodySmall" style={styles.cardTitleText}>
                            Occupation / Title
                          </Text>
                        </View>
                      </View>
                      <RNTextInput
                        style={[
                          styles.textInput,
                          {
                            color: theme.colors.textPrimary,
                            borderColor:
                              focusedField === 'occupation'
                                ? theme.colors.textPrimary
                                : isDark
                                  ? 'rgba(255, 255, 255, 0.1)'
                                  : '#E4E4E7',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F8FA',
                          },
                        ]}
                        placeholder="e.g. Architect, Founder, Designer"
                        placeholderTextColor={theme.colors.textTertiary}
                        value={occupation}
                        onFocus={() => setFocusedField('occupation')}
                        onBlur={() => setFocusedField(null)}
                        onChangeText={(t) => {
                          setOccupation(t);
                          ensureFieldInView(section5Y.current + occupationCardRelY.current - 95);
                        }}
                        autoCapitalize="words"
                      />
                    </View>

                    {/* Education */}
                    <View
                      style={[styles.fieldInnerRow, { marginTop: 14 }]}
                      onLayout={(e) => {
                        educationCardRelY.current = e.nativeEvent.layout.y;
                      }}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTitleCluster}>
                          <View
                            style={[
                              styles.monochromeIconBadge,
                              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                            ]}
                          >
                            <GraduationCap size={15} color={theme.colors.textPrimary} />
                          </View>
                          <Text level="bodySmall" style={styles.cardTitleText}>
                            Education / University
                          </Text>
                        </View>
                      </View>
                      {/* Education Input with Real-time Search and Inline Spinner / Clear Button */}
                      <View style={styles.cityInputContainer}>
                        <RNTextInput
                          ref={educationInputRef}
                          style={[
                            styles.textInput,
                            {
                              color: theme.colors.textPrimary,
                              borderColor:
                                focusedField === 'education'
                                  ? theme.colors.textPrimary
                                  : isDark
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : '#E4E4E7',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F8FA',
                              paddingRight: isSearchingEducation
                                ? 44
                                : education.length > 0
                                  ? 44
                                  : 14,
                            },
                          ]}
                          placeholder="e.g. IIT Bombay, NID, St. Xavier's"
                          placeholderTextColor={theme.colors.textTertiary}
                          value={education}
                          onFocus={() => {
                            setFocusedField('education');
                            if (educationSuggestions.length > 0) setShowEducationDropdown(true);
                          }}
                          onBlur={() => {
                            setFocusedField(null);
                            setTimeout(() => setShowEducationDropdown(false), 250);
                          }}
                          onChangeText={handleEducationTextChange}
                          autoCapitalize="words"
                          returnKeyType="done"
                          testID="education-input"
                        />

                        {/* Trailing action: Activity indicator or Clear X button */}
                        <View style={styles.cityInputTrailingAction}>
                          {isSearchingEducation ? (
                            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                          ) : education.length > 0 ? (
                            <TouchableOpacity
                              onPress={() => {
                                haptics.selection();
                                setEducation('');
                                setEducationSuggestions([]);
                                setShowEducationDropdown(false);
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ padding: 3 }}
                              accessibilityRole="button"
                              accessibilityLabel="Clear education input"
                            >
                              <X size={14} color={theme.colors.textTertiary} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>

                      {/* Real-time Internet Autocomplete Dropdown for Education */}
                      {showEducationDropdown && educationSuggestions.length > 0 && (
                        <View
                          style={[
                            styles.suggestionsDropdownCard,
                            {
                              backgroundColor: isDark ? '#18181E' : '#FFFFFF',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E4E4E7',
                            },
                          ]}
                        >
                          {educationSuggestions.map((item, idx) => (
                            <TouchableOpacity
                              key={`${item.name}-${idx}`}
                              style={[
                                styles.suggestionRow,
                                idx > 0 && {
                                  borderTopWidth: 1,
                                  borderTopColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4',
                                },
                              ]}
                              onPress={() => handleSelectEducationSuggestion(item)}
                              activeOpacity={0.7}
                            >
                              <GraduationCap
                                size={15}
                                color={theme.colors.textSecondary}
                                style={{ marginRight: 10, marginTop: 2 }}
                              />
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    color: theme.colors.textPrimary,
                                    fontWeight: '600',
                                    fontSize: 13.5,
                                  }}
                                >
                                  {item.name}
                                </Text>
                                {item.location ? (
                                  <Text
                                    level="caption"
                                    color="tertiary"
                                    numberOfLines={1}
                                    style={{ marginTop: 1 }}
                                  >
                                    {item.location}
                                  </Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {/* ======================================================== */}
      {/* Floating Bottom Action Dock with 8-Stop Feather Fade     */}
      {/* ======================================================== */}
      <View
        style={[styles.bottomDock, isKeyboardVisible && { opacity: 0, pointerEvents: 'none' }]}
        pointerEvents={isKeyboardVisible ? 'none' : 'box-none'}
      >
        {/* Soft, Natural Feathered Fade Above the Button */}
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(11, 11, 14, 0.0)',
                  'rgba(11, 11, 14, 0.05)',
                  'rgba(11, 11, 14, 0.16)',
                  'rgba(11, 11, 14, 0.38)',
                  'rgba(11, 11, 14, 0.68)',
                  'rgba(11, 11, 14, 0.90)',
                  'rgba(11, 11, 14, 1.0)',
                  'rgba(11, 11, 14, 1.0)',
                ]
              : [
                  'rgba(250, 250, 250, 0.0)',
                  'rgba(250, 250, 250, 0.05)',
                  'rgba(250, 250, 250, 0.16)',
                  'rgba(250, 250, 250, 0.38)',
                  'rgba(250, 250, 250, 0.68)',
                  'rgba(250, 250, 250, 0.90)',
                  'rgba(250, 250, 250, 1.0)',
                  'rgba(250, 250, 250, 1.0)',
                ]
          }
          locations={[0, 0.04, 0.1, 0.16, 0.22, 0.3, 0.38, 1.0]}
          style={styles.dockGradientBackdrop}
          pointerEvents="none"
        />

        <View
          style={[
            styles.dockInner,
            {
              maxWidth: maxContentWidth || 520,
              paddingBottom: Math.max(insets.bottom + 14, 20),
            },
          ]}
        >
          {/* Professional CTA Button (Matching Sign In / Sign Up white button) */}
          <TouchableOpacity
            onPress={handleNext}
            disabled={isLoading}
            style={[
              styles.professionalCtaButton,
              {
                backgroundColor: '#FFFFFF',
                borderColor: isDark ? 'transparent' : 'rgba(0, 0, 0, 0.12)',
                borderWidth: isDark ? 0 : 1,
                shadowColor: '#000000',
                shadowOpacity: isDark ? 0.28 : 0.12,
                opacity: isLoading ? 0.75 : isFormValid ? 1 : 0.6,
              },
            ]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Continue to Photos"
            testID="submit-button"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <View style={styles.buttonInnerRow}>
                <Text
                  style={[
                    styles.professionalCtaText,
                    {
                      color: '#000000',
                      fontFamily: folkraFont,
                    },
                  ]}
                >
                  Continue to Photos
                </Text>
                <ArrowRight size={17} color="#000000" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ======================================================== */}
      {/* 1. Modern Gender Identity Modal with Search Facility */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={isGenderModalVisible}
        onClose={() => {
          setIsGenderModalVisible(false);
          setGenderSearchText('');
        }}
        sheetStyle={{ maxHeight: '86%' }}
        showHandle={true}
      >
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.modalTitle,
                { color: theme.colors.textPrimary, fontFamily: folkraFont },
              ]}
            >
              Gender Identity
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 2 }}>
              Select the identity that feels most authentic to you.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setIsGenderModalVisible(false);
              setGenderSearchText('');
            }}
            style={[
              styles.modalCloseBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F1F4',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close gender selection modal"
          >
            <X size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar Facility */}
        <View
          style={[
            styles.modalSearchContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F4F4F6',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E4E4E7',
            },
          ]}
        >
          <Search size={16} color={theme.colors.textTertiary} style={{ marginRight: 8 }} />
          <RNTextInput
            ref={genderSearchInputRef}
            style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search gender identities..."
            placeholderTextColor={theme.colors.textTertiary}
            value={genderSearchText}
            onChangeText={setGenderSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {genderSearchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setGenderSearchText('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable Genders List */}
        <ScrollView
          style={{ maxHeight: 420 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredGenders.map((item) => {
            const isSelected = selectedGenderId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.selectionOptionRow,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.09)'
                        : '#F4F4F6'
                      : 'transparent',
                    borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F1F4',
                  },
                ]}
                onPress={() => {
                  haptics.selection();
                  setSelectedGenderId(item.id);
                  if (item.id !== 'other') {
                    setIsGenderModalVisible(false);
                    setGenderSearchText('');
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontWeight: isSelected ? '700' : '600',
                      fontSize: 15,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text level="caption" color="tertiary" style={{ marginTop: 2, lineHeight: 16 }}>
                    {item.desc}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioIndicator,
                    {
                      borderColor: isSelected
                        ? theme.colors.textPrimary
                        : isDark
                          ? 'rgba(255, 255, 255, 0.25)'
                          : '#D4D4D8',
                      backgroundColor: isSelected ? theme.colors.textPrimary : 'transparent',
                    },
                  ]}
                >
                  {isSelected && <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} />}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Custom Self-Describe Input if selected or no matches */}
          {selectedGenderId === 'other' && (
            <View style={styles.customGenderInputBox}>
              <Text
                level="caption"
                style={{
                  color: theme.colors.textSecondary,
                  marginBottom: 6,
                  fontWeight: '600',
                }}
              >
                Type your self-described identity:
              </Text>
              <RNTextInput
                style={[
                  styles.textInput,
                  {
                    color: theme.colors.textPrimary,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#E4E4E7',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8F8FA',
                  },
                ]}
                placeholder="e.g. Demigirl, Neutrois, Two-Spirit"
                placeholderTextColor={theme.colors.textTertiary}
                value={customGenderText}
                onChangeText={setCustomGenderText}
                maxLength={40}
              />
              <TouchableOpacity
                style={[styles.confirmCustomButton, { backgroundColor: theme.colors.textPrimary }]}
                onPress={() => {
                  haptics.notificationSuccess();
                  setIsGenderModalVisible(false);
                  setGenderSearchText('');
                }}
              >
                <Text
                  style={{
                    color: isDark ? '#000000' : '#FFFFFF',
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  Confirm Identity
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Show on Profile Toggle */}
        <TouchableOpacity
          style={[
            styles.showOnProfileRow,
            {
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
            },
          ]}
          onPress={() => {
            haptics.selection();
            setShowGenderOnProfile((prev) => !prev);
          }}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 13.5 }}>
              Visible on my profile
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 1 }}>
              {showGenderOnProfile
                ? 'Your identity is shown on your card'
                : 'Hidden from public profile card'}
            </Text>
          </View>
          <View
            style={[
              styles.toggleCapsule,
              {
                backgroundColor: showGenderOnProfile
                  ? theme.colors.textPrimary
                  : isDark
                    ? 'rgba(255, 255, 255, 0.14)'
                    : '#D4D4D8',
              },
            ]}
          >
            <View
              style={[
                styles.toggleKnob,
                {
                  backgroundColor: showGenderOnProfile
                    ? isDark
                      ? '#000000'
                      : '#FFFFFF'
                    : isDark
                      ? '#FFFFFF'
                      : '#FFFFFF',
                  alignSelf: showGenderOnProfile ? 'flex-end' : 'flex-start',
                },
              ]}
            />
          </View>
        </TouchableOpacity>
      </SmoothBottomSheetModal>

      {/* ======================================================== */}
      {/* 2. Interactive Map Location Picker Modal */}
      {/* ======================================================== */}
      <Modal
        visible={isMapModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          Keyboard.dismiss();
          setIsMapModalVisible(false);
        }}
      >
        <SafeAreaView style={[styles.mapModalContainer, { backgroundColor: '#0B0B0E' }]}>
          {/* Map Header */}
          <View style={styles.mapModalHeader}>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setIsMapModalVisible(false);
              }}
              style={styles.mapCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close map picker"
            >
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.mapHeaderTitle, { fontFamily: folkraFont }]}>
                Pinpoint Location
              </Text>
              <Text level="caption" color="secondary" style={{ fontSize: 11.5 }}>
                Pan the map or search to place pin
              </Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* In-Map Search Bar */}
          <View style={styles.mapSearchBarContainer}>
            <View
              style={[
                styles.mapSearchInputRow,
                {
                  backgroundColor: '#16161C',
                  borderColor: 'rgba(255, 255, 255, 0.16)',
                },
              ]}
            >
              <Search size={15} color="#9E9EA8" style={{ marginRight: 8 }} />
              <RNTextInput
                style={styles.mapSearchTextInput}
                placeholder="Search city, area, or landmark..."
                placeholderTextColor="#71717A"
                value={mapSearchText}
                onChangeText={handleMapSearchTextChange}
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (mapSearchText.trim().length >= 2) {
                    fetchMapSearchSuggestions(mapSearchText);
                  }
                }}
              />
              {isMapSearching ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 6 }} />
              ) : mapSearchText.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setMapSearchText('');
                    setMapSuggestions([]);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={14} color="#71717A" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* In-Map Search Suggestions Overlay Dropdown */}
            {mapSuggestions.length > 0 && (
              <View style={styles.mapSuggestionsDropdown}>
                {mapSuggestions.map((item, idx) => (
                  <TouchableOpacity
                    key={`map-sug-${idx}`}
                    style={[styles.mapSuggestionRow, idx > 0 && styles.mapSuggestionRowBorder]}
                    onPress={() => handleSelectMapSearchResult(item)}
                    activeOpacity={0.7}
                  >
                    <MapPin size={14} color="#FFFFFF" style={{ marginRight: 10, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mapSuggestionPrimaryText} numberOfLines={1}>
                        {item.city || item.displayName}
                      </Text>
                      {item.region ? (
                        <Text style={styles.mapSuggestionSecondaryText} numberOfLines={1}>
                          {item.region}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Leaflet Map in WebView */}
          <View style={styles.mapWebViewContainer}>
            <WebView
              ref={mapWebViewRef}
              source={{ html: mapHtml }}
              style={styles.mapWebView}
              onMessage={handleWebViewMessage}
              scrollEnabled={false}
              testID="location-picker-webview"
            />

            {/* Floating Dynamic Icon Capsule Dock */}
            <View style={styles.mapLayerSelectorContainer}>
              {MAP_LAYERS.map((layer) => {
                const isActive = selectedMapType === layer.id;
                const LayerIcon = layer.Icon;
                return (
                  <TouchableOpacity
                    key={layer.id}
                    onPress={() => handleMapTypeChange(layer.id)}
                    style={[
                      styles.mapLayerTab,
                      isActive ? styles.mapLayerTabActive : styles.mapLayerTabInactive,
                    ]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`${layer.label} map view`}
                  >
                    <LayerIcon
                      size={17}
                      color={isActive ? '#000000' : '#A1A1AA'}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    {isActive && (
                      <Text
                        style={[styles.mapLayerTabTextActive, { fontFamily: folkraFont }]}
                        numberOfLines={1}
                      >
                        {layer.label}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Floating Zoom Controls (+ / -) */}
            <View style={styles.mapFloatingControls}>
              <TouchableOpacity
                style={styles.mapFloatingBtn}
                onPress={() => {
                  haptics.selection();
                  mapWebViewRef.current?.injectJavaScript(`
                    if (window.map) { window.map.zoomIn(); }
                    true;
                  `);
                }}
                accessibilityRole="button"
                accessibilityLabel="Zoom in on map"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Plus size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.mapFloatingDivider} />
              <TouchableOpacity
                style={styles.mapFloatingBtn}
                onPress={() => {
                  haptics.selection();
                  mapWebViewRef.current?.injectJavaScript(`
                    if (window.map) { window.map.zoomOut(); }
                    true;
                  `);
                }}
                accessibilityRole="button"
                accessibilityLabel="Zoom out on map"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Minus size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Floating Monochromatic Confirmation Card */}
          <View style={styles.mapBottomCard}>
            <View style={styles.mapBottomCardHeader}>
              <View style={styles.mapPinBadge}>
                <MapPin size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  level="caption"
                  color="tertiary"
                  style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
                >
                  Selected Location
                </Text>
                {isReverseGeocoding ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Locating address...</Text>
                  </View>
                ) : (
                  <Text style={styles.mapLocationNameText} numberOfLines={2}>
                    {mapReverseGeocodedName}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={styles.mapConfirmCtaButton}
              onPress={handleConfirmMapLocation}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Confirm location from map"
            >
              <Text style={[styles.mapConfirmCtaText, { fontFamily: folkraFont }]}>
                Confirm Location
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ======================================================== */}
      {/* 3. Birthday Picker Bottom Sheet Modal */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        showHandle={true}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.modalTitle,
                { color: theme.colors.textPrimary, fontFamily: folkraFont },
              ]}
            >
              When&apos;s your birthday?
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 2 }}>
              Must be 18+ to join Nazar. Exact birthday remains private.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsDatePickerVisible(false)}
            style={[
              styles.modalCloseBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F1F4',
              },
            ]}
          >
            <X size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Real-time Age Calculation Badge */}
        <View
          style={[
            styles.ageStatusBox,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F4F4F6',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#E4E4E7',
            },
          ]}
        >
          <ShieldCheck size={16} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
          <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
            Age: {tempAge} years old {tempAge >= 18 ? '· Verified 18+' : '· (Under 18 not allowed)'}
          </Text>
        </View>

        {/* 3-Column Picker */}
        <View style={styles.pickerColumnsRow}>
          {/* Day Column */}
          <View style={styles.pickerColumn}>
            <Text style={[styles.pickerColHeader, { color: theme.colors.textSecondary }]}>DAY</Text>
            <ScrollView
              style={styles.pickerColScroll}
              contentContainerStyle={styles.pickerColScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {daysList.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.pickerItem,
                    tempDay === d && [
                      styles.pickerItemSelected,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E4E4E7' },
                    ],
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setTempDay(d);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      {
                        color: tempDay === d ? theme.colors.textPrimary : theme.colors.textTertiary,
                        fontWeight: tempDay === d ? '700' : '400',
                      },
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Month Column */}
          <View style={[styles.pickerColumn, { flex: 1.4 }]}>
            <Text style={[styles.pickerColHeader, { color: theme.colors.textSecondary }]}>
              MONTH
            </Text>
            <ScrollView
              style={styles.pickerColScroll}
              contentContainerStyle={styles.pickerColScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {MONTHS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[
                    styles.pickerItem,
                    tempMonth === m.value && [
                      styles.pickerItemSelected,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E4E4E7' },
                    ],
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setTempMonth(m.value);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      {
                        color:
                          tempMonth === m.value
                            ? theme.colors.textPrimary
                            : theme.colors.textTertiary,
                        fontWeight: tempMonth === m.value ? '700' : '400',
                      },
                    ]}
                  >
                    {m.short}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Year Column */}
          <View style={styles.pickerColumn}>
            <Text style={[styles.pickerColHeader, { color: theme.colors.textSecondary }]}>
              YEAR
            </Text>
            <ScrollView
              style={styles.pickerColScroll}
              contentContainerStyle={styles.pickerColScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {yearsList.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[
                    styles.pickerItem,
                    tempYear === y && [
                      styles.pickerItemSelected,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E4E4E7' },
                    ],
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setTempYear(y);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      {
                        color:
                          tempYear === y ? theme.colors.textPrimary : theme.colors.textTertiary,
                        fontWeight: tempYear === y ? '700' : '400',
                      },
                    ]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Confirm Date Button */}
        <TouchableOpacity
          style={[
            styles.modalConfirmBtn,
            {
              backgroundColor:
                tempAge >= 18 ? (isDark ? '#FFFFFF' : '#111114') : 'rgba(255, 255, 255, 0.12)',
            },
          ]}
          onPress={handleConfirmDate}
          disabled={tempAge < 18}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.modalConfirmBtnText,
              {
                color:
                  tempAge >= 18 ? (isDark ? '#000000' : '#FFFFFF') : 'rgba(255, 255, 255, 0.4)',
              },
            ]}
          >
            {tempAge >= 18 ? 'Set Date of Birth' : 'Must be 18+ to Continue'}
          </Text>
        </TouchableOpacity>
      </SmoothBottomSheetModal>

      {/* ======================================================== */}
      {/* 4. Relationship Intent Modal */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={isIntentModalVisible}
        onClose={() => setIsIntentModalVisible(false)}
        showHandle={true}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.modalTitle,
                { color: theme.colors.textPrimary, fontFamily: folkraFont },
              ]}
            >
              Relationship Intent
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 2 }}>
              Be intentional about what you&apos;re looking for.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsIntentModalVisible(false)}
            style={[
              styles.modalCloseBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F1F4',
              },
            ]}
          >
            <X size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* List of Intent Options */}
        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
          {INTENT_OPTIONS.map((item) => {
            const isSelected = intent === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.selectionOptionRow,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#F4F4F6'
                      : 'transparent',
                    borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F1F4',
                  },
                ]}
                onPress={() => {
                  haptics.selection();
                  setIntent(item.value);
                  setIsIntentModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: 10, minWidth: 0 }}>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontWeight: isSelected ? '700' : '600',
                      fontSize: 15,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.label}
                  </Text>
                  <Text
                    level="caption"
                    color="tertiary"
                    style={{ marginTop: 2 }}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.desc}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioIndicator,
                    {
                      borderColor: isSelected
                        ? theme.colors.textPrimary
                        : isDark
                          ? 'rgba(255, 255, 255, 0.25)'
                          : '#D4D4D8',
                      backgroundColor: isSelected ? theme.colors.textPrimary : 'transparent',
                    },
                  ]}
                >
                  {isSelected && <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SmoothBottomSheetModal>

      {/* ======================================================== */}
      {/* 5. Interested In (Looking For) Modal with Search Facility */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={isInterestedInModalVisible}
        onClose={() => {
          setIsInterestedInModalVisible(false);
          setInterestedInSearchText('');
        }}
        sheetStyle={{ maxHeight: '86%' }}
        showHandle={true}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.modalTitle,
                { color: theme.colors.textPrimary, fontFamily: folkraFont },
              ]}
            >
              Interested In
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 2 }}>
              Select all categories and identities you would like to meet.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setIsInterestedInModalVisible(false);
              setInterestedInSearchText('');
            }}
            style={[
              styles.modalCloseBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F1F4',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close interested in modal"
          >
            <X size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar Facility */}
        <View
          style={[
            styles.modalSearchContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F4F4F6',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E4E4E7',
            },
          ]}
        >
          <Search size={16} color={theme.colors.textTertiary} style={{ marginRight: 8 }} />
          <RNTextInput
            ref={interestedInSearchInputRef}
            style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search gender categories..."
            placeholderTextColor={theme.colors.textTertiary}
            value={interestedInSearchText}
            onChangeText={setInterestedInSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {interestedInSearchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setInterestedInSearchText('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable Categories List */}
        <ScrollView
          style={{ maxHeight: 420 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredInterestedInOptions.map((item) => {
            const isSelected = selectedInterestedInIds.includes(item.id);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.selectionOptionRow,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.09)'
                        : '#F4F4F6'
                      : 'transparent',
                    borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F1F4',
                  },
                ]}
                onPress={() => toggleInterestedInId(item.id)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${item.label}, ${isSelected ? 'selected' : 'not selected'}`}
              >
                <View style={{ flex: 1, paddingRight: 10, minWidth: 0 }}>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontWeight: isSelected ? '700' : '600',
                      fontSize: 15,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.label}
                  </Text>
                  <Text
                    level="caption"
                    color="tertiary"
                    style={{ marginTop: 2, lineHeight: 16 }}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.desc}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioIndicator,
                    {
                      borderColor: isSelected
                        ? theme.colors.textPrimary
                        : isDark
                          ? 'rgba(255, 255, 255, 0.25)'
                          : '#D4D4D8',
                      backgroundColor: isSelected ? theme.colors.textPrimary : 'transparent',
                    },
                  ]}
                >
                  {isSelected && <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Confirm / Done Button */}
        <TouchableOpacity
          style={[
            styles.confirmCustomButton,
            {
              backgroundColor: theme.colors.textPrimary,
              marginTop: 16,
              marginBottom: 8,
            },
          ]}
          onPress={() => {
            haptics.notificationSuccess();
            setIsInterestedInModalVisible(false);
            setInterestedInSearchText('');
          }}
          activeOpacity={0.88}
        >
          <Text
            style={{
              color: isDark ? '#000000' : '#FFFFFF',
              fontWeight: '700',
              fontSize: 14,
              fontFamily: folkraFont,
            }}
          >
            Done
          </Text>
        </TouchableOpacity>
      </SmoothBottomSheetModal>
    </View>
  );
}

// ============================================================================
// Styles (Monochromatic, Luxury & Editorial)
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  encircledBackButton: {
    position: 'absolute',
    zIndex: 25,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  glossyTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  glossySheenLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  heroSection: {
    marginBottom: 20,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  stepBadgeInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  stepCurrentText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stepDividerText: {
    fontSize: 13.5,
    fontWeight: '400',
    marginHorizontal: 2,
  },
  stepTotalText: {
    fontSize: 13.5,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  sectionGroup: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    marginBottom: 8,
    paddingLeft: 2,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  cardBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monochromeIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  cardTitleText: {
    fontWeight: '700',
    fontSize: 14,
  },
  monochromeAgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  microNotice: {
    marginTop: 7,
    fontSize: 11.5,
    lineHeight: 16,
  },
  dropdownBox: {
    height: 52,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  securityFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  chooseOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    flexShrink: 0,
  },
  inlineMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5.5,
    borderRadius: 7,
    borderWidth: 1,
    flexShrink: 0,
  },
  cityInputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  cityInputInlineActions: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityInputTrailingAction: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  intentDropdownBox: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intentContentContainer: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
    justifyContent: 'center',
  },
  intentLabelText: {
    fontWeight: '700',
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  intentDescText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2.5,
  },
  intentChevronBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  suggestionsDropdownCard: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  multilineInput: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14.5,
    lineHeight: 21,
  },
  chipsSection: {
    marginTop: 12,
  },
  chipsHeading: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 7,
  },
  inspirationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  fieldInnerRow: {
    marginBottom: 4,
  },
  bottomCtaSection: {
    marginTop: 10,
  },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 36,
    paddingHorizontal: 18,
    zIndex: 30,
  },
  dockGradientBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dockInner: {
    width: '100%',
    alignSelf: 'center',
  },
  professionalCtaButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  professionalCtaText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  selectionOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderBottomWidth: 1,
  },
  radioIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customGenderInputBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  confirmCustomButton: {
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  showOnProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: 1,
    marginTop: 6,
  },
  toggleCapsule: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  ageStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  pickerColumnsRow: {
    flexDirection: 'row',
    height: 180,
    gap: 8,
    marginBottom: 16,
  },
  pickerColumn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerColHeader: {
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  pickerColScroll: {
    flex: 1,
  },
  pickerColScrollContent: {
    paddingVertical: 4,
  },
  pickerItem: {
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemSelected: {
    borderRadius: 8,
    marginHorizontal: 4,
  },
  pickerItemText: {
    fontSize: 14.5,
  },
  modalConfirmBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  mapModalContainer: {
    flex: 1,
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  mapCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  mapSearchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 100,
    position: 'relative',
    backgroundColor: '#0B0B0E',
  },
  mapSearchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  mapSearchTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    paddingVertical: 0,
  },
  mapSuggestionsDropdown: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: '#16161C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    zIndex: 200,
    maxHeight: 220,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  mapSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mapSuggestionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  mapSuggestionPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  mapSuggestionSecondaryText: {
    color: '#9E9EA8',
    fontSize: 11,
    marginTop: 1,
  },
  mapWebViewContainer: {
    flex: 1,
    backgroundColor: '#0B0B0E',
    position: 'relative',
  },
  mapLayerSelectorContainer: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 22, 0.94)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    padding: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 90,
  },
  mapLayerTab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLayerTabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    height: 40,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 3,
  },
  mapLayerTabInactive: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  mapLayerTabTextActive: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 7,
    letterSpacing: -0.2,
  },
  mapFloatingControls: {
    position: 'absolute',
    right: 14,
    top: 72,
    backgroundColor: 'rgba(18, 18, 22, 0.88)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
    zIndex: 90,
  },
  mapFloatingBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFloatingDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  mapWebView: {
    flex: 1,
    backgroundColor: '#0B0B0E',
  },
  mapBottomCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(18, 18, 22, 0.94)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  mapBottomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  mapPinBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mapLocationNameText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    marginTop: 2,
    lineHeight: 20,
  },
  mapConfirmCtaButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapConfirmCtaText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
