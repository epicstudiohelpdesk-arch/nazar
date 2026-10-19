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
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  ChevronDown,
  Check,
  X,
  AlertCircle,
  Search,
  Crosshair,
  Plus,
  Minus,
  Moon,
  Map as MapIcon,
  Satellite,
  Layers,
  Compass,
  Globe,
  Church,
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
// Internet Gender & Community Identity Search Helpers (Context-Enforced)
// ============================================================================

export interface InternetIdentitySuggestion {
  id: string;
  label: string;
  desc: string;
  coreGender: Gender;
}

export const GENDER_IDENTITY_ABBREVIATIONS: Record<string, { label: string; desc: string; core: Gender }[]> = {
  demi: [
    { label: 'Demigirl', desc: 'Partially identifies with womanhood or feminine traits', core: 'NON_BINARY' },
    { label: 'Demiboy', desc: 'Partially identifies with manhood or masculine traits', core: 'NON_BINARY' },
    { label: 'Demigender', desc: 'Non-binary gender identity partially connected to a gender', core: 'NON_BINARY' },
  ],
  enby: [
    { label: 'Non-binary (Enby)', desc: 'Gender identity expanding beyond binary male or female', core: 'NON_BINARY' },
  ],
  nb: [
    { label: 'Non-binary', desc: 'Gender identity expanding beyond binary male or female', core: 'NON_BINARY' },
  ],
  trans: [
    { label: 'Transfeminine', desc: 'Assigned male at birth, identifies with feminine gender spectrum', core: 'WOMAN' },
    { label: 'Transmasculine', desc: 'Assigned female at birth, identifies with masculine gender spectrum', core: 'MAN' },
    { label: 'Transgender Woman', desc: 'Identifies as a woman with transgender lived journey', core: 'WOMAN' },
    { label: 'Transgender Man', desc: 'Identifies as a man with transgender lived journey', core: 'MAN' },
  ],
  transfem: [
    { label: 'Transfeminine', desc: 'Assigned male at birth, identifies with feminine gender spectrum', core: 'WOMAN' },
  ],
  transmasc: [
    { label: 'Transmasculine', desc: 'Assigned female at birth, identifies with masculine gender spectrum', core: 'MAN' },
  ],
  andro: [
    { label: 'Androgyne', desc: 'Blends masculine and feminine gender expressions harmoniously', core: 'NON_BINARY' },
    { label: 'Androgynous', desc: 'Gender expression combining traits outside the binary', core: 'NON_BINARY' },
  ],
  neutro: [
    { label: 'Neutrois', desc: 'A neutral, null, or genderless non-binary identity', core: 'NON_BINARY' },
  ],
  neutrois: [
    { label: 'Neutrois', desc: 'A neutral, null, or genderless non-binary identity', core: 'NON_BINARY' },
  ],
  two: [
    { label: 'Two-Spirit', desc: 'Sacred Indigenous cultural and spiritual gender identity', core: 'NON_BINARY' },
  ],
  '2s': [
    { label: 'Two-Spirit', desc: 'Sacred Indigenous cultural and spiritual gender identity', core: 'NON_BINARY' },
  ],
  gnc: [
    { label: 'Gender Non-Conforming', desc: 'Expresses gender outside traditional societal stereotypes', core: 'NON_BINARY' },
  ],
  inter: [
    { label: 'Intersex', desc: 'Natural biological variations in sex characteristics', core: 'OTHER' },
  ],
  x: [
    { label: 'X-gender', desc: 'Japanese non-binary gender identity definition', core: 'NON_BINARY' },
  ],
  hijra: [
    { label: 'Hijra', desc: 'South Asian cultural third gender community', core: 'OTHER' },
  ],
  faafafine: [
    { label: "Fa'afafine", desc: 'Samoan traditional third gender identity and cultural role', core: 'OTHER' },
  ],
  mahu: [
    { label: 'Māhū', desc: 'Hawaiian and Tahitian traditional third gender role in society', core: 'OTHER' },
  ],
  muxe: [
    { label: 'Muxe', desc: 'Zapotec third gender identity in Oaxaca, Mexico', core: 'OTHER' },
  ],
  fluid: [
    { label: 'Genderfluid', desc: 'Gender identity shifts or fluctuates dynamically over time', core: 'NON_BINARY' },
  ],
  queer: [
    { label: 'Genderqueer', desc: 'Queer expression defying normative social categories', core: 'NON_BINARY' },
  ],
};

const IDENTITY_CONTEXT_KEYWORDS = /\b(gender identity|gender|non-binary|nonbinary|transgender|cisgender|third gender|agender|bigender|pangender|genderfluid|genderqueer|neutrois|androgyne|androgynous|demigender|demiboy|demigirl|two-spirit|intersex|queer identity|two spirit|indigenous gender|cultural gender|hijra|fa'afafine|māhū|muxe|femme|masc|gender expression)\b/i;

const IDENTITY_EXCLUSION_KEYWORDS = /\b(plant|genus|species|film|album|song|music|crustacean|asteroid|insect|beetle|moth|village|commune|town|city|municipality|footballer|actor|actress|singer|musician|politician|cricketer|company|corporation|brand|software|airline|car|automobile|flag|article|book|journal|organization|killing|femicide|archives|museum|podcast|show|episode|hardware|river|lake|mountain|railway|airport)\b/i;

function inferCoreGender(label: string, desc: string): Gender {
  const combined = `${label} ${desc}`.toLowerCase();
  if (/\b(woman|women|female|feminine|girl|transfem|cis female|demigirl)\b/.test(combined)) {
    return 'WOMAN';
  }
  if (/\b(man|men|male|masculine|boy|transmasc|cis male|demiboy)\b/.test(combined)) {
    return 'MAN';
  }
  if (/\b(non-binary|nonbinary|enby|genderfluid|genderqueer|agender|bigender|pangender|neutrois|androgyne|two-spirit)\b/.test(combined)) {
    return 'NON_BINARY';
  }
  return 'OTHER';
}

// ============================================================================
// Intelligent Synonym & Keyword Dictionaries for Instant Local Matching
// ============================================================================

export const GENDER_SYNONYMS_MAP: Record<string, string[]> = {
  woman: ['woman', 'women', 'female', 'females', 'girl', 'girls', 'femme', 'cis woman', 'she/her'],
  man: ['man', 'men', 'male', 'males', 'guy', 'guys', 'masc', 'cis man', 'he/him'],
  non_binary: ['non-binary', 'nonbinary', 'nb', 'enby', 'genderqueer', 'neither', 'they/them', 'neutral'],
  cisgender_woman: ['cisgender woman', 'cis woman', 'cis female', 'cisgender female'],
  cisgender_man: ['cisgender man', 'cis man', 'cis male', 'cisgender male'],
  transgender_woman: ['transgender woman', 'trans woman', 'transfem', 'transfeminine', 'mtf', 'trans female'],
  transgender_man: ['transgender man', 'trans man', 'transmasc', 'transmasculine', 'ftm', 'trans male'],
  genderfluid: ['genderfluid', 'gender fluid', 'fluid', 'fluidity', 'shifting'],
  genderqueer: ['genderqueer', 'gender queer', 'queer', 'non-normative'],
  agender: ['agender', 'genderless', 'null', 'void', 'neutral', 'gender free'],
  bigender: ['bigender', 'bi-gender', 'dual gender', 'two genders'],
  demigirl: ['demigirl', 'demi-girl', 'demiwoman', 'demi female'],
  demiboy: ['demiboy', 'demi-boy', 'demiman', 'demi male'],
  two_spirit: ['two-spirit', 'twospirit', 'two spirit', '2s', 'indigenous gender', 'native'],
  pangender: ['pangender', 'pan gender', 'omnigender', 'all genders'],
  androgynous: ['androgynous', 'androgyne', 'andro', 'gender neutral', 'ambiguous'],
  intersex: ['intersex', 'variations in sex characteristics', 'dsd', 'intersexual'],
  questioning: ['questioning', 'exploring', 'unsure', 'curious', 'discovering'],
  other: ['other', 'self-describe', 'custom', 'unique', 'type my own'],
};

export const INTERESTED_IN_SYNONYMS_MAP: Record<string, string[]> = {
  ...GENDER_SYNONYMS_MAP,
  everyone: [
    'everyone',
    'all',
    'any',
    'anybody',
    'open to all',
    'pansexual',
    'all genders',
    'men and women',
    'both',
    'any gender',
  ],
  woman: ['women', 'woman', 'female', 'females', 'girls', 'femmes', 'she/her', 'lesbian'],
  man: ['men', 'man', 'male', 'males', 'guys', 'mascs', 'he/him', 'gay'],
};

export function rankSearchCandidates<T extends { label: string; desc: string; id: string }>(
  items: T[],
  query: string,
  keywordsMap?: Record<string, string[]>
): T[] {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return items;

  const queryWords = cleanQuery.split(/\s+/).filter(Boolean);
  const scored: { item: T; score: number }[] = [];

  for (const item of items) {
    const labelLower = item.label.toLowerCase();
    const descLower = item.desc.toLowerCase();
    const keywords = (keywordsMap && keywordsMap[item.id]) || [];

    let score = 0;

    // 1. Exact match on label
    if (labelLower === cleanQuery) {
      score += 160;
    }
    // 2. Exact match on keyword (e.g. "nb", "enby", "girls", "trans")
    else if (keywords.some((k) => k === cleanQuery)) {
      score += 140;
    }
    // 3. Label starts with entire query
    else if (labelLower.startsWith(cleanQuery)) {
      score += 100;
    }
    // 4. Word boundary match in label (e.g. "binary" matches "Non-Binary")
    else if (labelLower.split(/[\s\-_()]+/).some((w) => w.startsWith(cleanQuery))) {
      score += 80;
    }
    // 5. Keyword starts with query
    else if (keywords.some((k) => k.startsWith(cleanQuery))) {
      score += 70;
    }
    // 6. Label contains clean query
    else if (labelLower.includes(cleanQuery)) {
      score += 50;
    }
    // 7. Keyword contains query
    else if (keywords.some((k) => k.includes(cleanQuery))) {
      score += 40;
    }
    // 8. Description starts with query or contains query
    else if (descLower.startsWith(cleanQuery)) {
      score += 30;
    } else if (descLower.includes(cleanQuery)) {
      score += 20;
    }

    // Boost if all multi-word query tokens match
    if (queryWords.length > 1) {
      const allTokensMatch = queryWords.every(
        (qw) =>
          labelLower.includes(qw) ||
          descLower.includes(qw) ||
          keywords.some((k) => k.includes(qw))
      );
      if (allTokensMatch) {
        score += 35;
      }
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  // Sort descending by relevance score, ties broken by shorter label length
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.label.length - b.item.label.length;
  });

  return scored.map((s) => s.item);
}

export function getInstantAbbreviationDiscoveries(query: string): InternetIdentitySuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results: InternetIdentitySuggestion[] = [];
  const seen = new Set<string>();

  for (const [key, list] of Object.entries(GENDER_IDENTITY_ABBREVIATIONS)) {
    if (key === q || key.startsWith(q) || q.startsWith(key)) {
      for (const item of list) {
        const canonical = item.label.toLowerCase();
        if (
          !seen.has(canonical) &&
          !MODERN_GENDER_OPTIONS.some((g) => g.label.toLowerCase() === canonical)
        ) {
          seen.add(canonical);
          results.push({
            id: `abbrev_${canonical.replace(/\s+/g, '_')}`,
            label: item.label,
            desc: item.desc,
            coreGender: item.core,
          });
        }
      }
    }
  }
  return results.slice(0, 5);
}

