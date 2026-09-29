import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import {
  ErrorCode,
  type RecommendationMode,
  type RecommendationResponseDto,
  type DiscoveryItemDto,
  type UserFeatureVector,
  type Gender,
  getDistanceBucket,
  type PublicProfileResponse,
} from '@platform/api-contracts';
import { calculateAge } from '@platform/validation';
import { generateUuidV7 } from '@platform/domain';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import {
  PROFILE_REPOSITORY_TOKEN,
  type IProfileRepository,
} from '../../profiles/repositories/profile.repository.js';
import {
  PREFERENCES_REPOSITORY_TOKEN,
  type IPreferencesRepository,
} from '../../profiles/repositories/preferences.repository.js';
import {
  CANDIDATE_REPOSITORY_TOKEN,
  type ICandidateRepository,
  type HydratedProfileComponents,
} from '../../discovery/repositories/candidate.repository.interface.js';
import {
  CANDIDATE_RANKER_TOKEN,
  type ICandidateRanker,
} from '../../discovery/ranker/candidate-ranker.interface.js';
import {
  CANDIDATE_EXCLUSION_PROVIDER_TOKEN,
  type ICandidateExclusionProvider,
} from '../../discovery/exclusions/candidate-exclusion.interface.js';
import {
  USER_RESTRICTIONS_REPOSITORY_TOKEN,
  type IUserRestrictionsRepository,
} from '../../safety/repositories/user-restrictions.repository.interface.js';
import {
  USER_FEATURES_REPOSITORY_TOKEN,
  type IUserFeaturesRepository,
} from '../repositories/user-features.repository.interface.js';
import {
  EXPOSURES_REPOSITORY_TOKEN,
  type IExposuresRepository,
} from '../repositories/exposures.repository.interface.js';
import {
  MODEL_VERSIONS_REPOSITORY_TOKEN,
  type IModelVersionsRepository,
} from '../repositories/model-versions.repository.interface.js';
import {
  RECOMMENDATION_CURSOR_SERVICE_TOKEN,
  type IRecommendationCursorService,
} from '../cursor/recommendation-cursor.service.js';
import {
  RECOMMENDATION_MODEL_TOKEN,
  type IRecommendationModel,
  type RecommendationContext,
  type CandidateWithFeatures,
  DEFAULT_RECOMMENDATION_CONFIG,
  type RecommendationRankingConfig,
} from '../models/recommendation-model.interface.js';
import { FeatureExtractorService } from '../features/feature-extractor.service.js';
import type {
  DiscoveryViewerContext,
  CandidateRecord,
} from '../../discovery/domain/discovery.types.js';

export interface GetRecommendationsOptions {
  readonly mode?: RecommendationMode;
  readonly limit?: number;
  readonly cursor?: string;
  readonly requestId?: string;
}

@Injectable()
export class RecommendationEngineService {
  private readonly logger = new Logger(RecommendationEngineService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(PROFILE_REPOSITORY_TOKEN)
    private readonly profileRepo: IProfileRepository,
    @Inject(PREFERENCES_REPOSITORY_TOKEN)
    private readonly preferencesRepo: IPreferencesRepository,
    @Inject(CANDIDATE_REPOSITORY_TOKEN)
    private readonly candidateRepo: ICandidateRepository,
    @Inject(CANDIDATE_RANKER_TOKEN)
    private readonly candidateRanker: ICandidateRanker,
    @Inject(CANDIDATE_EXCLUSION_PROVIDER_TOKEN)
    private readonly exclusionProvider: ICandidateExclusionProvider,
    @Inject(USER_RESTRICTIONS_REPOSITORY_TOKEN)
    private readonly userRestrictionsRepo: IUserRestrictionsRepository,
    @Inject(USER_FEATURES_REPOSITORY_TOKEN)
    private readonly userFeaturesRepo: IUserFeaturesRepository,
    @Inject(EXPOSURES_REPOSITORY_TOKEN)
    private readonly exposuresRepo: IExposuresRepository,
    @Inject(MODEL_VERSIONS_REPOSITORY_TOKEN)
    private readonly modelVersionsRepo: IModelVersionsRepository,
    @Inject(RECOMMENDATION_CURSOR_SERVICE_TOKEN)
    private readonly cursorService: IRecommendationCursorService,
    @Inject(RECOMMENDATION_MODEL_TOKEN)
    private readonly recommendationModel: IRecommendationModel,
    @Inject(FeatureExtractorService)
    private readonly featureExtractor: FeatureExtractorService
  ) {}

