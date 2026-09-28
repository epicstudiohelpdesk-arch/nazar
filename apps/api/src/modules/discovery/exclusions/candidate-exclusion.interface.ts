export interface ICandidateExclusionProvider {
  /**
   * Retrieves user IDs that must be excluded from discovery for the requesting user
   * (e.g., future likes, passes, matches from Gate 07, or blocks/moderation from Gate 09).
   */
  getExcludedUserIds(viewerUserId: string): Promise<readonly string[]>;
}

export const CANDIDATE_EXCLUSION_PROVIDER_TOKEN = Symbol('ICandidateExclusionProvider');
