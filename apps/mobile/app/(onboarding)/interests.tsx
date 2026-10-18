import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { SmoothBottomSheetModal } from '../../src/design/components/modal/SmoothBottomSheetModal.js';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Check,
  Plus,
  Sparkles,
  Coffee,
  Music,
  Film,
  UtensilsCrossed,
  Mountain,
  Palette,
  Camera,
  BookOpen,
  Trophy,
  Activity,
  Gamepad2,
  Landmark,
  Sun,
  PenTool,
  Plane,
  Heart,
  Code,
  Cpu,
  Footprints,
  Dumbbell,
  Wine,
  Headphones,
  AlertCircle,
  Clapperboard,
  Tv,
  Compass,
  Mic,
  Flame,
  Globe,
  type LucideIcon,
} from 'lucide-react-native';
import type { InterestItem } from '@platform/api-contracts';
import { generateUuidV7 } from '@platform/domain';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { getDefaultProfileApi } from '../../src/profile/profile-api.js';
import { useOnboardingStore } from '../../src/auth/onboarding-store.js';
import { trackOnboardingEvent } from '../../src/analytics/onboarding-analytics.js';
import { useResponsiveLayout } from '../../src/design/responsive/index.js';
import { haptics } from '../../src/design/haptics/index.js';

// ============================================================================
// Robust Emoji Stripping Sanitizer
// Ensures 100% professional textual integrity across server & user inputs
// ============================================================================

export const cleanInterestName = (name: string): string => {
  return name
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}]/gu,
      ''
    )
    .replace(/[\uFE00-\uFE0F\u200D]/g, '')
    .trim();
};

// ============================================================================
// Internet / Web Passion Suggestions Resolver
// Leverages Wikipedia OpenSearch & DuckDuckGo APIs to discover real entities
// across movies, anime, music, books, cuisine, sports, and culture.
// ============================================================================

export const fetchInternetPassionSuggestions = async (
  query: string,
  _categoryHint?: string,
  signal?: AbortSignal
): Promise<string[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // 1. Try Wikipedia OpenSearch first (accurate, structured real-world pop culture entities)
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      trimmed
    )}&limit=6&namespace=0&format=json`;

    const res = await fetch(searchUrl, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        const rawTitles: string[] = data[1];
        const cleanedTitles = rawTitles
          .map((t) =>
            cleanInterestName(
              t
                .replace(/\s*\([^)]*\)$/, '') // Strip trailing parenthetical disambiguations like (film), (TV series)
                .trim()
            )
          )
          .filter((t) => t.length >= 2 && t.length <= 60);

        // Deduplicate while preserving order
        const unique = Array.from(new Set(cleanedTitles));
        if (unique.length > 0) {
          return unique.slice(0, 5);
        }
      }
    }
  } catch (_err: unknown) {
    if (signal?.aborted) return [];
  }

  // 2. Fallback to DuckDuckGo autocomplete if Wikipedia yielded no results
  try {
    const ddgUrl = `https://duckduckgo.com/ac/?q=${encodeURIComponent(trimmed)}&type=list`;
    const res = await fetch(ddgUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        const rawItems: string[] = data[1];
        const cleaned = rawItems
          .map((t) => cleanInterestName(t.trim()))
          .filter((t) => t.length >= 2 && t.length <= 60);
        const unique = Array.from(new Set(cleaned));
        return unique.slice(0, 5);
      }
    }
  } catch {
    // If offline or aborted, return empty list gracefully
  }

  return [];
};

export interface InternetPassionSuggestion {
  name: string;
  category: string;
}

// ============================================================================
// Intelligent Passion Domain & Category Resolution Engine
// Classifies searched passions into appropriate categories or dynamically
// generates a fitting category for new cultural entities.
// ============================================================================

export const resolveCategoryForPassion = (name: string, context: string = ''): string => {
  const text = `${name} ${context}`.toLowerCase();

  // Anime & Manga
  if (
    /\b(anime|manga|otaku|ghibli|naruto|titan|demon slayer|jujutsu|one piece|dragon ball|death note|bleach|evangelion|shonen|seinen|crunchyroll|haikyu|manhwa|webtoon|cosplay|isekai)\b/.test(
      text
    )
  ) {
    return 'Anime';
  }

  // Gaming & Tech
  if (
    /\b(video game|gaming|game|games|console|playstation|xbox|nintendo|steam|rpg|fps|esports|coding|programming|software|developer|machine learning|ai|crypto|robotics|hardware|linux|tech|computer|cyberpunk|dnd|tabletop|board game|bgmi|minecraft|pokemon)\b/.test(
      text
    )
  ) {
    return 'Gaming & Tech';
  }

  // Movies & Cinema
  if (
    /\b(film|movie|cinema|hollywood|bollywood|tollywood|kollywood|blockbuster|actor|actress|director|directed by|cinematography|oscar|marvel|mcu|dc comics|batman|superman|avengers|star wars|harry potter|potterhead|nolan|tarantino|scorsese|netflix|hbo|documentary|sitcom|tv series|television series|screenplay|rom-com)\b/.test(
      text
    )
  ) {
    return 'Movies & Cinema';
  }

  // Music & Audio
  if (
    /\b(music|song|album|singer|vocalist|band|guitar|drum|drums|composer|rap|hip hop|pop|rock|indie|jazz|blues|classical music|symphony|opera|electronic|edm|dj|techno|metal|punk|r&b|soul|acoustic|vinyl|concert|festival|spotify|soundcloud|podcast|synth|orchestra|musician|taylor swift|bts|drake|coldplay)\b/.test(
      text
    )
  ) {
    return 'Music & Audio';
  }

  // Food & Drink
  if (
    /\b(food|drink|coffee|tea|chai|espresso|latte|dining|restaurant|cuisine|recipe|cooking|baking|chef|sourdough|pasta|pizza|biryani|sushi|ramen|taco|burger|dessert|pastry|chocolate|cocktail|wine|beer|brewery|vegan|vegetarian|street food|bbq|dim sum|brunch|curry|dosa|momo|chaat|maggi)\b/.test(
      text
    )
  ) {
    return 'Food & Drink';
  }

  // Books & Literature
  if (
    /\b(book|books|novel|novels|literature|author|writer|poet|poetry|fiction|non-fiction|fantasy|sci-fi|biography|memoir|reading|reader|book club|kindle|library|bookstore|essay|haruki murakami|tolkien)\b/.test(
      text
    )
  ) {
    return 'Books & Literature';
  }

  // Sports & Fitness
  if (
    /\b(sport|sports|football|soccer|cricket|basketball|tennis|badminton|padel|formula 1|f1|racing|motorsport|gym|fitness|workout|running|marathon|crossfit|bodybuilding|boxing|mma|swimming|cycling|yoga|pilates|athletics|ipl|nba|olympics|athlete|squash|rugby|chess)\b/.test(
      text
    )
  ) {
    return 'Sports & Fitness';
  }

  // Outdoor & Nature
  if (
    /\b(outdoor|nature|hiking|trekking|camping|mountains|mountain|climbing|trail|national park|wildlife|safari|birdwatching|gardening|plants|plant|surfing|diving|scuba|kayaking|skiing|snowboarding|stargazing|astronomy|beach|ocean)\b/.test(
      text
    )
  ) {
    return 'Outdoor & Nature';
  }

  // Travel & Adventure
  if (
    /\b(travel|trip|road trip|solo travel|nomad|backpacking|flight|journey|destination|wanderlust|hostel|resort|city break|tourism|vacation|getaway|cruise|goa|bali|paris|tokyo|iceland)\b/.test(
      text
    )
  ) {
    return 'Travel & Adventure';
  }

  // Arts & Culture
  if (
    /\b(art|painting|drawing|sketch|illustration|sculpture|pottery|ceramic|museum|gallery|architecture|photography|photo|fashion|styling|vintage|thrift|theater|theatre|drama|acting|broadway|dance|ballet|salsa|kathak|bharatanatyam|history|heritage|origami|calligraphy)\b/.test(
      text
    )
  ) {
    return 'Arts & Culture';
  }

  // Science & Knowledge (Automatically generated new category)
  if (
    /\b(science|physics|chemistry|biology|astronomy|astrophysics|space|quantum|mathematics|math|neurology|neuroscience|psychology|philosophy|archeology|geology)\b/.test(
      text
    )
  ) {
    return 'Science & Knowledge';
  }

  // Automotive & Speed (Automatically generated new category)
  if (
    /\b(supercar|supercars|automotive|automobile|motorcycle|superbike|drifting|tuning|karting)\b/.test(
      text
    )
  ) {
    return 'Automotive & Speed';
  }

  // Business & Startups (Automatically generated new category)
  if (
    /\b(startup|startups|business|entrepreneur|entrepreneurship|venture|investing|finance|stocks|equity|economy)\b/.test(
      text
    )
  ) {
    return 'Business & Startups';
  }

  // Lifestyle & Social
  if (
    /\b(pet|pets|dog|dogs|cat|cats|retriever|puppy|animal|volunteering|mindfulness|meditation|journaling|tarot|astrology|zodiac|trivia|comedy|stand-up|karaoke|spirituality|slow living)\b/.test(
      text
    )
  ) {
    return 'Lifestyle & Social';
  }

  return 'Lifestyle & Social';
};

export const fetchInternetPassionSuggestionsWithDetails = async (
  query: string,
  categoryHint?: string,
  signal?: AbortSignal
): Promise<InternetPassionSuggestion[]> => {
  const titles = await fetchInternetPassionSuggestions(query, categoryHint, signal);
  return titles.map((title) => ({
    name: title,
    category: categoryHint || resolveCategoryForPassion(title),
  }));
};

// ============================================================================
// Curated Authentic Fallback Taxonomy (100% Emoji-Free)
// 108 rich, culturally resonant passions spanning 10 distinct categories,
// curated from contemporary dating app benchmarks (Tinder, Bumble, Hinge)
// ============================================================================

