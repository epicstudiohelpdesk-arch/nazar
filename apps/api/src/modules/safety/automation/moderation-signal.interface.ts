import type { ReportTargetType, ModerationDecisionOutcome } from '@platform/api-contracts';

/**
 * Moderation Automation Extension Point (Requirement 40)
 * Allows future text classifiers, image classifiers, spam detection, and ML risk scoring
 * to plug in without modifying the core moderation case lifecycle.
 */
export interface ModerationInput {
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly content?: string;
  readonly mediaUrl?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ModerationSignal {
  readonly score: number;
  readonly flagged: boolean;
  readonly category?: string;
  readonly recommendedAction?: ModerationDecisionOutcome;
  readonly reasoning?: string;
}

export interface IModerationSignalProvider {
  analyze(input: ModerationInput): Promise<ModerationSignal>;
}

export const MODERATION_SIGNAL_PROVIDER_TOKEN = Symbol('IModerationSignalProvider');

export class NoopModerationSignalProvider implements IModerationSignalProvider {
  async analyze(_input: ModerationInput): Promise<ModerationSignal> {
    return {
      score: 0,
      flagged: false,
    };
  }
}