  /**
   * Main recommendation dispatch pipeline with strict safety gates and graceful fallback.
   */
  async getRecommendations(
    viewerUserId: string,
    options: GetRecommendationsOptions = {}
  ): Promise<RecommendationResponseDto<any>> {
    const startTime = Date.now();
    const requestId = options.requestId || generateUuidV7();
    const mode: RecommendationMode = options.mode || 'PERSONALIZED_DISCOVERY';
    const limit = Math.max(1, Math.min(50, options.limit || 20));

    // 1. Safety Gate: Assert viewer is active and unrestricted
    await this.assertViewerEligibility(viewerUserId);

    // 2. Decode cursor if supplied
    let cursorPayload = null;
    if (options.cursor) {
      cursorPayload = this.cursorService.decode(options.cursor);
      if (cursorPayload.mode !== mode) {
        throw new BadRequestException({
          statusCode: 400,
          code: ErrorCode.RECOMMENDATION_CURSOR_INVALID,
          message: `Cursor mode mismatch: expected ${mode}, got ${cursorPayload.mode}`,
        });
      }
    }

    // 3. Resolve viewer context
    const viewerContext = await this.buildViewerContext(viewerUserId);

    // 4. Safety & Exclusions: Retrieve exclusions (blocks, restrictions, likes, passes, matches)
    const excludedUserIds = await this.exclusionProvider.getExcludedUserIds(viewerUserId);

    // 5. Candidate Universe: PostGIS + Profile Preferences + Safety Filtered Pool
    const candidatePool = await this.candidateRepo.findEligibleCandidates(
      viewerContext,
      excludedUserIds,
      250 // Bounded candidate retrieval pool
    );

    if (candidatePool.length === 0) {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
        recommendationVersion: this.recommendationModel.version,
        mode,
      };
    }

    // 6. Recommendation Scoring with Multi-Level Graceful Fallback
    let rankedCandidates: Array<{ candidate: CandidateRecord; score: number; tieBreaker: string }> =
      [];
    let activeVersion = this.recommendationModel.version;
    let fallbackUsed = false;

    try {
      // Step A: Load features & affinities for scoring
      const candidateUserIds = candidatePool.map((c) => c.userId);

      const [viewerFeaturesRow, candidateFeaturesRows, exposureCountsMap, socialAffinities] =
        await Promise.all([
          this.userFeaturesRepo.findByUserId(viewerUserId),
          this.userFeaturesRepo.findManyByUserIds(candidateUserIds),
          this.exposuresRepo.getRecentCandidateExposures(viewerUserId, candidateUserIds, 72),
          this.getSharedSocialCounts(viewerUserId, candidateUserIds),
        ]);

      const candidateFeatureMap = new Map<string, UserFeatureVector>();
      for (const row of candidateFeaturesRows) {
        candidateFeatureMap.set(row.userId, row.features as UserFeatureVector);
      }

      const viewerFeatures: UserFeatureVector =
        (viewerFeaturesRow?.features as UserFeatureVector) ||
        (await this.featureExtractor.extractFeatures(viewerUserId));

      const candidatePoolWithFeatures: CandidateWithFeatures[] = candidatePool.map((candidate) => ({
        candidate,
        features: candidateFeatureMap.get(candidate.userId) || null,
        recentExposuresCount: exposureCountsMap.get(candidate.userId) || 0,
        sharedCommunitiesCount: socialAffinities.communities.get(candidate.userId) || 0,
        sharedEventsCount: socialAffinities.events.get(candidate.userId) || 0,
      }));

      // Step B: Resolve Active Model Config
      const activeModelRow = await this.modelVersionsRepo.findActiveByMode(mode);
      const config: RecommendationRankingConfig = activeModelRow
        ? {
            version: activeModelRow.version,
            weights: activeModelRow.weights as any,
            exposurePenaltyPerCount:
              (activeModelRow.config as any)?.exposurePenaltyPerCount ?? 0.08,
            maxExposurePenalty: (activeModelRow.config as any)?.maxExposurePenalty ?? 0.4,
            explorationRate: (activeModelRow.config as any)?.explorationRate ?? 0.05,
            freshnessHalfLifeHours: (activeModelRow.config as any)?.freshnessHalfLifeHours ?? 48,
          }
        : DEFAULT_RECOMMENDATION_CONFIG;

      activeVersion = config.version;

      const recContext: RecommendationContext = {
        viewerUserId,
        viewerContext,
        viewerFeatures,
        mode,
        requestId,
        recommendationVersion: activeVersion,
        featureVersion: 'v1',
        referenceTime: new Date(),
        config,
      };

      // Step C: Execute Model Scoring
      const scoredResults = this.recommendationModel.score(recContext, candidatePoolWithFeatures);
      rankedCandidates = scoredResults.map((s) => ({
        candidate: s.candidate,
        score: s.score,
        tieBreaker: s.tieBreaker,
      }));
    } catch (err: unknown) {
      fallbackUsed = true;
      this.logger.warn(
        `[RecommendationEngine] Primary scoring failed for viewer ${viewerUserId}, falling back to Gate 06 Discovery Ranker: ${(err as Error)?.message}`
      );

      try {
        // Fallback Level 2: Deterministic Candidate Ranker from Gate 06
        const fallbackRanked = this.candidateRanker.rank(candidatePool, viewerContext);
        rankedCandidates = fallbackRanked.map((r) => ({
          candidate: r.candidate,
          score: r.score,
          tieBreaker: r.tieBreaker,
        }));
      } catch (innerErr: unknown) {
        this.logger.error(
          `[RecommendationEngine] Level 2 fallback failed for viewer ${viewerUserId}, falling back to Eligibility-Only Sort: ${(innerErr as Error)?.message}`
        );
        // Fallback Level 3: Safe Eligibility-Only Ordering
        rankedCandidates = [...candidatePool]
          .sort((a, b) => a.profileId.localeCompare(b.profileId))
          .map((c) => ({
            candidate: c,
            score: 0.5,
            tieBreaker: c.profileId,
          }));
      }
    }