export function getInstantInterestedInDiscoveries(
  query: string,
  existingOptions: InterestedInOption[]
): InterestedInOption[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results: InterestedInOption[] = [];
  const seen = new Set<string>();

  for (const [key, list] of Object.entries(GENDER_IDENTITY_ABBREVIATIONS)) {
    if (key === q || key.startsWith(q) || q.startsWith(key)) {
      for (const item of list) {
        const canonical = item.label.toLowerCase();
        if (
          !seen.has(canonical) &&
          !existingOptions.some((g) => g.label.toLowerCase() === canonical)
        ) {
          seen.add(canonical);
          const formattedLabel =
            item.label.toLowerCase().endsWith('people') ||
            item.label.toLowerCase().endsWith('women') ||
            item.label.toLowerCase().endsWith('men') ||
            item.label.toLowerCase().endsWith('individuals')
              ? item.label
              : `${item.label} People`;
          results.push({
            id: `interest_abbrev_${canonical.replace(/\s+/g, '_')}`,
            label: formattedLabel,
            desc: item.desc,
            coreGender: item.core,
          });
        }
      }
    }
  }
  return results.slice(0, 5);
}

export async function searchOnlineIdentities(
  query: string,
  signal: AbortSignal
): Promise<{ label: string; desc: string; coreGender: Gender }[]> {
  const trimmed = query.trim();
  const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(trimmed)}&language=en&format=json&limit=12`;
  const wpUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed + ' gender identity')}&format=json&srlimit=6`;

  const headers = { 'User-Agent': 'NazarApp/1.0 (contact@nazar.app)' };

  const [wdSettled, wpSettled] = await Promise.allSettled([
    fetch(wikidataUrl, { headers, signal }).then((r) => (r.ok ? r.json() : null)),
    fetch(wpUrl, { headers, signal }).then((r) => (r.ok ? r.json() : null)),
  ]);

  const results: { label: string; desc: string; coreGender: Gender }[] = [];
  const seen = new Set<string>();

  if (wdSettled.status === 'fulfilled' && wdSettled.value?.search) {
    const items = Array.isArray(wdSettled.value.search) ? wdSettled.value.search : [];
    for (const item of items) {
      const rawLabel = item.label || '';
      const rawDesc = item.description || '';
      if (rawLabel.length > 32 || rawLabel.includes(':') || rawLabel.includes('.')) continue;
      if (IDENTITY_EXCLUSION_KEYWORDS.test(rawDesc) || IDENTITY_EXCLUSION_KEYWORDS.test(rawLabel)) continue;
      if (!IDENTITY_CONTEXT_KEYWORDS.test(rawDesc) && !IDENTITY_CONTEXT_KEYWORDS.test(rawLabel)) continue;

      let label = rawLabel
        .replace(/\s*\([^)]*gender[^)]*\)/gi, '')
        .replace(/\s*\(disambiguation\)/gi, '')
        .trim();
      if (label) {
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
      const key = label.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      results.push({
        label,
        desc: rawDesc || 'Gender identity or community expression',
        coreGender: inferCoreGender(label, rawDesc),
      });

      if (results.length >= 6) break;
    }
  }

  if (results.length < 5 && wpSettled.status === 'fulfilled' && wpSettled.value?.query?.search) {
    const wpItems = Array.isArray(wpSettled.value.query.search) ? wpSettled.value.query.search : [];
    for (const item of wpItems) {
      const rawTitle = item.title || '';
      const rawSnippet = (item.snippet || '').replace(/<[^>]+>/g, '');
      if (rawTitle.length > 32 || rawTitle.includes(':') || rawTitle.includes('/')) continue;
      if (IDENTITY_EXCLUSION_KEYWORDS.test(rawTitle)) continue;
      if (!IDENTITY_CONTEXT_KEYWORDS.test(rawSnippet) && !IDENTITY_CONTEXT_KEYWORDS.test(rawTitle)) continue;

      let label = rawTitle
        .replace(/\s*\([^)]*gender[^)]*\)/gi, '')
        .replace(/\s*\(disambiguation\)/gi, '')
        .trim();
      if (label) {
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
      const key = label.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      results.push({
        label,
        desc: rawSnippet.slice(0, 75).trim() + '...',
        coreGender: inferCoreGender(label, rawSnippet),
      });

      if (results.length >= 6) break;
    }
  }

  return results;
}

// ============================================================================
// Religion & Beliefs Definitions & Internet Search Helpers (Context-Enforced)
// ============================================================================

export interface ReligionOption {
  id: string;
  label: string;
  desc: string;
}

export const RELIGION_OPTIONS: ReligionOption[] = [
  {
    id: 'agnostic',
    label: 'Agnostic',
    desc: 'Open-minded; believes ultimate reality or truth is unknown',
  },
  {
    id: 'atheist',
    label: 'Atheist',
    desc: 'Does not subscribe to belief in divine beings or deities',
  },
  {
    id: 'buddhist',
    label: 'Buddhist',
    desc: 'Practices mindfulness, compassion, and Buddhist dharma',
  },
  {
    id: 'catholic',
    label: 'Catholic',
    desc: 'Practices Roman Catholicism or Catholic sacramental traditions',
  },
  {
    id: 'christian',
    label: 'Christian',
    desc: 'Follows Jesus Christ and biblical teachings across traditions',
  },
  {
    id: 'hindu',
    label: 'Hindu',
    desc: 'Practices Sanatana Dharma, karma, and philosophical traditions',
  },
  {
    id: 'jain',
    label: 'Jain',
    desc: 'Follows Ahimsa (non-violence) and Jain spiritual path',
  },
  {
    id: 'jewish',
    label: 'Jewish',
    desc: 'Identifies with Judaism, covenant, and Jewish heritage',
  },
  {
    id: 'muslim',
    label: 'Muslim',
    desc: 'Follows Islam, Quranic teachings, and spiritual devotion',
  },
  {
    id: 'sikh',
    label: 'Sikh',
    desc: 'Follows Guru Granth Sahib, seva, and Sikh teachings',
  },
  {
    id: 'spiritual',
    label: 'Spiritual',
    desc: 'Connected to universal oneness beyond organized religion',
  },
  {
    id: 'daoist',
    label: 'Daoist / Taoist',
    desc: 'Follows the Dao, natural flow, and cosmic balance',
  },
  {
    id: 'shinto',
    label: 'Shinto',
    desc: 'Traditional Japanese spirituality honoring kami and nature',
  },
  {
    id: 'zoroastrian',
    label: 'Zoroastrian / Parsi',
    desc: 'Practices Good Thoughts, Good Words, and Good Deeds',
  },
  {
    id: 'bahai',
    label: "Bahá'í",
    desc: 'Believes in the spiritual unity of all humankind',
  },
  {
    id: 'pagan',
    label: 'Pagan / Earth-Based',
    desc: 'Honors nature cycles, animism, or polytheistic traditions',
  },
  {
    id: 'humanist',
    label: 'Humanist',
    desc: 'Guided by reason, human ethics, and universal empathy',
  },
  {
    id: 'indigenous',
    label: 'Indigenous / Ancestral',
    desc: 'Practices native ancestral traditions and earth stewardship',
  },
  {
    id: 'prefer_not_to_say',
    label: 'Prefer not to say',
    desc: 'Keeps faith and worldview private on profile',
  },
  {
    id: 'other',
    label: 'Other',
    desc: 'Self-describe your unique spiritual or philosophical worldview',
  },
];

export const RELIGION_SYNONYMS_MAP: Record<string, string[]> = {
  agnostic: ['agnostic', 'agnosticism', 'undecided', 'skeptic', 'questioning', 'unsure'],
  atheist: ['atheist', 'atheism', 'non-religious', 'secular', 'nonbeliever', 'godless', 'materialist'],
  buddhist: ['buddhist', 'buddhism', 'dharma', 'zen', 'theravada', 'mahayana', 'tibetan', 'vipassana'],
  catholic: ['catholic', 'catholicism', 'roman catholic', 'latin rite', 'papal', 'jesuit', 'franciscan'],
  christian: [
    'christian',
    'christianity',
    'protestant',
    'orthodox',
    'eastern orthodox',
    'evangelical',
    'baptist',
    'lutheran',
    'methodist',
    'pentecostal',
    'anglican',
    'presbyterian',
    'episcopal',
    'born again',
    'church of christ',
    'adventist',
  ],
  hindu: [
    'hindu',
    'hinduism',
    'sanatana dharma',
    'vedic',
    'vaishnav',
    'shaivite',
    'shakta',
    'advaita',
    'brahmin',
    'iskcon',
    'krishna',
    'shiva',
  ],
  jain: ['jain', 'jainism', 'ahimsa', 'digambara', 'shvetambara', 'tirthankara', 'mahavira'],
  jewish: [
    'jewish',
    'judaism',
    'jew',
    'orthodox jew',
    'reform jew',
    'conservative jew',
    'hasidic',
    'hebrew',
    'torah',
    'kabbalah',
  ],
  muslim: [
    'muslim',
    'islam',
    'islamic',
    'sunni',
    'shia',
    'sufi',
    'ahmadi',
    'deobandi',
    'quran',
    'hanafi',
    'shafii',
    'maliki',
    'hanbali',
    'ismaili',
    'ibadi',
  ],
  sikh: ['sikh', 'sikhism', 'khalsa', 'gurdwara', 'sardar', 'waheguru', 'guru nanak', 'singh', 'kaur'],
  spiritual: [
    'spiritual',
    'spirituality',
    'spiritual but not religious',
    'sbnr',
    'new age',
    'mystic',
    'cosmic',
    'universe',
    'astrology',
    'energy',
  ],
  daoist: ['daoist', 'taoist', 'daoism', 'taoism', 'yin yang', 'laozi', 'daodejing'],
  shinto: ['shinto', 'kami', 'shintoism', 'jinja'],
  zoroastrian: ['zoroastrian', 'zoroastrianism', 'parsi', 'mazdayasna', 'zarathustra', 'ahura mazda'],
  bahai: ['bahai', "baha'i", 'bahaism', 'baha faith', 'abdu-l-baha', 'bahaullah'],
  pagan: ['pagan', 'wicca', 'wiccan', 'heathen', 'polytheist', 'animist', 'druid', 'hellenist', 'norse'],
  humanist: ['humanist', 'humanism', 'secular humanist', 'rationalist', 'freethinker', 'ethical culture'],
  indigenous: ['indigenous', 'traditional', 'folk religion', 'ancestral', 'animism', 'tribal', 'native american', 'aboriginal'],
  prefer_not_to_say: ['prefer not to say', 'private', 'unspecified', 'skip', 'none of your business', 'hidden', 'pass'],
  other: ['other', 'self-describe', 'custom', 'unique', 'type my own', 'eclectic'],
};

export interface InterestedInReligionOption {
  id: string;
  label: string;
  desc: string;
}

export const INTERESTED_IN_RELIGION_OPTIONS: InterestedInReligionOption[] = [
  {
    id: 'all',
    label: 'Open to All Religions',
    desc: 'Open to connecting with people of any faith, spiritual path, or worldview',
  },
  ...RELIGION_OPTIONS.filter((r) => r.id !== 'prefer_not_to_say' && r.id !== 'other'),
  {
    id: 'other',
    label: 'Other Traditions',
    desc: 'Open to specific unique philosophies, paths, or beliefs',
  },
];