const FALLBACK_INTERESTS: InterestItem[] = [
  // --------------------------------------------------------------------------
  // 1. Food & Drink
  // --------------------------------------------------------------------------
  {
    id: 'int_118',
    name: 'Masala Chai & Tapri Strolls',
    slug: 'masala-chai-tapri',
    category: 'Food & Drink',
  },
  {
    id: 'int_119',
    name: 'Biryani Debates & Dawat',
    slug: 'biryani-debates',
    category: 'Food & Drink',
  },
  {
    id: 'int_1',
    name: 'Filter Coffee & Dosas',
    slug: 'filter-coffee',
    category: 'Food & Drink',
  },
  {
    id: 'int_3',
    name: 'Pani Puri & Street Chaat',
    slug: 'street-food',
    category: 'Food & Drink',
  },
  {
    id: 'int_120',
    name: 'Late Night Maggi & Parathas',
    slug: 'late-night-maggi',
    category: 'Food & Drink',
  },
  {
    id: 'int_2',
    name: 'Artisan Cocktails & Speakeasies',
    slug: 'artisan-cocktails',
    category: 'Food & Drink',
  },
  {
    id: 'int_121',
    name: 'Momos & Dim Sum Trails',
    slug: 'momos-dimsum',
    category: 'Food & Drink',
  },
  {
    id: 'int_4',
    name: 'Home Cooking & Rich Spices',
    slug: 'home-cooking',
    category: 'Food & Drink',
  },
  {
    id: 'int_7',
    name: 'Sourdough & Artisan Baking',
    slug: 'baking',
    category: 'Food & Drink',
  },
  {
    id: 'int_46',
    name: 'Ramen & Asian Street Eats',
    slug: 'ramen-asian-food',
    category: 'Food & Drink',
  },
  {
    id: 'int_47',
    name: 'Sushi & Japanese Dining',
    slug: 'sushi-dining',
    category: 'Food & Drink',
  },
  {
    id: 'int_122',
    name: 'Sweet Tooth & Desserts',
    slug: 'sweet-tooth-desserts',
    category: 'Food & Drink',
  },
  {
    id: 'int_5',
    name: 'Wine Tasting & Natural Wines',
    slug: 'wine-tasting',
    category: 'Food & Drink',
  },
  {
    id: 'int_6',
    name: 'Specialty Tea & Matcha',
    slug: 'specialty-tea',
    category: 'Food & Drink',
  },
  {
    id: 'int_48',
    name: 'Plant-Based & Vegan Cooking',
    slug: 'plant-based-vegan',
    category: 'Food & Drink',
  },

  // --------------------------------------------------------------------------
  // 2. Movies & Cinema
  // --------------------------------------------------------------------------
  {
    id: 'int_109',
    name: 'Bollywood & 90s Rom-Coms',
    slug: 'bollywood-romcoms',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_110',
    name: 'Hollywood & Blockbusters',
    slug: 'hollywood-blockbusters',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_111',
    name: 'Harry Potter & Potterheads',
    slug: 'harry-potter-potterheads',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_112',
    name: 'Marvel & DC Universe',
    slug: 'marvel-dc-universe',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_54',
    name: 'Christopher Nolan Films',
    slug: 'christopher-nolan',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_113',
    name: 'South Indian Cinema',
    slug: 'south-indian-cinema',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_60',
    name: 'Rom-Coms & Cozy Rewatches',
    slug: 'rom-coms',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_58',
    name: 'Stand-Up Comedy & Roasts',
    slug: 'standup-comedy',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_15',
    name: 'Indie Cinema & A24',
    slug: 'indie-cinema',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_55',
    name: 'True Crime & Docuseries',
    slug: 'true-crime-docs',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_114',
    name: 'Binge-Watching OTT Series',
    slug: 'binge-watching-ott',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_51',
    name: 'Psychological Thrillers',
    slug: 'psychological-thrillers',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_56',
    name: 'Classic 90s Cult Movies',
    slug: 'classic-cult-cinema',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_57',
    name: 'Horror & Dark Suspense',
    slug: 'horror-suspense',
    category: 'Movies & Cinema',
  },
  {
    id: 'int_52',
    name: 'Sci-Fi & Cyberpunk',
    slug: 'sci-fi-cyberpunk',
    category: 'Movies & Cinema',
  },

  // --------------------------------------------------------------------------
  // 3. Books & Literature
  // --------------------------------------------------------------------------
  {
    id: 'int_115',
    name: 'Harry Potter & Hogwarts',
    slug: 'harry-potter-hogwarts',
    category: 'Books & Literature',
  },
  {
    id: 'int_18',
    name: 'Urdu Poetry, Ghalib & Shayari',
    slug: 'poetry-shayari',
    category: 'Books & Literature',
  },
  {
    id: 'int_29',
    name: 'Contemporary Fiction',
    slug: 'contemporary-fiction',
    category: 'Books & Literature',
  },
  {
    id: 'int_116',
    name: 'Indian Authors & Literature',
    slug: 'indian-authors-lit',
    category: 'Books & Literature',
  },
  {
    id: 'int_63',
    name: 'Mystery, Crime & Agatha Christie',
    slug: 'mystery-thrillers',
    category: 'Books & Literature',
  },
  {
    id: 'int_62',
    name: 'Sci-Fi & Fantasy Epics',
    slug: 'sci-fi-fantasy-books',
    category: 'Books & Literature',
  },
  {
    id: 'int_64',
    name: 'Philosophy & Existentialism',
    slug: 'philosophy-essays',
    category: 'Books & Literature',
  },
  {
    id: 'int_117',
    name: 'Mythology & Epics Retold',
    slug: 'mythology-epics',
    category: 'Books & Literature',
  },
  {
    id: 'int_66',
    name: 'Graphic Novels & Manga',
    slug: 'graphic-novels-manga',
    category: 'Books & Literature',
  },
  {
    id: 'int_65',
    name: 'Book Clubs & Annotations',
    slug: 'book-clubs-annotating',
    category: 'Books & Literature',
  },
  {
    id: 'int_68',
    name: 'Audiobooks on Daily Walks',
    slug: 'audiobooks-walks',
    category: 'Books & Literature',
  },
  {
    id: 'int_67',
    name: 'Biographies & Memoirs',
    slug: 'biographies-memoirs',
    category: 'Books & Literature',
  },
  {
    id: 'int_69',
    name: 'Classic World Literature',
    slug: 'classic-literature',
    category: 'Books & Literature',
  },
  {
    id: 'int_70',
    name: 'Magical Realism & Murakami',
    slug: 'magical-realism',
    category: 'Books & Literature',
  },
  {
    id: 'int_71',
    name: 'Cozy Bookstores & Cafes',
    slug: 'bookstores-cafes',
    category: 'Books & Literature',
  },

  // --------------------------------------------------------------------------
  // 4. Anime
  // --------------------------------------------------------------------------
  {
    id: 'int_53',
    name: 'Studio Ghibli & Miyazaki',
    slug: 'anime-ghibli',
    category: 'Anime',
  },
  {
    id: 'int_138',
    name: 'Shonen & Action Anime',
    slug: 'shonen-action-anime',
    category: 'Anime',
  },
  {
    id: 'int_139',
    name: 'Attack on Titan & Dark Fantasy',
    slug: 'aot-dark-fantasy',
    category: 'Anime',
  },
  {
    id: 'int_140',
    name: 'Jujutsu Kaisen & Demon Slayer',
    slug: 'jjk-demon-slayer',
    category: 'Anime',
  },
  {
    id: 'int_141',
    name: 'Death Note & Mind Games',
    slug: 'death-note-psychological',
    category: 'Anime',
  },
  {
    id: 'int_142',
    name: 'Manga & Manhwa Readers',
    slug: 'manga-manhwa-reading',
    category: 'Anime',
  },
  {
    id: 'int_143',
    name: 'Slice of Life & Cozy Anime',
    slug: 'slice-of-life-anime',
    category: 'Anime',
  },
  {
    id: 'int_144',
    name: 'Makoto Shinkai & Coziness',
    slug: 'makoto-shinkai-films',
    category: 'Anime',
  },
  {
    id: 'int_145',
    name: 'Cyberpunk & Mecha Classics',
    slug: 'cyberpunk-mecha-anime',
    category: 'Anime',
  },
  {
    id: 'int_146',
    name: 'Anime Movie Nights & Marathons',
    slug: 'anime-movie-nights',
    category: 'Anime',
  },
  {
    id: 'int_147',
    name: 'Cosplay & Comic Con Vibes',
    slug: 'cosplay-comic-con',
    category: 'Anime',
  },
  {
    id: 'int_148',
    name: 'Anime Soundtracks & Openings',
    slug: 'anime-ost-openings',
    category: 'Anime',
  },

  // --------------------------------------------------------------------------
  // 5. Music & Audio
  // --------------------------------------------------------------------------
  {
    id: 'int_123',
    name: 'Bollywood Classics & Arijit Singh',
    slug: 'bollywood-classics',
    category: 'Music & Audio',
  },
  {
    id: 'int_124',
    name: 'Punjabi Hits & AP Dhillon',
    slug: 'punjabi-hits-diljit',
    category: 'Music & Audio',
  },
  {
    id: 'int_10',
    name: 'Sufi, Ghazals & Qawwalis',
    slug: 'sufi-ghazals',
    category: 'Music & Audio',
  },
  {
    id: 'int_125',
    name: 'Coke Studio & Fusion',
    slug: 'coke-studio-fusion',
    category: 'Music & Audio',
  },
  {
    id: 'int_73',
    name: 'Indian Indie & Acoustic Pop',
    slug: 'indie-rock-pop',
    category: 'Music & Audio',
  },
  {
    id: 'int_9',
    name: 'Live Concerts & Gigs',
    slug: 'live-gigs',
    category: 'Music & Audio',
  },
  {
    id: 'int_12',
    name: 'Electronic, Techno & Sunburn',
    slug: 'electronic-techno',
    category: 'Music & Audio',
  },
  {
    id: 'int_8',
    name: 'Hindustani Classical',
    slug: 'hindustani-classical',
    category: 'Music & Audio',
  },
  {
    id: 'int_11',
    name: 'Vinyl Records & Turntables',
    slug: 'vinyl-records',
    category: 'Music & Audio',
  },
  {
    id: 'int_126',
    name: '90s & 2000s Nostalgia Tracks',
    slug: '90s-nostalgia-tracks',
    category: 'Music & Audio',
  },
  {
    id: 'int_13',
    name: 'Jazz, Soul & Blues Lounges',
    slug: 'jazz-blues',
    category: 'Music & Audio',
  },
  {
    id: 'int_14',
    name: 'Deep Dive Podcasts',
    slug: 'podcasts',
    category: 'Music & Audio',
  },
  {
    id: 'int_72',
    name: 'Hip-Hop, Desi Hip-Hop & Rap',
    slug: 'hip-hop-rnb',
    category: 'Music & Audio',
  },
  {
    id: 'int_75',
    name: 'Lo-Fi & Late Night Sessions',
    slug: 'lo-fi-sessions',
    category: 'Music & Audio',
  },

  // --------------------------------------------------------------------------
  // 5. Arts & Culture
  // --------------------------------------------------------------------------
  {
    id: 'int_17',
    name: 'Heritage & Monument Walks',
    slug: 'architecture',
    category: 'Arts & Culture',
  },
  {
    id: 'int_19',
    name: '35mm Film Photography',
    slug: 'film-photography',
    category: 'Arts & Culture',
  },
  {
    id: 'int_21',
    name: 'Prithvi Theatre & Plays',
    slug: 'theater',
    category: 'Arts & Culture',
  },
  {
    id: 'int_131',
    name: 'Classical & Folk Dance',
    slug: 'classical-folk-dance',
    category: 'Arts & Culture',
  },
  {
    id: 'int_16',
    name: 'Modern Indian Art & Galleries',
    slug: 'modern-art',
    category: 'Arts & Culture',
  },
  {
    id: 'int_43',
    name: 'Pottery & Ceramic Studios',
    slug: 'pottery',
    category: 'Arts & Culture',
  },
  {
    id: 'int_34',
    name: 'Vintage Thrifting & Handlooms',
    slug: 'vintage-thrifting',
    category: 'Arts & Culture',
  },
  {
    id: 'int_77',
    name: 'Creative Writing & Shayari',
    slug: 'creative-writing',
    category: 'Arts & Culture',
  },
  {
    id: 'int_78',
    name: 'Painting & Watercolor',
    slug: 'painting-watercolor',
    category: 'Arts & Culture',
  },
  {
    id: 'int_20',
    name: 'Museums & Exhibitions',
    slug: 'museums-galleries',
    category: 'Arts & Culture',
  },

  // --------------------------------------------------------------------------
  // 6. Active & Outdoors
  // --------------------------------------------------------------------------
  {
    id: 'int_22',
    name: 'Weekend Trekking & Summits',
    slug: 'weekend-trekking',
    category: 'Active & Outdoors',
  },
  {
    id: 'int_23',
    name: 'Heritage Walking Tours',
    slug: 'heritage-walks',
    category: 'Active & Outdoors',
  },
  {
    id: 'int_24',
    name: 'Trail Running & Marathons',
    slug: 'running',
    category: 'Active & Outdoors',
  },
  {
    id: 'int_25',
    name: 'Yoga, Pranayama & Mind',
    slug: 'yoga-mindfulness',
    category: 'Active & Outdoors',
  },
  {
    id: 'int_26',
    name: 'Gravel Cycling & Road Rides',
    slug: 'cycling',
    category: 'Active & Outdoors',
  },
  {
    id: 'int_27',
    name: 'Surfing & Ocean Swims',
    slug: 'scuba-surfing',
    category: 'Active & Outdoors',
  },
  {
    id: 'int_28',
    name: 'Bouldering & Rock Climbing',
    slug: 'rock-climbing',
    category: 'Active & Outdoors',
  },
  {
    id: 'int_80',
    name: 'Wild Camping & Stargazing',
    slug: 'camping-stargazing',
    category: 'Active & Outdoors',
  },
  {
    id: 'int_81',
    name: 'Scuba Diving & Coral Reefs',
    slug: 'scuba-diving',
    category: 'Active & Outdoors',
  },
  {
    id: 'int_82',
    name: 'Pilates & Core Movement',
    slug: 'pilates-movement',
    category: 'Active & Outdoors',
  },

  // --------------------------------------------------------------------------
  // 7. Sports & Fitness
  // --------------------------------------------------------------------------
  {
    id: 'int_35',
    name: 'Cricket & IPL Nights',
    slug: 'cricket',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_37',
    name: 'Premier League Football',
    slug: 'football',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_83',
    name: 'Badminton & Gully Matches',
    slug: 'badminton',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_36',
    name: 'Formula 1 Race Weekends',
    slug: 'formula-1',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_40',
    name: 'Gym, Powerlifting & Calisthenics',
    slug: 'gym-calisthenics',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_39',
    name: 'Chess Tactics & Blitz Games',
    slug: 'chess',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_38',
    name: 'Tennis, Padel & Pickleball',
    slug: 'tennis-padel',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_136',
    name: 'Morning Runs & Marathons',
    slug: 'morning-runs-marathons',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_84',
    name: 'Boxing & Martial Arts',
    slug: 'boxing-mma',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_85',
    name: 'Swimming & Lap Workouts',
    slug: 'swimming-laps',
    category: 'Sports & Fitness',
  },
  {
    id: 'int_86',
    name: 'Basketball & Street Courts',
    slug: 'basketball',
    category: 'Sports & Fitness',
  },

  // --------------------------------------------------------------------------
  // 8. Gaming & Tech
  // --------------------------------------------------------------------------
  {
    id: 'int_87',
    name: 'PC & Console Gaming',
    slug: 'pc-console-gaming',
    category: 'Gaming & Tech',
  },
  {
    id: 'int_30',
    name: 'Board Games & Catan Nights',
    slug: 'board-games',
    category: 'Gaming & Tech',
  },
  {
    id: 'int_132',
    name: 'Chess & Tactical Battles',
    slug: 'chess-tactics-battles',
    category: 'Gaming & Tech',
  },
  {
    id: 'int_133',
    name: 'BGMI & Mobile Gaming',
    slug: 'bgmi-mobile-gaming',
    category: 'Gaming & Tech',
  },
  {
    id: 'int_41',
    name: 'Creative Coding & Open Source',
    slug: 'creative-coding',
    category: 'Gaming & Tech',
  },
  {
    id: 'int_44',
    name: 'AI, LLMs & Futurism',
    slug: 'ai-futurism',
    category: 'Gaming & Tech',
  },
  {
    id: 'int_45',
    name: 'Custom Mechanical Keyboards',
    slug: 'mechanical-keyboards',
    category: 'Gaming & Tech',
  },
  {
    id: 'int_88',
    name: 'Dungeons & Dragons Tabletop',
    slug: 'dnd-tabletop',
    category: 'Gaming & Tech',
  },
  {
    id: 'int_89',
    name: 'Indie Game Development',
    slug: 'indie-game-dev',
    category: 'Gaming & Tech',
  },
  {
    id: 'int_90',
    name: 'Cybersecurity & Tech Culture',
    slug: 'cybersecurity-tech',
    category: 'Gaming & Tech',
  },

  // --------------------------------------------------------------------------
  // 9. Travel & Adventure
  // --------------------------------------------------------------------------
  {
    id: 'int_127',
    name: 'Goa Sunsets & Shack Hopping',
    slug: 'goa-beach-sunsets',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_100',
    name: 'Himachal & Mountain Treks',
    slug: 'mountain-sunrises',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_128',
    name: 'Spiti & Ladakh Road Trips',
    slug: 'spiti-ladakh-roadtrips',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_106',
    name: 'Train Journeys & Window Seats',
    slug: 'train-journeys',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_32',
    name: 'Solo Backpacking & Hostels',
    slug: 'solo-traveling',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_129',
    name: 'Pondicherry & French Quarters',
    slug: 'pondicherry-french-quarters',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_93',
    name: 'Scenic Road Trips & Detours',
    slug: 'road-trips',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_137',
    name: 'Wild Camping & Stargazing',
    slug: 'camping-stargazing-travel',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_102',
    name: 'Passport Stamps & City Breaks',
    slug: 'city-breaks',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_130',
    name: 'Heritage Forts & Palaces',
    slug: 'heritage-forts-palaces',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_103',
    name: 'Island Hopping & Scuba',
    slug: 'island-hopping',
    category: 'Travel & Adventure',
  },
  {
    id: 'int_107',
    name: 'Desert Safaris & Campfires',
    slug: 'desert-safaris',
    category: 'Travel & Adventure',
  },

  // --------------------------------------------------------------------------
  // 10. Lifestyle & Social
  // --------------------------------------------------------------------------
  {
    id: 'int_134',
    name: 'Late Night Drives & Chai Stops',
    slug: 'late-night-drives-chai',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_31',
    name: 'Dog & Puppy Parent (Indie Rescues)',
    slug: 'pet-lover',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_92',
    name: 'Cat Aficionado & Rescues',
    slug: 'cat-aficionado',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_94',
    name: 'Chai Pe Charcha & Deep Talks',
    slug: 'late-night-talks',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_95',
    name: 'Plant Parent & Balcony Jungles',
    slug: 'plant-parent',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_135',
    name: 'Festival Celebrations & Lights',
    slug: 'festivals-celebrations',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_96',
    name: 'Weekend Flea & Farmers Markets',
    slug: 'farmers-markets',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_97',
    name: 'Volunteering & Social Causes',
    slug: 'volunteering-causes',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_98',
    name: 'Astrology & Birth Charts',
    slug: 'astrology-charts',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_99',
    name: 'Slow Living & Intentionality',
    slug: 'slow-living',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_33',
    name: 'Astronomy & Stargazing',
    slug: 'astronomy',
    category: 'Lifestyle & Social',
  },
  {
    id: 'int_108',
    name: 'Mindful Coffee Strolls',
    slug: 'coffee-strolls',
    category: 'Lifestyle & Social',
  },
];

