import { Injectable } from '@nestjs/common';
import type { ICandidateExclusionProvider } from './candidate-exclusion.interface.js';

@Injectable()
export class DefaultCandidateExclusionService implements ICandidateExclusionProvider {
  /**
   * Baseline implementation returns empty exclusions until Gate 07/09
   * registers interaction and blocking storage providers.
   */
  async getExcludedUserIds(_viewerUserId: string): Promise<readonly string[]> {
    return [];
  }
}
