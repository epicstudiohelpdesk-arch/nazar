import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { DiscoveryModule } from '../discovery/discovery.module.js';
import { InteractionsModule } from '../interactions/interactions.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { RecommendationController } from './controllers/recommendation.controller.js';
import { UserFeaturesRepository } from './repositories/user-features.repository.js';
import { USER_FEATURES_REPOSITORY_TOKEN } from './repositories/user-features.repository.interface.js';
import { ExposuresRepository } from './repositories/exposures.repository.js';
import { EXPOSURES_REPOSITORY_TOKEN } from './repositories/exposures.repository.interface.js';
import { ModelVersionsRepository } from './repositories/model-versions.repository.js';
import { MODEL_VERSIONS_REPOSITORY_TOKEN } from './repositories/model-versions.repository.interface.js';
import { ExperimentsRepository } from './repositories/experiments.repository.js';
import { EXPERIMENTS_REPOSITORY_TOKEN } from './repositories/experiments.repository.interface.js';
import { RecommendationCursorService } from './cursor/recommendation-cursor.service.js';
import { RECOMMENDATION_CURSOR_SERVICE_TOKEN } from './cursor/recommendation-cursor.service.js';
import { DeterministicRecommendationModelV1 } from './models/deterministic-recommendation-model-v1.js';
import { RECOMMENDATION_MODEL_TOKEN } from './models/recommendation-model.interface.js';
import { FeatureExtractorService } from './features/feature-extractor.service.js';
import { RecommendationEngineService } from './services/recommendation-engine.service.js';
import { RecommendationFeatureWorker } from './workers/recommendation-feature.worker.js';

@Module({
  imports: [
    InfrastructureModule,
    AuthModule,
    ProfilesModule,
    DiscoveryModule,
    InteractionsModule,
    SafetyModule,
  ],
  controllers: [RecommendationController],
  providers: [
    UserFeaturesRepository,
    {
      provide: USER_FEATURES_REPOSITORY_TOKEN,
      useClass: UserFeaturesRepository,
    },
    ExposuresRepository,
    {
      provide: EXPOSURES_REPOSITORY_TOKEN,
      useClass: ExposuresRepository,
    },
    ModelVersionsRepository,
    {
      provide: MODEL_VERSIONS_REPOSITORY_TOKEN,
      useClass: ModelVersionsRepository,
    },
    ExperimentsRepository,
    {
      provide: EXPERIMENTS_REPOSITORY_TOKEN,
      useClass: ExperimentsRepository,
    },
    RecommendationCursorService,
    {
      provide: RECOMMENDATION_CURSOR_SERVICE_TOKEN,
      useClass: RecommendationCursorService,
    },
    DeterministicRecommendationModelV1,
    {
      provide: RECOMMENDATION_MODEL_TOKEN,
      useClass: DeterministicRecommendationModelV1,
    },
    FeatureExtractorService,
    RecommendationEngineService,
    RecommendationFeatureWorker,
  ],
  exports: [
    RecommendationEngineService,
    FeatureExtractorService,
    RecommendationFeatureWorker,
    USER_FEATURES_REPOSITORY_TOKEN,
    EXPOSURES_REPOSITORY_TOKEN,
    MODEL_VERSIONS_REPOSITORY_TOKEN,
    RECOMMENDATION_MODEL_TOKEN,
  ],
})
export class RecommendationsModule {}
