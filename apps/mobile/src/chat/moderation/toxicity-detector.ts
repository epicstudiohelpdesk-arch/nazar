/**
 * AI & Heuristic Toxic Message Detection ("Are You Sure?" / AYS Intervention)
 *
 * Evaluates message text client-side before sending to prevent harassment,
 * hate speech, threats, and unsolicited sexually explicit advances.
 */

export interface ToxicityResult {
  readonly isToxic: boolean;
  readonly score: number; // 0.0 to 1.0
  readonly reason?: string;
  readonly categories: readonly string[];
}

interface PatternRule {
  readonly pattern: RegExp;
  readonly weight: number;
  readonly category: string;
  readonly reason: string;
}

const TOXIC_PATTERNS: readonly PatternRule[] = [
  // 1. Threats & Violence
  {
    pattern: /\b(kill\s+your?self|die\s+bitch|gonna\s+hurt\s+you|beat\s+the\s+shit|shoot\s+you|cut\s+you|slit\s+your|choke\s+you)\b/i,
    weight: 0.95,
    category: 'THREAT_OR_VIOLENCE',
    reason: 'Language containing direct threats of harm or violence.',
  },
  // 2. Severe Personal Harassment & Abuse
  {
    pattern: /\b(you('re|\s+are)\s+(ugly|disgusting|fat|stupid|pathetic|worthless|a\s+bitch|a\s+whore|a\s+slut|trash))\b/i,
    weight: 0.85,
    category: 'HARASSMENT',
    reason: 'Personal insults or demeaning comments targeted at the recipient.',
  },
  {
    pattern: /\b(bitch|whore|slut|cunt|bastard|piece\s+of\s+shit|go\s+to\s+hell|waste\s+of\s+space)\b/i,
    weight: 0.75,
    category: 'ABUSIVE_LANGUAGE',
    reason: 'Profane or derogatory terms that violate our respectful community standards.',
  },
  // 3. Unsolicited Explicit Sexual Demands
  {
    pattern: /\b(send\s+(nudes?|naked|tits|boobs|dick\s*pic|pussy)|show\s+me\s+your\s+(body|tits|boobs|pussy|ass)|wanna\s+fuck|let\s+me\s+fuck|suck\s+my\s+dick)\b/i,
    weight: 0.85,
    category: 'SEXUAL_HARASSMENT',
    reason: 'Unsolicited sexually explicit demands or solicitation.',
  },
  // 4. Hate Speech & Slurs
  {
    pattern: /\b(nigger|faggot|retard|kike|chink|wetback|tranny|dyke)\b/i,
    weight: 1.0,
    category: 'HATE_SPEECH',
    reason: 'Discriminatory slurs or hate speech targeting identity groups.',
  },
];

/**
 * Evaluates candidate message text for toxicity.
 * Returns a score between 0.0 and 1.0, and marks isToxic = true when score >= 0.70.
 */
export function detectToxicity(text: string): ToxicityResult {
  const normalized = text.trim();
  if (!normalized) {
    return { isToxic: false, score: 0, categories: [] };
  }

  let maxWeight = 0;
  let primaryReason: string | undefined;
  const matchedCategories = new Set<string>();

  for (const rule of TOXIC_PATTERNS) {
    if (rule.pattern.test(normalized)) {
      matchedCategories.add(rule.category);
      if (rule.weight > maxWeight) {
        maxWeight = rule.weight;
        primaryReason = rule.reason;
      }
    }
  }

  return {
    isToxic: maxWeight >= 0.7,
    score: maxWeight,
    reason: primaryReason,
    categories: Array.from(matchedCategories),
  };
}