export const INTERESTED_IN_RELIGION_SYNONYMS_MAP: Record<string, string[]> = {
  ...RELIGION_SYNONYMS_MAP,
  all: [
    'all',
    'any',
    'everyone',
    'open to all',
    'all religions',
    'any religion',
    'all faiths',
    'any faith',
    'everything',
    'no preference',
    'open-minded',
  ],
};

export const RELIGION_ABBREVIATIONS: Record<string, { label: string; desc: string }[]> = {
  sbnr: [
    { label: 'Spiritual but not religious', desc: 'Personal spirituality without organized religion' },
  ],
  rc: [
    { label: 'Roman Catholic', desc: 'Practices Catholic faith in communion with the Pope' },
  ],
  eo: [
    { label: 'Eastern Orthodox', desc: 'Christian tradition rooted in Eastern church history' },
  ],
  lds: [
    { label: 'Latter-day Saint (Mormon)', desc: 'Christian restorationist movement and Book of Mormon' },
  ],
  jw: [
    { label: "Jehovah's Witness", desc: 'Millenarian Christian denomination with distinct beliefs' },
  ],
  uu: [
    { label: 'Unitarian Universalist', desc: 'Inclusive religious movement dedicated to freedom of belief' },
  ],
  quaker: [
    { label: 'Quaker (Friend)', desc: 'Religious Society of Friends valuing inner light and simplicity' },
  ],
  rasta: [
    { label: 'Rastafari', desc: 'Spiritual and cultural movement honoring Haile Selassie' },
  ],
  deist: [
    { label: 'Deist', desc: 'Belief in a creator based on reason, nature, and observation' },
  ],
  pantheist: [
    { label: 'Pantheist', desc: 'Belief that the universe and reality are identical with divinity' },
  ],
};

export const RELIGION_CONTEXT_KEYWORDS =
  /(religion|faith|belief|spiritual|church|theism|theology|mosque|temple|tradition|philosophy|movement|sect|denomination|creed|worldview|monotheis|polytheis|dharma|pantheis|order|god|deity)/i;

export const RELIGION_EXCLUSION_KEYWORDS =
  /(album|song|film|movie|discography|episode|village|town|football|cricket|railway|band|character|novel|actor|singer|track|single|stadium)/i;

export function getInstantReligionDiscoveries(
  query: string
): { id: string; label: string; desc: string }[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results: { id: string; label: string; desc: string }[] = [];
  const seen = new Set<string>();

  for (const [key, list] of Object.entries(RELIGION_ABBREVIATIONS)) {
    if (key === q || key.startsWith(q) || q.startsWith(key)) {
      for (const item of list) {
        const canonical = item.label.toLowerCase();
        if (
          !seen.has(canonical) &&
          !RELIGION_OPTIONS.some((r) => r.label.toLowerCase() === canonical)
        ) {
          seen.add(canonical);
          results.push({
            id: `religion_abbrev_${canonical.replace(/\s+/g, '_')}`,
            label: item.label,
            desc: item.desc,
          });
        }
      }
    }
  }
  return results.slice(0, 5);
}