// ============================================================================
// Semantic Icon Resolver
// Maps passion keywords and slugs to dedicated vector icons
// ============================================================================

const getInterestIcon = (item: { slug?: string; name: string; category?: string }): LucideIcon => {
  const key = `${item.slug || ''} ${item.name.toLowerCase()} ${item.category?.toLowerCase() || ''}`;

  // Food & Drink
  if (
    key.includes('coffee') ||
    key.includes('tea') ||
    key.includes('matcha') ||
    key.includes('chai') ||
    key.includes('boba') ||
    key.includes('pour-over')
  )
    return Coffee;
  if (
    key.includes('wine') ||
    key.includes('cocktail') ||
    key.includes('speakeasy') ||
    key.includes('brew') ||
    key.includes('beer')
  )
    return Wine;
  if (
    key.includes('food') ||
    key.includes('cook') ||
    key.includes('chaat') ||
    key.includes('baking') ||
    key.includes('bake') ||
    key.includes('sourdough') ||
    key.includes('ramen') ||
    key.includes('sushi') ||
    key.includes('dining') ||
    key.includes('vegan') ||
    key.includes('plant-based') ||
    key.includes('spice') ||
    key.includes('biryani') ||
    key.includes('maggi') ||
    key.includes('momo') ||
    key.includes('dessert') ||
    key.includes('dosa')
  )
    return UtensilsCrossed;

  // Music & Audio - Bollywood / Punjabi / Coke Studio
  if (
    key.includes('bollywood') &&
    (key.includes('music') || key.includes('classic') || key.includes('arijit'))
  )
    return Music;
  if (
    key.includes('punjabi') ||
    key.includes('dhillon') ||
    key.includes('coke studio') ||
    key.includes('sufi') ||
    key.includes('ghazal') ||
    key.includes('qawwali') ||
    key.includes('classical') ||
    key.includes('vinyl') ||
    key.includes('techno') ||
    key.includes('jazz') ||
    key.includes('hip-hop') ||
    key.includes('rock') ||
    key.includes('music') ||
    key.includes('acoustic') ||
    key.includes('nostalgia')
  )
    return Music;

  // Movies & Cinema
  if (
    key.includes('bollywood') ||
    key.includes('hollywood') ||
    key.includes('cinema') ||
    key.includes('film') ||
    key.includes('movie') ||
    key.includes('a24') ||
    key.includes('nolan') ||
    key.includes('festival')
  )
    return Film;
  if (
    key.includes('docuseries') ||
    key.includes('documentary') ||
    key.includes('series') ||
    key.includes('rewatch') ||
    key.includes('ott')
  )
    return Tv;
  if (
    key.includes('shonen') ||
    key.includes('titan') ||
    key.includes('jujutsu') ||
    key.includes('slayer')
  )
    return Flame;
  if (
    key.includes('ghibli') ||
    key.includes('miyazaki') ||
    key.includes('cosplay') ||
    key.includes('comic con') ||
    key.includes('potter') ||
    key.includes('hogwarts') ||
    key.includes('marvel') ||
    key.includes('dc')
  )
    return Sparkles;
  if (key.includes('anime')) return Flame;
  if (key.includes('comedy') || key.includes('stand-up') || key.includes('roast')) return Mic;
  if (key.includes('horror') || key.includes('suspense') || key.includes('thriller'))
    return Clapperboard;

  // Books & Literature
  if (
    key.includes('book') ||
    key.includes('literature') ||
    key.includes('fiction') ||
    key.includes('reading') ||
    key.includes('novel') ||
    key.includes('biograph') ||
    key.includes('memoir') ||
    key.includes('manga') ||
    key.includes('dystopia') ||
    key.includes('mythology') ||
    key.includes('author') ||
    key.includes('christie')
  )
    return BookOpen;
  if (
    key.includes('poetry') ||
    key.includes('shayari') ||
    key.includes('write') ||
    key.includes('writing') ||
    key.includes('journal') ||
    key.includes('philosoph')
  )
    return PenTool;
  if (key.includes('audiobook')) return Headphones;

  // Arts & Culture
  if (key.includes('photo') || key.includes('camera') || key.includes('35mm')) return Camera;
  if (
    key.includes('art') ||
    key.includes('paint') ||
    key.includes('pottery') ||
    key.includes('ceramic') ||
    key.includes('gallery') ||
    key.includes('watercolor')
  )
    return Palette;
  if (
    key.includes('architecture') ||
    key.includes('heritage') ||
    key.includes('museum') ||
    key.includes('theater') ||
    key.includes('prithvi') ||
    key.includes('monument') ||
    key.includes('fort') ||
    key.includes('palace')
  )
    return Landmark;
  if (
    key.includes('thrift') ||
    key.includes('vintage') ||
    key.includes('fashion') ||
    key.includes('handloom')
  )
    return Sparkles;

  // Active & Outdoors
  if (
    key.includes('trek') ||
    key.includes('hike') ||
    key.includes('mountain') ||
    key.includes('climbing') ||
    key.includes('boulder') ||
    key.includes('camp') ||
    key.includes('summit') ||
    key.includes('spiti') ||
    key.includes('ladakh') ||
    key.includes('himachal')
  )
    return Mountain;
  if (
    key.includes('run') ||
    key.includes('marathon') ||
    key.includes('cycling') ||
    key.includes('scuba') ||
    key.includes('surfing') ||
    key.includes('swim') ||
    key.includes('dance')
  )
    return Activity;
  if (key.includes('walk') || key.includes('stroll') || key.includes('trail')) return Footprints;
  if (
    key.includes('yoga') ||
    key.includes('mindful') ||
    key.includes('meditation') ||
    key.includes('breathwork') ||
    key.includes('pilates') ||
    key.includes('pranayama')
  )
    return Sun;

  // Sports & Fitness
  if (
    key.includes('gym') ||
    key.includes('calisthenics') ||
    key.includes('fitness') ||
    key.includes('workout') ||
    key.includes('powerlifting') ||
    key.includes('boxing') ||
    key.includes('martial')
  )
    return Dumbbell;
  if (
    key.includes('cricket') ||
    key.includes('football') ||
    key.includes('formula') ||
    key.includes('tennis') ||
    key.includes('padel') ||
    key.includes('badminton') ||
    key.includes('basketball') ||
    key.includes('ipl')
  )
    return Trophy;
  if (key.includes('chess') || key.includes('tactics')) return Trophy;

  // Gaming & Tech
  if (
    key.includes('gaming') ||
    key.includes('game') ||
    key.includes('console') ||
    key.includes('board') ||
    key.includes('catan') ||
    key.includes('dnd') ||
    key.includes('tabletop') ||
    key.includes('arcade') ||
    key.includes('bgmi')
  )
    return Gamepad2;
  if (
    key.includes('code') ||
    key.includes('coding') ||
    key.includes('software') ||
    key.includes('dev')
  )
    return Code;
  if (
    key.includes('ai') ||
    key.includes('futurism') ||
    key.includes('keyboard') ||
    key.includes('robot') ||
    key.includes('cyber')
  )
    return Cpu;

  // Travel & Adventure
  if (
    key.includes('backpack') ||
    key.includes('island') ||
    key.includes('safari') ||
    key.includes('train') ||
    key.includes('journey') ||
    key.includes('flight') ||
    key.includes('hostel') ||
    key.includes('goa') ||
    key.includes('pondicherry')
  )
    return Plane;
  if (
    key.includes('road trip') ||
    key.includes('detour') ||
    key.includes('explore') ||
    key.includes('exploration') ||
    key.includes('drive')
  )
    return Compass;

  // Lifestyle & Social
  if (key.includes('pet') || key.includes('dog') || key.includes('cat') || key.includes('puppy'))
    return Heart;
  if (key.includes('travel') || key.includes('solo') || key.includes('trip')) return Plane;
  if (
    key.includes('star') ||
    key.includes('astronomy') ||
    key.includes('astrology') ||
    key.includes('talk') ||
    key.includes('slow living') ||
    key.includes('plant') ||
    key.includes('festiv') ||
    key.includes('light')
  )
    return Sparkles;

  // Fallbacks by category
  if (item.category?.toLowerCase().includes('food')) return UtensilsCrossed;
  if (item.category?.toLowerCase().includes('anime')) return Flame;
  if (
    item.category?.toLowerCase().includes('movie') ||
    item.category?.toLowerCase().includes('cinema')
  )
    return Film;
  if (
    item.category?.toLowerCase().includes('book') ||
    item.category?.toLowerCase().includes('read')
  )
    return BookOpen;
  if (item.category?.toLowerCase().includes('music')) return Music;
  if (item.category?.toLowerCase().includes('art')) return Palette;
  if (
    item.category?.toLowerCase().includes('outdoor') ||
    item.category?.toLowerCase().includes('active')
  )
    return Mountain;
  if (
    item.category?.toLowerCase().includes('sport') ||
    item.category?.toLowerCase().includes('fitness')
  )
    return Trophy;
  if (
    item.category?.toLowerCase().includes('tech') ||
    item.category?.toLowerCase().includes('game') ||
    item.category?.toLowerCase().includes('creative')
  )
    return Gamepad2;
  if (
    item.category?.toLowerCase().includes('travel') ||
    item.category?.toLowerCase().includes('adventure')
  )
    return Plane;

  return Sparkles;
};