    // 7. Cursor Pagination Filtering
    let paginatedRanked = rankedCandidates;
    if (cursorPayload) {
      const { lastScore, lastId } = cursorPayload;
      paginatedRanked = rankedCandidates.filter((item) => {
        if (item.score < lastScore) return true;
        if (item.score === lastScore) return item.tieBreaker.localeCompare(lastId) > 0;
        return false;
      });
    }

    // 8. Slicing with limit
    const pageItems = paginatedRanked.slice(0, limit);
    const hasMore = paginatedRanked.length > limit;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1]!;
      nextCursor = this.cursorService.encode({
        mode,
        version: activeVersion,
        lastScore: lastItem.score,
        lastId: lastItem.tieBreaker,
        timestamp: Date.now(),
      });
    }

    // 9. Format response items (ensuring NO internal scores/weights are leaked)
    const profileIds = pageItems.map((item) => item.candidate.profileId);
    const hydratedComponents = await this.candidateRepo.batchHydrateComponents(profileIds);

    const discoveryItems: DiscoveryItemDto[] = pageItems.map((item) => {
      const candidate = item.candidate;
      const components = hydratedComponents.get(candidate.profileId) || {
        interests: [],
        prompts: [],
        media: [],
      };
      return this.toDiscoveryItemDto(candidate, components);
    });

    // 10. Exposure Logging: Persist exposure records asynchronously
    const exposureRecords = pageItems.map((item, idx) => ({
      id: generateUuidV7(),
      viewerUserId,
      candidateUserId: item.candidate.userId,
      recommendationMode: mode,
      recommendationVersion: activeVersion,
      featureVersion: 'v1',
      rankPosition: idx + 1,
      score: item.score,
      requestId,
      surfacedAt: new Date(),
      metadata: { fallbackUsed },
    }));

    // Non-blocking fire-and-forget exposure recording
    this.exposuresRepo.recordBatchExposures(exposureRecords).catch((err) => {
      this.logger.error(`[RecommendationEngine] Failed to record exposures: ${err.message}`);
    });

    const duration = Date.now() - startTime;
    this.logger.log(
      `[RecommendationEngine] Generated ${discoveryItems.length} recommendations for user ${viewerUserId} (mode=${mode}, fallback=${fallbackUsed}, latency=${duration}ms)`
    );

    return {
      items: discoveryItems,
      nextCursor,
      hasMore,
      recommendationVersion: activeVersion,
      mode,
    };
  }

  /**
   * Batch query shared communities and events between viewer and candidates.
   */
  private async getSharedSocialCounts(
    viewerUserId: string,
    candidateUserIds: readonly string[]
  ): Promise<{
    communities: Map<string, number>;
    events: Map<string, number>;
  }> {
    const commMap = new Map<string, number>();
    const eventMap = new Map<string, number>();
    if (candidateUserIds.length === 0) return { communities: commMap, events: eventMap };

    const client = this.databaseService.client;

    try {
      const commRows = await client.execute(sql<{ candidateUserId: string; count: number }>`
        SELECT cm2.user_id as "candidateUserId", count(*)::int as count
        FROM community_memberships cm1
        JOIN community_memberships cm2 ON cm1.community_id = cm2.community_id
        WHERE cm1.user_id = ${viewerUserId}
          AND cm1.status = 'ACTIVE'
          AND cm2.user_id IN (${sql.join(
            candidateUserIds.map((id) => sql`${id}`),
            sql`, `
          )})
          AND cm2.status = 'ACTIVE'
        GROUP BY cm2.user_id
      `);
      for (const r of (commRows.rows || commRows) as any[]) {
        commMap.set(r.candidateUserId, Number(r.count));
      }

      const eventRows = await client.execute(sql<{ candidateUserId: string; count: number }>`
        SELECT er2.user_id as "candidateUserId", count(*)::int as count
        FROM event_rsvps er1
        JOIN event_rsvps er2 ON er1.event_id = er2.event_id
        WHERE er1.user_id = ${viewerUserId}
          AND er1.status = 'GOING'
          AND er2.user_id IN (${sql.join(
            candidateUserIds.map((id) => sql`${id}`),
            sql`, `
          )})
          AND er2.status = 'GOING'
        GROUP BY er2.user_id
      `);
      for (const r of (eventRows.rows || eventRows) as any[]) {
        eventMap.set(r.candidateUserId, Number(r.count));
      }
    } catch (err: unknown) {
      this.logger.warn(
        `[RecommendationEngine] Social affinity calculation skipped: ${(err as Error)?.message}`
      );
    }

    return { communities: commMap, events: eventMap };
  }

  private async assertViewerEligibility(viewerUserId: string): Promise<void> {
    const hasFullRestriction = await this.userRestrictionsRepo.hasActiveRestriction(
      viewerUserId,
      'FULL_ACCOUNT'
    );
    if (hasFullRestriction) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.PROFILE_RESTRICTED,
        message: 'Your account is currently restricted from viewing recommendations',
      });
    }

    const hasDiscoveryRestriction = await this.userRestrictionsRepo.hasActiveRestriction(
      viewerUserId,
      'DISCOVERY'
    );
    if (hasDiscoveryRestriction) {
      throw new ForbiddenException({
        statusCode: 403,
        code: ErrorCode.PROFILE_RESTRICTED,
        message: 'Your account is restricted from discovery and recommendations',
      });
    }
  }

  private async buildViewerContext(viewerUserId: string): Promise<DiscoveryViewerContext> {
    const profile = await this.profileRepo.findByUserId(viewerUserId);
    if (!profile) {
      throw new BadRequestException({
        code: ErrorCode.PROFILE_NOT_READY,
        message: 'Profile not found. You must create and activate a profile to discover matches.',
      });
    }

    if (profile.visibility !== 'ACTIVE') {
      throw new BadRequestException({
        code: ErrorCode.PROFILE_NOT_READY,
        message: `Profile is in ${profile.visibility} state. Your profile must be ACTIVE to discover matches.`,
      });
    }

    const preferences = await this.preferencesRepo.findByUserId(viewerUserId);
    const age = calculateAge(profile.dateOfBirth);

    const location =
      profile.latitude !== null &&
      profile.latitude !== undefined &&
      profile.longitude !== null &&
      profile.longitude !== undefined
        ? { latitude: profile.latitude, longitude: profile.longitude }
        : null;

    return {
      userId: viewerUserId,
      profileId: profile.id,
      age,
      gender: profile.gender as Gender,
      location,
      minAge: preferences?.minAge ?? 18,
      maxAge: preferences?.maxAge ?? 99,
      genderPreferences: preferences?.genderPreferences ?? ['WOMAN', 'MAN', 'NON_BINARY', 'OTHER'],
      maxDistanceKm: preferences?.maxDistanceKm ?? 50,
      relationshipIntent: preferences?.relationshipIntent ?? 'LONG_TERM',
    };
  }

  private toDiscoveryItemDto(
    candidate: CandidateRecord,
    components: HydratedProfileComponents
  ): DiscoveryItemDto {
    const publicProfile: PublicProfileResponse = {
      id: candidate.profileId,
      userId: candidate.userId,
      displayName: candidate.displayName,
      age: candidate.age,
      gender: candidate.gender,
      bio: candidate.bio,
      occupation: candidate.occupation,
      education: candidate.education,
      city: candidate.city,
      countryCode: candidate.countryCode,
      interests: components.interests,
      prompts: components.prompts,
      media: components.media,
    };

    const distanceBucket = getDistanceBucket(candidate.distanceMeters);

    return {
      profile: publicProfile,
      distanceBucket,
    };
  }
}