export async function searchOnlineReligions(
  query: string,
  signal: AbortSignal
): Promise<{ label: string; desc: string }[]> {
  const trimmed = query.trim();
  const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(trimmed)}&language=en&format=json&limit=12`;
  const wpUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed + ' religion faith')}&format=json&srlimit=6`;

  const headers = { 'User-Agent': 'NazarApp/1.0 (contact@nazar.app)' };

  const [wdSettled, wpSettled] = await Promise.allSettled([
    fetch(wikidataUrl, { headers, signal }).then((r) => (r.ok ? r.json() : null)),
    fetch(wpUrl, { headers, signal }).then((r) => (r.ok ? r.json() : null)),
  ]);

  const results: { label: string; desc: string }[] = [];
  const seen = new Set<string>();

  if (wdSettled.status === 'fulfilled' && wdSettled.value?.search) {
    const items = Array.isArray(wdSettled.value.search) ? wdSettled.value.search : [];
    for (const item of items) {
      const rawLabel = item.label || '';
      const rawDesc = item.description || '';
      if (rawLabel.length > 36 || rawLabel.includes(':') || rawLabel.includes('.')) continue;
      if (RELIGION_EXCLUSION_KEYWORDS.test(rawDesc) || RELIGION_EXCLUSION_KEYWORDS.test(rawLabel)) continue;
      if (!RELIGION_CONTEXT_KEYWORDS.test(rawDesc) && !RELIGION_CONTEXT_KEYWORDS.test(rawLabel)) continue;

      let label = rawLabel
        .replace(/\s*\([^)]*religion[^)]*\)/gi, '')
        .replace(/\s*\(disambiguation\)/gi, '')
        .trim();
      if (label) {
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
      const key = label.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      results.push({
        label,
        desc: rawDesc || 'Religious tradition or philosophical worldview',
      });

      if (results.length >= 6) break;
    }
  }

  if (results.length < 5 && wpSettled.status === 'fulfilled' && wpSettled.value?.query?.search) {
    const wpItems = Array.isArray(wpSettled.value.query.search) ? wpSettled.value.query.search : [];
    for (const item of wpItems) {
      const rawTitle = item.title || '';
      const rawSnippet = (item.snippet || '').replace(/<[^>]+>/g, '');
      if (rawTitle.length > 36 || rawTitle.includes(':') || rawTitle.includes('/')) continue;
      if (RELIGION_EXCLUSION_KEYWORDS.test(rawTitle)) continue;
      if (!RELIGION_CONTEXT_KEYWORDS.test(rawSnippet) && !RELIGION_CONTEXT_KEYWORDS.test(rawTitle)) continue;

      let label = rawTitle
        .replace(/\s*\([^)]*religion[^)]*\)/gi, '')
        .replace(/\s*\(disambiguation\)/gi, '')
        .trim();
      if (label) {
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
      const key = label.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      results.push({
        label,
        desc: rawSnippet.slice(0, 75).trim() + '...',
      });

      if (results.length >= 6) break;
    }
  }

  return results;
}

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
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const isFromReview = returnTo === 'preview';
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

  // Monochromatic typography hierarchy:
  // 1. Section Headings: Pure white (#FFFFFF)
  // 2. Top-Left Field Labels: Lighter shade of grey (#D4D4D8)
  // 3. Inside Field Values: Less light than label (#A1A1AA)
  // 4. Field Icons: Fixed greyish (#78716C / textTertiary) matching FULL NAME default icon
  const sectionHeaderColor = isDark ? '#FFFFFF' : theme.colors.textPrimary;
  const fieldHeaderLabelColor = isDark ? '#D4D4D8' : '#27272A';
  const fieldInputTextColor = isDark ? '#A1A1AA' : '#52525B';
  const fieldIconColor = theme.colors.textTertiary;

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
  const [isSearchingGenderInternet, setIsSearchingGenderInternet] = useState(false);
  const [internetGenderSuggestions, setInternetGenderSuggestions] = useState<InternetIdentitySuggestion[]>([]);
  const genderSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isInterestedInModalVisible, setIsInterestedInModalVisible] = useState(false);
  const [interestedInSearchText, setInterestedInSearchText] = useState('');
  const [isSearchingInterestedInInternet, setIsSearchingInterestedInInternet] = useState(false);
  const [internetInterestedInSuggestions, setInternetInterestedInSuggestions] = useState<InterestedInOption[]>([]);
  const [customInterestedInOptions, setCustomInterestedInOptions] = useState<InterestedInOption[]>([]);
  const interestedInSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interestedInSearchInputRef = useRef<RNTextInput>(null);

  // Fast In-Memory Query Caches (0ms turnaround for repeated queries)
  const genderSearchCache = useRef(new Map<string, InternetIdentitySuggestion[]>()).current;
  const interestedInSearchCache = useRef(new Map<string, InterestedInOption[]>()).current;
  const genderAbortRef = useRef<AbortController | null>(null);
  const interestedInAbortRef = useRef<AbortController | null>(null);

  // Religion & Worldview State
  const [religion, setReligion] = useState<string>(draftProfile.religion || '');
  const [selectedReligionId, setSelectedReligionId] = useState<string>(() => {
    if (draftProfile.religion) {
      const match = RELIGION_OPTIONS.find(
        (r) => r.label.toLowerCase() === draftProfile.religion?.toLowerCase()
      );
      if (match) return match.id;
      return 'other';
    }
    return '';
  });
  const [customReligionText, setCustomReligionText] = useState<string>(() => {
    if (draftProfile.religion) {
      const match = RELIGION_OPTIONS.find(
        (r) => r.label.toLowerCase() === draftProfile.religion?.toLowerCase()
      );
      if (!match) return draftProfile.religion;
    }
    return '';
  });
  const [isReligionModalVisible, setIsReligionModalVisible] = useState(false);
  const [religionSearchText, setReligionSearchText] = useState('');
  const [isSearchingReligionInternet, setIsSearchingReligionInternet] = useState(false);
  const [internetReligionSuggestions, setInternetReligionSuggestions] = useState<
    { id: string; label: string; desc: string }[]
  >([]);
  const [showReligionOnProfile, setShowReligionOnProfile] = useState(true);
  const religionSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const religionSearchInputRef = useRef<RNTextInput>(null);
  const religionSearchCache = useRef(
    new Map<string, { id: string; label: string; desc: string }[]>()
  ).current;
  const religionAbortRef = useRef<AbortController | null>(null);

  // Open To Religions (Religious Preference) State
  const [selectedInterestedInReligionIds, setSelectedInterestedInReligionIds] = useState<string[]>(
    () => {
      if (draftProfile.interestedInReligions && draftProfile.interestedInReligions.length > 0) {
        return draftProfile.interestedInReligions;
      }
      if (draftPreferences.religionPreferences && draftPreferences.religionPreferences.length > 0) {
        return draftPreferences.religionPreferences;
      }
      return ['all'];
    }
  );
  const [isInterestedInReligionModalVisible, setIsInterestedInReligionModalVisible] = useState(false);
  const [interestedInReligionSearchText, setInterestedInReligionSearchText] = useState('');
  const [isSearchingInterestedInReligionInternet, setIsSearchingInterestedInReligionInternet] = useState(false);
  const [internetInterestedInReligionSuggestions, setInternetInterestedInReligionSuggestions] = useState<
    { id: string; label: string; desc: string }[]
  >([]);
  const [customInterestedInReligionOptions, setCustomInterestedInReligionOptions] = useState<
    { id: string; label: string; desc: string }[]
  >([]);
  const interestedInReligionSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interestedInReligionSearchInputRef = useRef<RNTextInput>(null);
  const interestedInReligionSearchCache = useRef(
    new Map<string, { id: string; label: string; desc: string }[]>()
  ).current;
  const interestedInReligionAbortRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    return () => {
      genderAbortRef.current?.abort();
      interestedInAbortRef.current?.abort();
      religionAbortRef.current?.abort();
      interestedInReligionAbortRef.current?.abort();
      if (genderSearchDebounceRef.current) clearTimeout(genderSearchDebounceRef.current);
      if (interestedInSearchDebounceRef.current) clearTimeout(interestedInSearchDebounceRef.current);
      if (religionSearchDebounceRef.current) clearTimeout(religionSearchDebounceRef.current);
      if (interestedInReligionSearchDebounceRef.current) clearTimeout(interestedInReligionSearchDebounceRef.current);
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
  const bioInputRef = useRef<RNTextInput>(null);
  const occupationInputRef = useRef<RNTextInput>(null);
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

  // Instantly deselects any active text field and clears its focused highlight state
  const dismissActiveField = useCallback(() => {
    setFocusedField(null);
    nameInputRef.current?.blur();
    cityInputRef.current?.blur();
    bioInputRef.current?.blur();
    occupationInputRef.current?.blur();
    educationInputRef.current?.blur();
    Keyboard.dismiss();
    setShowSuggestionsDropdown(false);
    setShowEducationDropdown(false);
  }, []);

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

  const allInterestedInOptions = useMemo<InterestedInOption[]>(() => {
    const combined = [...INTERESTED_IN_OPTIONS];
    for (const opt of customInterestedInOptions) {
      if (!combined.some((c) => c.id === opt.id)) {
        combined.push(opt);
      }
    }
    return combined;
  }, [customInterestedInOptions]);

  const selectedCoreGenders = useMemo<Gender[]>(() => {
    if (selectedInterestedInIds.includes('everyone')) {
      return ['OTHER'];
    }
    const coreSet = new Set<Gender>();
    selectedInterestedInIds.forEach((id) => {
      const found = allInterestedInOptions.find((opt) => opt.id === id);
      if (found) {
        coreSet.add(found.coreGender);
      }
    });
    return coreSet.size > 0 ? Array.from(coreSet) : ['OTHER'];
  }, [selectedInterestedInIds, allInterestedInOptions]);

  const filteredInterestedInOptions = useMemo(() => {
    return rankSearchCandidates(
      allInterestedInOptions,
      interestedInSearchText,
      INTERESTED_IN_SYNONYMS_MAP
    );
  }, [interestedInSearchText, allInterestedInOptions]);

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
      const match = allInterestedInOptions.find((o) => o.id === selectedInterestedInIds[0]);
      return match ? match.label : 'Everyone (Open to All)';
    }
    if (selectedInterestedInIds.length === 2) {
      const m1 = allInterestedInOptions.find((o) => o.id === selectedInterestedInIds[0]);
      const m2 = allInterestedInOptions.find((o) => o.id === selectedInterestedInIds[1]);
      if (m1 && m2) return `${m1.label} & ${m2.label}`;
    }
    const m1 = allInterestedInOptions.find((o) => o.id === selectedInterestedInIds[0]);
    if (m1) {
      return `${m1.label} +${selectedInterestedInIds.length - 1} more`;
    }
    return 'Everyone (Open to All)';
  }, [selectedInterestedInIds, allInterestedInOptions]);

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

  const activeReligionLabel = useMemo(() => {
    if (selectedReligionId === 'other') {
      return customReligionText.trim() || 'Other (self-described)';
    }
    const found = RELIGION_OPTIONS.find((r) => r.id === selectedReligionId);
    if (found) return found.label;
    if (religion) return religion;
    return 'Select religion or beliefs';
  }, [selectedReligionId, customReligionText, religion]);

  // Filtered genders for search modal with relevance ranking & synonym matching
  const filteredGenders = useMemo(() => {
    return rankSearchCandidates(
      MODERN_GENDER_OPTIONS,
      genderSearchText,
      GENDER_SYNONYMS_MAP
    );
  }, [genderSearchText]);

  // Filtered religions for search modal with relevance ranking & synonym matching
  const filteredReligions = useMemo(() => {
    return rankSearchCandidates(
      RELIGION_OPTIONS,
      religionSearchText,
      RELIGION_SYNONYMS_MAP
    );
  }, [religionSearchText]);

  const allInterestedInReligionOptions = useMemo<InterestedInReligionOption[]>(() => {
    const combined = [...INTERESTED_IN_RELIGION_OPTIONS];
    for (const opt of customInterestedInReligionOptions) {
      if (!combined.some((c) => c.id === opt.id)) {
        combined.push(opt);
      }
    }
    return combined;
  }, [customInterestedInReligionOptions]);

  const activeInterestedInReligionLabel = useMemo(() => {
    if (selectedInterestedInReligionIds.includes('all')) {
      return 'Open to All Religions';
    }
    if (selectedInterestedInReligionIds.length === 1) {
      const match = allInterestedInReligionOptions.find(
        (o) => o.id === selectedInterestedInReligionIds[0]
      );
      return match ? match.label : 'Open to All Religions';
    }
    if (selectedInterestedInReligionIds.length === 2) {
      const m1 = allInterestedInReligionOptions.find(
        (o) => o.id === selectedInterestedInReligionIds[0]
      );
      const m2 = allInterestedInReligionOptions.find(
        (o) => o.id === selectedInterestedInReligionIds[1]
      );
      if (m1 && m2) return `${m1.label} & ${m2.label}`;
    }
    const m1 = allInterestedInReligionOptions.find(
      (o) => o.id === selectedInterestedInReligionIds[0]
    );
    if (m1) {
      return `${m1.label} +${selectedInterestedInReligionIds.length - 1} more`;
    }
    return 'Open to All Religions';
  }, [selectedInterestedInReligionIds, allInterestedInReligionOptions]);

  const filteredInterestedInReligionOptions = useMemo(() => {
    return rankSearchCandidates(
      allInterestedInReligionOptions,
      interestedInReligionSearchText,
      INTERESTED_IN_RELIGION_SYNONYMS_MAP
    );
  }, [interestedInReligionSearchText, allInterestedInReligionOptions]);

  const toggleInterestedInReligionId = (id: string) => {
    haptics.selection();
    if (id === 'all') {
      setSelectedInterestedInReligionIds(['all']);
      return;
    }

    let updated: string[];
    if (selectedInterestedInReligionIds.includes('all')) {
      updated = [id];
    } else if (selectedInterestedInReligionIds.includes(id)) {
      if (selectedInterestedInReligionIds.length <= 1) {
        updated = ['all'];
      } else {
        updated = selectedInterestedInReligionIds.filter((item) => item !== id);
      }
    } else {
      updated = [...selectedInterestedInReligionIds, id];
    }
    setSelectedInterestedInReligionIds(updated);
  };

  // ============================================================================
  // High-Efficiency Search Handlers with Caching & Cancellation
  // ============================================================================

  const handleGenderSearchTextChange = useCallback(
    (text: string) => {
      setGenderSearchText(text);

      if (genderSearchDebounceRef.current) {
        clearTimeout(genderSearchDebounceRef.current);
      }
      genderAbortRef.current?.abort();

      const trimmed = text.trim();
      if (trimmed.length < 2) {
        setInternetGenderSuggestions([]);
        setIsSearchingGenderInternet(false);
        return;
      }

      const lower = trimmed.toLowerCase();

      // 1. Instant Fast-Path: immediately populate matching abbreviations (0ms latency)
      const instantDiscoveries = getInstantAbbreviationDiscoveries(lower);
      if (instantDiscoveries.length > 0) {
        setInternetGenderSuggestions(instantDiscoveries);
      }

      // 2. In-memory query cache check (0ms turnaround)
      if (genderSearchCache.has(lower)) {
        const cached = genderSearchCache.get(lower)!;
        setInternetGenderSuggestions(cached);
        setIsSearchingGenderInternet(false);
        return;
      }

      // 3. Debounced concurrent online search (snappy 200ms)
      setIsSearchingGenderInternet(true);
      genderSearchDebounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        genderAbortRef.current = controller;

        try {
          const raw = await searchOnlineIdentities(trimmed, controller.signal);
          if (controller.signal.aborted) return;

          const combined = [...instantDiscoveries];
          const seen = new Set(combined.map((c) => c.label.toLowerCase()));
          MODERN_GENDER_OPTIONS.forEach((g) => seen.add(g.label.toLowerCase()));

          for (const item of raw) {
            const key = item.label.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              combined.push({
                id: `wd_${key.replace(/\s+/g, '_')}`,
                label: item.label,
                desc: item.desc,
                coreGender: item.coreGender,
              });
            }
            if (combined.length >= 6) break;
          }

          if (genderSearchCache.size > 60) genderSearchCache.clear();
          genderSearchCache.set(lower, combined);
          setInternetGenderSuggestions(combined);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
        } finally {
          if (!controller.signal.aborted) {
            setIsSearchingGenderInternet(false);
          }
        }
      }, 200);
    },
    [genderSearchCache]
  );

  const handleSelectInternetGender = (item: InternetIdentitySuggestion) => {
    haptics.selection();
    const existing = MODERN_GENDER_OPTIONS.find(
      (g) => g.label.toLowerCase() === item.label.toLowerCase()
    );
    if (existing && existing.id !== 'other') {
      setSelectedGenderId(existing.id);
    } else {
      setSelectedGenderId('other');
      setCustomGenderText(item.label);
    }
    setIsGenderModalVisible(false);
    if (genderSearchDebounceRef.current) clearTimeout(genderSearchDebounceRef.current);
    genderAbortRef.current?.abort();
    setGenderSearchText('');
    setInternetGenderSuggestions([]);
  };

  const handleInterestedInSearchTextChange = useCallback(
    (text: string) => {
      setInterestedInSearchText(text);

      if (interestedInSearchDebounceRef.current) {
        clearTimeout(interestedInSearchDebounceRef.current);
      }
      interestedInAbortRef.current?.abort();

      const trimmed = text.trim();
      if (trimmed.length < 2) {
        setInternetInterestedInSuggestions([]);
        setIsSearchingInterestedInInternet(false);
        return;
      }

      const lower = trimmed.toLowerCase();

      // 1. Instant Fast-Path: immediately populate matching abbreviations (0ms latency)
      const instantDiscoveries = getInstantInterestedInDiscoveries(lower, allInterestedInOptions);
      if (instantDiscoveries.length > 0) {
        setInternetInterestedInSuggestions(instantDiscoveries);
      }

      // 2. In-memory query cache check (0ms turnaround)
      if (interestedInSearchCache.has(lower)) {
        const cached = interestedInSearchCache.get(lower)!;
        setInternetInterestedInSuggestions(cached);
        setIsSearchingInterestedInInternet(false);
        return;
      }

      // 3. Debounced concurrent online search (snappy 200ms)
      setIsSearchingInterestedInInternet(true);
      interestedInSearchDebounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        interestedInAbortRef.current = controller;

        try {
          const raw = await searchOnlineIdentities(trimmed, controller.signal);
          if (controller.signal.aborted) return;

          const combined = [...instantDiscoveries];
          const seen = new Set(combined.map((c) => c.label.toLowerCase()));
          allInterestedInOptions.forEach((g) => seen.add(g.label.toLowerCase()));

          for (const item of raw) {
            const formattedLabel =
              item.label.toLowerCase().endsWith('people') ||
              item.label.toLowerCase().endsWith('women') ||
              item.label.toLowerCase().endsWith('men') ||
              item.label.toLowerCase().endsWith('individuals')
                ? item.label
                : `${item.label} People`;

            const key = formattedLabel.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              combined.push({
                id: `interest_wd_${key.replace(/\s+/g, '_')}`,
                label: formattedLabel,
                desc: item.desc || 'Gender identity or community discovered online',
                coreGender: item.coreGender,
              });
            }
            if (combined.length >= 6) break;
          }

          if (interestedInSearchCache.size > 60) interestedInSearchCache.clear();
          interestedInSearchCache.set(lower, combined);
          setInternetInterestedInSuggestions(combined);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
        } finally {
          if (!controller.signal.aborted) {
            setIsSearchingInterestedInInternet(false);
          }
        }
      }, 200);
    },
    [allInterestedInOptions, interestedInSearchCache]
  );

  const handleSelectInternetInterestedIn = (item: InterestedInOption) => {
    if (!customInterestedInOptions.some((c) => c.id === item.id)) {
      setCustomInterestedInOptions((prev) => [...prev, item]);
    }
    toggleInterestedInId(item.id);
  };

  const handleReligionSearchTextChange = useCallback(
    (text: string) => {
      setReligionSearchText(text);

      if (religionSearchDebounceRef.current) {
        clearTimeout(religionSearchDebounceRef.current);
      }
      religionAbortRef.current?.abort();

      const trimmed = text.trim();
      if (trimmed.length < 2) {
        setInternetReligionSuggestions([]);
        setIsSearchingReligionInternet(false);
        return;
      }

      // 1. Instant abbreviation discoveries (0ms turnaround)
      const instantDiscoveries = getInstantReligionDiscoveries(trimmed);
      if (instantDiscoveries.length > 0) {
        setInternetReligionSuggestions(instantDiscoveries);
      }

      // 2. Check in-memory cache
      const lower = trimmed.toLowerCase();
      if (religionSearchCache.has(lower)) {
        setInternetReligionSuggestions(religionSearchCache.get(lower)!);
        setIsSearchingReligionInternet(false);
        return;
      }

      // 3. Debounced concurrent web fetch (Wikidata + Wikipedia)
      setIsSearchingReligionInternet(true);
      religionSearchDebounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        religionAbortRef.current = controller;

        try {
          const webItems = await searchOnlineReligions(trimmed, controller.signal);
          if (controller.signal.aborted) return;

          const combined: { id: string; label: string; desc: string }[] = [...instantDiscoveries];
          for (const item of webItems) {
            const existsInPreset = RELIGION_OPTIONS.some(
              (r) => r.label.toLowerCase() === item.label.toLowerCase()
            );
            const existsInCombined = combined.some(
              (c) => c.label.toLowerCase() === item.label.toLowerCase()
            );
            if (!existsInPreset && !existsInCombined) {
              combined.push({
                id: `web_rel_${item.label.toLowerCase().replace(/\s+/g, '_')}`,
                label: item.label,
                desc: item.desc || 'Worldview or tradition discovered online',
              });
            }
            if (combined.length >= 6) break;
          }

          if (religionSearchCache.size > 60) religionSearchCache.clear();
          religionSearchCache.set(lower, combined);
          setInternetReligionSuggestions(combined);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
        } finally {
          if (!controller.signal.aborted) {
            setIsSearchingReligionInternet(false);
          }
        }
      }, 200);
    },
    [religionSearchCache]
  );

  const handleSelectReligion = (item: ReligionOption) => {
    haptics.selection();
    setSelectedReligionId(item.id);
    if (item.id === 'other') {
      // Allow custom input
    } else {
      setReligion(item.label);
      setIsReligionModalVisible(false);
      setReligionSearchText('');
      setInternetReligionSuggestions([]);
      setIsSearchingReligionInternet(false);
    }
  };

  const handleSelectInternetReligion = (item: { id: string; label: string; desc: string }) => {
    haptics.selection();
    setSelectedReligionId('other');
    setCustomReligionText(item.label);
    setReligion(item.label);
    setIsReligionModalVisible(false);
    setReligionSearchText('');
    setInternetReligionSuggestions([]);
    setIsSearchingReligionInternet(false);
  };

  const handleInterestedInReligionSearchTextChange = useCallback(
    (text: string) => {
      setInterestedInReligionSearchText(text);

      if (interestedInReligionSearchDebounceRef.current) {
        clearTimeout(interestedInReligionSearchDebounceRef.current);
      }
      interestedInReligionAbortRef.current?.abort();

      const trimmed = text.trim();
      if (trimmed.length < 2) {
        setInternetInterestedInReligionSuggestions([]);
        setIsSearchingInterestedInReligionInternet(false);
        return;
      }

      // 1. Instant abbreviation lookup
      const instantDiscoveries = getInstantReligionDiscoveries(trimmed);
      if (instantDiscoveries.length > 0) {
        setInternetInterestedInReligionSuggestions(instantDiscoveries);
      }

      // 2. Check in-memory cache
      const lower = trimmed.toLowerCase();
      if (interestedInReligionSearchCache.has(lower)) {
        setInternetInterestedInReligionSuggestions(
          interestedInReligionSearchCache.get(lower)!
        );
        setIsSearchingInterestedInReligionInternet(false);
        return;
      }

      // 3. Debounced concurrent web fetch
      setIsSearchingInterestedInReligionInternet(true);
      interestedInReligionSearchDebounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        interestedInReligionAbortRef.current = controller;

        try {
          const webItems = await searchOnlineReligions(trimmed, controller.signal);
          if (controller.signal.aborted) return;

          const combined: { id: string; label: string; desc: string }[] = [
            ...instantDiscoveries,
          ];
          for (const item of webItems) {
            const existsInPreset = allInterestedInReligionOptions.some(
              (r) => r.label.toLowerCase() === item.label.toLowerCase()
            );
            const existsInCombined = combined.some(
              (c) => c.label.toLowerCase() === item.label.toLowerCase()
            );
            if (!existsInPreset && !existsInCombined) {
              combined.push({
                id: `rel_interest_${item.label.toLowerCase().replace(/\s+/g, '_')}`,
                label: item.label,
                desc: item.desc || 'Tradition or worldview discovered online',
              });
            }
            if (combined.length >= 6) break;
          }

          if (interestedInReligionSearchCache.size > 60)
            interestedInReligionSearchCache.clear();
          interestedInReligionSearchCache.set(lower, combined);
          setInternetInterestedInReligionSuggestions(combined);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
        } finally {
          if (!controller.signal.aborted) {
            setIsSearchingInterestedInReligionInternet(false);
          }
        }
      }, 200);
    },
    [allInterestedInReligionOptions, interestedInReligionSearchCache]
  );

  const handleSelectInternetInterestedInReligion = (item: {
    id: string;
    label: string;
    desc: string;
  }) => {
    if (!customInterestedInReligionOptions.some((c) => c.id === item.id)) {
      setCustomInterestedInReligionOptions((prev) => [...prev, item]);
    }
    toggleInterestedInReligionId(item.id);
  };

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
    dismissActiveField();
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
    dismissActiveField();
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
    dismissActiveField();
    haptics.impactLight();
    if (isFromReview) {
      router.replace('/(onboarding)/preview');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleOpenDatePicker = () => {
    dismissActiveField();
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
    dismissActiveField();
    const formattedDob = dateOfBirth.toISOString().split('T')[0];
    const coreGender = activeGenderOption.coreGender;
    const finalGenderIdentity = activeGenderLabel;
    const finalReligion =
      selectedReligionId === 'other'
        ? customReligionText.trim()
        : selectedReligionId === 'prefer_not_to_say'
          ? 'Prefer not to say'
          : religion.trim();

    updateDraftProfile({
      displayName: displayName.trim(),
      dateOfBirth: formattedDob,
      gender: coreGender,
      genderIdentity: finalGenderIdentity,
      interestedIn: selectedCoreGenders,
      interestedInIdentities: selectedInterestedInIds,
      interestedInReligions: selectedInterestedInReligionIds,
      intent,
      religion: finalReligion || undefined,
      city: city.trim(),
      coordinates: selectedCoords || undefined,
      bio: bio.trim(),
      occupation: occupation.trim(),
      education: education.trim(),
    });

    updateDraftPreferences({
      genderPreferences: selectedCoreGenders,
      religionPreferences: selectedInterestedInReligionIds,
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

      if (isFromReview) {
        router.replace('/(onboarding)/preview');
        return;
      }
      router.push('/(onboarding)/photos');
    } catch (err: unknown) {
      if (__DEV__) {
        trackOnboardingEvent('profile_details_completed', {
          age,
          gender: coreGender,
          intent,
        });
        if (isFromReview) {
          router.replace('/(onboarding)/preview');
          return;
        }
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

      <TouchableWithoutFeedback onPress={dismissActiveField} accessible={false}>
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
                flexGrow: 1,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <TouchableWithoutFeedback onPress={dismissActiveField} accessible={false}>
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
                        07
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
                  style={[styles.sectionGroup, { marginTop: 10 }]}
                  onLayout={(e) => {
                    section1Y.current = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeaderRow}>
                    <Text
                      style={[
                        styles.sectionHeaderTitle,
                        { color: sectionHeaderColor, fontFamily: folkraFont },
                      ]}
                    >
                      WHO YOU ARE
                    </Text>
                  </View>

                  {/* Full Name */}
                  <View style={styles.fieldWrapper}>
                    <View style={styles.fieldHeaderRow}>
                      <Text style={[styles.fieldLabel, { color: fieldHeaderLabelColor }]}>
                        Full Name
                      </Text>
                      <Text style={[styles.fieldCounter, { color: theme.colors.textTertiary }]}>
                        {displayName.length}/30
                      </Text>
                    </View>

                    <Animated.View
                      onLayout={(e) => {
                        nameCardRelY.current = e.nativeEvent.layout.y;
                      }}
                      style={[
                        styles.modernInputBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor:
                            focusedField === 'displayName' || highlightedField === 'displayName'
                              ? theme.colors.textPrimary
                              : isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : '#E5E7EB',
                          transform: [{ translateX: nameShakeAnim }],
                        },
                      ]}
                    >
                      <User
                        size={16}
                        color={fieldIconColor}
                        style={styles.inputLeadingIcon}
                      />
                      <RNTextInput
                        ref={nameInputRef}
                        style={[
                          styles.modernBarInput,
                          {
                            color: fieldInputTextColor,
                          },
                        ]}
                        placeholder="What should we call you?"
                        placeholderTextColor={theme.colors.textTertiary}
                        value={displayName}
                        onFocus={() => {
                          cityInputRef.current?.blur();
                          bioInputRef.current?.blur();
                          occupationInputRef.current?.blur();
                          educationInputRef.current?.blur();
                          setFocusedField('displayName');
                          ensureFieldInView(section1Y.current + nameCardRelY.current - 95);
                        }}
                        onBlur={() => {
                          setFocusedField((prev) => (prev === 'displayName' ? null : prev));
                        }}
                        onChangeText={(t) => {
                          setDisplayName(t);
                          if (errorMessage) setErrorMessage(undefined);
                          ensureFieldInView(section1Y.current + nameCardRelY.current - 95);
                        }}
                        onSubmitEditing={dismissActiveField}
                        maxLength={30}
                        autoCapitalize="words"
                        returnKeyType="done"
                        testID="name-input"
                      />
                      {displayName.length > 0 && focusedField === 'displayName' && (
                        <TouchableOpacity
                          onPress={() => setDisplayName('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.inputTrailingAction}
                        >
                          <X size={14} color={theme.colors.textTertiary} />
                        </TouchableOpacity>
                      )}
                    </Animated.View>
                  </View>

                  {/* Date of Birth */}
                  <View style={styles.fieldWrapper}>
                    <View style={styles.fieldHeaderRow}>
                      <Text style={[styles.fieldLabel, { color: fieldHeaderLabelColor }]}>
                        Date of Birth
                      </Text>
                      {currentAge !== null && (
                        <Text style={[styles.ageBadgeText, { color: theme.colors.textSecondary }]}>
                          {currentAge} yrs · 18+
                        </Text>
                      )}
                    </View>

                    <Animated.View
                      onLayout={(e) => {
                        dobCardRelY.current = e.nativeEvent.layout.y;
                      }}
                      style={{ transform: [{ translateX: dobShakeAnim }] }}
                    >
                      <TouchableOpacity
                        onPress={handleOpenDatePicker}
                        activeOpacity={0.7}
                        style={[
                          styles.modernInputBar,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                            borderColor:
                              highlightedField === 'dob'
                                ? theme.colors.textPrimary
                                : isDark
                                  ? 'rgba(255, 255, 255, 0.08)'
                                  : '#E5E7EB',
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Choose date of birth"
                      >
                        <Calendar
                          size={16}
                          color={fieldIconColor}
                          style={styles.inputLeadingIcon}
                        />
                        <Text
                          style={[
                            styles.modernBarInputText,
                            {
                              color: dateOfBirth
                                ? fieldInputTextColor
                                : theme.colors.textTertiary,
                              fontWeight: dateOfBirth ? '600' : '400',
                            },
                          ]}
                        >
                          {formattedDateString}
                        </Text>
                        <ChevronDown size={15} color={theme.colors.textTertiary} />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>

                  {/* Gender Identity */}
                  <View style={styles.fieldWrapper}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: fieldHeaderLabelColor, marginBottom: 6, marginLeft: 2 },
                      ]}
                    >
                      Gender Identity
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.modernInputBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
                        },
                      ]}
                      onPress={() => {
                        dismissActiveField();
                        haptics.selection();
                        setGenderSearchText('');
                        setIsGenderModalVisible(true);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Select gender identity"
                    >
                      <Users
                        size={16}
                        color={fieldIconColor}
                        style={styles.inputLeadingIcon}
                      />
                      <Text
                        style={[
                          styles.modernBarInputText,
                          { color: fieldInputTextColor, fontWeight: '600' },
                        ]}
                        numberOfLines={1}
                      >
                        {activeGenderLabel}
                      </Text>
                      <ChevronDown size={15} color={theme.colors.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  {/* Religion / Beliefs */}
                  <View style={styles.fieldWrapper}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: fieldHeaderLabelColor, marginBottom: 6, marginLeft: 2 },
                      ]}
                    >
                      Religion / Beliefs
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.modernInputBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
                        },
                      ]}
                      onPress={() => {
                        dismissActiveField();
                        haptics.selection();
                        setReligionSearchText('');
                        setIsReligionModalVisible(true);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Select religion or beliefs"
                    >
                      <Church
                        size={16}
                        color={fieldIconColor}
                        style={styles.inputLeadingIcon}
                      />
                      <Text
                        style={[
                          styles.modernBarInputText,
                          {
                            color: religion ? fieldInputTextColor : theme.colors.textTertiary,
                            fontWeight: religion ? '600' : '400',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {activeReligionLabel}
                      </Text>
                      <ChevronDown size={15} color={theme.colors.textTertiary} />
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
                        { color: sectionHeaderColor, fontFamily: folkraFont },
                      ]}
                    >
                      YOUR INTENTIONS
                    </Text>
                  </View>

                  {/* Relationship Intent */}
                  <View style={styles.fieldWrapper}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: fieldHeaderLabelColor, marginBottom: 6, marginLeft: 2 },
                      ]}
                    >
                      Relationship Intent
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.modernInputBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
                        },
                      ]}
                      onPress={() => {
                        dismissActiveField();
                        haptics.selection();
                        setIsIntentModalVisible(true);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Select relationship intent"
                    >
                      <Heart
                        size={16}
                        color={fieldIconColor}
                        style={styles.inputLeadingIcon}
                      />
                      <Text
                        style={[
                          styles.modernBarInputText,
                          { color: fieldInputTextColor, fontWeight: '600' },
                        ]}
                        numberOfLines={1}
                      >
                        {activeIntentOption.label}
                      </Text>
                      <ChevronDown size={15} color={theme.colors.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  {/* Interested In */}
                  <View style={styles.fieldWrapper}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: fieldHeaderLabelColor, marginBottom: 6, marginLeft: 2 },
                      ]}
                    >
                      Interested In
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.modernInputBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
                        },
                      ]}
                      onPress={() => {
                        dismissActiveField();
                        haptics.selection();
                        setIsInterestedInModalVisible(true);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Select who you are interested in"
                    >
                      <Compass
                        size={16}
                        color={fieldIconColor}
                        style={styles.inputLeadingIcon}
                      />
                      <Text
                        style={[
                          styles.modernBarInputText,
                          { color: fieldInputTextColor, fontWeight: '600' },
                        ]}
                        numberOfLines={1}
                      >
                        {activeInterestedInLabel}
                      </Text>
                      <ChevronDown size={15} color={theme.colors.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  {/* Open to Religions */}
                  <View style={styles.fieldWrapper}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: fieldHeaderLabelColor, marginBottom: 6, marginLeft: 2 },
                      ]}
                    >
                      Open to Religions
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.modernInputBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
                        },
                      ]}
                      onPress={() => {
                        dismissActiveField();
                        haptics.selection();
                        setInterestedInReligionSearchText('');
                        setIsInterestedInReligionModalVisible(true);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Select religions or beliefs you want to meet"
                    >
                      <Church
                        size={16}
                        color={fieldIconColor}
                        style={styles.inputLeadingIcon}
                      />
                      <Text
                        style={[
                          styles.modernBarInputText,
                          {
                            color: fieldInputTextColor,
                            fontWeight: '600',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {activeInterestedInReligionLabel}
                      </Text>
                      <ChevronDown size={15} color={theme.colors.textTertiary} />
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
                        { color: sectionHeaderColor, fontFamily: folkraFont },
                      ]}
                    >
                      WHERE YOU LIVE
                    </Text>
                  </View>

                  <View style={styles.fieldWrapper}>
                    <View style={styles.fieldHeaderRow}>
                      <Text style={[styles.fieldLabel, { color: fieldHeaderLabelColor }]}>
                        City / Neighborhood
                      </Text>
                      {/* Compact Map Button in Header */}
                      <TouchableOpacity
                        onPress={() => {
                          dismissActiveField();
                          haptics.selection();
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
                          styles.fieldHeaderAction,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#EBEBEF',
                          },
                        ]}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Choose location from map"
                      >
                        <Crosshair
                          size={11.5}
                          color={theme.colors.textPrimary}
                          style={{ marginRight: 3.5 }}
                        />
                        <Text
                          style={[
                            styles.fieldHeaderActionText,
                            { color: theme.colors.textPrimary },
                          ]}
                        >
                          Map
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Animated.View
                      onLayout={(e) => {
                        cityCardRelY.current = e.nativeEvent.layout.y;
                      }}
                      style={[
                        styles.modernInputBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor:
                            focusedField === 'city' || highlightedField === 'city'
                              ? theme.colors.textPrimary
                              : isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : '#E5E7EB',
                          transform: [{ translateX: cityShakeAnim }],
                        },
                      ]}
                    >
                      <MapPin
                        size={16}
                        color={fieldIconColor}
                        style={styles.inputLeadingIcon}
                      />
                      <RNTextInput
                        ref={cityInputRef}
                        style={[
                          styles.modernBarInput,
                          {
                            color: fieldInputTextColor,
                          },
                        ]}
                        placeholder="Type a city or locality..."
                        placeholderTextColor={theme.colors.textTertiary}
                        value={city}
                        onFocus={() => {
                          nameInputRef.current?.blur();
                          bioInputRef.current?.blur();
                          occupationInputRef.current?.blur();
                          educationInputRef.current?.blur();
                          setFocusedField('city');
                          ensureFieldInView(section3Y.current + cityCardRelY.current - 95);
                          if (locationSuggestions.length > 0) setShowSuggestionsDropdown(true);
                        }}
                        onBlur={() => {
                          setFocusedField((prev) => (prev === 'city' ? null : prev));
                          // allow tap on suggestions before hiding
                          setTimeout(() => setShowSuggestionsDropdown(false), 250);
                        }}
                        onChangeText={handleCityTextChange}
                        onSubmitEditing={dismissActiveField}
                        autoCapitalize="words"
                        returnKeyType="done"
                        testID="city-input"
                      />

                      {/* Right-aligned actions: Activity indicator or Clear X */}
                      {isSearchingLocation ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.textSecondary}
                          style={{ marginLeft: 8 }}
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
                          style={styles.inputTrailingAction}
                          accessibilityRole="button"
                          accessibilityLabel="Clear city input"
                        >
                          <X size={14} color={theme.colors.textTertiary} />
                        </TouchableOpacity>
                      ) : null}
                    </Animated.View>

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
                  </View>
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
                        { color: sectionHeaderColor, fontFamily: folkraFont },
                      ]}
                    >
                      ABOUT YOU
                    </Text>
                  </View>

                  <View
                    style={styles.fieldWrapper}
                    onLayout={(e) => {
                      bioCardRelY.current = e.nativeEvent.layout.y;
                    }}
                  >
                    <View style={styles.fieldHeaderRow}>
                      <Text style={[styles.fieldLabel, { color: fieldHeaderLabelColor }]}>
                        Bio / About You
                      </Text>
                      <Text style={[styles.fieldCounter, { color: theme.colors.textTertiary }]}>
                        {bio.length}/300
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.modernTextareaBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor:
                            focusedField === 'bio'
                              ? theme.colors.textPrimary
                              : isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : '#E5E7EB',
                        },
                      ]}
                    >
                      <RNTextInput
                        ref={bioInputRef}
                        style={[
                          styles.modernBarTextarea,
                          {
                            color: fieldInputTextColor,
                          },
                        ]}
                        placeholder="A little about your rhythm, weekend rituals, and what brings you genuine joy..."
                        placeholderTextColor={theme.colors.textTertiary}
                        value={bio}
                        onFocus={() => {
                          nameInputRef.current?.blur();
                          cityInputRef.current?.blur();
                          occupationInputRef.current?.blur();
                          educationInputRef.current?.blur();
                          setFocusedField('bio');
                          ensureFieldInView(section4Y.current + bioCardRelY.current - 95);
                        }}
                        onBlur={() => {
                          setFocusedField((prev) => (prev === 'bio' ? null : prev));
                        }}
                        onChangeText={(t) => {
                          setBio(t.slice(0, 300));
                          ensureFieldInView(section4Y.current + bioCardRelY.current - 95);
                        }}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        maxLength={300}
                      />
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
                        { color: sectionHeaderColor, fontFamily: folkraFont },
                      ]}
                    >
                      CAREER & EDUCATION (OPTIONAL)
                    </Text>
                  </View>

                  {/* Occupation */}
                  <View
                    style={styles.fieldWrapper}
                    onLayout={(e) => {
                      occupationCardRelY.current = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: fieldHeaderLabelColor, marginBottom: 6, marginLeft: 2 },
                      ]}
                    >
                      Occupation (Optional)
                    </Text>
                    <View
                      style={[
                        styles.modernInputBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor:
                            focusedField === 'occupation'
                              ? theme.colors.textPrimary
                              : isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : '#E5E7EB',
                        },
                      ]}
                    >
                      <Briefcase
                        size={16}
                        color={fieldIconColor}
                        style={styles.inputLeadingIcon}
                      />
                      <RNTextInput
                        ref={occupationInputRef}
                        style={[
                          styles.modernBarInput,
                          {
                            color: fieldInputTextColor,
                          },
                        ]}
                        placeholder="e.g. Architect, Founder, Designer"
                        placeholderTextColor={theme.colors.textTertiary}
                        value={occupation}
                        onFocus={() => {
                          nameInputRef.current?.blur();
                          cityInputRef.current?.blur();
                          bioInputRef.current?.blur();
                          educationInputRef.current?.blur();
                          setFocusedField('occupation');
                          ensureFieldInView(section5Y.current + occupationCardRelY.current - 95);
                        }}
                        onBlur={() => {
                          setFocusedField((prev) => (prev === 'occupation' ? null : prev));
                        }}
                        onChangeText={(t) => {
                          setOccupation(t);
                          ensureFieldInView(section5Y.current + occupationCardRelY.current - 95);
                        }}
                        onSubmitEditing={dismissActiveField}
                        autoCapitalize="words"
                        returnKeyType="done"
                      />
                      {occupation.length > 0 && focusedField === 'occupation' && (
                        <TouchableOpacity
                          onPress={() => setOccupation('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.inputTrailingAction}
                        >
                          <X size={14} color={theme.colors.textTertiary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Education */}
                  <View
                    style={styles.fieldWrapper}
                    onLayout={(e) => {
                      educationCardRelY.current = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: fieldHeaderLabelColor, marginBottom: 6, marginLeft: 2 },
                      ]}
                    >
                      Education (Optional)
                    </Text>
                    <View
                      style={[
                        styles.modernInputBar,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : '#F4F4F6',
                          borderColor:
                            focusedField === 'education'
                              ? theme.colors.textPrimary
                              : isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : '#E5E7EB',
                        },
                      ]}
                    >
                      <GraduationCap
                        size={16}
                        color={fieldIconColor}
                        style={styles.inputLeadingIcon}
                      />
                      <RNTextInput
                        ref={educationInputRef}
                        style={[
                          styles.modernBarInput,
                          {
                            color: fieldInputTextColor,
                          },
                        ]}
                        placeholder="e.g. IIT Bombay, NID, St. Xavier's"
                        placeholderTextColor={theme.colors.textTertiary}
                        value={education}
                        onFocus={() => {
                          nameInputRef.current?.blur();
                          cityInputRef.current?.blur();
                          bioInputRef.current?.blur();
                          occupationInputRef.current?.blur();
                          setFocusedField('education');
                          if (educationSuggestions.length > 0) setShowEducationDropdown(true);
                          ensureFieldInView(section5Y.current + educationCardRelY.current - 95);
                        }}
                        onBlur={() => {
                          setFocusedField((prev) => (prev === 'education' ? null : prev));
                          setTimeout(() => setShowEducationDropdown(false), 250);
                        }}
                        onChangeText={handleEducationTextChange}
                        onSubmitEditing={dismissActiveField}
                        autoCapitalize="words"
                        returnKeyType="done"
                        testID="education-input"
                      />

                      {/* Trailing action: Activity indicator or Clear X button */}
                      {isSearchingEducation ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.textSecondary}
                          style={{ marginLeft: 8 }}
                        />
                      ) : education.length > 0 ? (
                        <TouchableOpacity
                          onPress={() => {
                            haptics.selection();
                            setEducation('');
                            setEducationSuggestions([]);
                            setShowEducationDropdown(false);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.inputTrailingAction}
                          accessibilityRole="button"
                          accessibilityLabel="Clear education input"
                        >
                          <X size={14} color={theme.colors.textTertiary} />
                        </TouchableOpacity>
                      ) : null}
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
            accessibilityLabel={isFromReview ? 'Back to Review' : 'Continue to Photos'}
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
                  {isFromReview ? 'Back to Review' : 'Continue to Photos'}
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
          if (genderSearchDebounceRef.current) clearTimeout(genderSearchDebounceRef.current);
          genderAbortRef.current?.abort();
          setGenderSearchText('');
          setInternetGenderSuggestions([]);
          setIsSearchingGenderInternet(false);
        }}
        sheetStyle={{ maxHeight: '86%' }}
        keyboardPaddingBottom={7}
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
              if (genderSearchDebounceRef.current) clearTimeout(genderSearchDebounceRef.current);
              genderAbortRef.current?.abort();
              setGenderSearchText('');
              setInternetGenderSuggestions([]);
              setIsSearchingGenderInternet(false);
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
          {isSearchingGenderInternet ? (
            <ActivityIndicator size="small" color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
          ) : (
            <Search size={16} color={theme.colors.textTertiary} style={{ marginRight: 8 }} />
          )}
          <RNTextInput
            ref={genderSearchInputRef}
            style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search gender identities or web..."
            placeholderTextColor={theme.colors.textTertiary}
            value={genderSearchText}
            onChangeText={handleGenderSearchTextChange}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
          />
          {genderSearchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (genderSearchDebounceRef.current) clearTimeout(genderSearchDebounceRef.current);
                genderAbortRef.current?.abort();
                setGenderSearchText('');
                setInternetGenderSuggestions([]);
                setIsSearchingGenderInternet(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable Genders List */}
        <ScrollView
          style={{ maxHeight: isKeyboardVisible ? 240 : 420 }}
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
                    setInternetGenderSuggestions([]);
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

          {/* Web Discoveries Section */}
          {internetGenderSuggestions.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.modalSubSectionHeader}>
                <Globe size={13} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.modalSubSectionTitle,
                    { color: theme.colors.textSecondary, fontFamily: folkraFont },
                  ]}
                >
                  WEB DISCOVERIES ({internetGenderSuggestions.length})
                </Text>
              </View>

              {internetGenderSuggestions.map((item) => {
                const isSelected =
                  (selectedGenderId === 'other' && customGenderText.toLowerCase() === item.label.toLowerCase()) ||
                  selectedGenderId === item.id;

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
                    onPress={() => handleSelectInternetGender(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={{
                            color: theme.colors.textPrimary,
                            fontWeight: isSelected ? '700' : '600',
                            fontSize: 15,
                          }}
                        >
                          {item.label}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary }}>
                            WEB
                          </Text>
                        </View>
                      </View>
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
            </View>
          )}

          {/* Searching online status indicator */}
          {isSearchingGenderInternet && internetGenderSuggestions.length === 0 && (
            <View style={styles.modalSearchLoadingRow}>
              <ActivityIndicator size="small" color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text level="caption" color="secondary">
                Searching global identity catalog...
              </Text>
            </View>
          )}

          {/* No matches empty state with single-tap self-describe prompt */}
          {filteredGenders.length === 0 &&
            internetGenderSuggestions.length === 0 &&
            !isSearchingGenderInternet &&
            genderSearchText.trim().length > 0 && (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text level="caption" color="secondary" style={{ textAlign: 'center', marginBottom: 12 }}>
                  No preset identities matching &quot;{genderSearchText.trim()}&quot;
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setSelectedGenderId('other');
                    setCustomGenderText(genderSearchText.trim());
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#E4E4E7',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                    Tap to self-describe as &quot;{genderSearchText.trim()}&quot;
                  </Text>
                </TouchableOpacity>
              </View>
            )}

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
              paddingBottom: isKeyboardVisible ? 0 : 4,
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
          if (interestedInSearchDebounceRef.current) clearTimeout(interestedInSearchDebounceRef.current);
          interestedInAbortRef.current?.abort();
          setInterestedInSearchText('');
          setInternetInterestedInSuggestions([]);
          setIsSearchingInterestedInInternet(false);
        }}
        sheetStyle={{ maxHeight: '86%' }}
        keyboardPaddingBottom={7}
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
              if (interestedInSearchDebounceRef.current) clearTimeout(interestedInSearchDebounceRef.current);
              interestedInAbortRef.current?.abort();
              setInterestedInSearchText('');
              setInternetInterestedInSuggestions([]);
              setIsSearchingInterestedInInternet(false);
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
          {isSearchingInterestedInInternet ? (
            <ActivityIndicator size="small" color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
          ) : (
            <Search size={16} color={theme.colors.textTertiary} style={{ marginRight: 8 }} />
          )}
          <RNTextInput
            ref={interestedInSearchInputRef}
            style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search gender categories or web..."
            placeholderTextColor={theme.colors.textTertiary}
            value={interestedInSearchText}
            onChangeText={handleInterestedInSearchTextChange}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
          />
          {interestedInSearchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (interestedInSearchDebounceRef.current) clearTimeout(interestedInSearchDebounceRef.current);
                interestedInAbortRef.current?.abort();
                setInterestedInSearchText('');
                setInternetInterestedInSuggestions([]);
                setIsSearchingInterestedInInternet(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable Categories List */}
        <ScrollView
          style={{ maxHeight: isKeyboardVisible ? 240 : 420 }}
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

          {/* Web Discoveries Section */}
          {internetInterestedInSuggestions.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.modalSubSectionHeader}>
                <Globe size={13} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.modalSubSectionTitle,
                    { color: theme.colors.textSecondary, fontFamily: folkraFont },
                  ]}
                >
                  WEB DISCOVERIES ({internetInterestedInSuggestions.length})
                </Text>
              </View>

              {internetInterestedInSuggestions.map((item) => {
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
                    onPress={() => handleSelectInternetInterestedIn(item)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={{ flex: 1, paddingRight: 10, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={{
                            color: theme.colors.textPrimary,
                            fontWeight: isSelected ? '700' : '600',
                            fontSize: 15,
                          }}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary }}>
                            WEB
                          </Text>
                        </View>
                      </View>
                      <Text
                        level="caption"
                        color="tertiary"
                        style={{ marginTop: 2, lineHeight: 16 }}
                        numberOfLines={2}
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
            </View>
          )}

          {/* Searching online status indicator */}
          {isSearchingInterestedInInternet && internetInterestedInSuggestions.length === 0 && (
            <View style={styles.modalSearchLoadingRow}>
              <ActivityIndicator size="small" color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text level="caption" color="secondary">
                Searching global categories online...
              </Text>
            </View>
          )}

          {/* No matches empty state */}
          {filteredInterestedInOptions.length === 0 &&
            internetInterestedInSuggestions.length === 0 &&
            !isSearchingInterestedInInternet &&
            interestedInSearchText.trim().length > 0 && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text level="caption" color="secondary" style={{ textAlign: 'center' }}>
                  No categories matching &quot;{interestedInSearchText.trim()}&quot;
                </Text>
                <Text level="caption" color="tertiary" style={{ textAlign: 'center', marginTop: 4 }}>
                  Try broader terms like &quot;women&quot;, &quot;men&quot;, &quot;non-binary&quot;, or &quot;everyone&quot;.
                </Text>
              </View>
            )}
        </ScrollView>

        {/* Confirm / Done Button */}
        <TouchableOpacity
          style={[
            styles.confirmCustomButton,
            {
              backgroundColor: theme.colors.textPrimary,
              marginTop: isKeyboardVisible ? 10 : 16,
              marginBottom: isKeyboardVisible ? 0 : 8,
            },
          ]}
          onPress={() => {
            haptics.notificationSuccess();
            setIsInterestedInModalVisible(false);
            if (interestedInSearchDebounceRef.current) clearTimeout(interestedInSearchDebounceRef.current);
            interestedInAbortRef.current?.abort();
            setInterestedInSearchText('');
            setInternetInterestedInSuggestions([]);
            setIsSearchingInterestedInInternet(false);
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

      {/* ======================================================== */}
      {/* 6. Religion & Beliefs Modal with Search Facility */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={isReligionModalVisible}
        onClose={() => {
          setIsReligionModalVisible(false);
          if (religionSearchDebounceRef.current) clearTimeout(religionSearchDebounceRef.current);
          religionAbortRef.current?.abort();
          setReligionSearchText('');
          setInternetReligionSuggestions([]);
          setIsSearchingReligionInternet(false);
        }}
        sheetStyle={{ maxHeight: '86%' }}
        keyboardPaddingBottom={7}
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
              Religion & Beliefs
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 2 }}>
              Select the faith, tradition, or worldview that represents you.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setIsReligionModalVisible(false);
              if (religionSearchDebounceRef.current) clearTimeout(religionSearchDebounceRef.current);
              religionAbortRef.current?.abort();
              setReligionSearchText('');
              setInternetReligionSuggestions([]);
              setIsSearchingReligionInternet(false);
            }}
            style={[
              styles.modalCloseBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F1F4',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close religion selection modal"
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
          {isSearchingReligionInternet ? (
            <ActivityIndicator size="small" color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
          ) : (
            <Search size={16} color={theme.colors.textTertiary} style={{ marginRight: 8 }} />
          )}
          <RNTextInput
            ref={religionSearchInputRef}
            style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search religions, faiths, or web..."
            placeholderTextColor={theme.colors.textTertiary}
            value={religionSearchText}
            onChangeText={handleReligionSearchTextChange}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
          />
          {religionSearchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (religionSearchDebounceRef.current) clearTimeout(religionSearchDebounceRef.current);
                religionAbortRef.current?.abort();
                setReligionSearchText('');
                setInternetReligionSuggestions([]);
                setIsSearchingReligionInternet(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable Religions List */}
        <ScrollView
          style={{ maxHeight: isKeyboardVisible ? 240 : 420 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredReligions.map((item) => {
            const isSelected = selectedReligionId === item.id;
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
                onPress={() => handleSelectReligion(item)}
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

          {/* Web Discoveries Section */}
          {internetReligionSuggestions.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.modalSubSectionHeader}>
                <Globe size={13} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.modalSubSectionTitle,
                    { color: theme.colors.textSecondary, fontFamily: folkraFont },
                  ]}
                >
                  WEB DISCOVERIES ({internetReligionSuggestions.length})
                </Text>
              </View>

              {internetReligionSuggestions.map((item) => {
                const isSelected =
                  (selectedReligionId === 'other' && customReligionText.toLowerCase() === item.label.toLowerCase()) ||
                  religion.toLowerCase() === item.label.toLowerCase();

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
                    onPress={() => handleSelectInternetReligion(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={{
                            color: theme.colors.textPrimary,
                            fontWeight: isSelected ? '700' : '600',
                            fontSize: 15,
                          }}
                        >
                          {item.label}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary }}>
                            WEB
                          </Text>
                        </View>
                      </View>
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
            </View>
          )}

          {/* Searching online status indicator */}
          {isSearchingReligionInternet && internetReligionSuggestions.length === 0 && (
            <View style={styles.modalSearchLoadingRow}>
              <ActivityIndicator size="small" color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <Text level="caption" color="secondary">
                Searching global traditions online...
              </Text>
            </View>
          )}

          {/* No matches empty state with single-tap self-describe prompt */}
          {filteredReligions.length === 0 &&
            internetReligionSuggestions.length === 0 &&
            !isSearchingReligionInternet &&
            religionSearchText.trim().length > 0 && (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text level="caption" color="secondary" style={{ textAlign: 'center', marginBottom: 12 }}>
                  No preset religions matching &quot;{religionSearchText.trim()}&quot;
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setSelectedReligionId('other');
                    setCustomReligionText(religionSearchText.trim());
                    setReligion(religionSearchText.trim());
                    setIsReligionModalVisible(false);
                    setReligionSearchText('');
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#E4E4E7',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                    Tap to set as &quot;{religionSearchText.trim()}&quot;
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          {/* Custom Self-Describe Input if other selected */}
          {selectedReligionId === 'other' && (
            <View style={styles.customGenderInputBox}>
              <Text
                level="caption"
                style={{
                  color: theme.colors.textSecondary,
                  marginBottom: 6,
                  fontWeight: '600',
                }}
              >
                Type your belief or worldview:
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
                placeholder="e.g. Omnist, Non-denominational, Eclectic"
                placeholderTextColor={theme.colors.textTertiary}
                value={customReligionText}
                onChangeText={setCustomReligionText}
                maxLength={40}
              />
              <TouchableOpacity
                style={[styles.confirmCustomButton, { backgroundColor: theme.colors.textPrimary }]}
                onPress={() => {
                  haptics.notificationSuccess();
                  if (customReligionText.trim()) {
                    setReligion(customReligionText.trim());
                  }
                  setIsReligionModalVisible(false);
                  setReligionSearchText('');
                }}
              >
                <Text
                  style={{
                    color: isDark ? '#000000' : '#FFFFFF',
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  Confirm Belief
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
              paddingBottom: isKeyboardVisible ? 0 : 4,
            },
          ]}
          onPress={() => {
            haptics.selection();
            setShowReligionOnProfile((prev) => !prev);
          }}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: '600', fontSize: 13.5 }}>
              Visible on my profile
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 1 }}>
              {showReligionOnProfile
                ? 'Your beliefs are shown on your card'
                : 'Hidden from public profile card'}
            </Text>
          </View>
          <View
            style={[
              styles.toggleCapsule,
              {
                backgroundColor: showReligionOnProfile
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
                  backgroundColor: showReligionOnProfile
                    ? isDark
                      ? '#000000'
                      : '#FFFFFF'
                    : isDark
                      ? '#FFFFFF'
                      : '#FFFFFF',
                  alignSelf: showReligionOnProfile ? 'flex-end' : 'flex-start',
                },
              ]}
            />
          </View>
        </TouchableOpacity>
      </SmoothBottomSheetModal>

      {/* ======================================================== */}
      {/* 7. Open to Religions (Religious Preferences) Modal */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={isInterestedInReligionModalVisible}
        onClose={() => {
          setIsInterestedInReligionModalVisible(false);
          if (interestedInReligionSearchDebounceRef.current)
            clearTimeout(interestedInReligionSearchDebounceRef.current);
          interestedInReligionAbortRef.current?.abort();
          setInterestedInReligionSearchText('');
          setInternetInterestedInReligionSuggestions([]);
          setIsSearchingInterestedInReligionInternet(false);
        }}
        sheetStyle={{ maxHeight: '86%' }}
        keyboardPaddingBottom={7}
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
              Open to Religions
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 2 }}>
              Select all faiths, traditions, and worldviews you would like to meet.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              setIsInterestedInReligionModalVisible(false);
              if (interestedInReligionSearchDebounceRef.current)
                clearTimeout(interestedInReligionSearchDebounceRef.current);
              interestedInReligionAbortRef.current?.abort();
              setInterestedInReligionSearchText('');
              setInternetInterestedInReligionSuggestions([]);
              setIsSearchingInterestedInReligionInternet(false);
            }}
            style={[
              styles.modalCloseBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F1F4',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close open to religions modal"
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
          {isSearchingInterestedInReligionInternet ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.textPrimary}
              style={{ marginRight: 8 }}
            />
          ) : (
            <Search size={16} color={theme.colors.textTertiary} style={{ marginRight: 8 }} />
          )}
          <RNTextInput
            ref={interestedInReligionSearchInputRef}
            style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search faiths, traditions, or web..."
            placeholderTextColor={theme.colors.textTertiary}
            value={interestedInReligionSearchText}
            onChangeText={handleInterestedInReligionSearchTextChange}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
          />
          {interestedInReligionSearchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (interestedInReligionSearchDebounceRef.current)
                  clearTimeout(interestedInReligionSearchDebounceRef.current);
                interestedInReligionAbortRef.current?.abort();
                setInterestedInReligionSearchText('');
                setInternetInterestedInReligionSuggestions([]);
                setIsSearchingInterestedInReligionInternet(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable Categories List */}
        <ScrollView
          style={{ maxHeight: isKeyboardVisible ? 240 : 420 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredInterestedInReligionOptions.map((item) => {
            const isSelected = selectedInterestedInReligionIds.includes(item.id);

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
                onPress={() => toggleInterestedInReligionId(item.id)}
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

          {/* Web Discoveries Section */}
          {internetInterestedInReligionSuggestions.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.modalSubSectionHeader}>
                <Globe size={13} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.modalSubSectionTitle,
                    { color: theme.colors.textSecondary, fontFamily: folkraFont },
                  ]}
                >
                  WEB DISCOVERIES ({internetInterestedInReligionSuggestions.length})
                </Text>
              </View>

              {internetInterestedInReligionSuggestions.map((item) => {
                const isSelected = selectedInterestedInReligionIds.includes(item.id);

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
                    onPress={() => handleSelectInternetInterestedInReligion(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, paddingRight: 10, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={{
                            color: theme.colors.textPrimary,
                            fontWeight: isSelected ? '700' : '600',
                            fontSize: 15,
                          }}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color: theme.colors.textTertiary,
                            }}
                          >
                            WEB
                          </Text>
                        </View>
                      </View>
                      <Text
                        level="caption"
                        color="tertiary"
                        style={{ marginTop: 2, lineHeight: 16 }}
                        numberOfLines={2}
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
            </View>
          )}

          {/* Searching online status indicator */}
          {isSearchingInterestedInReligionInternet &&
            internetInterestedInReligionSuggestions.length === 0 && (
              <View style={styles.modalSearchLoadingRow}>
                <ActivityIndicator
                  size="small"
                  color={theme.colors.textSecondary}
                  style={{ marginRight: 8 }}
                />
                <Text level="caption" color="secondary">
                  Searching global traditions online...
                </Text>
              </View>
            )}

          {/* No matches empty state */}
          {filteredInterestedInReligionOptions.length === 0 &&
            internetInterestedInReligionSuggestions.length === 0 &&
            !isSearchingInterestedInReligionInternet &&
            interestedInReligionSearchText.trim().length > 0 && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text level="caption" color="secondary" style={{ textAlign: 'center' }}>
                  No traditions matching &quot;{interestedInReligionSearchText.trim()}&quot;
                </Text>
                <Text level="caption" color="tertiary" style={{ textAlign: 'center', marginTop: 4 }}>
                  Try broader terms like &quot;all&quot;, &quot;spiritual&quot;, &quot;buddhist&quot;, or &quot;hindu&quot;.
                </Text>
              </View>
            )}
        </ScrollView>

        {/* Confirm / Done Button */}
        <TouchableOpacity
          style={[
            styles.confirmCustomButton,
            {
              backgroundColor: theme.colors.textPrimary,
              marginTop: isKeyboardVisible ? 10 : 16,
              marginBottom: isKeyboardVisible ? 0 : 8,
            },
          ]}
          onPress={() => {
            haptics.notificationSuccess();
            setIsInterestedInReligionModalVisible(false);
            if (interestedInReligionSearchDebounceRef.current)
              clearTimeout(interestedInReligionSearchDebounceRef.current);
            interestedInReligionAbortRef.current?.abort();
            setInterestedInReligionSearchText('');
            setInternetInterestedInReligionSuggestions([]);
            setIsSearchingInterestedInReligionInternet(false);
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
    color: '#FFFFFF',
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
  fieldWrapper: {
    marginBottom: 14,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: '#D4D4D8',
  },
  fieldCounter: {
    fontSize: 11,
  },
  ageBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  fieldHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  fieldHeaderActionText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  modernInputBar: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  modernTextareaBar: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputLeadingIcon: {
    marginRight: 10,
    flexShrink: 0,
  },
  modernBarInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '500',
    color: '#A1A1AA',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  modernBarInputText: {
    flex: 1,
    fontSize: 15,
    color: '#A1A1AA',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  modernBarTextarea: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '400',
    color: '#A1A1AA',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  inputTrailingAction: {
    marginLeft: 8,
    padding: 4,
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
  pickerColumnsRow: {
    flexDirection: 'row',
    height: 228,
    gap: 8,
    marginBottom: 20,
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
    paddingVertical: 10,
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
    height: 50,
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
  modalSubSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  modalSubSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  modalSearchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
});