// Category Icon Mapping for Cards and Modal
const getCategoryIcon = (category: string): LucideIcon => {
  const cat = category.toLowerCase();
  if (cat.includes('food') || cat.includes('drink')) return UtensilsCrossed;
  if (cat.includes('anime')) return Flame;
  if (cat.includes('movie') || cat.includes('cinema') || cat.includes('film') || cat.includes('tv'))
    return Film;
  if (cat.includes('book') || cat.includes('read') || cat.includes('literature')) return BookOpen;
  if (cat.includes('music') || cat.includes('sound') || cat.includes('audio')) return Headphones;
  if (cat.includes('art') || cat.includes('culture')) return Palette;
  if (cat.includes('outdoor') || cat.includes('active')) return Mountain;
  if (cat.includes('sport') || cat.includes('fitness')) return Trophy;
  if (cat.includes('game') || cat.includes('gaming') || cat.includes('tech')) return Gamepad2;
  if (cat.includes('travel') || cat.includes('adventure')) return Plane;
  if (
    cat.includes('science') ||
    cat.includes('knowledge') ||
    cat.includes('space') ||
    cat.includes('astro')
  )
    return Sparkles;
  if (cat.includes('auto') || cat.includes('speed') || cat.includes('car')) return Compass;
  if (cat.includes('business') || cat.includes('startup') || cat.includes('finance'))
    return Landmark;
  if (cat.includes('lifestyle') || cat.includes('social') || cat.includes('leisure'))
    return Sparkles;
  return Sparkles;
};

// ============================================================================
// Main Screen Component
// ============================================================================

