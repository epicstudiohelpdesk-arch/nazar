import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module.js';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { DiscoveryController } from './discovery.controller.js';
import { DiscoveryService } from './services/discovery.service.js';
import { CandidateRepository } from './repositories/candidate.repository.js';
import { CANDIDATE_REPOSITORY_TOKEN } from './repositories/candidate.repository.interface.js';
import { DeterministicCandidateRanker } from './ranker/deterministic-candidate-ranker.js';
import { CANDIDATE_RANKER_TOKEN } from './ranker/candidate-ranker.interface.js';
import { DiscoveryCursorService } from './cursor/discovery-cursor.service.js';
import { DISCOVERY_CURSOR_SERVICE_TOKEN } from './cursor/discovery-cursor.interface.js';
import { DefaultCandidateExclusionService } from './exclusions/default-candidate-exclusion.service.js';
import { CANDIDATE_EXCLUSION_PROVIDER_TOKEN } from './exclusions/candidate-exclusion.interface.js';

@Module({
  imports: [AppConfigModule, InfrastructureModule, AuthModule, ProfilesModule],
  controllers: [DiscoveryController],
  providers: [
    CandidateRepository,
    {
      provide: CANDIDATE_REPOSITORY_TOKEN,
      useClass: CandidateRepository,
    },
    DeterministicCandidateRanker,
    {
      provide: CANDIDATE_RANKER_TOKEN,
      useClass: DeterministicCandidateRanker,
    },
    DiscoveryCursorService,
    {
      provide: DISCOVERY_CURSOR_SERVICE_TOKEN,
      useClass: DiscoveryCursorService,
    },
    DefaultCandidateExclusionService,
    {
      provide: CANDIDATE_EXCLUSION_PROVIDER_TOKEN,
      useClass: DefaultCandidateExclusionService,
    },
    DiscoveryService,
  ],
  exports: [
    DiscoveryService,
    CANDIDATE_REPOSITORY_TOKEN,
    CANDIDATE_RANKER_TOKEN,
    DISCOVERY_CURSOR_SERVICE_TOKEN,
    CANDIDATE_EXCLUSION_PROVIDER_TOKEN,
  ],
})
export class DiscoveryModule {}
