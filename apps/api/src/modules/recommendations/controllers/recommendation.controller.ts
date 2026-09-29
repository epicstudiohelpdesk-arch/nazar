import { Controller, Get, Query, UseGuards, Inject, Headers } from '@nestjs/common';
import { AuthGuard, type AuthenticatedPrincipal } from '../../../common/guards/auth.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RecommendationEngineService } from '../services/recommendation-engine.service.js';
import { FeatureExtractorService } from '../features/feature-extractor.service.js';
import {
  USER_FEATURES_REPOSITORY_TOKEN,
  type IUserFeaturesRepository,
} from '../repositories/user-features.repository.interface.js';
import {
  MODEL_VERSIONS_REPOSITORY_TOKEN,
  type IModelVersionsRepository,
} from '../repositories/model-versions.repository.interface.js';
import { recommendationQuerySchema } from '@platform/validation';
import type { RecommendationMode } from '@platform/api-contracts';

@Controller('v1/recommendations')
@UseGuards(AuthGuard)
export class RecommendationController {
  constructor(
    @Inject(RecommendationEngineService)
    private readonly recommendationEngine: RecommendationEngineService,
    @Inject(FeatureExtractorService)
    private readonly featureExtractor: FeatureExtractorService,
    @Inject(USER_FEATURES_REPOSITORY_TOKEN)
    private readonly userFeaturesRepo: IUserFeaturesRepository,
    @Inject(MODEL_VERSIONS_REPOSITORY_TOKEN)
    private readonly modelVersionsRepo: IModelVersionsRepository
  ) {}

  @Get()
  async getRecommendations(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query('mode') mode?: RecommendationMode,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Headers('x-request-id') requestId?: string
  ) {
    const validated = recommendationQuerySchema.parse({
      mode,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });

    const result = await this.recommendationEngine.getRecommendations(user.userId, {
      mode: validated.mode,
      limit: validated.limit,
      cursor: validated.cursor,
      requestId,
    });

    return result;
  }

  @Get('features/me')
  async getMyFeatures(@CurrentUser() user: AuthenticatedPrincipal) {
    let featureRow = await this.userFeaturesRepo.findByUserId(user.userId);
    if (!featureRow) {
      const freshFeatures = await this.featureExtractor.extractFeatures(user.userId);
      featureRow = await this.userFeaturesRepo.upsertFeatures(user.userId, 'v1', freshFeatures);
    }

    return {
      userId: featureRow.userId,
      featureVersion: featureRow.featureVersion,
      features: featureRow.features,
      computedAt: featureRow.computedAt.toISOString(),
      updatedAt: featureRow.updatedAt.toISOString(),
    };
  }

  @Get('models')
  async listModelVersions() {
    const models = await this.modelVersionsRepo.findAll();
    return models.map((m) => ({
      id: m.id,
      version: m.version,
      name: m.name,
      mode: m.mode,
      isActive: m.isActive,
      weights: m.weights,
      config: m.config,
      rolloutPercentage: m.rolloutPercentage,
      createdAt: m.createdAt.toISOString(),
      activatedAt: m.activatedAt.toISOString(),
    }));
  }
}