export default function OnboardingInterestsScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const { maxContentWidth } = useResponsiveLayout();
  const profileApi = getDefaultProfileApi();

  // Load Folkra brand font
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../../assets/fonts/folkra.ttf'),
  });
  const folkraFont = fontsLoaded ? 'Folkra' : undefined;

  // Scroll listener for glossy top vignette
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });
  const headerGlossOpacity = scrollY.interpolate({
    inputRange: [0, 20, 60],
    outputRange: [0, 0.45, 1],
    extrapolate: 'clamp',
  });

  const { draftInterests, toggleDraftInterest, setDraftInterests } = useOnboardingStore();

  const [availableInterests, setAvailableInterests] = useState<InterestItem[]>(FALLBACK_INTERESTS);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setRawErrorMessage] = useState<string | undefined>();
  const errorAnim = useRef(new Animated.Value(0)).current;
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryShakeAnim = useRef(new Animated.Value(0)).current;

  const dismissError = () => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    Animated.timing(errorAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setRawErrorMessage(undefined);
    });
  };

  const showTemporaryError = (msg: string, durationMs = 1300) => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    setRawErrorMessage(msg);
    errorAnim.setValue(0);
    Animated.timing(errorAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    errorTimeoutRef.current = setTimeout(() => {
      Animated.timing(errorAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setRawErrorMessage(undefined);
      });
    }, durationMs);
  };

  const setErrorMessage = (msg?: string) => {
    if (!msg) {
      dismissError();
    } else {
      showTemporaryError(msg);
    }
  };

  const triggerCategoriesShake = () => {
    categoryShakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(categoryShakeAnim, {
        toValue: -5.5,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(categoryShakeAnim, {
        toValue: 5,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(categoryShakeAnim, {
        toValue: -3.5,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(categoryShakeAnim, {
        toValue: 2.5,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.timing(categoryShakeAnim, {
        toValue: -1,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(categoryShakeAnim, {
        toValue: 0,
        duration: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<string | null>(null);
  const [activeCategoryModal, setActiveCategoryModal] = useState<string | null>(null);

  // Preserve modal category during exit animation so list contents never abruptly vanish or collapse
  useEffect(() => {
    if (selectedCategoryModal) {
      setActiveCategoryModal(selectedCategoryModal);
    }
  }, [selectedCategoryModal]);

  const currentCategory = selectedCategoryModal || activeCategoryModal;
  const [categorySearchText, setCategorySearchText] = useState('');
  const [internetSuggestions, setInternetSuggestions] = useState<string[]>([]);
  const [isSearchingInternet, setIsSearchingInternet] = useState(false);
  const [isSavingInterest, setIsSavingInterest] = useState(false);
  // Main screen search internet suggestions & loading state
  const [mainSearchSuggestions, setMainSearchSuggestions] = useState<InternetPassionSuggestion[]>(
    []
  );
  const [isMainSearchingInternet, setIsMainSearchingInternet] = useState(false);
  // Track keyboard height to adjust scrollable content padding inside category modal
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 300);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Ensure no passions are selected by default on initial entry
  useEffect(() => {
    if (draftInterests.length < 3 && draftInterests.length > 0) {
      setDraftInterests([]);
    }
  }, []);

  useEffect(() => {
    trackOnboardingEvent('interests_viewed');
    let isMounted = true;

    (async () => {
      try {
        const taxonomy = await profileApi.getInterestsTaxonomy();
        if (isMounted && taxonomy && taxonomy.length > 0) {
          setAvailableInterests(taxonomy);
        }
      } catch {
        // Fallback taxonomy used gracefully
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sanitized taxonomy: guarantees zero emojis anywhere in UI
  const sanitizedTaxonomy = useMemo(() => {
    return availableInterests.map((item) => ({
      ...item,
      name: cleanInterestName(item.name),
    }));
  }, [availableInterests]);

  // Debounced internet suggestions query when searching inside the category modal
  useEffect(() => {
    const trimmed = categorySearchText.trim();
    if (trimmed.length < 2) {
      setInternetSuggestions([]);
      setIsSearchingInternet(false);
      return;
    }

    const controller = new AbortController();
    setIsSearchingInternet(true);

    const timer = setTimeout(async () => {
      try {
        const results = await fetchInternetPassionSuggestions(
          trimmed,
          currentCategory || undefined,
          controller.signal
        );

        if (!controller.signal.aborted) {
          // Filter out results that are already in the taxonomy
          const filtered = results.filter((title) => {
            const titleLower = title.toLowerCase();
            return !sanitizedTaxonomy.some((item) => item.name.toLowerCase() === titleLower);
          });
          setInternetSuggestions(filtered);
        }
      } catch {
        if (!controller.signal.aborted) {
          setInternetSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingInternet(false);
        }
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [categorySearchText, currentCategory, sanitizedTaxonomy]);

  // Debounced internet suggestions query when searching from the main page search bar
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setMainSearchSuggestions([]);
      setIsMainSearchingInternet(false);
      return;
    }

    const controller = new AbortController();
    setIsMainSearchingInternet(true);

    const timer = setTimeout(async () => {
      try {
        const results = await fetchInternetPassionSuggestionsWithDetails(
          trimmed,
          undefined,
          controller.signal
        );

        if (!controller.signal.aborted) {
          // Filter out results that are already in the taxonomy
          const filtered = results.filter((suggestion) => {
            const suggestionLower = suggestion.name.toLowerCase();
            return !sanitizedTaxonomy.some((item) => item.name.toLowerCase() === suggestionLower);
          });
          setMainSearchSuggestions(filtered);
        }
      } catch {
        if (!controller.signal.aborted) {
          setMainSearchSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsMainSearchingInternet(false);
        }
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, sanitizedTaxonomy]);

  // Dynamically resolve/predict the most fitting category for current search query
  const predictedCategory = useMemo(() => {
    return resolveCategoryForPassion(searchQuery.trim());
  }, [searchQuery]);

  // Distinct category list for cards
  const categoryCards = useMemo(() => {
    return Array.from(new Set(sanitizedTaxonomy.map((item) => item.category || 'General')));
  }, [sanitizedTaxonomy]);

  // Passions for the actively opened category modal (retained during close animation to prevent shrinking)
  const modalCategoryItems = useMemo(() => {
    if (!currentCategory) return [];
    return sanitizedTaxonomy.filter((item) => (item.category || 'General') === currentCategory);
  }, [sanitizedTaxonomy, currentCategory]);

  const modalCategorySelectedCount = useMemo(() => {
    return modalCategoryItems.filter((item) => draftInterests.includes(item.id)).length;
  }, [modalCategoryItems, draftInterests]);

  // Filtered passions inside the modal when searching in-category
  const filteredModalCategoryItems = useMemo(() => {
    const trimmed = categorySearchText.trim().toLowerCase();
    if (!trimmed) return modalCategoryItems;
    return modalCategoryItems.filter((item) => item.name.toLowerCase().includes(trimmed));
  }, [modalCategoryItems, categorySearchText]);

  // Check if current category search query exactly matches an existing passion in this category
  const hasCategoryExactMatch = useMemo(() => {
    const trimmed = categorySearchText.trim().toLowerCase();
    if (!trimmed) return false;
    return modalCategoryItems.some((item) => item.name.toLowerCase() === trimmed);
  }, [modalCategoryItems, categorySearchText]);

  // Filtered interests when actively typing in the search bar
  const searchResults = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return sanitizedTaxonomy.filter((item) => {
      return (
        item.name.toLowerCase().includes(trimmed) ||
        (item.slug && item.slug.toLowerCase().includes(trimmed)) ||
        (item.category && item.category.toLowerCase().includes(trimmed))
      );
    });
  }, [sanitizedTaxonomy, searchQuery]);

  // Map of category to selected count (for visual category badges)
  const categorySelectedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of sanitizedTaxonomy) {
      if (draftInterests.includes(item.id)) {
        const cat = item.category || 'General';
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [sanitizedTaxonomy, draftInterests]);

  const handleToggle = (id: string) => {
    const isSelected = draftInterests.includes(id);
    if (!isSelected && draftInterests.length >= 10) {
      haptics.notificationError();
      setErrorMessage('You can select a maximum of 10 passions.');
      return;
    }

    haptics.selection();
    toggleDraftInterest(id);
    if (errorMessage) setErrorMessage(undefined);

    if (isSelected) {
      trackOnboardingEvent('interest_deselected', { interestId: id });
    } else {
      trackOnboardingEvent('interest_selected', { interestId: id });
    }
  };

  // Add custom or community-sourced passion: saves permanently in the DB and selects it
  const handleCreateAndSelectInterest = async (rawName: string, category: string) => {
    const cleaned = cleanInterestName(rawName).trim();
    if (!cleaned) return;

    if (draftInterests.length >= 10) {
      haptics.notificationError();
      setErrorMessage('You can select a maximum of 10 passions.');
      return;
    }

    // Check if it already exists in taxonomy
    const existing = sanitizedTaxonomy.find((i) => i.name.toLowerCase() === cleaned.toLowerCase());

    if (existing) {
      if (!draftInterests.includes(existing.id)) {
        haptics.selection();
        toggleDraftInterest(existing.id);
      }
      setCategorySearchText('');
      setInternetSuggestions([]);
      setMainSearchSuggestions((prev) =>
        prev.filter((s) => s.name.toLowerCase() !== cleaned.toLowerCase())
      );
      if (errorMessage) setErrorMessage(undefined);
      return;
    }

    setIsSavingInterest(true);
    haptics.impactMedium();

    try {
      // 1. Permanently persist in the database
      const created = await profileApi.createInterest({
        name: cleaned,
        category,
      });

      // 2. Add to available interests & select
      setAvailableInterests((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
      toggleDraftInterest(created.id);
      haptics.notificationSuccess();
      trackOnboardingEvent('interest_selected', {
        interestId: created.id,
      });
    } catch {
      // Offline fallback: create local with valid UUIDv7 so app flow continues smoothly
      const fallbackId = generateUuidV7();
      const fallbackSlug = cleaned
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const fallbackItem: InterestItem = {
        id: fallbackId,
        name: cleaned,
        slug: fallbackSlug || 'custom-passion',
        category,
      };
      setAvailableInterests((prev) => [fallbackItem, ...prev]);
      toggleDraftInterest(fallbackId);
      haptics.notificationSuccess();
    } finally {
      setIsSavingInterest(false);
      setCategorySearchText('');
      setInternetSuggestions([]);
      setMainSearchSuggestions((prev) =>
        prev.filter((s) => s.name.toLowerCase() !== cleaned.toLowerCase())
      );
      if (errorMessage) setErrorMessage(undefined);
    }
  };

  // Unified search passions list combining catalog matches, web-discovered passions,
  // and the user's typed search term with auto-resolved category
  const searchPassions = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];

    const list: Array<{
      id?: string;
      name: string;
      category: string;
      isSelected: boolean;
    }> = [];
    const seen = new Set<string>();

    // 1. Existing catalog matches (from sanitizedTaxonomy)
    for (const item of searchResults) {
      const lower = item.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        list.push({
          id: item.id,
          name: item.name,
          category: item.category || 'Lifestyle & Social',
          isSelected: draftInterests.includes(item.id),
        });
      }
    }

    // 2. Internet suggestions matching user query
    for (const suggestion of mainSearchSuggestions) {
      const lower = suggestion.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        const existingItem = sanitizedTaxonomy.find((i) => i.name.toLowerCase() === lower);
        list.push({
          id: existingItem?.id,
          name: suggestion.name,
          category: suggestion.category,
          isSelected: existingItem ? draftInterests.includes(existingItem.id) : false,
        });
      }
    }

    // 3. User's typed search term (if not already present)
    const cleanedTyped = cleanInterestName(trimmed);
    const lowerTyped = cleanedTyped.toLowerCase();
    if (cleanedTyped.length >= 2 && !seen.has(lowerTyped)) {
      seen.add(lowerTyped);
      const existingItem = sanitizedTaxonomy.find((i) => i.name.toLowerCase() === lowerTyped);
      list.push({
        id: existingItem?.id,
        name: cleanedTyped,
        category: predictedCategory,
        isSelected: existingItem ? draftInterests.includes(existingItem.id) : false,
      });
    }

    return list;
  }, [
    searchQuery,
    searchResults,
    mainSearchSuggestions,
    sanitizedTaxonomy,
    predictedCategory,
    draftInterests,
  ]);

  const handleSelectSearchPassion = async (item: {
    id?: string;
    name: string;
    category: string;
    isSelected: boolean;
  }) => {
    Keyboard.dismiss();
    setSearchQuery('');
    setMainSearchSuggestions([]);

    if (item.id) {
      handleToggle(item.id);
      return;
    }
    const existing = sanitizedTaxonomy.find(
      (t) => t.name.toLowerCase() === item.name.toLowerCase()
    );
    if (existing) {
      handleToggle(existing.id);
      return;
    }
    await handleCreateAndSelectInterest(item.name, item.category);
  };

  const handleBack = () => {
    haptics.impactLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(onboarding)/photos');
    }
  };

  const handleNext = async () => {
    if (draftInterests.length < 3) {
      haptics.notificationError();
      triggerCategoriesShake();
      setErrorMessage('Please select at least 3 passions that represent you.');
      return;
    }

    haptics.impactMedium();
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      await profileApi.updateMyInterests({ interestIds: draftInterests });
      trackOnboardingEvent('interests_completed', { count: draftInterests.length });
      router.push('/(onboarding)/prompts');
    } catch {
      // Offline fallback: store holds draft and flow continues
      trackOnboardingEvent('interests_completed', { count: draftInterests.length });
      router.push('/(onboarding)/prompts');
    } finally {
      setIsLoading(false);
    }
  };

  const isMinimumMet = draftInterests.length >= 3;
  const count = draftInterests.length;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0B0E' : '#FAFAFA' }]}>
      {/* Specular Frosted Top Vignette (Fades in dynamically on scroll) */}
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

      {/* Floating Circular Back Button on top left */}
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
        <ArrowLeft size={19} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth || 540,
            width: '100%',
            alignSelf: 'center',
            paddingTop: Math.max(insets.top + 60, 72),
            paddingBottom: Math.max(insets.bottom + 210, 240),
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ======================================================== */}
        {/* Header Section (with clean unboxed 03 / 06 step counter) */}
        {/* ======================================================== */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Heading
              level="h1"
              style={[styles.title, { fontFamily: folkraFont, color: theme.colors.textPrimary }]}
            >
              What are you into?
            </Heading>

            {/* Clean unboxed 03 / 06 step counter */}
            <View style={styles.stepBadgeInline}>
              <Text
                style={[
                  styles.stepCurrentText,
                  { color: theme.colors.textPrimary, fontFamily: folkraFont },
                ]}
              >
                03
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

          <Text level="body" color="secondary" style={styles.subtitle}>
            Select 3 to 10 passions to help us curate profiles who share your rhythm and creative
            soul.
          </Text>
        </View>

        {/* Compact, Professional Validation Pill */}
        {errorMessage && (
          <Animated.View
            style={[
              styles.compactErrorPill,
              {
                backgroundColor: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.05)',
                borderColor: isDark ? 'rgba(244, 63, 94, 0.24)' : 'rgba(244, 63, 94, 0.18)',
                opacity: errorAnim,
                transform: [
                  {
                    translateY: errorAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-4, 0],
                    }),
                  },
                  {
                    scale: errorAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <AlertCircle
              size={12.5}
              color={isDark ? '#FB7185' : '#E11D48'}
              strokeWidth={2.4}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[styles.compactErrorText, { color: isDark ? '#FDA4AF' : '#E11D48' }]}
              numberOfLines={1}
            >
              {errorMessage}
            </Text>
            <TouchableOpacity
              onPress={() => dismissError()}
              style={styles.compactErrorDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notice"
            >
              <X
                size={11}
                color={isDark ? 'rgba(253, 164, 175, 0.65)' : 'rgba(225, 29, 72, 0.65)'}
                strokeWidth={2.5}
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ======================================================== */}
        {/* Compact, Non-Boxy Curation & Rhythm Progress Bar */}
        {/* ======================================================== */}
        <View style={styles.compactRhythmSection}>
          <View style={styles.compactRhythmHeader}>
            <View style={styles.compactRhythmStatusCluster}>
              <View
                style={[
                  styles.statusIndicatorDot,
                  {
                    backgroundColor: isMinimumMet ? '#10B981' : theme.colors.textTertiary,
                  },
                ]}
              />
              <Text style={[styles.compactRhythmStatusText, { color: theme.colors.textSecondary }]}>
                {count === 0
                  ? 'Select at least 3 passions to continue'
                  : count < 3
                    ? `${3 - count} more needed for minimum`
                    : count === 10
                      ? 'Maximum 10 passions selected'
                      : `Minimum reached • ${10 - count} optional open`}
              </Text>
            </View>

            <Text
              style={[
                styles.compactRhythmCountText,
                {
                  color: isMinimumMet ? theme.colors.textPrimary : theme.colors.textTertiary,
                  fontFamily: folkraFont,
                },
              ]}
            >
              {count}/10
            </Text>
          </View>

          {/* 10-Segment Progress Rail */}
          <View style={styles.compactSegmentRail}>
            {Array.from({ length: 10 }).map((_, idx) => {
              const isFilled = idx < count;
              const isMandatory = idx < 3;
              return (
                <View
                  key={`rail-tick-${idx}`}
                  style={[
                    styles.compactSegmentTick,
                    {
                      backgroundColor: isFilled
                        ? isDark
                          ? '#FFFFFF'
                          : '#121216'
                        : isMandatory
                          ? isDark
                            ? 'rgba(255, 255, 255, 0.16)'
                            : '#DCDCE0'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : '#ECECF0',
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* ======================================================== */}
        {/* Search Input Bar (Fully Functional for Searching & Custom Passions) */}
        {/* ======================================================== */}
        <View
          style={[
            styles.searchBarContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F4F4F6',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E4E7',
            },
          ]}
        >
          <Search size={16} color={theme.colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
            placeholder="Search or type any passion..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (errorMessage) setErrorMessage(undefined);
            }}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={() => {
              if (searchPassions[0]) {
                handleSelectSearchPassion(searchPassions[0]);
              }
            }}
            clearButtonMode="never"
          />
          {isMainSearchingInternet && (
            <ActivityIndicator
              size="small"
              color={theme.colors.textTertiary}
              style={{ marginRight: 6 }}
            />
          )}
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search input"
            >
              <X size={14} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ======================================================== */}
        {/* Passions Matching Search Query (Catalog & Web Discovery) */}
        {/* ======================================================== */}
        {searchQuery.trim() !== '' && (
          <View style={styles.searchSectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.sectionHeading,
                  { color: theme.colors.textSecondary, fontFamily: folkraFont },
                ]}
              >
                PASSIONS
              </Text>
              {isMainSearchingInternet ? (
                <ActivityIndicator size="small" color={theme.colors.textTertiary} />
              ) : (
                <Text style={[styles.sectionCountHint, { color: theme.colors.textTertiary }]}>
                  {searchPassions.length} {searchPassions.length === 1 ? 'match' : 'matches'}
                </Text>
              )}
            </View>

            {searchPassions.length === 0 && !isMainSearchingInternet ? (
              <View style={styles.emptyStateContainer}>
                <View
                  style={[
                    styles.emptyStateIconCircle,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F1F4' },
                  ]}
                >
                  <Search size={20} color={theme.colors.textTertiary} />
                </View>
                <Text
                  style={[
                    styles.emptyStateTitle,
                    { color: theme.colors.textPrimary, fontFamily: folkraFont },
                  ]}
                >
                  NO PASSIONS FOUND
                </Text>
                <Text style={[styles.emptyStateSubtitle, { color: theme.colors.textSecondary }]}>
                  {`No passions match "${searchQuery.trim()}". Try typing another passion.`}
                </Text>
              </View>
            ) : (
              <View style={styles.chipGrid}>
                {searchPassions.map((item) => {
                  const isSelected = item.isSelected;
                  const PassionIcon = getInterestIcon(item);

                  return (
                    <TouchableOpacity
                      key={`search-passion-${item.name}`}
                      onPress={() => handleSelectSearchPassion(item)}
                      style={[
                        styles.passionCard,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#FFFFFF'
                              : '#121216'
                            : isDark
                              ? '#121216'
                              : '#FFFFFF',
                          borderColor: isSelected
                            ? isDark
                              ? '#FFFFFF'
                              : '#121216'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : '#E4E4E7',
                        },
                      ]}
                      activeOpacity={0.82}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={`${item.name}, ${isSelected ? 'selected' : 'unselected'}`}
                    >
                      <View
                        style={[
                          styles.passionIconCircle,
                          {
                            backgroundColor: isSelected
                              ? isDark
                                ? '#0B0B0E'
                                : '#FFFFFF'
                              : isDark
                                ? 'rgba(255, 255, 255, 0.06)'
                                : '#F4F4F6',
                          },
                        ]}
                      >
                        {isSelected ? (
                          <Check
                            size={12}
                            color={isDark ? '#FFFFFF' : '#0B0B0E'}
                            strokeWidth={2.8}
                          />
                        ) : (
                          <PassionIcon size={12.5} color={theme.colors.textSecondary} />
                        )}
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            styles.passionCardTitle,
                            {
                              color: isSelected
                                ? isDark
                                  ? '#0B0B0E'
                                  : '#FFFFFF'
                                : theme.colors.textPrimary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {item.category && (
                          <Text
                            style={[
                              styles.passionCardCategoryBadge,
                              {
                                color: isSelected
                                  ? isDark
                                    ? 'rgba(0, 0, 0, 0.65)'
                                    : 'rgba(255, 255, 255, 0.70)'
                                  : theme.colors.textTertiary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            • {item.category}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* Category Cards Grid (Rounded Squared Cards)             */}
        {/* Always visible so marked categories reflect live!       */}
        {/* ======================================================== */}
        <View
          style={[styles.categorySectionContainer, searchQuery.trim() !== '' && { marginTop: 14 }]}
        >
          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionHeading,
                { color: theme.colors.textSecondary, fontFamily: folkraFont },
              ]}
            >
              CATEGORIES
            </Text>
            <Text style={[styles.sectionCountHint, { color: theme.colors.textTertiary }]}>
              Tap to explore & select
            </Text>
          </View>

          <Animated.View
            style={[styles.categoryGrid, { transform: [{ translateX: categoryShakeAnim }] }]}
          >
            {categoryCards.map((category) => {
              const CatIcon = getCategoryIcon(category);
              const categoryItems = sanitizedTaxonomy.filter(
                (i) => (i.category || 'General') === category
              );
              const selectedCount = categorySelectedCounts[category] || 0;
              const hasSelections = selectedCount > 0;

              return (
                <TouchableOpacity
                  key={`cat-card-${category}`}
                  onPress={() => {
                    haptics.impactLight();
                    setSelectedCategoryModal(category);
                  }}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: isDark
                        ? hasSelections
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(255, 255, 255, 0.035)'
                        : hasSelections
                          ? '#FFFFFF'
                          : '#FFFFFF',
                      borderColor: hasSelections
                        ? isDark
                          ? 'rgba(255, 255, 255, 0.35)'
                          : '#121216'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : '#E4E4E7',
                    },
                  ]}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={`${category}, ${hasSelections ? `${selectedCount} selected` : `${categoryItems.length} passions`}`}
                >
                  {/* Top-Right Badge showing count selected */}
                  {hasSelections && (
                    <View
                      style={[
                        styles.categoryCardTopBadge,
                        {
                          backgroundColor: isDark ? '#FFFFFF' : '#121216',
                        },
                      ]}
                    >
                      <Check size={9.5} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      <Text
                        style={[
                          styles.categoryCardTopBadgeText,
                          { color: isDark ? '#000000' : '#FFFFFF' },
                        ]}
                      >
                        {selectedCount}
                      </Text>
                    </View>
                  )}

                  {/* Icon in the Middle */}
                  <View
                    style={[
                      styles.categoryCardIconCircle,
                      {
                        backgroundColor: isDark
                          ? hasSelections
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(255, 255, 255, 0.06)'
                          : hasSelections
                            ? 'rgba(0, 0, 0, 0.06)'
                            : '#F4F4F6',
                      },
                    ]}
                  >
                    <CatIcon
                      size={28}
                      color={
                        hasSelections
                          ? isDark
                            ? '#FFFFFF'
                            : '#000000'
                          : isDark
                            ? '#E4E4E7'
                            : '#27272A'
                      }
                      strokeWidth={1.9}
                    />
                  </View>

                  {/* Text in the Bottom */}
                  <View style={styles.categoryCardBottomWrap}>
                    <Text
                      style={[
                        styles.categoryCardTitle,
                        {
                          color: theme.colors.textPrimary,
                          fontFamily: folkraFont,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {category}
                    </Text>
                    <Text
                      style={[
                        styles.categoryCardSubtitle,
                        {
                          color: theme.colors.textTertiary,
                          fontWeight: '500',
                        },
                      ]}
                    >
                      {`${categoryItems.length} passions`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          {/* Bottom clearance spacer so bottom cards are never covered by floating action button */}
          <View style={styles.categoryGridBottomSpacer} />
        </View>
      </Animated.ScrollView>

      {/* ======================================================== */}
      {/* Floating Bottom Action Dock with 8-Stop Feather Fade     */}
      {/* ======================================================== */}
      <View style={styles.floatingDock} pointerEvents="box-none">
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
          {/* Professional CTA Button (Solid, Non-See-Through Button) */}
          <TouchableOpacity
            onPress={handleNext}
            disabled={isLoading}
            style={[
              styles.professionalCtaButton,
              {
                backgroundColor: isMinimumMet
                  ? isDark
                    ? '#FFFFFF'
                    : '#121216'
                  : isDark
                    ? '#222228'
                    : '#E4E4E7',
                borderColor: isMinimumMet
                  ? isDark
                    ? 'transparent'
                    : 'rgba(0, 0, 0, 0.12)'
                  : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.08)',
                borderWidth: isMinimumMet ? (isDark ? 0 : 1) : 1,
                shadowColor: '#000000',
                shadowOpacity: isMinimumMet ? (isDark ? 0.28 : 0.12) : 0.06,
                opacity: isLoading ? 0.75 : 1,
              },
            ]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={
              isMinimumMet
                ? `Continue to prompts (${count} selected)`
                : count === 0
                  ? 'Select at least 3 passions to continue (0 of 3 selected)'
                  : `Select at least 3 passions (${count} of 3 required)`
            }
            testID="interests-continue-button"
          >
            {isLoading ? (
              <ActivityIndicator
                size="small"
                color={
                  isMinimumMet ? (isDark ? '#000000' : '#FFFFFF') : isDark ? '#A1A1AA' : '#71717A'
                }
              />
            ) : (
              <View style={styles.buttonInnerRow}>
                <Text
                  style={[
                    styles.professionalCtaText,
                    {
                      color: isMinimumMet
                        ? isDark
                          ? '#000000'
                          : '#FFFFFF'
                        : isDark
                          ? '#8E8E93'
                          : '#71717A',
                      fontFamily: folkraFont,
                    },
                  ]}
                >
                  {count < 3
                    ? count === 0
                      ? 'Select at least 3 passions (0/3)'
                      : `Select ${3 - count} more passion${3 - count > 1 ? 's' : ''} (${count}/3)`
                    : `Continue to Prompts (${count} selected)`}
                </Text>
                {isMinimumMet && (
                  <ArrowRight
                    size={17}
                    color={isDark ? '#000000' : '#FFFFFF'}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.dockFootnoteText, { color: theme.colors.textTertiary }]}>
            You can refine or add more passions anytime in your profile settings.
          </Text>
        </View>
      </View>

      {/* ======================================================== */}
      {/* Category Passions Bottom Sheet Modal (Basics Page Style)  */}
      {/* ======================================================== */}
      <SmoothBottomSheetModal
        visible={!!selectedCategoryModal}
        onClose={() => {
          Keyboard.dismiss();
          setSelectedCategoryModal(null);
        }}
        onDismiss={() => {
          setActiveCategoryModal(null);
          setCategorySearchText('');
          setInternetSuggestions([]);
        }}
        height="86%"
        disableKeyboardAvoiding={true}
        sheetStyle={{
          paddingBottom: Math.max(insets.bottom + 12, 28),
        }}
        showHandle={true}
      >
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={Keyboard.dismiss}
            style={{ flex: 1, paddingRight: 8 }}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: theme.colors.textPrimary, fontFamily: folkraFont },
              ]}
            >
              {currentCategory || ''}
            </Text>
            <Text level="caption" color="tertiary" style={{ marginTop: 2 }}>
              {modalCategorySelectedCount > 0
                ? `${modalCategorySelectedCount} selected • ${modalCategoryItems.length} curated passions`
                : `${modalCategoryItems.length} curated passions • select what resonates with you`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              haptics.selection();
              Keyboard.dismiss();
              setSelectedCategoryModal(null);
            }}
            style={[
              styles.modalCloseBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F1F4',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close category modal"
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
          <TextInput
            style={[styles.modalSearchInput, { color: theme.colors.textPrimary }]}
            placeholder={`Search in ${currentCategory || 'category'} or web...`}
            placeholderTextColor={theme.colors.textTertiary}
            value={categorySearchText}
            onChangeText={setCategorySearchText}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (
                categorySearchText.trim().length >= 2 &&
                currentCategory &&
                !hasCategoryExactMatch
              ) {
                handleCreateAndSelectInterest(categorySearchText.trim(), currentCategory);
              }
            }}
          />
          {isSearchingInternet ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.textTertiary}
              style={{ marginRight: 4 }}
            />
          ) : categorySearchText.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setCategorySearchText('');
                setInternetSuggestions([]);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Passions Scroll Area */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.modalScrollContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 16 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
        >
          {categorySearchText.trim().length > 0 ? (
            /* Search / Suggestion Mode inside category modal */
            <View>
              {/* 1. In-Category Curated Matches */}
              {filteredModalCategoryItems.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <View style={styles.modalSubSectionHeader}>
                    <Text
                      style={[
                        styles.modalSubSectionTitle,
                        { color: theme.colors.textSecondary, fontFamily: folkraFont },
                      ]}
                    >
                      {`IN ${currentCategory?.toUpperCase() || 'CATEGORY'}`}
                    </Text>
                    <Text
                      style={[styles.modalSubSectionCount, { color: theme.colors.textTertiary }]}
                    >
                      {`${filteredModalCategoryItems.length} found`}
                    </Text>
                  </View>
                  <View style={styles.modalChipsGrid}>
                    {filteredModalCategoryItems.map((item) => {
                      const isSelected = draftInterests.includes(item.id);
                      const PassionIcon = getInterestIcon(item);

                      return (
                        <TouchableOpacity
                          key={`modal-${item.id}`}
                          onPress={() => handleToggle(item.id)}
                          style={[
                            styles.passionCard,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                  ? '#FFFFFF'
                                  : '#121216'
                                : isDark
                                  ? 'rgba(255, 255, 255, 0.06)'
                                  : '#F4F4F6',
                              borderColor: isSelected
                                ? isDark
                                  ? '#FFFFFF'
                                  : '#121216'
                                : isDark
                                  ? 'rgba(255, 255, 255, 0.09)'
                                  : '#E4E4E7',
                            },
                          ]}
                          activeOpacity={0.82}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                          accessibilityLabel={`${item.name}, ${isSelected ? 'selected' : 'unselected'}`}
                        >
                          <View
                            style={[
                              styles.passionIconCircle,
                              {
                                backgroundColor: isSelected
                                  ? isDark
                                    ? '#0B0B0E'
                                    : '#FFFFFF'
                                  : isDark
                                    ? 'rgba(255, 255, 255, 0.06)'
                                    : '#FFFFFF',
                              },
                            ]}
                          >
                            {isSelected ? (
                              <Check
                                size={12}
                                color={isDark ? '#FFFFFF' : '#0B0B0E'}
                                strokeWidth={2.8}
                              />
                            ) : (
                              <PassionIcon size={12.5} color={theme.colors.textSecondary} />
                            )}
                          </View>

                          <Text
                            style={[
                              styles.passionCardTitle,
                              {
                                color: isSelected
                                  ? isDark
                                    ? '#0B0B0E'
                                    : '#FFFFFF'
                                  : theme.colors.textPrimary,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 2. Web Suggestions from the Internet */}
              {internetSuggestions.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <View style={styles.modalSubSectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Globe
                        size={12.5}
                        color={theme.colors.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.modalSubSectionTitle,
                          { color: theme.colors.textSecondary, fontFamily: folkraFont },
                        ]}
                      >
                        SUGGESTIONS FROM WEB
                      </Text>
                    </View>
                    <Text
                      style={[styles.modalSubSectionCount, { color: theme.colors.textTertiary }]}
                    >
                      Tap to add & select
                    </Text>
                  </View>

                  <View style={styles.modalChipsGrid}>
                    {internetSuggestions.map((suggestion) => (
                      <TouchableOpacity
                        key={`web-sugg-${suggestion}`}
                        onPress={() => {
                          if (currentCategory) {
                            handleCreateAndSelectInterest(suggestion, currentCategory);
                          }
                        }}
                        disabled={isSavingInterest}
                        style={[
                          styles.webSuggestionCard,
                          {
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E4E4E7',
                          },
                        ]}
                        activeOpacity={0.78}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${suggestion} from web to ${currentCategory}`}
                      >
                        <View
                          style={[
                            styles.webSuggestionIconWrap,
                            {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F4F4F6',
                            },
                          ]}
                        >
                          <Sparkles size={12} color={theme.colors.textPrimary} />
                        </View>
                        <Text
                          style={[styles.webSuggestionText, { color: theme.colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {suggestion}
                        </Text>
                        <View
                          style={[
                            styles.webSuggestionPill,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.12)'
                                : 'rgba(0, 0, 0, 0.06)',
                            },
                          ]}
                        >
                          <Plus
                            size={11}
                            color={theme.colors.textPrimary}
                            strokeWidth={2.5}
                            style={{ marginRight: 3 }}
                          />
                          <Text
                            style={[
                              styles.webSuggestionPillText,
                              { color: theme.colors.textPrimary },
                            ]}
                          >
                            Add
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* 3. Ask user to add if not in catalog / internet */}
              {!hasCategoryExactMatch &&
                categorySearchText.trim().length >= 2 &&
                currentCategory && (
                  <TouchableOpacity
                    onPress={() =>
                      handleCreateAndSelectInterest(categorySearchText.trim(), currentCategory)
                    }
                    disabled={isSavingInterest}
                    style={[
                      styles.modalAddCustomCard,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F4F4F6',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E4E4E7',
                      },
                    ]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${categorySearchText.trim()} to ${currentCategory}`}
                  >
                    <View
                      style={[
                        styles.modalAddCustomIconBadge,
                        { backgroundColor: isDark ? '#FFFFFF' : '#121216' },
                      ]}
                    >
                      <Plus size={14} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                    </View>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text
                        style={[styles.modalAddCustomTitle, { color: theme.colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {`Add "${cleanInterestName(categorySearchText.trim())}"`}
                      </Text>
                      <Text
                        style={[styles.modalAddCustomSub, { color: theme.colors.textTertiary }]}
                      >
                        {internetSuggestions.length === 0 && !isSearchingInternet
                          ? `Not found on web? Add permanently to ${currentCategory} database & select`
                          : `Add permanently to ${currentCategory} database & select`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.modalAddCustomPill,
                        { backgroundColor: isDark ? '#FFFFFF' : '#121216' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalAddCustomPillText,
                          { color: isDark ? '#000000' : '#FFFFFF' },
                        ]}
                      >
                        Add & Select
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

              {/* 4. Empty Fallback State when zero results anywhere */}
              {filteredModalCategoryItems.length === 0 &&
                internetSuggestions.length === 0 &&
                !isSearchingInternet &&
                categorySearchText.trim().length >= 2 && (
                  <View style={styles.modalEmptyNotice}>
                    <Text
                      style={[styles.modalEmptyNoticeText, { color: theme.colors.textTertiary }]}
                    >
                      {`No pre-existing catalog or web matches found. Tap "Add & Select" above to save "${cleanInterestName(categorySearchText.trim())}" permanently to our ${currentCategory} database!`}
                    </Text>
                  </View>
                )}
            </View>
          ) : (
            /* Standard Curated Passions Grid */
            <View style={styles.modalChipsGrid}>
              {modalCategoryItems.map((item) => {
                const isSelected = draftInterests.includes(item.id);
                const PassionIcon = getInterestIcon(item);

                return (
                  <TouchableOpacity
                    key={`modal-${item.id}`}
                    onPress={() => handleToggle(item.id)}
                    style={[
                      styles.passionCard,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? '#FFFFFF'
                            : '#121216'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : '#F4F4F6',
                        borderColor: isSelected
                          ? isDark
                            ? '#FFFFFF'
                            : '#121216'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.09)'
                            : '#E4E4E7',
                      },
                    ]}
                    activeOpacity={0.82}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${item.name}, ${isSelected ? 'selected' : 'unselected'}`}
                  >
                    <View
                      style={[
                        styles.passionIconCircle,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#0B0B0E'
                              : '#FFFFFF'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : '#FFFFFF',
                        },
                      ]}
                    >
                      {isSelected ? (
                        <Check size={12} color={isDark ? '#FFFFFF' : '#0B0B0E'} strokeWidth={2.8} />
                      ) : (
                        <PassionIcon size={12.5} color={theme.colors.textSecondary} />
                      )}
                    </View>

                    <Text
                      style={[
                        styles.passionCardTitle,
                        {
                          color: isSelected
                            ? isDark
                              ? '#0B0B0E'
                              : '#FFFFFF'
                            : theme.colors.textPrimary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Confirm / Done Button */}
        <View style={{ marginTop: 14, marginBottom: 4 }}>
          <TouchableOpacity
            style={[
              styles.confirmCustomButton,
              {
                backgroundColor: theme.colors.textPrimary,
                height: 48,
              },
            ]}
            onPress={() => {
              haptics.notificationSuccess();
              Keyboard.dismiss();
              setSelectedCategoryModal(null);
            }}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Done selecting passions in this category"
          >
            <Text
              style={{
                color: isDark ? '#000000' : '#FFFFFF',
                fontWeight: '700',
                fontSize: 14.5,
                fontFamily: folkraFont,
              }}
            >
              {modalCategorySelectedCount > 0
                ? `Done (${modalCategorySelectedCount} Selected)`
                : 'Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </SmoothBottomSheetModal>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
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
  content: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.6,
    flex: 1,
  },
  // Clean unboxed 03 / 06 step counter
  stepBadgeInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 12,
  },
  stepCurrentText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stepDividerText: {
    fontSize: 14,
    fontWeight: '400',
    marginHorizontal: 2,
  },
  stepTotalText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  compactErrorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 5.5,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  compactErrorText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  compactErrorDismiss: {
    marginLeft: 7,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Compact, Non-Boxy Curation & Rhythm Progress Bar
  compactRhythmSection: {
    marginBottom: 14,
  },
  compactRhythmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  compactRhythmStatusCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  statusIndicatorDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    marginRight: 7,
  },
  compactRhythmStatusText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  compactRhythmCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  compactSegmentRail: {
    flexDirection: 'row',
    gap: 3.5,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactSegmentTick: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
  },
  // Search Results Wrap & Section Header
  searchSectionWrap: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionCountHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Search Bar Styles
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  // Custom Passion Action Card
  customPassionActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  customPassionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  customPassionActionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  customPassionActionSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  customPassionAddPill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  customPassionAddPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  // Category Cards Section & Grid (Rounded Squared Cards)
  categorySectionContainer: {
    marginBottom: 16,
  },
  categoryGridBottomSpacer: {
    height: 36,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  categoryCard: {
    width: '48%',
    aspectRatio: 1.05,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryCardTopBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 2,
  },
  categoryCardTopBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  categoryCardIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  categoryCardBottomWrap: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 2,
  },
  categoryCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 2.5,
  },
  categoryCardSubtitle: {
    fontSize: 11.5,
    textAlign: 'center',
  },
  // Empty State
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyStateIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Modal Sheet Styles (Matching Basics Page)
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
  modalScrollContent: {
    paddingVertical: 4,
  },
  modalChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  modalSubSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  modalSubSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  modalSubSectionCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  webSuggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 6,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  webSuggestionIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  webSuggestionText: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: -0.1,
    marginRight: 8,
  },
  webSuggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  webSuggestionPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalAddCustomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 10,
  },
  modalAddCustomIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalAddCustomTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  modalAddCustomSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  modalAddCustomPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAddCustomPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalEmptyNotice: {
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  modalEmptyNoticeText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  confirmCustomButton: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Multi-option fluid side-by-side chip grid
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    alignItems: 'center',
  },
  passionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 7,
    paddingRight: 11,
    paddingVertical: 6,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  passionIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  passionCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  passionCardCategoryBadge: {
    fontSize: 9.5,
    fontWeight: '500',
    marginTop: 1.5,
    letterSpacing: 0.1,
  },
  webSuggestionCategoryTag: {
    fontSize: 9.5,
    fontWeight: '500',
    marginTop: 1.5,
    letterSpacing: 0.1,
  },
  inlineAddBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  // Floating Bottom Dock with Feathered Fade (Matching photos.tsx)
  floatingDock: {
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
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dockFootnoteText: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
